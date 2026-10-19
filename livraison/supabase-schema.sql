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

-- Les clients créent seulement des commandes neuves, non attribuées, non payées.
drop policy if exists "clients creent" on public.orders;
create policy "clients creent" on public.orders for insert to anon
  with check (status = 'nouvelle' and payment_status = 'en_attente' and admin_note is null
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
  select (to_jsonb(o) - 'contact_email' - 'commission' - 'commission_status' - 'client_ip' - 'device_id'
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
    end if;
  end if;
  return new;
end;
$$;

-- Le parrain a quelques minutes d'avance sur les courses de ses commerces
create or replace function public.can_see_new(o orders) returns boolean
language sql stable security definer set search_path = public as $$
  select o.status = 'nouvelle' and o.courier_id is null
     and (o.referrer_id is null or o.referrer_id = auth.uid()
          or o.created_at < now() - make_interval(mins => (select priority_minutes from settings where id = 1)));
$$;

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
  update orders o set status = 'confirmee', courier_id = c.id, courier_name = c.name,
         courier_phone = c.phone, courier_bit = coalesce(c.bit_phone, c.phone),
         commission = case when c.role = 'admin' then 0 else (select commission from settings where id = 1) end
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

-- Infos publiques d'un commerce (pour pré-remplir le départ de la course)
create or replace function public.shop_public(p_code text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('id', id, 'code', code, 'name', name, 'kind', kind, 'city', city,
                           'address', address, 'lat', lat, 'lon', lon, 'status', status)
    from shops where code = upper(p_code) and status <> 'suspendu';
$$;

-- Espace du commerce (lien secret) : sa fiche et ses dernières courses
create or replace function public.shop_dashboard(p_token uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'shop', (select to_jsonb(s) - 'referrer_id' - 'admin_note' from shops s where s.token = p_token),
    'orders', coalesce((select json_agg(x order by x.pickup_at desc) from (
        select o.ref, o.token, o.status, o.created_at, o.pickup_at, o.urgency, o.price, o.payment_status,
               o.to_city, o.dropoff_address, o.dropoff_contact, o.contact_name, o.receipt_number, o.courier_name
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
  select json_build_object('id', id, 'shop_id', shop_id, 'pickup_at', pickup_at, 'status', status,
                           'referral_bonus', referral_bonus, 'referral_status', referral_status)
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
