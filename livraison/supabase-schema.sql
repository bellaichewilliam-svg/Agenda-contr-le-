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

-- Partenariat commerce ↔ livreur : seulement dans la ville du livreur
create or replace function public.shop_signup(p jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare r shops; ref uuid; ref_city text; other_city text; c text;
begin
  if coalesce(trim(p->>'name'), '') = '' or coalesce(trim(p->>'phone'), '') = '' then raise exception 'missing'; end if;
  -- Déjà inscrit (même téléphone, ou même nom dans la même ville) : pas de doublon, le parrain ne change pas
  if exists (select 1 from shops where norm_phone(phone) = norm_phone(p->>'phone')
               or (lower(trim(name)) = lower(trim(p->>'name')) and coalesce(city, '') = coalesce(p->>'city', ''))) then
    raise exception 'shop_exists';
  end if;
  select id, city into ref, ref_city from couriers where ref_code = upper(trim(coalesce(p->>'ref_code', ''))) and status = 'actif';
  -- Partenariat seulement dans la ville du livreur (pour assurer les livraisons) ; sinon inscrit sans parrain
  if ref is not null and ref_city is not null and coalesce(p->>'city', '') <> ref_city then
    other_city := ref_city; ref := null;
  end if;
  loop
    c := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from shops where code = c);
  end loop;
  insert into shops (code, name, kind, city, address, lat, lon, contact_name, phone, email, lang, referrer_id)
  values (c, left(trim(p->>'name'), 80), left(p->>'kind', 20), left(p->>'city', 60), left(p->>'address', 200),
          (p->>'lat')::double precision, (p->>'lon')::double precision, left(p->>'contact_name', 80),
          left(p->>'phone', 30), left(p->>'email', 120), case when p->>'lang' = 'fr' then 'fr' else 'he' end, ref)
  returning * into r;
  return json_build_object('code', r.code, 'token', r.token, 'referred', ref is not null, 'ref_other_city', other_city);
end;
$$;

-- Le client paie par Bit tout de suite et touche « J'ai payé » : le patron vérifie son Bit puis valide
alter table public.orders add column if not exists client_paid_at timestamptz;
create or replace function public.orders_client_paid_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  new.client_paid_at := null;
  return new;
end;
$$;
create or replace trigger orders_client_paid_guard before insert on public.orders
  for each row execute function public.orders_client_paid_guard();
create or replace function public.order_client_paid(p_token uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare oid uuid;
begin
  update orders set client_paid_at = now()
   where token = p_token and payment_method = 'bit' and payment_status = 'en_attente' and client_paid_at is null
     and status not in ('annulee', 'refusee')
   returning id into oid;
  if oid is null then return false; end if;
  insert into chat_messages (thread, author, body) values ('o:' || oid::text, 'system', 'status:client_paid');
  return true;
end;
$$;
revoke execute on function public.order_client_paid(uuid) from public;
grant execute on function public.order_client_paid(uuid) to anon, authenticated;

-- ============================================================================
-- MOYEN DE PAIEMENT CHANGÉ PAR LE CLIENT (il s'est trompé) : espèces ↔ Bit, tant que rien n'est payé
-- Bit → payé à HOP (le livreur n'encaisse rien) ; espèces → au livreur. Le livreur est prévenu.
-- ============================================================================
create or replace function public.order_set_payment(p_token uuid, p_method text) returns boolean
language plpgsql security definer set search_path = public as $$
declare oid uuid;
begin
  if p_method not in ('cash', 'bit') then raise exception 'bad_method'; end if;
  update orders set payment_method = p_method, paid_to = case when p_method = 'bit' then 'hop' else 'livreur' end,
         client_paid_at = null
   where token = p_token and payment_method in ('cash', 'bit') and payment_method <> p_method
     and payment_status = 'en_attente' and status in ('nouvelle', 'confirmee', 'recuperee')
     and not (p_method = 'cash' and prepaid_required)
   returning id into oid;
  if oid is null then return false; end if;
  insert into chat_messages (thread, author, body) values ('o:' || oid::text, 'system', 'status:pay_' || p_method);
  return true;
end;
$$;
revoke execute on function public.order_set_payment(uuid, text) from public;
grant execute on function public.order_set_payment(uuid, text) to anon, authenticated;

-- ============================================================================
-- NOTIFICATIONS PUSH : elles arrivent même quand HOP! est fermé (Android, et iPhone avec HOP! sur l'écran d'accueil)
-- Le téléphone s'abonne (push_subscribe) ; à chaque nouvelle commande ou message, la base appelle la
-- fonction hop-push (supabase/functions/hop-push) qui envoie la notification. Les clés sont dans
-- push_config, illisible depuis l'application (voir README : « Notifications push »).
-- ============================================================================
do $$ begin
  create extension if not exists pg_net with schema extensions;
exception when others then raise notice 'pg_net indisponible : pas de notifications push';
end $$;

create table if not exists public.push_subs (
  endpoint    text primary key check (endpoint ~ '^https://'),
  courier_id  uuid not null references public.couriers(id) on delete cascade,
  p256dh      text not null check (length(p256dh) <= 200),
  auth        text not null check (length(auth) <= 100),
  created_at  timestamptz not null default now()
);
alter table public.push_subs enable row level security;
revoke all on public.push_subs from anon, authenticated;

create table if not exists public.push_config (
  id            int primary key default 1 check (id = 1),
  function_url  text, hook_key text, site_url text,
  vapid_public  text, vapid_private text, vapid_subject text
);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from couriers where id = auth.uid()) then return false; end if;
  insert into push_subs (endpoint, courier_id, p256dh, auth) values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update set courier_id = excluded.courier_id, p256dh = excluded.p256dh, auth = excluded.auth;
  return true;
end;
$$;
revoke execute on function public.push_subscribe(text, text, text) from public, anon;
grant execute on function public.push_subscribe(text, text, text) to authenticated;

-- Appel de la fonction d'envoi (sans jamais bloquer la commande ou le message si l'envoi échoue)
create or replace function public.push_call(p_body jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare cfg push_config;
begin
  select * into cfg from push_config where id = 1;
  if cfg.function_url is null or cfg.hook_key is null then return; end if;
  perform net.http_post(url := cfg.function_url, body := p_body,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hop-key', cfg.hook_key));
exception when others then return;
end;
$$;
revoke execute on function public.push_call(jsonb) from public, anon, authenticated;

create or replace function public.push_order_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare ev text;
begin
  if tg_op = 'INSERT' then ev := 'new';
  elsif new.shop_status = 'acceptee' and old.shop_status is distinct from 'acceptee' then ev := 'shop_ok';
  elsif new.status = 'nouvelle' and old.status <> 'nouvelle' then ev := 'again';
  else return new; end if;
  perform public.push_call(jsonb_build_object('order_id', new.id, 'event', ev));
  return new;
end;
$$;
create or replace trigger orders_push after insert or update of status, shop_status on public.orders
  for each row execute function public.push_order_event();

create or replace function public.push_chat_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.author = 'system' and new.body is distinct from 'status:client_paid' then return new; end if;
  perform public.push_call(jsonb_build_object('thread', new.thread, 'author', new.author,
    'author_name', new.author_name, 'body', new.body));
  return new;
end;
$$;
create or replace trigger chat_push after insert on public.chat_messages
  for each row execute function public.push_chat_event();

-- ============================================================================
-- COMMANDE PASSÉE PAR TÉLÉPHONE chez une enseigne qui n'est pas sur HOP! : le client donne l'heure où
-- ce sera prêt et le nom de la commande ; la course n'est proposée aux livreurs que pro_lead_min minutes
-- avant, pour qu'ils arrivent quand c'est prêt (pas avant). L'attente compte à partir de l'heure « prête »
-- (10 min offertes, puis payée par le client). La commande doit être déjà payée au commerce.
-- ============================================================================
alter table public.orders add column if not exists phone_order boolean not null default false;
alter table public.orders add column if not exists pickup_name text check (length(pickup_name) <= 60);
alter table public.orders add column if not exists phone_ref text check (length(phone_ref) <= 20);
alter table public.orders add column if not exists phone_ready_at timestamptz;
alter table public.orders add column if not exists phone_paid boolean not null default false;
alter table public.orders add column if not exists ready_push_at timestamptz;

-- Après orders_guard (ordre alphabétique des déclencheurs) : contrôle et heure « prête »
create or replace function public.orders_phone_order() returns trigger
language plpgsql set search_path = public as $$
declare ready timestamptz;
begin
  new.ready_push_at := null;
  if not coalesce(new.phone_order, false) or new.shop_id is not null or new.service = 'achat' then
    new.phone_order := false; new.pickup_name := null; new.phone_ref := null; new.phone_ready_at := null; new.phone_paid := false;
    return new;
  end if;
  if nullif(trim(coalesce(new.pickup_name, '')), '') is null then raise exception 'phone_name_required'; end if;
  if not coalesce(new.phone_paid, false) then raise exception 'phone_unpaid'; end if;
  ready := least(greatest(coalesce(new.phone_ready_at, now()), now()), now() + interval '3 hours');
  new.pickup_name := left(trim(new.pickup_name), 60);
  new.phone_ref := left(nullif(trim(coalesce(new.phone_ref, '')), ''), 20);
  new.phone_ready_at := ready;
  new.ready_at := ready;
  new.pickup_at := greatest(new.pickup_at, ready);
  return new;
end;
$$;
create or replace trigger orders_phone_order before insert on public.orders
  for each row execute function public.orders_phone_order();

-- Quand la course devient visible pour les livreurs (commande HOP! Pro acceptée ou commande par téléphone :
-- pro_lead_min minutes avant l'heure « prête » ; sinon tout de suite)
create or replace function public.offer_from(o orders) returns timestamptz
language sql stable set search_path = public as $$
  select case when o.shop_status is not null or o.phone_order
              then greatest(o.created_at, o.ready_at - make_interval(mins => coalesce((select pro_lead_min from settings where id = 1), 8)))
              else o.created_at end;
$$;

create or replace function public.can_see_new(o orders) returns boolean
language sql stable security definer set search_path = public as $$
  with st as (select * from settings where id = 1),
  ranked as (
    select c.id, row_number() over (order by (c.lat - o.pickup_lat) ^ 2 + ((c.lon - o.pickup_lon) * cos(radians(o.pickup_lat))) ^ 2) as rk
      from couriers c
     where c.status = 'actif' and c.role = 'coursier' and c.lat is not null and o.pickup_lat is not null
       and public.courier_online(c)
       and not exists (select 1 from order_declines d where d.order_id = o.id and d.courier_id = c.id)
  )
  select o.status = 'nouvelle' and o.courier_id is null
     and exists (select 1 from couriers me where me.id = auth.uid() and public.courier_online(me))
     and not exists (select 1 from order_declines d where d.order_id = o.id and d.courier_id = auth.uid())
     -- HOP! Pro : quand le commerce a accepté ; Pro et téléphone : pour arriver au moment où c'est prêt
     and (o.shop_status is null or o.shop_status in ('acceptee', 'prete'))
     and now() >= public.offer_from(o)
     and (o.referrer_id = auth.uid()
          or now() >= public.offer_from(o)
               + case when o.referrer_id is not null then make_interval(mins => (select priority_minutes from st)) else interval '0' end
               + make_interval(secs => (select wave_seconds from st) * least(coalesce((select rk - 1 from ranked where id = auth.uid()), (select count(*) from ranked)), 2)));
$$;

-- Notification push « nouvelle course » aux livreurs quand une course retardée devient visible (chaque minute)
create or replace function public.push_ready_orders() returns int
language plpgsql security definer set search_path = public as $$
declare o record; n int := 0;
begin
  for o in select id from orders
            where status = 'nouvelle' and courier_id is null and ready_push_at is null
              and (phone_order or shop_status in ('acceptee', 'prete'))
              and now() >= public.offer_from(orders) and created_at < now() - interval '1 minute'
  loop
    update orders set ready_push_at = now() where id = o.id;
    perform public.push_call(jsonb_build_object('order_id', o.id, 'event', 'ready'));
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.push_ready_orders() from public, anon, authenticated;
do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('hop-push-ready', '* * * * *', 'select public.push_ready_orders()');
exception when others then raise notice 'pg_cron indisponible : pas de rappel des courses prêtes';
end $$;

-- ============================================================================
-- MESSAGE AUX CLIENTS (promo, annonce) : le patron l'envoie dans la conversation « service client » de
-- chaque client qui a commandé sur les p_days derniers jours (un message par téléphone)
-- ============================================================================
create or replace function public.admin_broadcast_clients(p_body text, p_days int) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if nullif(trim(coalesce(p_body, '')), '') is null then raise exception 'empty'; end if;
  insert into chat_messages (thread, author, author_name, body)
  select 'u:' || d.device_id, 'admin', 'HOP!', left(trim(p_body), 2000)
    from (select distinct device_id from orders
           where device_id ~ '^[0-9a-f-]{36}$'
             and created_at > now() - make_interval(days => least(greatest(coalesce(p_days, 365), 1), 730))) d;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.admin_broadcast_clients(text, int) from public, anon;
grant execute on function public.admin_broadcast_clients(text, int) to authenticated;

-- ============================================================================
-- CATALOGUE DES COMMERCES HOP! Pro : catégories et produits (nom, prix, photo, disponible ou épuisé).
-- Le commerce le gère dans son espace (clé secrète) ; le client choisit ses articles, la base recalcule
-- les prix et écrit la liste à préparer. Les articles se paient directement au commerce.
-- ============================================================================
create table if not exists public.shop_categories (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 40),
  position    int not null default 0,
  created_at  timestamptz not null default now()
);
create table if not exists public.shop_products (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops(id) on delete cascade,
  category_id  uuid references public.shop_categories(id) on delete set null,
  name         text not null check (length(trim(name)) between 1 and 80),
  description  text check (length(description) <= 300),
  price        numeric(8,2) not null check (price >= 0 and price <= 5000),
  photo        text check (length(photo) <= 300000 and photo ~ '^data:image/(jpeg|png|webp);base64,'),
  available    boolean not null default true,
  position     int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists shop_categories_shop_idx on public.shop_categories (shop_id, position);
create index if not exists shop_products_shop_idx on public.shop_products (shop_id, position);
alter table public.shop_categories enable row level security;
alter table public.shop_products enable row level security;
revoke all on public.shop_categories, public.shop_products from anon, authenticated;

alter table public.orders add column if not exists items jsonb;
alter table public.orders add column if not exists items_total numeric(10,2);

-- Catalogue d'un commerce Pro actif (pour ses clients)
create or replace function public.shop_catalog(p_code text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'categories', coalesce((select json_agg(json_build_object('id', c.id, 'name', c.name) order by c.position, c.created_at)
                              from shop_categories c where c.shop_id = s.id), '[]'::json),
    'products', coalesce((select json_agg(json_build_object('id', p.id, 'category_id', p.category_id, 'name', p.name,
                              'description', p.description, 'price', p.price, 'photo', p.photo, 'available', p.available)
                              order by p.position, p.created_at)
                            from shop_products p where p.shop_id = s.id), '[]'::json))
    from shops s
   where s.code = upper(trim(p_code)) and s.status = 'actif' and s.plan_until >= current_date;
$$;
-- Le même, pour le commerce lui-même (sa clé), même avant activation
create or replace function public.shop_catalog_mine(p_token uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'categories', coalesce((select json_agg(json_build_object('id', c.id, 'name', c.name, 'position', c.position) order by c.position, c.created_at)
                              from shop_categories c where c.shop_id = s.id), '[]'::json),
    'products', coalesce((select json_agg(json_build_object('id', p.id, 'category_id', p.category_id, 'name', p.name,
                              'description', p.description, 'price', p.price, 'photo', p.photo, 'available', p.available, 'position', p.position)
                              order by p.position, p.created_at)
                            from shop_products p where p.shop_id = s.id), '[]'::json))
    from shops s where s.token = p_token;
$$;

create or replace function public.shop_category_save(p_token uuid, p_id uuid, p_name text, p_position int) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid; cid uuid;
begin
  select id into sid from shops where token = p_token;
  if sid is null then raise exception 'forbidden'; end if;
  if p_id is null then
    if (select count(*) from shop_categories where shop_id = sid) >= 30 then raise exception 'too_many'; end if;
    insert into shop_categories (shop_id, name, position) values (sid, left(trim(p_name), 40), coalesce(p_position, 0)) returning id into cid;
  else
    update shop_categories set name = left(trim(p_name), 40), position = coalesce(p_position, position)
     where id = p_id and shop_id = sid returning id into cid;
  end if;
  return cid;
end;
$$;
create or replace function public.shop_category_delete(p_token uuid, p_id uuid) returns boolean
language sql security definer set search_path = public as $$
  with d as (delete from shop_categories c using shops s where c.id = p_id and c.shop_id = s.id and s.token = p_token returning c.id)
  select exists (select 1 from d);
$$;
-- p_photo : null = garder la photo, '' = l'enlever
create or replace function public.shop_product_save(p_token uuid, p_id uuid, p_category uuid, p_name text, p_description text,
  p_price numeric, p_photo text, p_available boolean, p_position int) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid; pid uuid; cat uuid;
begin
  select id into sid from shops where token = p_token;
  if sid is null then raise exception 'forbidden'; end if;
  select id into cat from shop_categories where id = p_category and shop_id = sid;
  if p_id is null then
    if (select count(*) from shop_products where shop_id = sid) >= 300 then raise exception 'too_many'; end if;
    insert into shop_products (shop_id, category_id, name, description, price, photo, available, position)
    values (sid, cat, left(trim(p_name), 80), left(nullif(trim(coalesce(p_description, '')), ''), 300), round(p_price, 2),
            nullif(p_photo, ''), coalesce(p_available, true), coalesce(p_position, 0))
    returning id into pid;
  else
    update shop_products set category_id = cat, name = left(trim(p_name), 80),
           description = left(nullif(trim(coalesce(p_description, '')), ''), 300), price = round(p_price, 2),
           photo = case when p_photo is null then photo else nullif(p_photo, '') end,
           available = coalesce(p_available, available), position = coalesce(p_position, position)
     where id = p_id and shop_id = sid returning id into pid;
  end if;
  return pid;
end;
$$;
create or replace function public.shop_product_available(p_token uuid, p_id uuid, p_available boolean) returns boolean
language sql security definer set search_path = public as $$
  with u as (update shop_products p set available = p_available from shops s
              where p.id = p_id and p.shop_id = s.id and s.token = p_token returning p.id)
  select exists (select 1 from u);
$$;
create or replace function public.shop_product_delete(p_token uuid, p_id uuid) returns boolean
language sql security definer set search_path = public as $$
  with d as (delete from shop_products p using shops s where p.id = p_id and p.shop_id = s.id and s.token = p_token returning p.id)
  select exists (select 1 from d);
$$;
revoke execute on function public.shop_catalog(text), public.shop_catalog_mine(uuid), public.shop_category_save(uuid, uuid, text, int),
  public.shop_category_delete(uuid, uuid), public.shop_product_save(uuid, uuid, uuid, text, text, numeric, text, boolean, int),
  public.shop_product_available(uuid, uuid, boolean), public.shop_product_delete(uuid, uuid) from public;
grant execute on function public.shop_catalog(text), public.shop_catalog_mine(uuid), public.shop_category_save(uuid, uuid, text, int),
  public.shop_category_delete(uuid, uuid), public.shop_product_save(uuid, uuid, uuid, text, text, numeric, text, boolean, int),
  public.shop_product_available(uuid, uuid, boolean), public.shop_product_delete(uuid, uuid) to anon, authenticated;

-- Articles choisis par le client : prix et noms repris du catalogue (jamais ceux envoyés), produits
-- disponibles seulement ; la liste à préparer est écrite dans shop_order (+ la précision du client)
create or replace function public.orders_items() returns trigger
language plpgsql security definer set search_path = public as $$
declare list jsonb; total numeric; lines text; note text;
begin
  if new.items is null or jsonb_typeof(new.items) <> 'array' or new.shop_id is null or new.shop_order is null then
    new.items := null; new.items_total := null; return new;
  end if;
  select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'price', p.price, 'qty', q.qty) order by q.ord),
         sum(p.price * q.qty),
         string_agg(q.qty || ' × ' || p.name, E'\n' order by q.ord)
    into list, total, lines
    from (select (x->>'id')::uuid as id, least(greatest(coalesce((x->>'qty')::int, 1), 1), 50) as qty, ord
            from jsonb_array_elements(new.items) with ordinality as t(x, ord)
           where (x->>'id') ~ '^[0-9a-f-]{36}$' limit 40) q
    join shop_products p on p.id = q.id and p.shop_id = new.shop_id and p.available;
  if list is null then new.items := null; new.items_total := null; return new; end if;
  note := nullif(trim(coalesce(new.items_note, '')), '');
  new.items := list; new.items_total := total;
  new.shop_order := left(lines || coalesce(E'\n💬 ' || note, ''), 1000);
  return new;
end;
$$;
alter table public.orders add column if not exists items_note text check (length(items_note) <= 300);
create or replace trigger orders_items before insert on public.orders
  for each row execute function public.orders_items();

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
               o.shop_order, o.shop_status, o.prep_minutes, o.ready_at, o.shop_share, o.wait_fee, o.wait_minutes, o.shop_ref,
               o.items, o.items_total, o.items_note
          from orders o join shops s on s.id = o.shop_id
         where s.token = p_token order by o.pickup_at desc limit 100) x), '[]'::json));
$$;

-- ============================================================================
-- « J'ACHÈTE POUR VOUS » SANS AVANCE : le client règle le magasin lui-même (paiement par téléphone, Bit du
-- magasin, déjà payé en ligne). Le livreur n'avance jamais d'argent ; la commande est refusée sinon.
-- ============================================================================
alter table public.orders add column if not exists goods_self_pay boolean not null default false;

create or replace function public.orders_goods_pay() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.service = 'achat' then
    if not coalesce(new.goods_self_pay, false) then raise exception 'goods_pay_required'; end if;
  else
    new.goods_self_pay := false;
  end if;
  return new;
end;
$$;
create or replace trigger orders_goods_pay before insert on public.orders
  for each row execute function public.orders_goods_pay();

-- ============================================================================
-- RÉCUPÉRER UN COLIS (poste, Super-Pharm, point relais, casier) : le client donne TOUT avant.
-- N° du colis, nom sur le colis (ou code du casier), photos (avis/SMS, carte d'identité, procuration
-- signée, rendez-vous à la poste) et l'heure du rendez-vous à la poste (obligatoire : sans rendez-vous,
-- la poste ne remet rien). La course n'est proposée aux livreurs qu'après « ✅ Documents OK » du patron ;
-- seuls le patron et le livreur de la course voient les photos, effacées quelques jours après.
-- ============================================================================
alter table public.orders add column if not exists docs_status text check (docs_status in ('a_verifier', 'ok', 'refuse'));
alter table public.orders add column if not exists docs_note text check (length(docs_note) <= 300);
alter table public.orders add column if not exists appt_at timestamptz;
alter table public.orders add column if not exists retrait_code text check (length(retrait_code) <= 30);

create table if not exists public.order_docs (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  kind        text not null check (kind in ('avis', 'identite', 'procuration', 'rdv', 'ordonnance', 'etiquette')),
  photo       text not null check (length(photo) <= 400000 and photo ~ '^data:image/(jpeg|png|webp);base64,'),
  created_at  timestamptz not null default now()
);
create index if not exists order_docs_order_idx on public.order_docs (order_id, created_at);
alter table public.order_docs enable row level security;
revoke all on public.order_docs from anon, authenticated;

-- Les documents demandés selon le lieu
create or replace function public.retrait_docs_needed(p_place text) returns text[]
language sql immutable as $$
  select case p_place when 'poste' then array['avis', 'identite', 'procuration', 'rdv']
                      when 'locker' then array['avis']
                      else array['avis', 'identite'] end;
$$;

-- Les documents demandés pour une course : colis à récupérer (selon le lieu), médicament sur ordonnance
-- (carte d'identité du patient + ordonnance), dépôt d'un colis à la poste (rendez-vous + étiquette payée)
alter table public.orders add column if not exists rx boolean not null default false;
alter table public.orders add column if not exists post_send boolean not null default false;
create or replace function public.order_docs_needed(o orders) returns text[]
language sql immutable as $$
  select case when o.service = 'retrait' then public.retrait_docs_needed(o.place_kind)
              when o.service = 'achat' and o.rx then array['identite', 'ordonnance']
              when o.service = 'colis' and o.post_send then array['rdv', 'etiquette']
              else '{}'::text[] end;
$$;

-- Contrôle à l'envoi (après les autres déclencheurs : ordre alphabétique) ; à la poste, la course est à l'heure du rendez-vous
create or replace function public.orders_retrait() returns trigger
language plpgsql set search_path = public as $$
begin
  -- Autres services : documents et rendez-vous gérés par orders_special (ordonnance, envoi à la poste)
  if new.service is distinct from 'retrait' then
    new.retrait_code := null;
    return new;
  end if;
  if coalesce(new.place_kind, '') not in ('poste', 'superpharm', 'relais', 'locker', 'autre') then raise exception 'retrait_place'; end if;
  if nullif(trim(coalesce(new.tracking_number, '')), '') is null then raise exception 'retrait_tracking'; end if;
  if new.place_kind = 'locker' then
    if nullif(trim(coalesce(new.retrait_code, '')), '') is null then raise exception 'retrait_code'; end if;
  else
    new.retrait_code := null;
    if nullif(trim(coalesce(new.parcel_name, '')), '') is null then raise exception 'retrait_name'; end if;
  end if;
  if new.place_kind = 'poste' then
    if new.appt_at is null or new.appt_at < now() - interval '15 minutes' or new.appt_at > now() + interval '30 days' then raise exception 'retrait_appt'; end if;
    new.pickup_at := new.appt_at;
  else
    new.appt_at := null;
  end if;
  new.docs_status := 'a_verifier';
  new.docs_note := null;
  return new;
end;
$$;
create or replace trigger orders_retrait before insert on public.orders
  for each row execute function public.orders_retrait();

-- Le client ajoute ses photos (avec le jeton secret de sa course), tant que les documents ne sont pas validés
create or replace function public.order_doc_add(p_token uuid, p_kind text, p_photo text) returns boolean
language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  select * into o from orders where token = p_token;
  if o.id is null or o.docs_status is null or o.status <> 'nouvelle' or o.docs_status = 'ok' then return false; end if;
  if not (p_kind = any (public.order_docs_needed(o))) then return false; end if;
  if (select count(*) from order_docs where order_id = o.id) >= 12 then raise exception 'too_many'; end if;
  insert into order_docs (order_id, kind, photo) values (o.id, p_kind, p_photo);
  -- Le patron avait demandé un document : il revient à vérifier, et le patron est prévenu
  if o.docs_status = 'refuse' then
    update orders set docs_status = 'a_verifier' where id = o.id;
    insert into chat_messages (thread, author, author_name, body)
    values ('o:' || o.id::text, 'client', left(o.contact_name, 80), '📄 Document ajouté · מסמך נוסף');
  end if;
  return true;
end;
$$;
-- Ce que le client a déjà envoyé (sans les photos)
create or replace function public.order_docs_sent(p_token uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct d.kind), '{}') from order_docs d join orders o on o.id = d.order_id where o.token = p_token;
$$;
-- Les photos : le patron, et le livreur de la course pendant la course
create or replace function public.order_docs(p_order uuid) returns table (kind text, photo text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select d.kind, d.photo, d.created_at from order_docs d join orders o on o.id = d.order_id
   where d.order_id = p_order
     and (public.is_admin() or (o.courier_id = auth.uid() and o.status in ('confirmee', 'recuperee')))
   order by d.created_at;
$$;
-- Le patron valide (la course part aux livreurs) ou demande ce qui manque (message au client)
create or replace function public.admin_docs_verdict(p_order uuid, p_ok boolean, p_note text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update orders set docs_status = case when p_ok then 'ok' else 'refuse' end,
                    docs_note = case when p_ok then null else left(nullif(trim(coalesce(p_note, '')), ''), 300) end
   where id = p_order and docs_status is not null and status = 'nouvelle';
  if not found then return false; end if;
  insert into chat_messages (thread, author, author_name, body)
  values ('o:' || p_order::text, 'admin', 'HOP!',
          case when p_ok then '✅ Documents vérifiés : nous envoyons un livreur. · המסמכים אושרו: אנחנו שולחים שליח.'
               else '📄 Il manque : ' || coalesce(nullif(trim(coalesce(p_note, '')), ''), '…')
                    || ' — ajoutez-le depuis le suivi de votre course. · חסר מסמך: הוסיפו אותו מדף המעקב.' end);
  return true;
end;
$$;
revoke execute on function public.order_doc_add(uuid, text, text), public.order_docs_sent(uuid), public.order_docs(uuid),
  public.admin_docs_verdict(uuid, boolean, text) from public;
grant execute on function public.order_doc_add(uuid, text, text), public.order_docs_sent(uuid) to anon, authenticated;
grant execute on function public.order_docs(uuid), public.admin_docs_verdict(uuid, boolean, text) to authenticated;

-- Quand la course devient visible : à la poste, 40 min avant le rendez-vous (et toujours après « Documents OK »)
create or replace function public.offer_from(o orders) returns timestamptz
language sql stable set search_path = public as $$
  select case when o.appt_at is not null then greatest(o.created_at, o.appt_at - interval '40 minutes')
              when o.shop_status is not null or o.phone_order
              then greatest(o.created_at, o.ready_at - make_interval(mins => coalesce((select pro_lead_min from settings where id = 1), 8)))
              else o.created_at end;
$$;

create or replace function public.can_see_new(o orders) returns boolean
language sql stable security definer set search_path = public as $$
  with st as (select * from settings where id = 1),
  ranked as (
    select c.id, row_number() over (order by (c.lat - o.pickup_lat) ^ 2 + ((c.lon - o.pickup_lon) * cos(radians(o.pickup_lat))) ^ 2) as rk
      from couriers c
     where c.status = 'actif' and c.role = 'coursier' and c.lat is not null and o.pickup_lat is not null
       and public.courier_online(c)
       and not exists (select 1 from order_declines d where d.order_id = o.id and d.courier_id = c.id)
  )
  select o.status = 'nouvelle' and o.courier_id is null
     and exists (select 1 from couriers me where me.id = auth.uid() and public.courier_online(me))
     and not exists (select 1 from order_declines d where d.order_id = o.id and d.courier_id = auth.uid())
     -- HOP! Pro : quand le commerce a accepté ; Pro et téléphone : pour arriver au moment où c'est prêt
     and (o.shop_status is null or o.shop_status in ('acceptee', 'prete'))
     -- Colis à récupérer : seulement quand le patron a vérifié les documents
     and coalesce(o.docs_status, 'ok') = 'ok'
     and now() >= public.offer_from(o)
     and (o.referrer_id = auth.uid()
          or now() >= public.offer_from(o)
               + case when o.referrer_id is not null then make_interval(mins => (select priority_minutes from st)) else interval '0' end
               + make_interval(secs => (select wave_seconds from st) * least(coalesce((select rk - 1 from ranked where id = auth.uid()), (select count(*) from ranked)), 2)));
$$;

-- Notification « nouvelle course » quand une course retardée devient visible (Pro, téléphone, rendez-vous à la poste)
create or replace function public.push_ready_orders() returns int
language plpgsql security definer set search_path = public as $$
declare o record; n int := 0;
begin
  for o in select id from orders
            where status = 'nouvelle' and courier_id is null and ready_push_at is null
              and (phone_order or shop_status in ('acceptee', 'prete') or (appt_at is not null and docs_status = 'ok'))
              and now() >= public.offer_from(orders) and created_at < now() - interval '1 minute'
  loop
    update orders set ready_push_at = now() where id = o.id;
    perform public.push_call(jsonb_build_object('order_id', o.id, 'event', 'ready'));
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.push_ready_orders() from public, anon, authenticated;

-- Push : « Documents OK » envoie la course aux livreurs en service
create or replace function public.push_order_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare ev text;
begin
  if tg_op = 'INSERT' then ev := 'new';
  elsif new.shop_status = 'acceptee' and old.shop_status is distinct from 'acceptee' then ev := 'shop_ok';
  elsif new.docs_status = 'ok' and old.docs_status is distinct from 'ok' then ev := 'docs_ok';
  elsif new.status = 'nouvelle' and old.status <> 'nouvelle' then ev := 'again';
  else return new; end if;
  perform public.push_call(jsonb_build_object('order_id', new.id, 'event', ev));
  return new;
end;
$$;
create or replace trigger orders_push after insert or update of status, shop_status, docs_status on public.orders
  for each row execute function public.push_order_event();

-- Les photos des documents sont effacées 3 jours après la fin de la course
create or replace function public.purge_order_docs() returns int
language sql security definer set search_path = public as $$
  with d as (delete from order_docs x using orders o
              where o.id = x.order_id and o.status in ('livree', 'annulee', 'refusee') and x.created_at < now() - interval '3 days'
              returning x.id)
  select count(*)::int from d;
$$;
revoke execute on function public.purge_order_docs() from public, anon, authenticated;
do $$ begin
  perform cron.schedule('hop-purge-docs', '17 3 * * *', 'select public.purge_order_docs()');
exception when others then raise notice 'pg_cron indisponible : effacer les documents à la main';
end $$;

-- ============================================================================
-- BON SENS À LA COMMANDE : sans contact, le livreur doit pouvoir arriver jusqu'à la porte (type de lieu,
-- code d'entrée sauf maison, n° d'appartement) ; courses : tout doit tenir dans le top case du scooter.
-- ============================================================================
alter table public.orders add column if not exists fits_topcase boolean not null default false;
create or replace function public.orders_door_topcase() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.service = 'achat' then
    if not coalesce(new.fits_topcase, false) then raise exception 'topcase_required'; end if;
  else
    new.fits_topcase := false;
  end if;
  if coalesce(new.leave_at_door, false) then
    if new.dropoff_kind is null then raise exception 'door_kind'; end if;
    if (new.dropoff_kind <> 'maison' and nullif(trim(coalesce(new.dropoff_code, '')), '') is null)
       or (new.dropoff_kind = 'appartement' and nullif(trim(coalesce(new.dropoff_apt, '')), '') is null) then
      raise exception 'door_code';
    end if;
  end if;
  return new;
end;
$$;
create or replace trigger orders_door_topcase before insert on public.orders
  for each row execute function public.orders_door_topcase();

-- ============================================================================
-- VITRINE DES COMMERCES HOP! Pro : logo, photo de couverture et phrase d'accroche (le commerce les met
-- dans son espace). Les commerces abonnés sont mis en avant sur l'accueil (« Nos partenaires »).
-- ============================================================================
alter table public.shops add column if not exists logo text check (length(logo) <= 160000 and logo ~ '^data:image/(jpeg|png|webp);base64,');
alter table public.shops add column if not exists cover text check (length(cover) <= 300000 and cover ~ '^data:image/(jpeg|png|webp);base64,');
alter table public.shops add column if not exists tagline text check (length(tagline) <= 90);

-- p_logo / p_cover : null = garder, '' = enlever
create or replace function public.shop_brand_save(p_token uuid, p_logo text, p_cover text, p_tagline text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update shops set logo = case when p_logo is null then logo else nullif(p_logo, '') end,
                   cover = case when p_cover is null then cover else nullif(p_cover, '') end,
                   tagline = left(nullif(trim(coalesce(p_tagline, '')), ''), 90)
   where token = p_token;
  return found;
end;
$$;
-- Les commerces HOP! Pro actifs, pour l'accueil des clients
create or replace function public.shops_showcase() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('code', s.code, 'name', s.name, 'kind', s.kind, 'city', s.city, 'logo', s.logo, 'cover', s.cover,
           'tagline', s.tagline, 'products', (select count(*) from shop_products p where p.shop_id = s.id and p.available))
           order by (s.cover is not null) desc, (s.logo is not null) desc, s.name), '[]'::json)
    from shops s where s.status = 'actif' and s.plan_until >= current_date;
$$;
create or replace function public.shop_public(p_code text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('id', id, 'code', code, 'name', name, 'kind', kind, 'city', city,
                           'address', address, 'lat', lat, 'lon', lon, 'status', status,
                           'pro', coalesce(plan_until >= current_date, false),
                           'logo', logo, 'cover', cover, 'tagline', tagline,
                           'shop_share', (select pro_shop_share - pro_hop_share from settings where id = 1))
    from shops where code = upper(p_code) and status <> 'suspendu';
$$;
revoke execute on function public.shop_brand_save(uuid, text, text, text), public.shops_showcase() from public;
grant execute on function public.shop_brand_save(uuid, text, text, text), public.shops_showcase() to anon, authenticated;

-- ============================================================================
-- CAS PARTICULIERS, chacun avec sa justification avant d'envoyer un livreur :
-- - médicament sur ordonnance (« J'achète pour vous ») : carte d'identité du patient + ordonnance (photos) ;
-- - dépôt d'un colis à la poste : rendez-vous + étiquette déjà payée (photos), pas d'avance du livreur ;
-- - vente entre particuliers (Yad2, Marketplace) : l'acheteur a déjà payé le vendeur ;
-- - clés ou objet de valeur : code de remise à 4 chiffres, demandé au destinataire avant « Livré ».
-- ============================================================================
alter table public.orders add column if not exists p2p_sale boolean not null default false;
alter table public.orders add column if not exists sale_paid boolean not null default false;
alter table public.orders add column if not exists handoff boolean not null default false;
alter table public.orders add column if not exists handoff_ok_at timestamptz;
-- Le code de remise : lu seulement par le client (suivi) ; le livreur le vérifie sans le voir
create table if not exists public.order_secrets (
  order_id      uuid primary key references public.orders(id) on delete cascade,
  handoff_code  text not null,
  tries         int not null default 0
);
alter table public.order_secrets enable row level security;
revoke all on public.order_secrets from anon, authenticated;

create or replace function public.orders_special() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.service is distinct from 'achat' then new.rx := false; end if;
  if new.service is distinct from 'colis' then new.post_send := false; new.p2p_sale := false; end if;
  if not coalesce(new.p2p_sale, false) then new.sale_paid := false;
  elsif not coalesce(new.sale_paid, false) then raise exception 'sale_unpaid'; end if;
  if new.post_send then
    if new.appt_at is null or new.appt_at < now() - interval '15 minutes' or new.appt_at > now() + interval '30 days' then raise exception 'post_appt'; end if;
    new.pickup_at := greatest(now(), new.appt_at - interval '30 minutes');
  elsif new.service is distinct from 'retrait' then
    new.appt_at := null;
  end if;
  if new.service is distinct from 'retrait' then
    if new.rx or new.post_send then new.docs_status := 'a_verifier'; else new.docs_status := null; end if;
    new.docs_note := null;
  end if;
  new.handoff_ok_at := null;
  return new;
end;
$$;
create or replace trigger orders_special before insert on public.orders
  for each row execute function public.orders_special();

create or replace function public.orders_handoff_code() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.handoff then
    insert into order_secrets (order_id, handoff_code) values (new.id, lpad(floor(random() * 10000)::int::text, 4, '0'))
    on conflict (order_id) do nothing;
  end if;
  return new;
end;
$$;
create or replace trigger orders_handoff_code after insert on public.orders
  for each row execute function public.orders_handoff_code();

-- Le livreur tape le code donné par le destinataire (5 essais au plus)
create or replace function public.courier_handoff(p_id uuid, p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare x order_secrets;
begin
  if not public.is_active_courier() then return false; end if;
  if not exists (select 1 from orders where id = p_id and courier_id = auth.uid() and status = 'recuperee' and handoff) then return false; end if;
  update order_secrets set tries = tries + 1 where order_id = p_id returning * into x;
  if x.order_id is null then return false; end if;
  if x.tries > 5 then raise exception 'too_many_tries'; end if;
  if trim(coalesce(p_code, '')) <> x.handoff_code then return false; end if;
  update orders set handoff_ok_at = now() where id = p_id;
  return true;
end;
$$;
revoke execute on function public.courier_handoff(uuid, text) from public, anon;
grant execute on function public.courier_handoff(uuid, text) to authenticated;

create or replace function public.track_order(p_token uuid)
returns json
language sql security definer set search_path = public as $$
  select (to_jsonb(o) - 'contact_email' - 'commission' - 'commission_status' - 'client_ip' - 'device_id' - 'hop_share' - 'network'
    || case when o.status in ('confirmee','recuperee') and c.position_at > now() - interval '30 minutes'
         then jsonb_build_object('courier_lat', c.lat, 'courier_lon', c.lon, 'courier_at', c.position_at)
         else '{}'::jsonb end
    || jsonb_build_object('handoff_code', (select x.handoff_code from order_secrets x where x.order_id = o.id)))::json
  from public.orders o
  left join public.couriers c on c.id = o.courier_id
  where o.token = p_token;
$$;

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
      -- Clés ou objet de valeur : le destinataire a donné le bon code de remise
      if exists (select 1 from orders o where o.id = p_id and o.handoff and o.handoff_ok_at is null) then
        raise exception 'handoff_required';
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

-- ============================================================================
-- COURSE PAS FAITE / PAS REÇUE : le patron est prévenu, et la course est retenue au livreur.
-- - Le client signale « pas reçu » (48 h après « Livré ») : message et notification au patron.
-- - Courses en retard (personne ne l'a prise, pas récupérée, pas livrée) : notification au patron.
-- - Le patron décide : « Classer » (livrée) ou « 💸 Retenue » (prix de la course + valeur de la commande, ou
--   le montant qu'il fixe) : elle est déduite du versement de la semaine du livreur, qui est prévenu et peut
--   répondre avec ses preuves. Les livreurs l'acceptent dans leurs engagements.
-- ============================================================================
alter table public.orders add column if not exists delivered_at timestamptz;
alter table public.orders add column if not exists claim_status text check (claim_status in ('ouverte', 'classee', 'retenue'));
alter table public.orders add column if not exists claim_note text check (length(claim_note) <= 300);
alter table public.orders add column if not exists claim_at timestamptz;
alter table public.orders add column if not exists late_alert text;

create or replace function public.orders_delivered_at() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'livree' and old.status is distinct from 'livree' then new.delivered_at := now(); end if;
  return new;
end;
$$;
create or replace trigger orders_delivered_at before update of status on public.orders
  for each row execute function public.orders_delivered_at();

create table if not exists public.courier_penalties (
  id          uuid primary key default gen_random_uuid(),
  courier_id  uuid not null references public.couriers(id) on delete cascade,
  order_id    uuid references public.orders(id) on delete set null,
  order_ref   text,
  amount      numeric(10,2) not null check (amount > 0 and amount <= 5000),
  reason      text not null check (length(reason) between 1 and 300),
  status      text not null default 'du' check (status in ('du', 'regle', 'annulee')),
  created_at  timestamptz not null default now(),
  settled_at  timestamptz
);
create index if not exists courier_penalties_courier_idx on public.courier_penalties (courier_id, created_at);
alter table public.courier_penalties enable row level security;
revoke all on public.courier_penalties from anon, authenticated;

-- Le client : « Je n'ai pas reçu ma commande » (jeton secret de la course)
create or replace function public.order_claim(p_token uuid, p_note text) returns boolean
language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  select * into o from orders where token = p_token;
  if o.id is null or o.status <> 'livree' or o.claim_status is not null
     or coalesce(o.delivered_at, o.pickup_at) < now() - interval '48 hours' then return false; end if;
  update orders set claim_status = 'ouverte', claim_note = left(nullif(trim(coalesce(p_note, '')), ''), 300), claim_at = now() where id = o.id;
  insert into chat_messages (thread, author, author_name, body)
  values ('o:' || o.id::text, 'client', left(o.contact_name, 80),
          '⚠️ Commande pas reçue · ההזמנה לא הגיעה' || coalesce(' : ' || nullif(trim(coalesce(p_note, '')), ''), ''));
  return true;
end;
$$;
-- Le patron : retenue au livreur (déduite de son versement de la semaine), avec message au livreur
create or replace function public.admin_penalty_add(p_courier uuid, p_order uuid, p_amount numeric, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid; ref text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 5000 then raise exception 'bad_amount'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'reason_required'; end if;
  select o.ref into ref from orders o where o.id = p_order;
  insert into courier_penalties (courier_id, order_id, order_ref, amount, reason)
  values (p_courier, p_order, ref, round(p_amount, 2), left(trim(p_reason), 300)) returning id into pid;
  if p_order is not null then update orders set claim_status = 'retenue' where id = p_order and claim_status = 'ouverte'; end if;
  insert into chat_messages (thread, author, author_name, body)
  values ('c:' || p_courier::text, 'admin', 'HOP!',
          '💸 Retenue de ' || round(p_amount, 2) || ' ₪' || coalesce(' · course n° ' || ref, '') || ' : ' || left(trim(p_reason), 300)
          || '. Elle est déduite de votre prochain versement. Vous pouvez répondre ici avec vos preuves (photo, position).');
  return pid;
end;
$$;
create or replace function public.admin_penalty_cancel(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare x courier_penalties;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update courier_penalties set status = 'annulee' where id = p_id and status = 'du' returning * into x;
  if x.id is null then return false; end if;
  insert into chat_messages (thread, author, author_name, body)
  values ('c:' || x.courier_id::text, 'admin', 'HOP!', '✅ Retenue de ' || x.amount || ' ₪ annulée' || coalesce(' (course n° ' || x.order_ref || ')', '') || '.');
  return true;
end;
$$;
create or replace function public.admin_claim_close(p_order uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update orders set claim_status = 'classee' where id = p_order and claim_status = 'ouverte';
  return found;
end;
$$;
create or replace function public.admin_penalties() returns setof public.courier_penalties
language sql stable security definer set search_path = public as $$
  select * from courier_penalties where public.is_admin() order by created_at desc limit 500;
$$;
create or replace function public.my_penalties() returns setof public.courier_penalties
language sql stable security definer set search_path = public as $$
  select * from courier_penalties where courier_id = auth.uid() and status <> 'annulee' order by created_at desc limit 200;
$$;
-- « ✓ Réglé » de la semaine : les retenues du livreur sont réglées en même temps
create or replace function public.admin_penalties_settle(p_courier uuid) returns int
language sql security definer set search_path = public as $$
  with u as (update courier_penalties set status = 'regle', settled_at = now()
              where public.is_admin() and courier_id = p_courier and status = 'du' returning id)
  select count(*)::int from u;
$$;
revoke execute on function public.order_claim(uuid, text), public.admin_penalty_add(uuid, uuid, numeric, text), public.admin_penalty_cancel(uuid),
  public.admin_claim_close(uuid), public.admin_penalties(), public.my_penalties(), public.admin_penalties_settle(uuid) from public;
grant execute on function public.order_claim(uuid, text) to anon, authenticated;
grant execute on function public.admin_penalty_add(uuid, uuid, numeric, text), public.admin_penalty_cancel(uuid), public.admin_claim_close(uuid),
  public.admin_penalties(), public.my_penalties(), public.admin_penalties_settle(uuid) to authenticated;

-- Courses en retard : le patron est prévenu une fois par étape (toutes les 5 minutes)
create or replace function public.late_orders_alert() returns int
language plpgsql security definer set search_path = public as $$
declare o record; n int := 0; why text; step text;
begin
  for o in select * from orders where status in ('nouvelle', 'confirmee', 'recuperee') and pickup_at < now() - interval '15 minutes'
  loop
    step := null;
    if o.status = 'nouvelle' and o.courier_id is null and coalesce(o.docs_status, 'ok') = 'ok'
       and (o.shop_status is null or o.shop_status in ('acceptee', 'prete')) and o.pickup_at < now() - interval '15 minutes' then
      step := 'libre'; why := 'Personne n''a pris la course';
    elsif o.status = 'confirmee' and o.pickup_at < now() - interval '45 minutes' then
      step := 'pas_recuperee'; why := 'Pas encore récupérée, 45 min après l''heure';
    elsif o.status = 'recuperee' and o.pickup_at < now() - interval '2 hours' then
      step := 'pas_livree'; why := 'Pas encore livrée, 2 h après l''heure';
    end if;
    if step is null or o.late_alert is not distinct from step then continue; end if;
    update orders set late_alert = step where id = o.id;
    perform public.push_call(jsonb_build_object('order_id', o.id, 'event', 'late', 'why', why));
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.late_orders_alert() from public, anon, authenticated;
do $$ begin
  perform cron.schedule('hop-late-orders', '*/5 * * * *', 'select public.late_orders_alert()');
exception when others then raise notice 'pg_cron indisponible : pas d''alerte de retard';
end $$;

-- ============================================================================
-- LE LIVREUR DIT DANS COMBIEN DE TEMPS IL EST AU DÉPART ; LE CLIENT PEUT REFUSER (TROP LONG)
-- Courses « dès que possible » ou express (pas programmées, pas HOP! Pro, pas par téléphone, pas de rendez-vous) :
-- le client a 3 minutes pour dire « trop long » ; la course repart alors aux autres livreurs (pas à celui-là).
-- Sans réponse, c'est accepté.
-- ============================================================================
alter table public.orders add column if not exists eta_min int check (eta_min between 1 and 180);
alter table public.orders add column if not exists eta_at timestamptz;
alter table public.orders add column if not exists eta_status text check (eta_status in ('attente', 'ok'));
alter table public.orders add column if not exists eta_until timestamptz;
alter table public.orders add column if not exists eta_refusals int not null default 0;

create or replace function public.eta_choice(o orders) returns boolean
language sql stable as $$
  select o.urgency in ('asap', 'express') and o.shop_status is null and not coalesce(o.phone_order, false) and o.appt_at is null;
$$;

-- Accepter en disant le temps pour être au départ (l'ancienne version, sans temps, reste pour les vieilles applis)
create or replace function public.accept_order(p_id uuid, p_eta int) returns boolean
language plpgsql security definer set search_path = public as $$
declare o orders; m int;
begin
  if not public.accept_order(p_id) then return false; end if;
  m := least(greatest(coalesce(p_eta, 15), 1), 180);
  select * into o from orders where id = p_id;
  update orders set eta_min = m, eta_at = now() + make_interval(mins => m),
         eta_status = case when public.eta_choice(o) then 'attente' else 'ok' end,
         eta_until = case when public.eta_choice(o) then now() + interval '3 minutes' else null end
   where id = p_id;
  if public.eta_choice(o) then
    insert into chat_messages (thread, author, body) values ('o:' || p_id::text, 'system', 'status:eta');
  end if;
  return true;
end;
$$;
revoke execute on function public.accept_order(uuid, int) from public, anon;
grant execute on function public.accept_order(uuid, int) to authenticated;

-- Course remise en attente (livreur, patron, client) : plus de temps annoncé
create or replace function public.orders_eta_reset() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'nouvelle' and old.status is distinct from 'nouvelle' then
    new.eta_min := null; new.eta_at := null; new.eta_status := null; new.eta_until := null;
  end if;
  return new;
end;
$$;
create or replace trigger orders_eta_reset before update of status on public.orders
  for each row execute function public.orders_eta_reset();

-- Le client répond : « D'accord » ou « Trop long : un autre livreur » (dans les 3 minutes)
create or replace function public.order_eta_answer(p_token uuid, p_ok boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  select * into o from orders where token = p_token;
  if o.id is null or o.status <> 'confirmee' or o.eta_status is distinct from 'attente' then return false; end if;
  if p_ok then update orders set eta_status = 'ok' where id = o.id; return true; end if;
  if now() > o.eta_until then return false; end if;
  -- Ce livreur ne la revoit plus ; elle repart aux autres (notification « remise en attente »)
  insert into order_declines (order_id, courier_id) values (o.id, o.courier_id) on conflict do nothing;
  update orders set status = 'nouvelle', courier_id = null, courier_name = null, courier_phone = null, courier_bit = null,
         commission = 0, network = false, eta_refusals = eta_refusals + 1
   where id = o.id;
  insert into chat_messages (thread, author, author_name, body)
  values ('c:' || o.courier_id::text, 'admin', 'HOP!',
          '↩️ Course n° ' || o.ref || ' : le client a préféré un autre livreur (' || o.eta_min || ' min, trop long pour lui). Elle n''est plus à vous, pas de souci.');
  return true;
end;
$$;
revoke execute on function public.order_eta_answer(uuid, boolean) from public;
grant execute on function public.order_eta_answer(uuid, boolean) to anon, authenticated;

-- ============================================================================
-- HOP! PRO : LE COMMERCE CHOISIT QUI PAIE LA LIVRAISON
-- - « Je paie 12 ₪ » (par défaut) : le commerce paie pro_shop_share par livraison (dont pro_hop_share pour HOP),
--   le client paie le reste (25 − 10 = 15 ₪ dans Netanya) ;
-- - « Le client paie » : le client paie la course entière (25 ₪), HOP en garde pro_hop_share (2 ₪) et le
--   livreur le reste ; le commerce ne paie que son abonnement.
-- Choisi à l'inscription, modifiable à tout moment dans l'espace du commerce (les commandes passées gardent leur règle).
-- ============================================================================
alter table public.shops add column if not exists client_pays boolean not null default false;

-- Commande HOP! Pro d'un commerce « le client paie » : pas de part du commerce
create or replace function public.orders_guard_pay() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.shop_status is not null and exists (select 1 from shops where id = new.shop_id and client_pays) then
    new.shop_share := 0;
  end if;
  return new;
end;
$$;
create or replace trigger orders_guard_pay before insert on public.orders
  for each row execute function public.orders_guard_pay();
revoke execute on function public.orders_guard_pay() from public, anon, authenticated;

-- Part de HOP sur une commande HOP! Pro : prise sur la part du commerce, ou sur le prix payé par le client
create or replace function public.orders_money_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.discount := case when new.promo_code is null then 0 else least(greatest(coalesce(new.discount, 0), 0), 30) end;
  new.hop_share := case when coalesce(new.shop_share, 0) > 0
                          then least(new.shop_share, (select pro_hop_share from settings where id = 1))
                        when new.shop_status is not null
                          then least(greatest(coalesce(new.price, 0), 0), (select pro_hop_share from settings where id = 1))
                        else 0 end;
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

-- Infos publiques : « shop_share » = ce que le commerce enlève au prix du client (0 quand le client paie tout)
create or replace function public.shop_public(p_code text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('id', id, 'code', code, 'name', name, 'kind', kind, 'city', city,
                           'address', address, 'lat', lat, 'lon', lon, 'status', status,
                           'pro', coalesce(plan_until >= current_date, false),
                           'logo', logo, 'cover', cover, 'tagline', tagline, 'client_pays', client_pays,
                           'shop_share', case when client_pays then 0
                                              else (select pro_shop_share - pro_hop_share from settings where id = 1) end)
    from shops where code = upper(p_code) and status <> 'suspendu';
$$;
create or replace function public.shops_showcase() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('code', s.code, 'name', s.name, 'kind', s.kind, 'city', s.city, 'logo', s.logo, 'cover', s.cover,
           'tagline', s.tagline, 'client_pays', s.client_pays,
           'products', (select count(*) from shop_products p where p.shop_id = s.id and p.available))
           order by (s.cover is not null) desc, (s.logo is not null) desc, s.name), '[]'::json)
    from shops s where s.status = 'actif' and s.plan_until >= current_date;
$$;

-- Le commerce change de formule (sa clé secrète)
create or replace function public.shop_set_client_pays(p_token uuid, p_on boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update shops set client_pays = coalesce(p_on, false) where token = p_token;
  return found;
end;
$$;
revoke execute on function public.shop_set_client_pays(uuid, boolean) from public;
grant execute on function public.shop_set_client_pays(uuid, boolean) to anon, authenticated;

-- Inscription : le choix est fait dès le départ (« client_pays » : true = le client paie la livraison)
create or replace function public.shop_signup(p jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare r shops; ref uuid; ref_city text; other_city text; c text;
begin
  if coalesce(trim(p->>'name'), '') = '' or coalesce(trim(p->>'phone'), '') = '' then raise exception 'missing'; end if;
  -- Déjà inscrit (même téléphone, ou même nom dans la même ville) : pas de doublon, le parrain ne change pas
  if exists (select 1 from shops where norm_phone(phone) = norm_phone(p->>'phone')
               or (lower(trim(name)) = lower(trim(p->>'name')) and coalesce(city, '') = coalesce(p->>'city', ''))) then
    raise exception 'shop_exists';
  end if;
  select id, city into ref, ref_city from couriers where ref_code = upper(trim(coalesce(p->>'ref_code', ''))) and status = 'actif';
  -- Partenariat seulement dans la ville du livreur (pour assurer les livraisons) ; sinon inscrit sans parrain
  if ref is not null and ref_city is not null and coalesce(p->>'city', '') <> ref_city then
    other_city := ref_city; ref := null;
  end if;
  loop
    c := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from shops where code = c);
  end loop;
  insert into shops (code, name, kind, city, address, lat, lon, contact_name, phone, email, lang, referrer_id, client_pays)
  values (c, left(trim(p->>'name'), 80), left(p->>'kind', 20), left(p->>'city', 60), left(p->>'address', 200),
          (p->>'lat')::double precision, (p->>'lon')::double precision, left(p->>'contact_name', 80),
          left(p->>'phone', 30), left(p->>'email', 120), case when p->>'lang' = 'fr' then 'fr' else 'he' end, ref,
          coalesce((p->>'client_pays')::boolean, false))
  returning * into r;
  return json_build_object('code', r.code, 'token', r.token, 'referred', ref is not null, 'ref_other_city', other_city);
end;
$$;

-- ============================================================================
-- PAIEMENT DIRECT AU LIVREUR + CRÉDIT PRÉPAYÉ : HOP n'encaisse que sa rémunération
-- - Le client paie le livreur directement (Bit ou PayBox sur le numéro du livreur), plus d'espèces ni de Bit à
--   HOP. Le livreur confirme « Paiement reçu » avant « Livré ».
-- - HOP! Pro « je paie 12 ₪ » : le commerce paie au livreur sa part (12 − 2 = 10 ₪) en lui remettant la
--   commande ; HOP facture au commerce ses 2 ₪ par livraison avec l'abonnement.
-- - HOP! Pro « le client paie » : HOP garde pro_hop_share_client (1 ₪), pris sur le crédit du livreur.
-- - Le livreur recharge un crédit à l'avance (Bit à HOP, validé par le patron) ; chaque course livrée en
--   déduit la commission de HOP (15 %, au moins 3 ₪). Sans crédit suffisant, pas de nouvelle course.
-- Les courses passées avant gardent leur ancienne règle (direct_pay = false).
-- ============================================================================
alter table public.settings alter column commission_min set default 3;
update public.settings set commission_min = 3 where id = 1 and commission_min = 3.5;
alter table public.settings add column if not exists pro_hop_share_client numeric not null default 1;
alter table public.orders add column if not exists direct_pay boolean not null default false;

-- Nouvelle commande : payée au livreur (sauf carnet, payé d'avance à HOP) ; Pro « le client paie » : pas de part du commerce
create or replace function public.orders_guard_pay() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.shop_status is not null and exists (select 1 from shops where id = new.shop_id and client_pays) then
    new.shop_share := 0;
  end if;
  new.direct_pay := new.payment_method <> 'carnet';
  if new.direct_pay then new.paid_to := 'livreur'; new.prepaid_required := false; end if;
  return new;
end;
$$;

-- Part de HOP sur une commande HOP! Pro : sur la part du commerce (2 ₪), ou sur le prix payé par le client (1 ₪)
create or replace function public.orders_money_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.discount := case when new.promo_code is null then 0 else least(greatest(coalesce(new.discount, 0), 0), 30) end;
  new.hop_share := case when coalesce(new.shop_share, 0) > 0
                          then least(new.shop_share, (select pro_hop_share from settings where id = 1))
                        when new.shop_status is not null
                          then least(greatest(coalesce(new.price, 0), 0), (select pro_hop_share_client from settings where id = 1))
                        else 0 end;
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

-- Ce que le livreur doit à HOP pour une course livrée (négatif : ce que HOP lui doit)
-- - commission ; réduction d'un code promo (payée par HOP) ;
-- - paiement direct : part de HOP prise sur le prix du client (Pro « le client paie ») ; le commerce paie lui-même sa part au livreur ;
-- - avant : part du commerce reversée par HOP, course payée à HOP (Bit, carnet).
create or replace function public.course_due(o orders) returns numeric
language sql stable set search_path = public as $$
  select coalesce(o.commission, 0) - coalesce(o.discount, 0)
       + case when o.direct_pay then case when coalesce(o.shop_share, 0) > 0 then 0 else coalesce(o.hop_share, 0) end
              else coalesce(o.hop_share, 0) - coalesce(o.shop_share, 0) end
       - case when o.paid_to = 'hop' and o.payment_status = 'paye' then coalesce(o.price, 0) else 0 end;
$$;
create or replace function public.courier_balance(p_id uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(public.course_due(o))
                     from orders o where o.courier_id = p_id and o.status = 'livree' and o.commission_status <> 'regle'), 0)
       - coalesce((select sum(tip) from orders where courier_id = p_id and tip_status = 'recu' and not direct_pay), 0)
       -- (une course de son réseau qu'il livre lui-même : pas de bonus, il a déjà la commission réseau)
       - coalesce((select sum(referral_bonus) from orders
                    where referrer_id = p_id and courier_id is distinct from p_id and status = 'livree' and referral_status <> 'regle'), 0)
       - coalesce((select sum(referrer_share) from plan_sales where referrer_id = p_id and referrer_status <> 'regle'), 0);
$$;
revoke execute on function public.courier_balance(uuid) from public, anon, authenticated;

-- Recharges du crédit : le livreur envoie par Bit à HOP puis le déclare, le patron valide (ou l'ajoute lui-même)
create table if not exists public.courier_topups (
  id          uuid primary key default gen_random_uuid(),
  courier_id  uuid not null references public.couriers(id) on delete cascade,
  amount      numeric(10,2) not null check (amount >= 5 and amount <= 2000),
  status      text not null default 'attente' check (status in ('attente', 'ok', 'refuse')),
  note        text check (length(note) <= 200),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);
create index if not exists courier_topups_courier_idx on public.courier_topups (courier_id, created_at);
alter table public.courier_topups enable row level security;
revoke all on public.courier_topups from anon, authenticated;

-- Crédit = recharges validées − ce qu'il doit (courses, retenues) + ce que HOP lui doit (bonus, codes promo…)
create or replace function public.courier_credit(p_id uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(amount) from courier_topups where courier_id = p_id and status = 'ok'), 0)
       - public.courier_balance(p_id)
       - coalesce((select sum(amount) from courier_penalties where courier_id = p_id and status = 'du'), 0);
$$;
revoke execute on function public.courier_credit(uuid) from public, anon, authenticated;
-- Ce qui est déjà réservé pour les courses en cours (commission + part HOP, pas encore livrées)
create or replace function public.courier_reserved(p_id uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(greatest(public.course_due(o), 0)), 0) from orders o
   where o.courier_id = p_id and o.status in ('confirmee', 'recuperee');
$$;
revoke execute on function public.courier_reserved(uuid) from public, anon, authenticated;

-- Accepter une course : le crédit doit couvrir la commission de HOP
create or replace function public.accept_order(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare c couriers; ord orders; need numeric;
begin
  select * into c from couriers where id = auth.uid() and status = 'actif';
  if not found then return false; end if;
  if c.role = 'coursier' and not coalesce(c.unlocked_until > now(), false) then
    -- Crédit prépayé : il doit couvrir ce que HOP prendra sur cette course (et sur celles en cours)
    select * into ord from orders where id = p_id;
    if ord.id is not null then
      need := case when ord.referrer_id = c.id then public.commission_network(public.course_value(ord))
                   else public.commission_for(public.course_value(ord)) end
            + case when ord.direct_pay and coalesce(ord.shop_share, 0) = 0 then coalesce(ord.hop_share, 0) else 0 end;
      if public.courier_credit(c.id) - public.courier_reserved(c.id) < need then raise exception 'credit_low'; end if;
    end if;
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

-- Le livreur : son crédit, ce qui est réservé, ses recharges
create or replace function public.my_credit() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('credit', public.courier_credit(auth.uid()), 'reserved', public.courier_reserved(auth.uid()),
    'topups', coalesce((select json_agg(t order by t.created_at desc) from
                 (select id, amount, status, note, created_at, decided_at from courier_topups
                   where courier_id = auth.uid() order by created_at desc limit 50) t), '[]'::json))
   where public.is_active_courier();
$$;
-- « J'ai rechargé X ₪ par Bit » : le patron reçoit un message et valide
create or replace function public.courier_topup_declare(p_amount numeric) returns uuid
language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  if not public.is_active_courier() then raise exception 'forbidden'; end if;
  if p_amount is null or p_amount < 5 or p_amount > 2000 then raise exception 'bad_amount'; end if;
  if (select count(*) from courier_topups where courier_id = auth.uid() and status = 'attente') >= 3 then raise exception 'too_many'; end if;
  insert into courier_topups (courier_id, amount) values (auth.uid(), round(p_amount, 2)) returning id into tid;
  insert into chat_messages (thread, author, author_name, body)
  values ('c:' || auth.uid()::text, 'courier', (select name from couriers where id = auth.uid()),
          '💳 J''ai rechargé ' || round(p_amount, 2) || ' ₪ par Bit pour mon crédit HOP. Merci de valider.');
  return tid;
end;
$$;
create or replace function public.admin_topup_decide(p_id uuid, p_ok boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare t courier_topups;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update courier_topups set status = case when p_ok then 'ok' else 'refuse' end, decided_at = now()
   where id = p_id and status = 'attente' returning * into t;
  if t.id is null then return false; end if;
  insert into chat_messages (thread, author, author_name, body)
  values ('c:' || t.courier_id::text, 'admin', 'HOP!', case when p_ok
            then '✅ Recharge de ' || t.amount || ' ₪ validée : elle est sur votre crédit.'
            else '❌ Recharge de ' || t.amount || ' ₪ pas reçue sur le Bit de HOP. Écrivez-nous si c''est une erreur.' end);
  return true;
end;
$$;
-- Le patron ajoute (ou retire, montant négatif) du crédit lui-même : recharge reçue autrement, geste commercial
create or replace function public.admin_topup_add(p_courier uuid, p_amount numeric, p_note text) returns uuid
language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_amount is null or p_amount < 5 or p_amount > 2000 then raise exception 'bad_amount'; end if;
  insert into courier_topups (courier_id, amount, status, note, decided_at)
  values (p_courier, round(p_amount, 2), 'ok', left(nullif(trim(coalesce(p_note, '')), ''), 200), now()) returning id into tid;
  insert into chat_messages (thread, author, author_name, body)
  values ('c:' || p_courier::text, 'admin', 'HOP!', '💳 ' || round(p_amount, 2) || ' ₪ ajoutés à votre crédit HOP.');
  return tid;
end;
$$;
-- Patron : crédit de chaque livreur et recharges à valider
create or replace function public.admin_credits() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'credits', coalesce((select json_agg(json_build_object('courier_id', c.id, 'credit', public.courier_credit(c.id),
                           'reserved', public.courier_reserved(c.id))) from couriers c where c.role = 'coursier'), '[]'::json),
    'topups', coalesce((select json_agg(t order by t.created_at desc) from
                 (select x.*, c.name as courier_name from courier_topups x join couriers c on c.id = x.courier_id
                   order by x.created_at desc limit 300) t), '[]'::json))
   where public.is_admin();
$$;
revoke execute on function public.my_credit(), public.courier_topup_declare(numeric), public.admin_topup_decide(uuid, boolean),
  public.admin_topup_add(uuid, numeric, text), public.admin_credits() from public, anon;
grant execute on function public.my_credit(), public.courier_topup_declare(numeric), public.admin_topup_decide(uuid, boolean),
  public.admin_topup_add(uuid, numeric, text), public.admin_credits() to authenticated;

-- « Livré » : un paiement direct doit avoir été reçu par le livreur (bouton « 💳 Paiement reçu »)
create or replace function public.orders_paid_before_delivery() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'livree' and old.status is distinct from 'livree' and new.direct_pay and new.paid_to = 'livreur'
     and new.payment_status <> 'paye' and not new.unlocked and coalesce(auth.uid() = new.courier_id, false)
     and not exists (select 1 from couriers where id = new.courier_id and (role = 'admin' or unlocked_until > now())) then
    raise exception 'payment_required';
  end if;
  return new;
end;
$$;
create or replace trigger orders_paid_before_delivery before update of status on public.orders
  for each row execute function public.orders_paid_before_delivery();
revoke execute on function public.orders_paid_before_delivery() from public, anon, authenticated;

-- Le client peut dire « J'ai payé » au livreur (Bit ou PayBox) ; le livreur confirme ensuite
create or replace function public.order_client_paid(p_token uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare oid uuid;
begin
  update orders set client_paid_at = now()
   where token = p_token and payment_method = 'bit' and payment_status = 'en_attente' and client_paid_at is null
     and status not in ('annulee', 'refusee') and (not direct_pay or courier_id is not null)
   returning id into oid;
  if oid is null then return false; end if;
  insert into chat_messages (thread, author, body) values ('o:' || oid::text, 'system', 'status:client_paid');
  return true;
end;
$$;

-- Espace du commerce : le Bit du livreur pour lui payer sa part (paiement direct)
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
               o.shop_order, o.shop_status, o.prep_minutes, o.ready_at, o.shop_share, o.wait_fee, o.wait_minutes, o.shop_ref,
               o.items, o.items_total, o.items_note, o.hop_share, o.direct_pay,
               case when o.status in ('confirmee', 'recuperee') then o.courier_bit end as courier_bit
          from orders o join shops s on s.id = o.shop_id
         where s.token = p_token order by o.pickup_at desc limit 100) x), '[]'::json));
$$;

-- Moyen de paiement changé par le client : paiement direct → toujours au livreur
create or replace function public.order_set_payment(p_token uuid, p_method text) returns boolean
language plpgsql security definer set search_path = public as $$
declare oid uuid;
begin
  if p_method not in ('cash', 'bit') then raise exception 'bad_method'; end if;
  update orders set payment_method = p_method,
         paid_to = case when direct_pay or p_method = 'cash' then 'livreur' else 'hop' end,
         client_paid_at = null
   where token = p_token and payment_method in ('cash', 'bit') and payment_method <> p_method
     and payment_status = 'en_attente' and status in ('nouvelle', 'confirmee', 'recuperee')
     and not (p_method = 'cash' and prepaid_required)
   returning id into oid;
  if oid is null then return false; end if;
  insert into chat_messages (thread, author, body) values ('o:' || oid::text, 'system', 'status:pay_' || p_method);
  return true;
end;
$$;

-- ============================================================================
-- DOCUMENTS DU PAIEMENT DIRECT
-- 1. Reçu du livreur au client, à chaque course livrée et payée : au nom du livreur (son n° d'עוסק),
--    numéroté pour chaque livreur (1, 2, 3…), même page que les reçus de HOP (recu.html?t=…).
-- 2. Reçu de HOP au livreur, à chaque recharge de crédit reçue (קבלה numérotée de HOP, recu.html?k=…).
-- 3. Relevé mensuel du livreur : ses courses, la commission déduite de son crédit, ses recharges (recu.html?m=AAAA-MM).
-- ============================================================================
alter table public.couriers add column if not exists receipt_seq int not null default 0;
alter table public.orders add column if not exists courier_receipt_number int;

create or replace function public.orders_courier_receipt() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if new.status = 'livree' and new.payment_status = 'paye' and new.direct_pay and new.paid_to = 'livreur'
     and new.courier_receipt_number is null and new.receipt_number is null
     and exists (select 1 from couriers where id = new.courier_id and role = 'coursier') then
    update couriers set receipt_seq = receipt_seq + 1 where id = new.courier_id returning receipt_seq into n;
    new.courier_receipt_number := n;
    new.receipt_at := coalesce(new.receipt_at, now());
  end if;
  return new;
end;
$$;
create or replace trigger orders_courier_receipt before update on public.orders
  for each row execute function public.orders_courier_receipt();
revoke execute on function public.orders_courier_receipt() from public, anon, authenticated;

-- Reçu d'une course (jeton secret) : qui l'émet (HOP pour ses propres courses, ou le livreur)
create or replace function public.order_receipt(p_token uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('ref', o.ref, 'token', o.token, 'status', o.status, 'price', o.price, 'payment_method', o.payment_method,
    'contact_name', o.contact_name, 'company', o.company, 'contact_phone', o.contact_phone,
    'from_city', o.from_city, 'to_city', o.to_city, 'pickup_at', o.pickup_at,
    'receipt_number', coalesce(o.receipt_number, o.courier_receipt_number), 'receipt_at', o.receipt_at,
    'issuer', case when o.courier_receipt_number is not null then 'courier' else 'hop' end,
    'courier_name', case when o.courier_receipt_number is not null then c.name end,
    'courier_business', case when o.courier_receipt_number is not null then c.business_number end,
    'courier_phone', case when o.courier_receipt_number is not null then c.phone end,
    'courier_city', case when o.courier_receipt_number is not null then c.city end)
  from orders o left join couriers c on c.id = o.courier_id
  where o.token = p_token;
$$;
revoke execute on function public.order_receipt(uuid) from public;
grant execute on function public.order_receipt(uuid) to anon, authenticated;

-- Recharges : reçu de HOP (numéro de la suite des reçus de HOP) quand l'argent est reçu
alter table public.courier_topups add column if not exists token uuid not null default gen_random_uuid();
alter table public.courier_topups add column if not exists receipt_number int unique;
alter table public.courier_topups add column if not exists receipt_at timestamptz;
alter table public.courier_topups add column if not exists paid boolean not null default true;   -- false : crédit offert (pas d'argent reçu)
create or replace function public.topups_receipt() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'ok' and new.paid and new.receipt_number is null then
    new.receipt_number := nextval('public.receipt_seq');
    new.receipt_at := now();
  end if;
  return new;
end;
$$;
create or replace trigger topups_receipt before insert or update on public.courier_topups
  for each row execute function public.topups_receipt();
revoke execute on function public.topups_receipt() from public, anon, authenticated;

-- Le patron ajoute du crédit : argent reçu autrement (reçu de HOP) ou offert (pas de reçu)
create or replace function public.admin_topup_add(p_courier uuid, p_amount numeric, p_note text, p_paid boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_amount is null or p_amount < 5 or p_amount > 2000 then raise exception 'bad_amount'; end if;
  insert into courier_topups (courier_id, amount, status, note, decided_at, paid)
  values (p_courier, round(p_amount, 2), 'ok', left(nullif(trim(coalesce(p_note, '')), ''), 200), now(), coalesce(p_paid, true)) returning id into tid;
  insert into chat_messages (thread, author, author_name, body)
  values ('c:' || p_courier::text, 'admin', 'HOP!', '💳 ' || round(p_amount, 2) || ' ₪ ajoutés à votre crédit HOP'
          || case when coalesce(p_paid, true) then ' (reçu dans Finances).' else ' (offerts par HOP).' end);
  return tid;
end;
$$;
revoke execute on function public.admin_topup_add(uuid, numeric, text, boolean) from public, anon;
grant execute on function public.admin_topup_add(uuid, numeric, text, boolean) to authenticated;

create or replace function public.topup_receipt(p_token uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('receipt_number', t.receipt_number, 'receipt_at', t.receipt_at, 'amount', t.amount,
                           'courier_name', c.name, 'phone', c.phone, 'business_number', c.business_number)
    from courier_topups t join couriers c on c.id = t.courier_id
   where t.token = p_token and t.receipt_number is not null;
$$;
revoke execute on function public.topup_receipt(uuid) from public;
grant execute on function public.topup_receipt(uuid) to anon, authenticated;

-- Le livreur : ses recharges avec leur reçu, et son relevé du mois
create or replace function public.my_credit() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('credit', public.courier_credit(auth.uid()), 'reserved', public.courier_reserved(auth.uid()),
    'topups', coalesce((select json_agg(t order by t.created_at desc) from
                 (select id, amount, status, note, created_at, decided_at, paid, receipt_number, token from courier_topups
                   where courier_id = auth.uid() order by created_at desc limit 50) t), '[]'::json))
   where public.is_active_courier();
$$;
create or replace function public.my_statement(p_month text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('month', p_month,
    'courier', (select json_build_object('name', name, 'phone', phone, 'business_number', business_number) from couriers where id = auth.uid()),
    'orders', coalesce((select json_agg(x order by x.delivered) from (
        select o.ref, coalesce(o.delivered_at, o.pickup_at) as delivered, o.price, o.discount, o.commission, o.direct_pay,
               o.shop_share, o.hop_share, o.courier_receipt_number, public.course_due(o) as due
          from orders o where o.courier_id = auth.uid() and o.status = 'livree'
           and to_char(coalesce(o.delivered_at, o.pickup_at) at time zone 'Asia/Jerusalem', 'YYYY-MM') = p_month) x), '[]'::json),
    'topups', coalesce((select json_agg(t order by t.created_at) from (
        select amount, status, paid, receipt_number, created_at, decided_at, note from courier_topups
         where courier_id = auth.uid() and status = 'ok'
           and to_char(coalesce(decided_at, created_at) at time zone 'Asia/Jerusalem', 'YYYY-MM') = p_month) t), '[]'::json),
    'penalties', coalesce((select json_agg(p order by p.created_at) from (
        select amount, reason, order_ref, created_at from courier_penalties
         where courier_id = auth.uid() and status = 'du'
           and to_char(created_at at time zone 'Asia/Jerusalem', 'YYYY-MM') = p_month) p), '[]'::json),
    'credit', public.courier_credit(auth.uid()))
   where public.is_active_courier() and p_month ~ '^[0-9]{4}-[0-9]{2}$';
$$;
revoke execute on function public.my_statement(text) from public, anon;
grant execute on function public.my_statement(text) to authenticated;

-- Patron : les recharges avec leur reçu
create or replace function public.admin_credits() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'credits', coalesce((select json_agg(json_build_object('courier_id', c.id, 'credit', public.courier_credit(c.id),
                           'reserved', public.courier_reserved(c.id))) from couriers c where c.role = 'coursier'), '[]'::json),
    'topups', coalesce((select json_agg(t order by t.created_at desc) from
                 (select x.*, c.name as courier_name from courier_topups x join couriers c on c.id = x.courier_id
                   order by x.created_at desc limit 300) t), '[]'::json))
   where public.is_admin();
$$;

-- ============================================================================
-- CRÉDIT DE DÉPART OFFERT : quand le patron valide un livreur, il reçoit welcome_credit ₪ (50 ₪) sur son crédit
-- HOP, une seule fois. Crédit offert : pas d'argent reçu, donc pas de reçu ; il paie ses premières commissions.
-- welcome_credit = 0 : plus de crédit de départ.
-- ============================================================================
alter table public.settings add column if not exists welcome_credit numeric not null default 50;
create or replace function public.couriers_welcome_credit() returns trigger
language plpgsql security definer set search_path = public as $$
declare amt numeric;
begin
  if new.role = 'coursier' and new.status = 'actif' and old.status is distinct from 'actif'
     and not exists (select 1 from courier_topups where courier_id = new.id and note = 'Crédit de départ offert') then
    amt := (select welcome_credit from settings where id = 1);
    if amt >= 5 then
      insert into courier_topups (courier_id, amount, status, note, decided_at, paid)
      values (new.id, amt, 'ok', 'Crédit de départ offert', now(), false);
      insert into chat_messages (thread, author, author_name, body)
      values ('c:' || new.id::text, 'admin', 'HOP!', '🎁 Bienvenue ! ' || amt || ' ₪ de crédit de départ offerts par HOP : vos premières commissions sont payées avec. Ensuite, rechargez par Bit dans « Finances ».');
    end if;
  end if;
  return new;
end;
$$;
create or replace trigger couriers_welcome_credit after update of status on public.couriers
  for each row execute function public.couriers_welcome_credit();
revoke execute on function public.couriers_welcome_credit() from public, anon, authenticated;

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
