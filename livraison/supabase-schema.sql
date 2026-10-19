-- ============================================================================
-- Base de données des commandes — à coller dans Supabase > SQL Editor > Run.
-- Les clients peuvent CRÉER des commandes et voir UNIQUEMENT les leurs
-- (grâce à un jeton secret gardé sur leur téléphone). Seul le compte livreur
-- (connecté) peut voir et modifier toutes les commandes.
-- ============================================================================

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  ref              text not null,
  token            uuid not null unique,
  created_at       timestamptz not null default now(),
  status           text not null default 'nouvelle'
                   check (status in ('nouvelle','confirmee','recuperee','livree','annulee')),
  service          text not null check (service in ('course','poste')),
  urgency          text not null check (urgency in ('programmee','express')),
  pickup_at        timestamptz not null,
  pickup_address   text not null,
  pickup_contact   text,
  pickup_phone     text,
  dropoff_address  text not null,
  dropoff_contact  text,
  dropoff_phone    text,
  size             text,
  round_trip       boolean not null default false,
  extra_stops      int not null default 0,
  distance_km      numeric,
  price            numeric not null,
  tracking_number  text,
  parcel_name      text,
  has_proxy        boolean not null default false,
  notes            text,
  company          text not null,
  contact_name     text not null,
  contact_phone    text not null,
  contact_email    text,
  admin_note       text
);

create index if not exists orders_pickup_at_idx on public.orders (pickup_at);

alter table public.orders enable row level security;

-- Les clients (anonymes) peuvent seulement créer des commandes "nouvelle".
drop policy if exists "clients creent" on public.orders;
create policy "clients creent" on public.orders
  for insert to anon
  with check (status = 'nouvelle' and admin_note is null);

-- Le livreur connecté voit et gère tout.
drop policy if exists "livreur lit" on public.orders;
create policy "livreur lit" on public.orders
  for select to authenticated using (true);

drop policy if exists "livreur modifie" on public.orders;
create policy "livreur modifie" on public.orders
  for update to authenticated using (true) with check (true);

-- Un client retrouve ses commandes grâce aux jetons enregistrés sur son appareil.
create or replace function public.orders_by_tokens(tokens uuid[])
returns setof public.orders
language sql security definer set search_path = public as $$
  select * from public.orders where token = any(tokens) order by pickup_at desc;
$$;

-- Un client peut annuler sa commande tant qu'elle n'est pas confirmée.
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
grant execute on function public.cancel_order(uuid) to anon;
