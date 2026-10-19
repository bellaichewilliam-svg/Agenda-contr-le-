-- ============================================================================
-- Base de données — à coller dans Supabase > SQL Editor > Run.
-- Les clients peuvent CRÉER des commandes et voir UNIQUEMENT les leurs
-- (grâce à un jeton secret gardé sur leur téléphone). Seul le compte coursier
-- (connecté) voit et modifie toutes les commandes et partage sa position.
-- ============================================================================

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  ref              text not null,
  token            uuid not null unique,
  created_at       timestamptz not null default now(),
  lang             text not null default 'fr',
  status           text not null default 'nouvelle'
                   check (status in ('nouvelle','confirmee','recuperee','livree','annulee')),
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
  admin_note       text
);

create index if not exists orders_pickup_at_idx on public.orders (pickup_at);

alter table public.orders enable row level security;

-- Les clients (anonymes) peuvent seulement créer des commandes "nouvelle" non payées.
drop policy if exists "clients creent" on public.orders;
create policy "clients creent" on public.orders
  for insert to anon
  with check (status = 'nouvelle' and payment_status = 'en_attente' and admin_note is null);

-- Le coursier connecté voit et gère tout.
drop policy if exists "coursier lit" on public.orders;
create policy "coursier lit" on public.orders
  for select to authenticated using (true);

drop policy if exists "coursier modifie" on public.orders;
create policy "coursier modifie" on public.orders
  for update to authenticated using (true) with check (true);

-- Position GPS du coursier (une seule ligne).
create table if not exists public.courier (
  id          int primary key check (id = 1),
  lat         double precision,
  lon         double precision,
  updated_at  timestamptz
);
insert into public.courier (id) values (1) on conflict do nothing;
alter table public.courier enable row level security;

drop policy if exists "coursier position" on public.courier;
create policy "coursier position" on public.courier
  for all to authenticated using (true) with check (true);

-- Un client retrouve ses commandes grâce aux jetons enregistrés sur son appareil.
create or replace function public.orders_by_tokens(tokens uuid[])
returns setof public.orders
language sql security definer set search_path = public as $$
  select * from public.orders where token = any(tokens) order by pickup_at desc;
$$;

-- Suivi en direct : la commande + la position du coursier pendant la course.
create or replace function public.track_order(p_token uuid)
returns json
language sql security definer set search_path = public as $$
  select case when o.id is null then null else
    to_jsonb(o) - 'contact_email'
    || case when o.status in ('confirmee','recuperee') and c.updated_at > now() - interval '30 minutes'
         then jsonb_build_object('courier_lat', c.lat, 'courier_lon', c.lon, 'courier_at', c.updated_at)
         else '{}'::jsonb end
  end::json
  from public.orders o
  left join public.courier c on c.id = 1
  where o.token = p_token;
$$;

-- Un client peut annuler sa commande tant qu'elle n'est pas acceptée.
create or replace function public.cancel_order(p_token uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.orders set status = 'annulee'
   where token = p_token and status = 'nouvelle';
  return found;
end;
$$;

grant execute on function public.orders_by_tokens(uuid[]) to anon;
grant execute on function public.track_order(uuid) to anon;
grant execute on function public.cancel_order(uuid) to anon;
