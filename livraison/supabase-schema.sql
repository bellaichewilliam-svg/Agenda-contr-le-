-- ============================================================================
-- Base de données — à coller dans Supabase > SQL Editor > Run.
--
-- Qui peut faire quoi :
--   • Clients (anonymes) : créer une commande, voir/annuler les leurs (jeton secret).
--   • Livreurs validés : voir les courses libres, en accepter, gérer les leurs.
--   • Patron (role = 'admin') : tout voir, tout gérer, valider les livreurs.
-- ============================================================================

-- Réglages publics (disponibilité, commission)
create table if not exists public.settings (
  id          int primary key check (id = 1),
  accepting   boolean not null default true,
  message     text,
  commission  numeric not null default 3
);
insert into public.settings (id) values (1) on conflict do nothing;

-- Livreurs (un par compte Supabase Auth) — le patron a aussi sa ligne, role = 'admin'
create table if not exists public.couriers (
  id                 uuid primary key default auth.uid(),
  created_at         timestamptz not null default now(),
  role               text not null default 'coursier' check (role in ('coursier','admin')),
  status             text not null default 'en_attente' check (status in ('en_attente','actif','suspendu')),
  name               text not null,
  phone              text not null,
  bit_phone          text,
  city               text,
  vehicle            text,
  license_number     text,
  license_expiry     date,
  insurance          text,
  insurance_expiry   date,
  business_number    text,
  accepted_terms_at  timestamptz,
  lat                double precision,
  lon                double precision,
  position_at        timestamptz,
  admin_note         text
);

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  ref              text not null,
  token            uuid not null unique,
  created_at       timestamptz not null default now(),
  lang             text not null default 'fr',
  status           text not null default 'nouvelle'
                   check (status in ('nouvelle','confirmee','recuperee','livree','annulee','refusee')),
  service          text not null check (service in ('colis','retrait','achat','repas')),
  urgency          text not null check (urgency in ('asap','express','programmee')),
  pickup_at        timestamptz not null,
  from_city        text not null,
  pickup_address   text not null,
  pickup_note      text,
  pickup_place     text,
  pickup_exact     boolean not null default false,
  pickup_building  text,
  pickup_floor     text,
  pickup_apt       text,
  pickup_code      text,
  pickup_lat       double precision,
  pickup_lon       double precision,
  pickup_contact   text,
  pickup_phone     text,
  place_kind       text,
  tracking_number  text,
  parcel_name      text,
  has_proxy        boolean not null default false,
  shopping_list    text,
  budget           numeric,
  to_city          text not null,
  dropoff_address  text not null,
  dropoff_note     text,
  dropoff_place    text,
  dropoff_exact    boolean not null default false,
  dropoff_building text,
  dropoff_floor    text,
  dropoff_apt      text,
  dropoff_code     text,
  leave_at_door    boolean not null default false,
  prepaid_required boolean not null default false,
  device_id        text,
  client_ip        text,
  dropoff_lat      double precision,
  dropoff_lon      double precision,
  dropoff_contact  text,
  dropoff_phone    text,
  size             text,
  round_trip       boolean not null default false,
  extra_stops      int not null default 0,
  distance_km      numeric,
  price            numeric not null,
  promo_code       text,
  discount         numeric not null default 0,
  payment_method   text not null default 'cash' check (payment_method in ('cash','bit')),
  payer            text not null default 'moi' check (payer in ('moi','destinataire')),
  payment_status   text not null default 'en_attente' check (payment_status in ('en_attente','paye')),
  notes            text,
  company          text,
  contact_name     text not null,
  contact_phone    text not null,
  contact_email    text,
  admin_note       text,
  courier_id       uuid references public.couriers(id),
  courier_name     text,
  courier_phone    text,
  courier_bit      text,
  commission       numeric not null default 0,
  commission_status text not null default 'du' check (commission_status in ('du','regle')),
  receipt_number   int unique,
  receipt_at       timestamptz
);

-- Pour une base déjà créée avec une version précédente
alter table public.orders add column if not exists pickup_note text;
alter table public.orders add column if not exists rating smallint check (rating between 1 and 5);
alter table public.orders add column if not exists rating_tags text[];
alter table public.orders add column if not exists rating_note text;
alter table public.orders add column if not exists rated_at timestamptz;
alter table public.orders add column if not exists dropoff_note text;
alter table public.orders add column if not exists pickup_place text;
alter table public.orders add column if not exists dropoff_place text;
alter table public.orders add column if not exists pickup_exact boolean not null default false;
alter table public.orders add column if not exists dropoff_exact boolean not null default false;
alter table public.orders add column if not exists pickup_floor text;
alter table public.orders add column if not exists pickup_apt text;
alter table public.orders add column if not exists pickup_code text;
alter table public.orders add column if not exists dropoff_floor text;
alter table public.orders add column if not exists dropoff_apt text;
alter table public.orders add column if not exists dropoff_code text;
alter table public.orders add column if not exists leave_at_door boolean not null default false;
alter table public.orders add column if not exists prepaid_required boolean not null default false;
alter table public.orders add column if not exists device_id text;
alter table public.orders add column if not exists client_ip text;
alter table public.orders add column if not exists pickup_building text;
alter table public.orders add column if not exists dropoff_building text;

create index if not exists orders_pickup_at_idx on public.orders (pickup_at);
create index if not exists orders_courier_idx on public.orders (courier_id);

-- --- Reçus (קבלה) : numérotation continue, attribuée automatiquement ----------
-- Seulement pour VOS courses (pas celles des livreurs partenaires, qui
-- encaissent eux-mêmes), quand la course est livrée ET payée.
create sequence if not exists public.receipt_seq start 1;

create or replace function public.assign_receipt() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'livree' and new.payment_status = 'paye' and new.receipt_number is null
     and exists (select 1 from couriers where id = new.courier_id and role = 'admin') then
    new.receipt_number := nextval('public.receipt_seq');
    new.receipt_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists orders_receipt on public.orders;
create trigger orders_receipt before update on public.orders
  for each row execute function public.assign_receipt();

-- --- Offre de bienvenue : une seule fois par numéro, appareil ou IP -------------------
create or replace function public.norm_phone(p text) returns text
language sql immutable as $$
  select case when d like '972%' then '0' || substr(d, 4) else d end
    from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x;
$$;

create or replace function public.welcome_used(p_phone text, p_device text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from orders
    where promo_code in ('BIENVENUE', 'BRUCHIM') and status not in ('annulee', 'refusee')
      and (norm_phone(contact_phone) = norm_phone(p_phone) or (p_device is not null and device_id = p_device)));
$$;

-- À chaque nouvelle commande : on note l'IP, et on refuse une 2e offre de bienvenue
-- (même numéro, même appareil, ou même IP dans les dernières 24 h)
create or replace function public.orders_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare ip text;
begin
  begin
    ip := split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1);
  exception when others then ip := null;
  end;
  new.client_ip := nullif(trim(ip), '');
  if new.promo_code in ('BIENVENUE', 'BRUCHIM') and (
       welcome_used(new.contact_phone, new.device_id)
       or (new.client_ip is not null and exists (select 1 from orders
             where promo_code in ('BIENVENUE', 'BRUCHIM') and status not in ('annulee', 'refusee')
               and client_ip = new.client_ip and created_at > now() - interval '24 hours'))) then
    raise exception 'welcome_used';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_guard on public.orders;
create trigger orders_guard before insert on public.orders
  for each row execute function public.orders_guard();

-- --- Fonctions d'aide pour les règles ---------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from couriers where id = auth.uid() and role = 'admin' and status = 'actif');
$$;

create or replace function public.is_active_courier() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from couriers where id = auth.uid() and status = 'actif');
$$;

-- --- Règles de sécurité ------------------------------------------------------
alter table public.settings enable row level security;
alter table public.couriers enable row level security;
alter table public.orders enable row level security;

drop policy if exists "reglages publics" on public.settings;
create policy "reglages publics" on public.settings for select to anon, authenticated using (true);
drop policy if exists "reglages patron" on public.settings;
create policy "reglages patron" on public.settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Un livreur s'inscrit lui-même (en attente), voit sa fiche ; le patron gère tout.
drop policy if exists "inscription livreur" on public.couriers;
create policy "inscription livreur" on public.couriers for insert to authenticated
  with check (id = auth.uid() and role = 'coursier' and status = 'en_attente' and accepted_terms_at is not null);
drop policy if exists "fiche livreur" on public.couriers;
create policy "fiche livreur" on public.couriers for select to authenticated
  using (id = auth.uid() or public.is_admin());
drop policy if exists "patron gere livreurs" on public.couriers;
create policy "patron gere livreurs" on public.couriers for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Photo du top case (la caisse du scooter), obligatoire à l'inscription : à part, pour ne pas
-- alourdir la liste des livreurs ; le patron l'ouvre à la demande.
alter table public.couriers add column if not exists topcase_at timestamptz;
create table if not exists public.courier_photos (
  courier_id uuid primary key references public.couriers(id) on delete cascade,
  created_at timestamptz not null default now(),
  topcase    text not null check (length(topcase) <= 700000 and topcase ~ '^data:image/(jpeg|png|webp);base64,')
);
alter table public.courier_photos enable row level security;
drop policy if exists "top case envoi" on public.courier_photos;
create policy "top case envoi" on public.courier_photos for insert to authenticated with check (courier_id = auth.uid());
drop policy if exists "top case maj" on public.courier_photos;
create policy "top case maj" on public.courier_photos for update to authenticated
  using (courier_id = auth.uid()) with check (courier_id = auth.uid());
drop policy if exists "top case lecture" on public.courier_photos;
create policy "top case lecture" on public.courier_photos for select to authenticated
  using (courier_id = auth.uid() or public.is_admin());
create or replace function public.courier_photo_at() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update couriers set topcase_at = now() where id = new.courier_id;
  return new;
end;
$$;
drop trigger if exists courier_photo_at on public.courier_photos;
create trigger courier_photo_at after insert or update on public.courier_photos
  for each row execute function public.courier_photo_at();

-- Les clients créent seulement des commandes neuves, non attribuées, non payées.
drop policy if exists "clients creent" on public.orders;
create policy "clients creent" on public.orders for insert to anon
  with check (status = 'nouvelle' and (payment_status = 'en_attente' or payment_method = 'carnet') and admin_note is null
              and courier_id is null and commission = 0 and receipt_number is null);

-- Livreur validé : courses libres + les siennes. Patron : tout.
drop policy if exists "lecture courses" on public.orders;
create policy "lecture courses" on public.orders for select to authenticated
  using (public.is_admin()
         or (public.is_active_courier() and (courier_id = auth.uid() or (status = 'nouvelle' and courier_id is null))));

drop policy if exists "patron modifie" on public.orders;
create policy "patron modifie" on public.orders for update to authenticated
  using (public.is_admin()) with check (true);

-- --- Actions des livreurs (contrôlées) ----------------------------------------
-- Accepter une course libre (le premier qui accepte la prend)
create or replace function public.accept_order(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare c couriers;
begin
  select * into c from couriers where id = auth.uid() and status = 'actif';
  if not found then return false; end if;
  update orders set status = 'confirmee', courier_id = c.id, courier_name = c.name,
         courier_phone = c.phone, courier_bit = coalesce(c.bit_phone, c.phone),
         commission = case when c.role = 'admin' then 0 else (select commission from settings where id = 1) end
   where id = p_id and status = 'nouvelle' and courier_id is null;
  return found;
end;
$$;

-- Avancer sa course (récupérée, livrée), l'encaisser, ou la rendre (« je ne peux plus »)
create or replace function public.courier_update(p_id uuid, p_action text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active_courier() then return false; end if;
  if p_action = 'recuperee' then
    update orders set status = 'recuperee' where id = p_id and courier_id = auth.uid() and status = 'confirmee';
  elsif p_action = 'livree' then
    update orders set status = 'livree' where id = p_id and courier_id = auth.uid() and status = 'recuperee';
  elsif p_action = 'paye' then
    update orders set payment_status = 'paye' where id = p_id and courier_id = auth.uid();
  elsif p_action = 'liberer' then
    update orders set status = 'nouvelle', courier_id = null, courier_name = null, courier_phone = null,
           courier_bit = null, commission = 0
     where id = p_id and courier_id = auth.uid() and status = 'confirmee';
  else
    return false;
  end if;
  return found;
end;
$$;

-- Position GPS du livreur en service
create or replace function public.courier_ping(p_lat double precision, p_lon double precision) returns void
language sql security definer set search_path = public as $$
  update couriers set lat = p_lat, lon = p_lon, position_at = now() where id = auth.uid();
$$;

-- --- Fonctions pour les clients -------------------------------------------------
create or replace function public.orders_by_tokens(tokens uuid[])
returns setof public.orders
language sql security definer set search_path = public as $$
  select * from public.orders where token = any(tokens) order by pickup_at desc;
$$;

-- Suivi en direct : la commande + la position de SON livreur pendant la course
create or replace function public.track_order(p_token uuid)
returns json
language sql security definer set search_path = public as $$
  select (to_jsonb(o) - 'contact_email' - 'commission' - 'commission_status' - 'client_ip' - 'device_id' - 'hop_share' - 'network'
    || case when o.status in ('confirmee','recuperee') and c.position_at > now() - interval '30 minutes'
         then jsonb_build_object('courier_lat', c.lat, 'courier_lon', c.lon, 'courier_at', c.position_at)
         else '{}'::jsonb end)::json
  from public.orders o
  left join public.couriers c on c.id = o.courier_id
  where o.token = p_token;
$$;

create or replace function public.cancel_order(p_token uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.orders set status = 'annulee'
   where token = p_token and status = 'nouvelle';
  return found;
end;
$$;

revoke execute on function public.accept_order(uuid), public.courier_update(uuid, text),
  public.courier_ping(double precision, double precision) from public, anon;
grant execute on function public.accept_order(uuid), public.courier_update(uuid, text),
  public.courier_ping(double precision, double precision) to authenticated;
grant execute on function public.orders_by_tokens(uuid[]), public.track_order(uuid), public.cancel_order(uuid), public.welcome_used(text, text) to anon;

-- ============================================================================
-- COMMERCES PARTENAIRES ET PARRAINAGE DES LIVREURS
--   Un livreur amène un commerce (lien commerce.html?p=SONCODE). À chaque course
--   livrée au départ de ce commerce, il gagne settings.referral_bonus (1 ₪),
--   même si c'est un autre livreur qui livre, et il a quelques minutes d'avance
--   (settings.priority_minutes) pour prendre ces courses.
-- ============================================================================
alter table public.settings add column if not exists referral_bonus numeric not null default 1;
alter table public.settings add column if not exists priority_minutes int not null default 3;

alter table public.couriers add column if not exists ref_code text unique;
update public.couriers set ref_code = upper(substr(md5(random()::text || id::text), 1, 5)) where ref_code is null;

create or replace function public.courier_code() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.ref_code is null then
    loop
      new.ref_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
      exit when not exists (select 1 from couriers where ref_code = new.ref_code);
    end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists couriers_code on public.couriers;
create trigger couriers_code before insert on public.couriers
  for each row execute function public.courier_code();

create table if not exists public.shops (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  code         text not null unique,
  token        uuid not null unique default gen_random_uuid(),
  status       text not null default 'en_attente' check (status in ('en_attente','actif','suspendu')),
  name         text not null,
  kind         text,
  city         text,
  address      text,
  lat          double precision,
  lon          double precision,
  contact_name text,
  phone        text not null,
  email        text,
  lang         text not null default 'he',
  referrer_id  uuid references public.couriers(id),
  admin_note   text
);
alter table public.shops enable row level security;
drop policy if exists "commerces patron" on public.shops;
create policy "commerces patron" on public.shops for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.orders add column if not exists shop_id uuid references public.shops(id);
alter table public.orders add column if not exists shop_name text;
alter table public.orders add column if not exists referrer_id uuid references public.couriers(id);
alter table public.orders add column if not exists referral_bonus numeric not null default 0;
alter table public.orders add column if not exists referral_status text not null default 'du';
-- Qui a reçu l'argent du client : le livreur (espèces) ou HOP (Bit, payé d'avance, carnet)
alter table public.orders add column if not exists paid_to text not null default 'livreur';
-- Clé secrète du commerce, envoyée seulement pour utiliser son carnet (effacée aussitôt)
alter table public.orders add column if not exists shop_token uuid;
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check check (payment_method in ('cash','bit','carnet'));
alter table public.shops add column if not exists credits int not null default 0;
alter table public.settings add column if not exists wave_seconds int not null default 45;
alter table public.settings add column if not exists max_debt numeric not null default 50;
alter table public.settings add column if not exists carnet_unit numeric not null default 20;
alter table public.settings add column if not exists referral_active_days int not null default 21;
alter table public.settings add column if not exists deliver_radius int not null default 200;
-- Déblocages par le patron : une course (livrer sans GPS ni photo), ou un livreur (tout, jusqu'à une date)
alter table public.orders add column if not exists unlocked boolean not null default false;
alter table public.couriers add column if not exists unlocked_until timestamptz;
-- Souci signalé par le livreur pendant la course (client absent, adresse introuvable…)
alter table public.orders add column if not exists issue text;
alter table public.orders add column if not exists issue_at timestamptz;
-- En ligne / hors ligne (le livreur glisse le bouton) ; refus de course ; commission en pourcentage
alter table public.couriers add column if not exists online boolean not null default false;
alter table public.settings add column if not exists commission_pct numeric not null default 12;
alter table public.settings add column if not exists commission_min numeric not null default 3;
-- Attente sur place / achats : minutes offertes, puis supplément par tranche (plafonné), au livreur
alter table public.settings add column if not exists wait_free_min int not null default 10;
alter table public.settings add column if not exists wait_step_min int not null default 10;
alter table public.settings add column if not exists wait_step_price numeric not null default 5;
alter table public.settings add column if not exists wait_max numeric not null default 60;
alter table public.orders add column if not exists arrived_at timestamptz;
alter table public.orders add column if not exists wait_minutes int;
alter table public.orders add column if not exists wait_fee numeric(10, 2) not null default 0;
-- HOP! Pro : abonnement mensuel du commerce ; ses clients commandent dans l'appli, le commerce
-- accepte avec un temps de préparation, le livreur est envoyé pour arriver quand c'est prêt.
-- Le commerce paie une part fixe de chaque livraison (shop_share) : le client paie moins.
alter table public.shops add column if not exists plan_until date;
alter table public.settings add column if not exists pro_monthly numeric not null default 199;
alter table public.settings add column if not exists pro_shop_share numeric not null default 10;
alter table public.settings add column if not exists pro_lead_min int not null default 8;
alter table public.orders add column if not exists shop_order text check (length(shop_order) <= 1000);
alter table public.orders add column if not exists shop_status text check (shop_status in ('attente', 'acceptee', 'prete', 'refusee'));
alter table public.orders add column if not exists prep_minutes int;
alter table public.orders add column if not exists ready_at timestamptz;
alter table public.orders add column if not exists shop_share numeric(10, 2) not null default 0;
create table if not exists public.order_declines (
  order_id    uuid not null references public.orders(id) on delete cascade,
  courier_id  uuid not null references public.couriers(id),
  created_at  timestamptz not null default now(),
  primary key (order_id, courier_id)
);
create index if not exists order_declines_courier_idx on public.order_declines (courier_id);
alter table public.order_declines enable row level security;
drop policy if exists "refus patron" on public.order_declines;
create policy "refus patron" on public.order_declines for select to authenticated using (public.is_admin());

-- Commission d'une course : un pourcentage du prix, avec un minimum, arrondi au demi-shekel
create or replace function public.commission_for(p_price numeric) returns numeric
language sql stable security definer set search_path = public as $$
  select greatest(st.commission_min, round(coalesce(p_price, 0) * st.commission_pct / 100 * 2) / 2)::numeric(10, 2) from settings st where st.id = 1;
$$;

-- Livreur en ligne : bouton « en ligne » et position GPS de moins de 15 minutes
create or replace function public.courier_online(c couriers) returns boolean
language sql stable as $$
  select c.online and c.position_at > now() - interval '15 minutes';
$$;
create index if not exists orders_referrer_idx on public.orders (referrer_id);

-- Nouvelle commande : IP, offre de bienvenue, et commerce / parrain (jamais fournis par le client)
create or replace function public.orders_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare ip text; s shops;
begin
  begin
    ip := split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1);
  exception when others then ip := null;
  end;
  new.client_ip := nullif(trim(ip), '');
  if new.promo_code in ('BIENVENUE', 'BRUCHIM') and (
       welcome_used(new.contact_phone, new.device_id)
       or (new.client_ip is not null and exists (select 1 from orders
             where promo_code in ('BIENVENUE', 'BRUCHIM') and status not in ('annulee', 'refusee')
               and client_ip = new.client_ip and created_at > now() - interval '24 hours'))) then
    raise exception 'welcome_used';
  end if;
  new.shop_name := null; new.referrer_id := null; new.referral_bonus := 0; new.referral_status := 'du';
  new.rating := null; new.rating_tags := null; new.rating_note := null; new.rated_at := null;
  new.arrived_at := null; new.wait_minutes := null; new.wait_fee := 0;
  new.shop_status := null; new.prep_minutes := null; new.ready_at := null; new.shop_share := 0;
  -- Bit (et carnet, courses programmées) : toujours payé à HOP ; le livreur n'encaisse que les espèces
  new.paid_to := case when new.prepaid_required or new.payment_method in ('bit', 'carnet') then 'hop' else 'livreur' end;
  -- Carnet pro : seulement le commerce lui-même (sa clé secrète), dans Netanya, s'il lui reste des courses
  if new.payment_method = 'carnet' then
    if new.shop_id is null or new.shop_token is null or new.from_city <> 'netanya' or new.to_city <> 'netanya' then
      raise exception 'carnet_invalid';
    end if;
    update shops set credits = credits - 1 where id = new.shop_id and token = new.shop_token and credits > 0;
    if not found then raise exception 'carnet_empty'; end if;
    new.price := (select carnet_unit from settings where id = 1);
    new.payment_status := 'paye'; new.paid_to := 'hop'; new.promo_code := null; new.discount := 0;
  end if;
  new.shop_token := null;
  if new.shop_id is not null then
    select * into s from shops where id = new.shop_id and status <> 'suspendu';
    if not found then
      new.shop_id := null;
    else
      new.shop_name := s.name;
      new.referrer_id := s.referrer_id;
      -- Pas de bonus quand c'est le patron qui a amené le commerce
      if exists (select 1 from couriers where id = s.referrer_id and role = 'coursier') then
        new.referral_bonus := (select referral_bonus from settings where id = 1);
      end if;
      -- HOP! Pro : commande d'un client (abonnement en cours) → le commerce la confirme et la prépare
      if s.plan_until >= current_date and nullif(trim(new.shop_order), '') is not null and new.payment_method <> 'carnet' then
        new.shop_status := 'attente';
        new.shop_share := (select pro_shop_share from settings where id = 1);
      end if;
    end if;
  end if;
  if new.shop_status is null then new.shop_order := null; end if;
  return new;
end;
$$;

-- Le parrain a quelques minutes d'avance sur les courses de ses commerces
-- puis la course est proposée par vagues : le livreur en service le plus proche du départ
-- d'abord, le 2e plus proche après wave_seconds, tous les autres après 2 × wave_seconds.
create or replace function public.can_see_new(o orders) returns boolean
language sql stable security definer set search_path = public as $$
  with st as (select * from settings where id = 1),
  ranked as (
    select c.id, row_number() over (order by (c.lat - o.pickup_lat) ^ 2 + ((c.lon - o.pickup_lon) * cos(radians(o.pickup_lat))) ^ 2) as rk
      from couriers c
     where c.status = 'actif' and c.role = 'coursier' and c.lat is not null and o.pickup_lat is not null
       and public.courier_online(c)
       -- un livreur qui a refusé laisse sa place : la course passe tout de suite au suivant
       and not exists (select 1 from order_declines d where d.order_id = o.id and d.courier_id = c.id)
  )
  select o.status = 'nouvelle' and o.courier_id is null
     -- hors ligne ou course refusée : on ne la voit plus
     and exists (select 1 from couriers me where me.id = auth.uid() and public.courier_online(me))
     and not exists (select 1 from order_declines d where d.order_id = o.id and d.courier_id = auth.uid())
     -- HOP! Pro : proposée quand le commerce a accepté, pour arriver au moment où c'est prêt
     and (o.shop_status is null
          or (o.shop_status in ('acceptee', 'prete') and now() >= o.ready_at - make_interval(mins => (select pro_lead_min from st))))
     and (o.referrer_id = auth.uid()
          or now() >= o.created_at
               + case when o.referrer_id is not null then make_interval(mins => (select priority_minutes from st)) else interval '0' end
               -- hors service : après les livreurs en service (tout de suite s'il n'y en a aucun)
               + make_interval(secs => (select wave_seconds from st) * least(coalesce((select rk - 1 from ranked where id = auth.uid()), (select count(*) from ranked)), 2)));
$$;

-- Ce que le livreur doit à HOP (positif) ou HOP lui doit (négatif), sur les courses pas encore réglées :
-- commissions − courses payées à HOP (reversées au livreur) − part du commerce (HOP! Pro) − bonus de parrainage
create or replace function public.courier_balance(p_id uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(commission - shop_share - case when paid_to = 'hop' and payment_status = 'paye' then price else 0 end)
                     from orders where courier_id = p_id and status = 'livree' and commission_status <> 'regle'), 0)
       - coalesce((select sum(referral_bonus) from orders
                    where referrer_id = p_id and status = 'livree' and referral_status <> 'regle'), 0);
$$;
revoke execute on function public.courier_balance(uuid) from public, anon, authenticated;

drop policy if exists "lecture courses" on public.orders;
create policy "lecture courses" on public.orders for select to authenticated
  using (public.is_admin()
         or (public.is_active_courier() and (courier_id = auth.uid() or public.can_see_new(orders))));

create or replace function public.accept_order(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare c couriers;
begin
  select * into c from couriers where id = auth.uid() and status = 'actif';
  if not found then return false; end if;
  if c.role = 'coursier' and not coalesce(c.unlocked_until > now(), false) then
    -- Trop de commission en retard : plus de nouvelles courses tant que ce n'est pas réglé
    if public.courier_balance(c.id) > (select max_debt from settings where id = 1) then raise exception 'debt'; end if;
    -- Une course récupérée doit être livrée (et validée) avant d'en prendre une autre
    if exists (select 1 from orders where courier_id = c.id and status = 'recuperee') then raise exception 'busy'; end if;
  end if;
  if c.role = 'coursier' and not public.courier_online(c) then raise exception 'offline'; end if;
  update orders o set status = 'confirmee', courier_id = c.id, courier_name = c.name,
         courier_phone = c.phone, courier_bit = coalesce(c.bit_phone, c.phone),
         commission = case when c.role = 'admin' then 0 else public.commission_for(o.price + o.shop_share) end
   where o.id = p_id and (c.role = 'admin' or public.can_see_new(o)) and o.status = 'nouvelle' and o.courier_id is null;
  return found;
end;
$$;

-- Inscription d'un commerce (depuis commerce.html, sans compte)
create or replace function public.shop_signup(p jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare r shops; ref uuid; c text;
begin
  if coalesce(trim(p->>'name'), '') = '' or coalesce(trim(p->>'phone'), '') = '' then raise exception 'missing'; end if;
  -- Déjà inscrit (même téléphone, ou même nom dans la même ville) : pas de doublon, le parrain ne change pas
  if exists (select 1 from shops where norm_phone(phone) = norm_phone(p->>'phone')
               or (lower(trim(name)) = lower(trim(p->>'name')) and coalesce(city, '') = coalesce(p->>'city', ''))) then
    raise exception 'shop_exists';
  end if;
  select id into ref from couriers where ref_code = upper(trim(coalesce(p->>'ref_code', ''))) and status = 'actif';
  loop
    c := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from shops where code = c);
  end loop;
  insert into shops (code, name, kind, city, address, lat, lon, contact_name, phone, email, lang, referrer_id)
  values (c, left(trim(p->>'name'), 80), left(p->>'kind', 20), left(p->>'city', 60), left(p->>'address', 200),
          (p->>'lat')::double precision, (p->>'lon')::double precision, left(p->>'contact_name', 80),
          left(p->>'phone', 30), left(p->>'email', 120), case when p->>'lang' = 'fr' then 'fr' else 'he' end, ref)
  returning * into r;
  return json_build_object('code', r.code, 'token', r.token, 'referred', ref is not null);
end;
$$;

-- --- Vente d'un carnet pro : reçu (קבלה) numéroté dans la même suite que les courses -----
create table if not exists public.carnet_sales (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  token           uuid not null unique default gen_random_uuid(),
  shop_id         uuid not null references public.shops(id),
  courses         int not null,
  amount          numeric not null,
  payment_method  text not null default 'bit' check (payment_method in ('bit', 'cash')),
  receipt_number  int unique,
  receipt_at      timestamptz
);
create index if not exists carnet_sales_shop_idx on public.carnet_sales (shop_id);
alter table public.carnet_sales enable row level security;
drop policy if exists "carnets patron" on public.carnet_sales;
create policy "carnets patron" on public.carnet_sales for select to authenticated using (public.is_admin());

-- Le patron enregistre un carnet payé : reçu + courses ajoutées au commerce, en une fois
create or replace function public.sell_carnet(p_shop uuid, p_courses int, p_amount numeric, p_method text) returns json
language plpgsql security definer set search_path = public as $$
declare r carnet_sales;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  insert into carnet_sales (shop_id, courses, amount, payment_method, receipt_number, receipt_at)
  values (p_shop, p_courses, p_amount, case when p_method = 'cash' then 'cash' else 'bit' end, nextval('public.receipt_seq'), now())
  returning * into r;
  update shops set credits = credits + p_courses where id = p_shop;
  return json_build_object('token', r.token, 'receipt_number', r.receipt_number);
end;
$$;

-- Reçu d'un carnet (lien secret envoyé au commerce)
create or replace function public.carnet_receipt(p_token uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('receipt_number', c.receipt_number, 'receipt_at', c.receipt_at, 'amount', c.amount,
                           'courses', c.courses, 'payment_method', c.payment_method,
                           'shop_name', s.name, 'contact_name', s.contact_name, 'phone', s.phone)
    from carnet_sales c join shops s on s.id = c.shop_id where c.token = p_token;
$$;

revoke execute on function public.sell_carnet(uuid, int, numeric, text) from public, anon;
grant execute on function public.sell_carnet(uuid, int, numeric, text) to authenticated;
grant execute on function public.carnet_receipt(uuid) to anon, authenticated;

-- Infos publiques d'un commerce (pour pré-remplir le départ de la course)
create or replace function public.shop_public(p_code text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('id', id, 'code', code, 'name', name, 'kind', kind, 'city', city,
                           'address', address, 'lat', lat, 'lon', lon, 'status', status,
                           'pro', coalesce(plan_until >= current_date, false),
                           'shop_share', (select pro_shop_share from settings where id = 1))
    from shops where code = upper(p_code) and status <> 'suspendu';
$$;

-- Espace du commerce (lien secret) : sa fiche et ses dernières courses
create or replace function public.shop_dashboard(p_token uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'shop', (select to_jsonb(s) - 'referrer_id' - 'admin_note' from shops s where s.token = p_token),
    'sales', coalesce((select json_agg(json_build_object('token', c.token, 'receipt_number', c.receipt_number, 'receipt_at', c.receipt_at,
                                                         'amount', c.amount, 'courses', c.courses) order by c.receipt_at desc)
                         from carnet_sales c join shops s on s.id = c.shop_id where s.token = p_token), '[]'::json),
    'orders', coalesce((select json_agg(x order by x.pickup_at desc) from (
        select o.id, o.ref, o.token, o.status, o.created_at, o.pickup_at, o.urgency, o.price, o.payment_status,
               o.to_city, o.dropoff_address, o.dropoff_contact, o.contact_name, o.receipt_number, o.courier_name,
               o.shop_order, o.shop_status, o.prep_minutes, o.ready_at, o.shop_share, o.wait_fee, o.wait_minutes
          from orders o join shops s on s.id = o.shop_id
         where s.token = p_token order by o.pickup_at desc limit 100) x), '[]'::json));
$$;

-- Livreur : ses commerces et les courses qui lui rapportent un bonus
create or replace function public.my_shops() returns setof json
language sql stable security definer set search_path = public as $$
  select json_build_object('id', id, 'code', code, 'name', name, 'kind', kind, 'city', city,
                           'status', status, 'created_at', created_at)
    from shops where referrer_id = auth.uid() order by created_at desc;
$$;

create or replace function public.my_referral_orders() returns setof json
language sql stable security definer set search_path = public as $$
  -- « mine » : course de son commerce qu'il a livrée lui-même (commission réseau, pas de bonus)
  select json_build_object('id', id, 'shop_id', shop_id, 'pickup_at', pickup_at, 'status', status,
                           'referral_bonus', referral_bonus, 'referral_status', referral_status,
                           'mine', coalesce(courier_id = auth.uid(), false))
    from orders where referrer_id = auth.uid() order by pickup_at desc limit 2000;
$$;

-- Classement des parrains du mois (prénoms seulement)
create or replace function public.referral_leaderboard() returns setof json
language sql stable security definer set search_path = public as $$
  select json_build_object('name', split_part(c.name, ' ', 1), 'me', c.id = auth.uid(), 'shops', x.shops, 'deliveries', x.deliveries)
    from couriers c,
    lateral (select (select count(*) from shops s where s.referrer_id = c.id and s.status <> 'suspendu') as shops,
                    (select count(*) from orders o where o.referrer_id = c.id and o.status = 'livree'
                        and o.pickup_at >= date_trunc('month', now())) as deliveries) x
   where public.is_active_courier() and c.status = 'actif' and c.role = 'coursier' and (x.shops > 0 or c.id = auth.uid())
   order by x.shops desc, x.deliveries desc
   limit 10;
$$;

-- --- Argent : tout est carré --------------------------------------------------------
-- Le livreur n'encaisse jamais une course déjà payée à HOP.
-- « Livré » seulement sur place : sa position GPS (envoyée il y a moins de 3 min) doit être à
-- moins de deliver_radius mètres de l'adresse de livraison (si l'adresse est connue sur la carte).
create or replace function public.courier_update(p_id uuid, p_action text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active_courier() then return false; end if;
  if p_action = 'arrivee' then
    -- « Je suis arrivé » au départ : le compteur d'attente démarre (sur place seulement, sauf déblocage)
    if not exists (select 1 from orders o, couriers c where o.id = p_id and c.id = auth.uid()
                    and (o.unlocked or coalesce(c.unlocked_until > now(), false)))
       and exists (select 1 from orders o, couriers c, settings st
                    where o.id = p_id and c.id = auth.uid() and st.id = 1 and o.pickup_lat is not null
                      and (c.position_at is null or c.position_at < now() - interval '3 minutes'
                           or 6371000 * sqrt(radians(c.lat - o.pickup_lat) ^ 2
                                + (radians(c.lon - o.pickup_lon) * cos(radians(o.pickup_lat))) ^ 2) > st.deliver_radius * 1.5)) then
      raise exception 'too_far_pickup';
    end if;
    update orders set arrived_at = now()
     where id = p_id and courier_id = auth.uid() and status = 'confirmee' and arrived_at is null;
    if found then insert into chat_messages (thread, author, body) values ('o:' || p_id::text, 'system', 'status:arrivee'); end if;
  elsif p_action = 'recuperee' then
    -- Attente / achats au-delà des minutes offertes : supplément par tranche commencée, ajouté au prix.
    -- Course déjà payée (Bit, carnet) : le supplément reste à régler.
    -- HOP! Pro : l'attente compte à partir de l'heure annoncée par le commerce, et c'est le commerce qui la paie.
    update orders o set status = 'recuperee',
           wait_minutes = w.mins,
           wait_fee = w.fee,
           price = o.price + case when o.shop_status is null then w.fee else 0 end,
           shop_share = o.shop_share + case when o.shop_status is null then 0 else w.fee end,
           payment_status = case when w.fee > 0 and o.shop_status is null and o.payment_status = 'paye' then 'en_attente' else o.payment_status end
      from (select x.id, coalesce(floor(extract(epoch from now() - greatest(x.arrived_at, coalesce(x.ready_at, x.arrived_at))) / 60), 0)::int as mins,
                   case when x.arrived_at is null then 0
                        else least(st.wait_max, ceil(greatest(0, floor(extract(epoch from now() - greatest(x.arrived_at, coalesce(x.ready_at, x.arrived_at))) / 60) - st.wait_free_min)
                                                     / st.wait_step_min) * st.wait_step_price) end as fee
              from orders x, settings st where x.id = p_id and st.id = 1) w
     where o.id = w.id and o.courier_id = auth.uid() and o.status = 'confirmee';
  elsif p_action = 'livree' then
    -- Sauf course ou livreur débloqué par le patron
    if not exists (select 1 from orders o, couriers c where o.id = p_id and c.id = auth.uid()
                    and (o.unlocked or coalesce(c.unlocked_until > now(), false))) then
      if exists (select 1 from orders o, couriers c, settings st
                  where o.id = p_id and c.id = auth.uid() and st.id = 1 and o.dropoff_lat is not null
                    and (c.position_at is null or c.position_at < now() - interval '3 minutes'
                         or 6371000 * sqrt(radians(c.lat - o.dropoff_lat) ^ 2
                              + (radians(c.lon - o.dropoff_lon) * cos(radians(o.dropoff_lat))) ^ 2) > st.deliver_radius)) then
        raise exception 'too_far';
      end if;
      -- « Déposer devant la porte » : la photo du colis doit être envoyée dans la conversation
      if exists (select 1 from orders o where o.id = p_id and o.leave_at_door)
         and not exists (select 1 from chat_messages m where m.thread = 'o:' || p_id::text and m.author = 'courier' and m.image is not null) then
        raise exception 'photo_required';
      end if;
    end if;
    update orders set status = 'livree' where id = p_id and courier_id = auth.uid() and status = 'recuperee';
  elsif p_action = 'paye' then
    update orders set payment_status = 'paye' where id = p_id and courier_id = auth.uid() and paid_to = 'livreur';
  elsif p_action = 'liberer' then
    update orders set status = 'nouvelle', courier_id = null, courier_name = null, courier_phone = null,
           courier_bit = null, commission = 0
     where id = p_id and courier_id = auth.uid() and status = 'confirmee';
  else
    return false;
  end if;
  return found;
end;
$$;

-- Solde du livreur connecté (affiché dans son espace)
create or replace function public.my_balance() returns numeric
language sql stable security definer set search_path = public as $$
  select public.courier_balance(auth.uid());
$$;
revoke execute on function public.my_balance() from public, anon;
grant execute on function public.my_balance() to authenticated;

-- Reçus : pas pour une course de carnet (le reçu est celui de l'achat du carnet)
create or replace function public.assign_receipt() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'livree' and new.payment_status = 'paye' and new.receipt_number is null and new.payment_method <> 'carnet'
     and exists (select 1 from couriers where id = new.courier_id and role = 'admin') then
    new.receipt_number := nextval('public.receipt_seq');
    new.receipt_at := now();
  end if;
  return new;
end;
$$;

-- Bonus de parrainage : seulement tant que le parrain livre avec nous. Au moment où la course
-- est livrée, il doit avoir livré au moins une course ces referral_active_days derniers jours
-- (ou être inscrit depuis moins longtemps), sinon pas de bonus pour cette course.
create or replace function public.referrer_active(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from couriers c, settings st where st.id = 1 and c.id = p_id
                   and (c.created_at > now() - make_interval(days => st.referral_active_days)
                        or exists (select 1 from orders o where o.courier_id = p_id and o.status = 'livree'
                                     and o.pickup_at > now() - make_interval(days => st.referral_active_days))));
$$;
create or replace function public.orders_referral_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'livree' and old.status <> 'livree' and new.referral_bonus > 0
     and new.courier_id is distinct from new.referrer_id and not public.referrer_active(new.referrer_id) then
    new.referral_bonus := 0;
  end if;
  return new;
end;
$$;
drop trigger if exists orders_referral_check on public.orders;
create trigger orders_referral_check before update on public.orders
  for each row execute function public.orders_referral_check();

-- Course de carnet annulée ou refusée : la course est rendue au commerce
create or replace function public.orders_refund() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.payment_method = 'carnet' and new.status in ('annulee', 'refusee') and old.status not in ('annulee', 'refusee') then
    update shops set credits = credits + 1 where id = new.shop_id;
  end if;
  return new;
end;
$$;
drop trigger if exists orders_refund on public.orders;
create trigger orders_refund after update on public.orders
  for each row execute function public.orders_refund();

-- --- Demandes de devis (tournée quotidienne, carnet…) envoyées depuis l'application ----
create table if not exists public.requests (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  kind        text not null check (kind in ('pro', 'particulier')),
  topic       text not null default 'tournee' check (topic in ('tournee', 'carnet', 'autre')),
  name        text not null check (length(name) <= 80),
  company     text check (length(company) <= 80),
  phone       text not null check (length(phone) <= 30),
  email       text check (length(email) <= 120),
  city        text check (length(city) <= 60),
  frequency   text check (length(frequency) <= 80),
  message     text check (length(message) <= 1000),
  lang        text not null default 'fr',
  status      text not null default 'nouvelle' check (status in ('nouvelle', 'traitee')),
  admin_note  text
);
alter table public.requests enable row level security;
drop policy if exists "demandes clients" on public.requests;
create policy "demandes clients" on public.requests for insert to anon, authenticated
  with check (status = 'nouvelle' and admin_note is null);
drop policy if exists "demandes patron" on public.requests;
create policy "demandes patron" on public.requests for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.requests add column if not exists device_id text;

-- ============================================================================
-- MESSAGERIE DANS L'APPLICATION (aucun dialogue par WhatsApp)
--   o:<course>   client + livreur de la course + patron
--   u:<appareil> client ↔ patron (service client)
--   c:<livreur>  livreur ↔ patron
--   s:<commerce> commerce ↔ patron
-- Texte et photos (photo réduite, envoyée en data:image/…).
-- ============================================================================
create table if not exists public.chat_messages (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  thread       text not null check (thread ~ '^[oucs]:[0-9a-f-]{36}$'),
  author       text not null check (author in ('client', 'courier', 'admin', 'shop', 'system')),
  author_name  text check (length(author_name) <= 80),
  body         text check (length(body) <= 2000),
  image        text check (length(image) <= 700000 and image ~ '^data:image/(jpeg|png|webp);base64,'),
  check (body is not null or image is not null)
);
create index if not exists chat_thread_idx on public.chat_messages (thread, created_at);
create index if not exists chat_created_idx on public.chat_messages (created_at);
alter table public.chat_messages enable row level security;

-- Livreur : sa conversation avec le patron (même en attente de validation, pour ses documents)
-- et celles de ses courses
create or replace function public.courier_can_chat(p_thread text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from couriers where id = auth.uid())
     and (p_thread = 'c:' || auth.uid()::text
          or (public.is_active_courier() and exists (select 1 from orders o where p_thread = 'o:' || o.id::text and o.courier_id = auth.uid())));
$$;

drop policy if exists "messagerie patron" on public.chat_messages;
create policy "messagerie patron" on public.chat_messages for all to authenticated
  using (public.is_admin()) with check (public.is_admin() and author = 'admin');
drop policy if exists "messagerie livreur lecture" on public.chat_messages;
create policy "messagerie livreur lecture" on public.chat_messages for select to authenticated
  using (public.courier_can_chat(thread));
drop policy if exists "messagerie livreur envoi" on public.chat_messages;
create policy "messagerie livreur envoi" on public.chat_messages for insert to authenticated
  with check (author = 'courier' and public.courier_can_chat(thread));

-- Client : la conversation de sa course (jeton secret de la course)
create or replace function public.chat_order(p_token uuid) returns setof public.chat_messages
language sql stable security definer set search_path = public as $$
  select m.* from chat_messages m join orders o on m.thread = 'o:' || o.id::text
   where o.token = p_token order by m.created_at limit 300;
$$;
create or replace function public.chat_order_send(p_token uuid, p_body text, p_image text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into chat_messages (thread, author, author_name, body, image)
  select 'o:' || id::text, 'client', left(contact_name, 80), nullif(trim(p_body), ''), p_image from orders where token = p_token;
  return found;
end;
$$;

-- Client : service client (identifiant secret de son appareil)
create or replace function public.chat_support(p_device uuid) returns setof public.chat_messages
language sql stable security definer set search_path = public as $$
  select * from chat_messages where thread = 'u:' || p_device::text order by created_at limit 300;
$$;
create or replace function public.chat_support_send(p_device uuid, p_name text, p_body text, p_image text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into chat_messages (thread, author, author_name, body, image)
  values ('u:' || p_device::text, 'client', left(nullif(trim(p_name), ''), 80), nullif(trim(p_body), ''), p_image);
  return true;
end;
$$;

-- Commerce : sa conversation avec le patron (clé secrète du commerce)
create or replace function public.chat_shop(p_token uuid) returns setof public.chat_messages
language sql stable security definer set search_path = public as $$
  select m.* from chat_messages m join shops s on m.thread = 's:' || s.id::text
   where s.token = p_token order by m.created_at limit 300;
$$;
create or replace function public.chat_shop_send(p_token uuid, p_body text, p_image text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into chat_messages (thread, author, author_name, body, image)
  select 's:' || id::text, 'shop', left(name, 80), nullif(trim(p_body), ''), p_image from shops where token = p_token;
  return found;
end;
$$;

-- Le livreur signale un souci : noté sur la course et écrit dans sa conversation (client + patron)
create or replace function public.courier_issue(p_id uuid, p_reason text) returns boolean
language plpgsql security definer set search_path = public as $$
declare r text := left(nullif(trim(p_reason), ''), 300);
begin
  if r is null or not public.is_active_courier() then return false; end if;
  update orders set issue = r, issue_at = now()
   where id = p_id and courier_id = auth.uid() and status in ('confirmee', 'recuperee');
  if not found then return false; end if;
  insert into chat_messages (thread, author, author_name, body)
  select 'o:' || p_id::text, 'courier', name, '⚠️ ' || r from couriers where id = auth.uid();
  return true;
end;
$$;
revoke execute on function public.courier_issue(uuid, text) from public, anon;
grant execute on function public.courier_issue(uuid, text) to authenticated;

-- Demande en direct pour l'écran « Zones » des livreurs (des chiffres seulement)
create or replace function public.zone_demand() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'waiting',   (select count(*) from orders where status = 'nouvelle' and courier_id is null),
    'last_hour', (select count(*) from orders where created_at > now() - interval '1 hour' and status not in ('annulee', 'refusee')),
    'on_duty',   (select count(*) from couriers c where c.status = 'actif' and public.courier_online(c)))
  where public.is_active_courier();
$$;
revoke execute on function public.zone_demand() from public, anon;
grant execute on function public.zone_demand() to authenticated;

-- Le livreur passe en ligne / hors ligne
create or replace function public.courier_set_online(p_on boolean) returns void
language sql security definer set search_path = public as $$
  update couriers set online = p_on where id = auth.uid();
$$;
-- Refuser une course : elle passe tout de suite au livreur suivant
create or replace function public.decline_order(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active_courier() then return false; end if;
  insert into order_declines (order_id, courier_id) values (p_id, auth.uid()) on conflict do nothing;
  return true;
end;
$$;
-- Taux d'acceptation du livreur (30 derniers jours)
create or replace function public.my_acceptance() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'accepted', (select count(*) from orders where courier_id = auth.uid() and created_at > now() - interval '30 days'),
    'declined', (select count(*) from order_declines where courier_id = auth.uid() and created_at > now() - interval '30 days'));
$$;
-- Prévisions : commandes moyennes par heure, pour ce jour de la semaine (4 dernières semaines)
create or replace function public.demand_forecast() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(x.n order by x.h), '[]'::json) from (
    select h, round(count(o.id)::numeric / 4, 1) as n
      from generate_series(0, 23) h
      left join orders o on extract(hour from o.created_at at time zone 'Asia/Jerusalem') = h
        and extract(dow from o.created_at at time zone 'Asia/Jerusalem') = extract(dow from now() at time zone 'Asia/Jerusalem')
        and o.created_at > now() - interval '28 days' and o.status not in ('annulee', 'refusee')
     group by h) x
  where public.is_active_courier();
$$;
revoke execute on function public.courier_set_online(boolean), public.decline_order(uuid), public.my_acceptance(), public.demand_forecast() from public, anon;
grant execute on function public.courier_set_online(boolean), public.decline_order(uuid), public.my_acceptance(), public.demand_forecast() to authenticated;

-- Chaque étape de la course s'affiche toute seule dans sa conversation
create or replace function public.orders_chat_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('confirmee', 'recuperee', 'livree', 'refusee', 'annulee') then
    insert into chat_messages (thread, author, body) values ('o:' || new.id::text, 'system', 'status:' || new.status);
  end if;
  return new;
end;
$$;
drop trigger if exists orders_chat_status on public.orders;
create trigger orders_chat_status after update on public.orders
  for each row execute function public.orders_chat_status();

revoke execute on function public.courier_can_chat(text) from public, anon;
grant execute on function public.courier_can_chat(text) to authenticated;
grant execute on function public.chat_order(uuid), public.chat_order_send(uuid, text, text),
  public.chat_support(uuid), public.chat_support_send(uuid, text, text, text),
  public.chat_shop(uuid), public.chat_shop_send(uuid, text, text) to anon, authenticated;

-- ============================================================================
-- MESSAGES DU PATRON AUX LIVREURS (« ça vaut le coup de sortir ! »)
-- ============================================================================
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  to_courier  uuid references public.couriers(id),   -- vide = tous les livreurs
  kind        text not null default 'info',
  body        text not null
);
create table if not exists public.message_replies (
  message_id  uuid not null references public.messages(id) on delete cascade,
  courier_id  uuid not null references public.couriers(id) default auth.uid(),
  answer      text not null check (answer in ('jarrive', 'pas_dispo')),
  created_at  timestamptz not null default now(),
  primary key (message_id, courier_id)
);
alter table public.messages enable row level security;
alter table public.message_replies enable row level security;

drop policy if exists "messages patron" on public.messages;
create policy "messages patron" on public.messages for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "messages livreur" on public.messages;
create policy "messages livreur" on public.messages for select to authenticated
  using (public.is_active_courier() and (to_courier is null or to_courier = auth.uid()));

drop policy if exists "reponses lecture" on public.message_replies;
create policy "reponses lecture" on public.message_replies for select to authenticated
  using (courier_id = auth.uid() or public.is_admin());
drop policy if exists "reponses livreur" on public.message_replies;
create policy "reponses livreur" on public.message_replies for insert to authenticated
  with check (courier_id = auth.uid() and public.is_active_courier());
drop policy if exists "reponses modif" on public.message_replies;
create policy "reponses modif" on public.message_replies for update to authenticated
  using (courier_id = auth.uid()) with check (courier_id = auth.uid());

revoke execute on function public.my_shops(), public.my_referral_orders(), public.referral_leaderboard() from public, anon;
grant execute on function public.my_shops(), public.my_referral_orders(), public.referral_leaderboard() to authenticated;
grant execute on function public.shop_signup(jsonb), public.shop_public(text), public.shop_dashboard(uuid) to anon, authenticated;

-- ============================================================================
-- CLIENTS : LIVREURS AUTOUR DE SOI ET NOTE DE LA LIVRAISON
-- ============================================================================
-- Les livreurs en ligne, pour la carte de l'accueil : position arrondie (≈ 200 m),
-- sans nom ni identifiant ; « free » = pas de course en cours. Ordre stable (même livreur =
-- même place dans la liste) pour que la carte fasse glisser chaque scooter sans le mélanger.
create or replace function public.couriers_nearby() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
           'lat', round(c.lat::numeric * 500) / 500, 'lon', round(c.lon::numeric * 500) / 500,
           'free', not exists (select 1 from orders o where o.courier_id = c.id and o.status in ('confirmee', 'recuperee'))
         ) order by c.id), '[]'::json)
    from couriers c
   where c.status = 'actif' and c.lat is not null
     and (public.courier_online(c) or (c.role = 'admin' and c.position_at > now() - interval '15 minutes'));
$$;
revoke execute on function public.couriers_nearby() from public;
grant execute on function public.couriers_nearby() to anon, authenticated;

-- Annuaire des commerces partenaires (vérifiés) pour les clients : nom, type, adresse, position
create or replace function public.shops_directory() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('code', code, 'name', name, 'kind', kind, 'city', city,
           'address', address, 'lat', lat, 'lon', lon, 'pro', coalesce(plan_until >= current_date, false)) order by name), '[]'::json)
    from shops where status = 'actif';
$$;
revoke execute on function public.shops_directory() from public;
grant execute on function public.shops_directory() to anon, authenticated;

-- Le client note sa livraison (une seule fois, dans les 7 jours) avec la clé secrète de sa course.
-- Une note basse (ou un mot) arrive aussi dans la conversation de la course, chez le patron.
create or replace function public.rate_order(p_token uuid, p_stars int, p_tags text[], p_note text) returns boolean
language plpgsql security definer set search_path = public as $$
declare o orders; tags text[];
begin
  if p_stars is null or p_stars < 1 or p_stars > 5 then raise exception 'bad_rating'; end if;
  select array_agg(x) into tags from unnest(coalesce(p_tags, '{}')) x
   where x in ('fast', 'nice', 'care', 'found', 'late', 'damaged', 'rude', 'lost');
  update orders set rating = p_stars, rating_tags = tags, rating_note = left(nullif(trim(p_note), ''), 300), rated_at = now()
   where token = p_token and status = 'livree' and rating is null and pickup_at > now() - interval '7 days'
   returning * into o;
  if not found then return false; end if;
  if p_stars <= 3 or o.rating_note is not null then
    insert into chat_messages (thread, author, author_name, body)
    values ('o:' || o.id::text, 'client', o.contact_name,
            repeat('⭐', p_stars) || ' ' || p_stars || '/5'
              || coalesce(' · ' || (select string_agg(case x when 'fast' then 'Rapide' when 'nice' then 'Sympa' when 'care' then 'Soigneux'
                   when 'found' then 'Bien trouvé' when 'late' then 'En retard' when 'damaged' then 'Colis abîmé' when 'rude' then 'Pas aimable'
                   else 'Colis perdu' end, ', ') from unnest(tags) x), '')
              || coalesce(E'\n' || o.rating_note, ''));
  end if;
  return true;
end;
$$;
revoke execute on function public.rate_order(uuid, int, text[], text) from public;
grant execute on function public.rate_order(uuid, int, text[], text) to anon, authenticated;

-- HOP! Pro : le commerce accepte la commande avec un temps de préparation, la marque prête, ou la refuse
-- (avec sa clé secrète). Le client et le livreur le voient tout de suite dans la conversation.
create or replace function public.shop_order_action(p_token uuid, p_id uuid, p_action text, p_minutes int, p_reason text) returns boolean
language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  select o2.* into o from orders o2 join shops s on s.id = o2.shop_id where o2.id = p_id and s.token = p_token;
  if not found then return false; end if;
  if p_action = 'accepter' and o.shop_status = 'attente' and o.status = 'nouvelle' then
    update orders set shop_status = 'acceptee', prep_minutes = least(greatest(coalesce(p_minutes, 15), 5), 90),
           ready_at = now() + make_interval(mins => least(greatest(coalesce(p_minutes, 15), 5), 90))
     where id = p_id;
    insert into chat_messages (thread, author, body) values ('o:' || p_id::text, 'system', 'status:shop_ok');
  elsif p_action = 'prete' and o.shop_status = 'acceptee' then
    update orders set shop_status = 'prete', ready_at = least(ready_at, now()) where id = p_id;
    insert into chat_messages (thread, author, body) values ('o:' || p_id::text, 'system', 'status:prete');
  elsif p_action = 'refuser' and o.shop_status = 'attente' and o.status = 'nouvelle' then
    update orders set shop_status = 'refusee', status = 'refusee', admin_note = left(nullif(trim(p_reason), ''), 300) where id = p_id;
  else
    return false;
  end if;
  return true;
end;
$$;
revoke execute on function public.shop_order_action(uuid, uuid, text, int, text) from public;
grant execute on function public.shop_order_action(uuid, uuid, text, int, text) to anon, authenticated;

-- Fonctions internes : pas appelables depuis l'API (les déclencheurs et règles continuent de marcher)
revoke execute on function public.assign_receipt(), public.courier_photo_at(), public.orders_chat_status(),
  public.orders_guard(), public.orders_referral_check(), public.orders_refund(), public.courier_code() from public, anon, authenticated;
revoke execute on function public.referrer_active(uuid) from public, anon, authenticated;
revoke execute on function public.can_see_new(public.orders), public.commission_for(numeric),
  public.is_admin(), public.is_active_courier() from public, anon;
grant execute on function public.can_see_new(public.orders), public.commission_for(numeric),
  public.is_admin(), public.is_active_courier() to authenticated;
alter function public.norm_phone(text) set search_path = public;
alter function public.courier_online(public.couriers) set search_path = public;

-- ============================================================================
-- RÈGLES DE RÉMUNÉRATION (octobre 2026) : les livreurs qui font leur marketing gagnent plus
--   · commission 8 % (min 2 ₪) sur les courses de son réseau (commerce qu'il a amené),
--     15 % (min 3,50 ₪) sur les courses que l'appli lui apporte
--   · bonus réseau 2 ₪ par course d'un de ses commerces livrée par un autre
--   · HOP! Pro : le commerce paie 12 ₪ par livraison, dont 2 ₪ pour HOP (le client paie 15 ₪)
--   · 20 % des abonnements HOP! Pro payés, pendant 12 mois, au livreur qui a amené le commerce
--   · codes promo payés par HOP (le livreur est payé sur le prix sans réduction)
--   · pourboire : 100 % pour le livreur (payé à HOP par Bit, reversé au livreur)
-- ============================================================================
alter table public.settings add column if not exists network_pct numeric not null default 8;
alter table public.settings add column if not exists network_min numeric not null default 2;
alter table public.settings add column if not exists pro_hop_share numeric not null default 2;
alter table public.settings add column if not exists pro_referrer_pct numeric not null default 20;
alter table public.settings add column if not exists pro_referrer_months int not null default 12;
alter table public.settings alter column commission_pct set default 15;
alter table public.settings alter column commission_min set default 3.5;
alter table public.settings alter column referral_bonus set default 2;
alter table public.settings alter column pro_shop_share set default 12;
-- Passage aux nouvelles règles (seulement si les anciennes valeurs n'ont pas été changées à la main)
update public.settings set commission_pct = 15 where id = 1 and commission_pct = 12;
update public.settings set commission_min = 3.5 where id = 1 and commission_min = 3;
update public.settings set referral_bonus = 2 where id = 1 and referral_bonus = 1;
update public.settings set pro_shop_share = 12 where id = 1 and pro_shop_share = 10;

alter table public.orders add column if not exists hop_share numeric not null default 0;   -- part du commerce Pro gardée par HOP
alter table public.orders add column if not exists network boolean not null default false;  -- course du réseau du livreur
alter table public.orders add column if not exists tip numeric not null default 0;
alter table public.orders add column if not exists tip_status text check (tip_status in ('promis', 'recu', 'verse'));

-- Commission sur une course du réseau du livreur
create or replace function public.commission_network(p_price numeric) returns numeric
language sql stable security definer set search_path = public as $$
  select greatest(st.network_min, round(coalesce(p_price, 0) * st.network_pct / 100 * 2) / 2)::numeric(10, 2) from settings st where st.id = 1;
$$;
revoke execute on function public.commission_network(numeric) from public, anon;
grant execute on function public.commission_network(numeric) to authenticated;

-- Valeur de la course pour le livreur : prix payé + réduction (payée par HOP) + part du commerce − part de HOP
create or replace function public.course_value(o orders) returns numeric
language sql stable set search_path = public as $$
  select coalesce(o.price, 0) + coalesce(o.discount, 0) + coalesce(o.shop_share, 0) - coalesce(o.hop_share, 0);
$$;

-- Nouvelle commande : réduction seulement avec un code (au plus 30 ₪), part HOP du Pro, pas de pourboire
create or replace function public.orders_money_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.discount := case when new.promo_code is null then 0 else least(greatest(coalesce(new.discount, 0), 0), 30) end;
  new.hop_share := case when coalesce(new.shop_share, 0) > 0
                        then least(new.shop_share, (select pro_hop_share from settings where id = 1)) else 0 end;
  new.network := false; new.tip := 0; new.tip_status := null;
  return new;
end;
$$;
create or replace trigger orders_money_guard before insert on public.orders
  for each row execute function public.orders_money_guard();
revoke execute on function public.orders_money_guard() from public, anon, authenticated;

-- Infos publiques d'un commerce : « shop_share » = ce que le commerce enlève au prix du client (12 − 2 = 10 ₪)
create or replace function public.shop_public(p_code text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('id', id, 'code', code, 'name', name, 'kind', kind, 'city', city,
                           'address', address, 'lat', lat, 'lon', lon, 'status', status,
                           'pro', coalesce(plan_until >= current_date, false),
                           'shop_share', (select pro_shop_share - pro_hop_share from settings where id = 1))
    from shops where code = upper(p_code) and status <> 'suspendu';
$$;

-- Abonnements HOP! Pro payés : 20 % pour le livreur qui a amené le commerce, ses 12 premiers mois
create table if not exists public.plan_sales (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  shop_id          uuid not null references public.shops(id),
  months           int not null default 1,
  amount           numeric not null,
  referrer_id      uuid references public.couriers(id),
  referrer_share   numeric not null default 0,
  referrer_status  text not null default 'du' check (referrer_status in ('du', 'regle'))
);
create index if not exists plan_sales_referrer_idx on public.plan_sales (referrer_id);
alter table public.plan_sales enable row level security;
do $pol$ begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'plan_sales' and policyname = 'abonnements patron') then
    alter policy "abonnements patron" on public.plan_sales to authenticated using (public.is_admin()) with check (public.is_admin());
  else
    create policy "abonnements patron" on public.plan_sales for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $pol$;
do $pol$ begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'plan_sales' and policyname = 'abonnements parrain') then
    alter policy "abonnements parrain" on public.plan_sales to authenticated using (referrer_id = auth.uid());
  else
    create policy "abonnements parrain" on public.plan_sales for select to authenticated using (referrer_id = auth.uid());
  end if;
end $pol$;

-- Le patron prolonge HOP! Pro d'un mois (payé ou offert). Payé : la part du parrain est enregistrée.
create or replace function public.shop_plan_extend(p_shop uuid, p_paid boolean) returns json
language plpgsql security definer set search_path = public as $$
declare s shops; st settings; until date; first_paid timestamptz; share numeric := 0; ref uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into s from shops where id = p_shop for update;
  if not found then raise exception 'not_found'; end if;
  select * into st from settings where id = 1;
  until := (greatest(coalesce(s.plan_until, current_date - 1), current_date - 1) + interval '1 month')::date;
  update shops set plan_until = until where id = p_shop;
  if p_paid then
    select min(created_at) into first_paid from plan_sales where shop_id = p_shop;
    if exists (select 1 from couriers where id = s.referrer_id and role = 'coursier')
       and coalesce(first_paid, now()) > now() - make_interval(months => st.pro_referrer_months) then
      ref := s.referrer_id;
      share := round(st.pro_monthly * st.pro_referrer_pct / 100, 2);
    end if;
    insert into plan_sales (shop_id, months, amount, referrer_id, referrer_share)
    values (p_shop, 1, st.pro_monthly, ref, share);
  end if;
  return json_build_object('plan_until', until, 'referrer_share', share);
end;
$$;
revoke execute on function public.shop_plan_extend(uuid, boolean) from public, anon;
grant execute on function public.shop_plan_extend(uuid, boolean) to authenticated;

-- Le client laisse un pourboire après la livraison (une fois, dans les 7 jours) : 100 % pour le livreur
create or replace function public.tip_order(p_token uuid, p_amount numeric) returns boolean
language plpgsql security definer set search_path = public as $$
declare oid uuid;
begin
  if p_amount is null or p_amount < 1 or p_amount > 100 then raise exception 'bad_tip'; end if;
  update orders set tip = round(p_amount), tip_status = 'promis'
   where token = p_token and status = 'livree' and courier_id is not null and tip_status is null
     and pickup_at > now() - interval '7 days'
   returning id into oid;
  if oid is null then return false; end if;
  insert into chat_messages (thread, author, body) values ('o:' || oid::text, 'system', 'status:tip');
  return true;
end;
$$;
revoke execute on function public.tip_order(uuid, numeric) from public;
grant execute on function public.tip_order(uuid, numeric) to anon, authenticated;

-- Ce que le livreur doit à HOP (positif) ou HOP lui doit (négatif) :
--   courses pas réglées : commission − part du commerce pour lui − réduction payée par HOP − course payée à HOP
--   − pourboires reçus par HOP − bonus réseau − part des abonnements Pro
create or replace function public.courier_balance(p_id uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(commission - (shop_share - hop_share) - discount
                              - case when paid_to = 'hop' and payment_status = 'paye' then price else 0 end)
                     from orders where courier_id = p_id and status = 'livree' and commission_status <> 'regle'), 0)
       - coalesce((select sum(tip) from orders where courier_id = p_id and tip_status = 'recu'), 0)
       -- (une course de son réseau qu'il livre lui-même : pas de bonus, il a déjà la commission réseau)
       - coalesce((select sum(referral_bonus) from orders
                    where referrer_id = p_id and courier_id is distinct from p_id and status = 'livree' and referral_status <> 'regle'), 0)
       - coalesce((select sum(referrer_share) from plan_sales where referrer_id = p_id and referrer_status <> 'regle'), 0);
$$;
revoke execute on function public.courier_balance(uuid) from public, anon, authenticated;

-- Accepter une course : commission « réseau » si la course vient d'un commerce qu'il a amené
create or replace function public.accept_order(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare c couriers;
begin
  select * into c from couriers where id = auth.uid() and status = 'actif';
  if not found then return false; end if;
  if c.role = 'coursier' and not coalesce(c.unlocked_until > now(), false) then
    -- Trop de commission en retard : plus de nouvelles courses tant que ce n'est pas réglé
    if public.courier_balance(c.id) > (select max_debt from settings where id = 1) then raise exception 'debt'; end if;
    -- Une course récupérée doit être livrée (et validée) avant d'en prendre une autre
    if exists (select 1 from orders where courier_id = c.id and status = 'recuperee') then raise exception 'busy'; end if;
  end if;
  if c.role = 'coursier' and not public.courier_online(c) then raise exception 'offline'; end if;
  update orders o set status = 'confirmee', courier_id = c.id, courier_name = c.name,
         courier_phone = c.phone, courier_bit = coalesce(c.bit_phone, c.phone),
         network = coalesce(o.referrer_id = c.id, false),
         commission = case when c.role = 'admin' then 0
                           when o.referrer_id = c.id then public.commission_network(public.course_value(o))
                           else public.commission_for(public.course_value(o)) end
   where o.id = p_id and (c.role = 'admin' or public.can_see_new(o)) and o.status = 'nouvelle' and o.courier_id is null;
  return found;
end;
$$;

-- Livreur : ses abonnements Pro (part qui lui revient)
create or replace function public.my_plan_shares() returns setof json
language sql stable security definer set search_path = public as $$
  select json_build_object('created_at', p.created_at, 'shop', s.name, 'share', p.referrer_share, 'status', p.referrer_status)
    from plan_sales p join shops s on s.id = p.shop_id
   where p.referrer_id = auth.uid() and p.referrer_share > 0 order by p.created_at desc limit 200;
$$;
revoke execute on function public.my_plan_shares() from public, anon;
grant execute on function public.my_plan_shares() to authenticated;

-- Type de lieu (maison, appartement, bureau, commerce) et conditions de livraison d'objets acceptées
alter table public.orders add column if not exists pickup_kind text check (pickup_kind in ('maison', 'appartement', 'bureau', 'commerce'));
alter table public.orders add column if not exists dropoff_kind text check (dropoff_kind in ('maison', 'appartement', 'bureau', 'commerce'));
alter table public.orders add column if not exists rules_accepted_at timestamptz;

-- ============================================================================
-- REFUS DE COURSES : on demande pourquoi, et après decline_streak_max refus d'affilée
-- (refus ou pas de réponse), le livreur passe hors ligne tout seul. Il repasse en ligne quand il veut.
-- ============================================================================
alter table public.order_declines add column if not exists reason text
  check (reason in ('loin', 'prix', 'taille', 'occupe', 'fin', 'autre', 'sans_reponse'));
alter table public.couriers add column if not exists decline_streak int not null default 0;
alter table public.couriers add column if not exists auto_offline_at timestamptz;
alter table public.settings add column if not exists decline_streak_max int not null default 3;

-- Passer en ligne (en revenant d'hors ligne) remet le compteur de refus à zéro
create or replace function public.courier_set_online(p_on boolean) returns void
language sql security definer set search_path = public as $$
  update couriers set decline_streak = case when p_on and not online then 0 else decline_streak end,
         online = p_on
   where id = auth.uid();
$$;

-- Refuser une course (avec la raison) : elle passe au livreur suivant. Trop de refus d'affilée : hors ligne.
create or replace function public.decline_offer(p_id uuid, p_reason text) returns json
language plpgsql security definer set search_path = public as $$
declare c couriers; mx int; r text := case when p_reason in ('loin', 'prix', 'taille', 'occupe', 'fin', 'autre', 'sans_reponse') then p_reason else 'autre' end;
begin
  select * into c from couriers where id = auth.uid() and status = 'actif';
  if not found then return json_build_object('ok', false); end if;
  insert into order_declines (order_id, courier_id, reason) values (p_id, c.id, r) on conflict do nothing;
  if not found then return json_build_object('ok', true, 'streak', c.decline_streak, 'offline', false); end if;
  if c.role = 'admin' then return json_build_object('ok', true, 'streak', 0, 'offline', false); end if;
  select decline_streak_max into mx from settings where id = 1;
  update couriers set decline_streak = decline_streak + 1 where id = c.id returning * into c;
  if c.decline_streak >= mx then
    update couriers set online = false, decline_streak = 0, auto_offline_at = now() where id = c.id;
    insert into chat_messages (thread, author, body) values ('c:' || c.id::text, 'system', 'status:autooff');
    return json_build_object('ok', true, 'streak', mx, 'offline', true, 'max', mx);
  end if;
  return json_build_object('ok', true, 'streak', c.decline_streak, 'offline', false, 'max', mx);
end;
$$;
revoke execute on function public.decline_offer(uuid, text) from public, anon;
grant execute on function public.decline_offer(uuid, text) to authenticated;

-- Une course acceptée remet le compteur de refus à zéro
create or replace function public.orders_reset_streak() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.courier_id is not null and new.courier_id is distinct from old.courier_id then
    update couriers set decline_streak = 0 where id = new.courier_id and decline_streak <> 0;
  end if;
  return new;
end;
$$;
create or replace trigger orders_reset_streak after update on public.orders
  for each row execute function public.orders_reset_streak();
revoke execute on function public.orders_reset_streak() from public, anon, authenticated;

-- ============================================================================
-- N° DE COMMANDE DU COMMERCE (3 chiffres) : écrit sur le sac, le livreur prend le bon
-- Obligatoire quand le commerce accepte une commande HOP! Pro.
-- ============================================================================
alter table public.orders add column if not exists shop_ref text check (shop_ref ~ '^[0-9]{3}$');
-- Arrêts en plus (adresse, quoi faire, sur le chemin ou non) et achats réservés aux 18 ans et plus
alter table public.orders add column if not exists stops jsonb;
alter table public.orders add column if not exists adult_items text check (adult_items in ('tabac', 'alcool', 'tabac,alcool'));

create or replace function public.orders_money_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.discount := case when new.promo_code is null then 0 else least(greatest(coalesce(new.discount, 0), 0), 30) end;
  new.hop_share := case when coalesce(new.shop_share, 0) > 0
                        then least(new.shop_share, (select pro_hop_share from settings where id = 1)) else 0 end;
  new.network := false; new.tip := 0; new.tip_status := null;
  -- N° de commande du commerce (3 chiffres), seulement pour une course au départ d'un commerce
  new.shop_ref := case when new.shop_id is not null and new.shop_ref ~ '^[0-9]{3}$' then new.shop_ref end;
  -- Alcool : la loi interdit la vente entre 23 h et 6 h
  if new.adult_items like '%alcool%' and (extract(hour from new.pickup_at at time zone 'Asia/Jerusalem') >= 23
                                          or extract(hour from new.pickup_at at time zone 'Asia/Jerusalem') < 6) then
    raise exception 'alcohol_hours';
  end if;
  return new;
end;
$$;

create or replace function public.shop_dashboard(p_token uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'shop', (select to_jsonb(s) - 'referrer_id' - 'admin_note' from shops s where s.token = p_token),
    'sales', coalesce((select json_agg(json_build_object('token', c.token, 'receipt_number', c.receipt_number, 'receipt_at', c.receipt_at,
                                                         'amount', c.amount, 'courses', c.courses) order by c.receipt_at desc)
                         from carnet_sales c join shops s on s.id = c.shop_id where s.token = p_token), '[]'::json),
    'orders', coalesce((select json_agg(x order by x.pickup_at desc) from (
        select o.id, o.ref, o.token, o.status, o.created_at, o.pickup_at, o.urgency, o.price, o.payment_status,
               o.to_city, o.dropoff_address, o.dropoff_contact, o.contact_name, o.receipt_number, o.courier_name,
               o.shop_order, o.shop_status, o.prep_minutes, o.ready_at, o.shop_share, o.wait_fee, o.wait_minutes, o.shop_ref
          from orders o join shops s on s.id = o.shop_id
         where s.token = p_token order by o.pickup_at desc limit 100) x), '[]'::json));
$$;

create or replace function public.shop_order_action(p_token uuid, p_id uuid, p_action text, p_minutes int, p_reason text, p_ref text) returns boolean
language plpgsql security definer set search_path = public as $$
declare o orders; v_ref text := nullif(trim(coalesce(p_ref, '')), '');
begin
  select o2.* into o from orders o2 join shops s on s.id = o2.shop_id where o2.id = p_id and s.token = p_token;
  if not found then return false; end if;
  if p_action = 'accepter' and o.shop_status = 'attente' and o.status = 'nouvelle' then
    if v_ref is null or v_ref !~ '^[0-9]{3}$' then raise exception 'shop_ref_required'; end if;
    update orders set shop_status = 'acceptee', shop_ref = v_ref, prep_minutes = least(greatest(coalesce(p_minutes, 15), 5), 90),
           ready_at = now() + make_interval(mins => least(greatest(coalesce(p_minutes, 15), 5), 90))
     where id = p_id;
    insert into chat_messages (thread, author, body) values ('o:' || p_id::text, 'system', 'status:shop_ok');
  elsif p_action = 'prete' and o.shop_status = 'acceptee' then
    update orders set shop_status = 'prete', ready_at = least(ready_at, now()) where id = p_id;
    insert into chat_messages (thread, author, body) values ('o:' || p_id::text, 'system', 'status:prete');
  elsif p_action = 'refuser' and o.shop_status = 'attente' and o.status = 'nouvelle' then
    update orders set shop_status = 'refusee', status = 'refusee', admin_note = left(nullif(trim(p_reason), ''), 300) where id = p_id;
  else
    return false;
  end if;
  return true;
end;
$$;
revoke execute on function public.shop_order_action(uuid, uuid, text, int, text, text) from public;
grant execute on function public.shop_order_action(uuid, uuid, text, int, text, text) to anon, authenticated;
-- Ancienne version (sans numéro) : une acceptation demande maintenant le numéro
create or replace function public.shop_order_action(p_token uuid, p_id uuid, p_action text, p_minutes int, p_reason text) returns boolean
language sql security definer set search_path = public as $$
  select public.shop_order_action(p_token, p_id, p_action, p_minutes, p_reason, null::text);
$$;

-- ============================================================================
-- EN SERVICE : on reste en ligne en passant sur Waze. La position peut dater de duty_grace_min minutes
-- (le téléphone coupe le GPS quand HOP! n'est pas à l'écran) ; « Terminer le service » met hors ligne
-- tout de suite, le patron compris.
-- ============================================================================
alter table public.settings add column if not exists duty_grace_min int not null default 60;
create or replace function public.courier_online(c couriers) returns boolean
language sql stable set search_path = public as $$
  select c.online and c.position_at > now() - make_interval(mins => coalesce((select duty_grace_min from settings where id = 1), 60));
$$;
create or replace function public.couriers_nearby() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
           'lat', round(c.lat::numeric * 500) / 500, 'lon', round(c.lon::numeric * 500) / 500,
           'free', not exists (select 1 from orders o where o.courier_id = c.id and o.status in ('confirmee', 'recuperee'))
         ) order by c.id), '[]'::json)
    from couriers c
   where c.status = 'actif' and c.lat is not null and public.courier_online(c);
$$;
revoke execute on function public.couriers_nearby() from public;
grant execute on function public.couriers_nearby() to anon, authenticated;

-- ============================================================================
-- ENVOI AUTOMATIQUE DES REÇUS PAR MAIL : voir livraison/email/README-mail.md
-- (Database > Webhooks > orders, UPDATE → votre script Google Apps Script)
-- ============================================================================

-- ============================================================================
-- APRÈS avoir créé VOTRE compte (Authentication > Users > Add user), lancez
-- une seule fois, en remplaçant l'email, le nom et le téléphone :
--
-- insert into public.couriers (id, role, status, name, phone, bit_phone, accepted_terms_at)
-- select id, 'admin', 'actif', 'Mon nom', '050-000-0000', '050-000-0000', now()
--   from auth.users where email = 'mon-email@exemple.com';
-- ============================================================================
