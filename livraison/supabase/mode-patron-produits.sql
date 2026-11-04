-- ============================================================================
-- Mode patron sur la page client (04/11/2026) : le patron change un produit directement sur sa page
-- (nom FR · HE, prix, visible / masqué). Rien n'est effacé.
--  • Boutiques HOP! (Carrefour, BOOOM : mises à jour toutes seules depuis le magasin) : le choix du patron est
--    gardé dans boss_* et REPASSE PAR-DESSUS chaque mise à jour automatique ; ce que dit le magasin est gardé
--    dans src_* (« Revenir au magasin » le remet).
--  • Autres commerces : le produit est changé directement (comme le ferait le commerce dans son espace).
--  • Historique de chaque changement : shop_product_log (avant → après).
-- ============================================================================
alter table public.shop_products add column if not exists boss_name text;
alter table public.shop_products add column if not exists boss_price numeric(10,2);
alter table public.shop_products add column if not exists boss_hidden boolean;
alter table public.shop_products add column if not exists src_name text;
alter table public.shop_products add column if not exists src_price numeric(10,2);
alter table public.shop_products add column if not exists src_available boolean;

create table if not exists public.shop_product_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  product_id uuid not null,
  shop_id uuid,
  before jsonb,
  after jsonb
);
create index if not exists shop_product_log_p on public.shop_product_log (product_id, id desc);
alter table public.shop_product_log enable row level security;

-- Le choix du patron passe toujours par-dessus (mise à jour automatique, import…)
create or replace function public.shop_products_boss() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('hop.boss', true), '') <> '1' then
    -- Mise à jour venue du magasin : on garde ce qu'il dit, puis on remet le choix du patron
    if new.boss_name is not null then new.src_name := new.name; end if;
    if new.boss_price is not null then new.src_price := new.price; end if;
    if new.boss_hidden is not null then new.src_available := new.available; end if;
  end if;
  if new.boss_name is not null then new.name := new.boss_name; end if;
  if new.boss_price is not null then new.price := new.boss_price; end if;
  if new.boss_hidden is not null then new.available := not new.boss_hidden; end if;
  return new;
end $$;
create or replace trigger shop_products_boss before insert or update on public.shop_products
  for each row execute function public.shop_products_boss();

-- Le patron change un produit. p_reset : revenir à ce que dit le magasin (boutiques HOP!)
create or replace function public.admin_shop_product_set(p_id uuid, p_name text default null, p_price numeric default null,
                                                         p_available boolean default null, p_reset boolean default false) returns json
language plpgsql security definer set search_path = public as $$
declare p shop_products; hop boolean; nm text; r shop_products;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into p from shop_products where id = p_id;
  if not found then raise exception 'not_found'; end if;
  nm := nullif(trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), '');
  if nm is not null and length(nm) > 80 then raise exception 'name_long'; end if;
  if p_price is not null and (p_price < 0 or p_price > 5000) then raise exception 'bad_price'; end if;
  hop := public.hop_shop(p.shop_id);
  perform set_config('hop.boss', '1', true);
  if p_reset then
    update shop_products set
      name = coalesce(case when boss_name is not null then src_name end, name),
      price = coalesce(case when boss_price is not null then src_price end, price),
      available = coalesce(case when boss_hidden is not null then src_available end, available),
      boss_name = null, boss_price = null, boss_hidden = null
     where id = p_id returning * into r;
  elsif hop then
    update shop_products set
      src_name = case when nm is not null and boss_name is null then name else src_name end,
      src_price = case when p_price is not null and boss_price is null then price else src_price end,
      src_available = case when p_available is not null and boss_hidden is null then available else src_available end,
      boss_name = coalesce(nm, boss_name),
      boss_price = coalesce(round(p_price, 2), boss_price),
      boss_hidden = case when p_available is null then boss_hidden when p_available then null else true end,
      -- « Afficher » : on revient à ce que dit le magasin (s'il ne l'a plus, il reste masqué)
      available = case when p_available is true and boss_hidden is not null then coalesce(src_available, true) else available end
     where id = p_id returning * into r;
  else
    update shop_products set
      name = coalesce(nm, name),
      price = coalesce(round(p_price, 2), price),
      available = coalesce(p_available, available)
     where id = p_id returning * into r;
  end if;
  insert into shop_product_log (product_id, shop_id, before, after)
  values (p_id, p.shop_id,
          jsonb_build_object('name', p.name, 'price', p.price, 'available', p.available),
          jsonb_build_object('name', r.name, 'price', r.price, 'available', r.available, 'reset', p_reset));
  return json_build_object('id', r.id, 'name', r.name, 'price', r.price, 'available', r.available,
                           'boss', r.boss_name is not null or r.boss_price is not null or r.boss_hidden is not null,
                           'src_price', r.src_price);
end $$;
revoke execute on function public.admin_shop_product_set(uuid, text, numeric, boolean, boolean) from public, anon;
grant execute on function public.admin_shop_product_set(uuid, text, numeric, boolean, boolean) to authenticated;

-- Ce que le patron a changé dans un commerce (pour le crayon : « Revenir au magasin », prix du magasin)
create or replace function public.admin_shop_boss(p_code text) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_object_agg(p.id, json_build_object('src_name', p.src_name, 'src_price', p.src_price,
                  'src_available', p.src_available, 'boss_name', p.boss_name is not null, 'boss_price', p.boss_price is not null,
                  'boss_hidden', p.boss_hidden)), '{}'::json)
    from shop_products p join shops s on s.id = p.shop_id
   where public.is_admin() and s.code = upper(trim(p_code))
     and (p.boss_name is not null or p.boss_price is not null or p.boss_hidden is not null);
$$;
revoke execute on function public.admin_shop_boss(text) from public, anon;
grant execute on function public.admin_shop_boss(text) to authenticated;
