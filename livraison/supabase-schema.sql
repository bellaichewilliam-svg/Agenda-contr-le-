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
  select (to_jsonb(o) - 'contact_email' - 'commission' - 'commission_status'
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
grant execute on function public.orders_by_tokens(uuid[]), public.track_order(uuid), public.cancel_order(uuid) to anon;

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
