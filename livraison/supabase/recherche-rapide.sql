-- 19/11 (patron) : « quand on tape, on voit que ça cherche, ce n'est pas instantané ». La recherche recalculait à chaque
-- lettre la version normalisée (sans accents, minuscules…) de tous les produits : 0,6 à 2,5 s. On la garde toute prête
-- dans une table (mise à jour toute seule quand un produit change), la recherche ne fait plus que comparer.
create table if not exists public.product_search_cache (id uuid primary key, nn text, dd text, cn text, at timestamptz not null default now());
alter table public.product_search_cache enable row level security;
create index if not exists product_search_cache_nn_trgm on public.product_search_cache using gin (nn extensions.gin_trgm_ops);

create or replace function public.product_search_cache_row(p_id uuid) returns void
language sql security definer set search_path = public, extensions as $f$
  insert into product_search_cache (id, nn, dd, cn, at)
  select p.id, search_norm(p.name), search_norm(coalesce(p.description, '')), search_norm(coalesce(k.name, '')), now()
    from shop_products p left join shop_categories k on k.id = p.category_id where p.id = p_id
  on conflict (id) do update set nn = excluded.nn, dd = excluded.dd, cn = excluded.cn, at = excluded.at;
$f$;
revoke all on function public.product_search_cache_row(uuid) from public, anon, authenticated;

create or replace function public.product_search_cache_trg() returns trigger
language plpgsql security definer set search_path = public as $f$
begin
  perform product_search_cache_row(new.id);
  return new;
end $f$;
create or replace trigger product_search_cache_sync after insert or update of name, description, category_id on public.shop_products
  for each row execute function public.product_search_cache_trg();

-- Tout recalculer (catégories renommées…) : chaque heure, et une fois maintenant
create or replace function public.product_search_cache_refresh() returns int
language sql security definer set search_path = public, extensions as $f$
  with up as (
    insert into product_search_cache (id, nn, dd, cn, at)
    select p.id, search_norm(p.name), search_norm(coalesce(p.description, '')), search_norm(coalesce(k.name, '')), now()
      from shop_products p left join shop_categories k on k.id = p.category_id
    on conflict (id) do update set nn = excluded.nn, dd = excluded.dd, cn = excluded.cn, at = excluded.at
    returning 1)
  select count(*)::int from up;
$f$;
revoke all on function public.product_search_cache_refresh() from public, anon, authenticated;
select public.product_search_cache_refresh();
select cron.schedule('hop-search-cache', '17 * * * *', 'select public.product_search_cache_refresh()');

-- La même recherche (mêmes résultats), avec les textes déjà prêts
CREATE OR REPLACE FUNCTION public.products_search_v3(p_q text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  with t as (select public.search_terms(p_q) terms, public.search_norm(trim(p_q)) q),
  cand as (
    select p.id, p.name, p.price, p.photo_url, p.photo_h, p.category_id, p.position, s.code, s.name as shop, s.kind, s.rank,
           coalesce(x.nn, public.search_norm(p.name)) nn, coalesce(x.dd, public.search_norm(coalesce(p.description, ''))) dd,
           coalesce(x.cn, public.search_norm(coalesce(k.name, ''))) cn
      from shop_products p join shops s on s.id = p.shop_id left join shop_categories k on k.id = p.category_id
      left join product_search_cache x on x.id = p.id
     where p.available and s.status = 'actif' and not s.demo and (s.plan_until >= current_date or s.showcase)
  ),
  scored as (
    select c.*, (select coalesce(max(case when c.nn ~ ('(^|·\s*)' || e || '($|[^[:alnum:]])') then 7
                                         when c.nn ~ ('(^|[^[:alnum:]])' || e || '($|[^[:alnum:]])') then 6
                                         when c.nn ~ ('(^|·\s*)' || e) then 4
                                         when c.nn like '% ' || tt || '%' or c.nn like '%·' || tt || '%' or c.nn like '%(' || tt || '%' then 3
                                         when c.nn like '%' || tt || '%' then 2
                                         when c.dd like '%' || tt || '%' then 1 end), 0) * 2
                        + coalesce(max(case when c.cn ~ ('(^|[^[:alnum:]])' || e) then 1 end), 0)
                   from unnest(t.terms) tt, lateral (select regexp_replace(tt, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') e) z) as sc,
           extensions.word_similarity(t.q, c.nn) as sim
      from cand c, t
     where length(t.q) >= 2
  ),
  hits as (select * from scored where sc > 1),
  fuzzy as (select * from scored where sc <= 1 and sim >= 0.5 and (select count(*) from hits) < 4)
  select coalesce(json_agg(json_build_object('id', x.id, 'name', x.name, 'price', x.price, 'photo', x.photo,
                                             'code', x.code, 'shop', x.shop, 'kind', x.kind, 'category', x.category)), '[]'::json)
    from (select y.id, y.name, y.price, y.code, y.shop, y.kind,
                 case when ext_photo_ok(y.photo_url) then y.photo_url
                      when y.photo_h is null then null
                      else coalesce((select f.path from shop_photo_files f where f.h = y.photo_h),
                                    'ph:' || y.id || ':' || left(y.photo_h, 12)) end as photo,
                 (select c.name from shop_categories c where c.id = y.category_id) as category
            from (select * from hits union all select * from fuzzy) y
           order by y.sc desc, y.sim desc, y.rank nulls last, y.position
           limit 30) x
$function$;
