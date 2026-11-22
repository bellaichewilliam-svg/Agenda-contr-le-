-- 22/11 (patron : « un système de recommandations et de notes sur les restaurants ») :
-- le client note le commerce (étoiles + points forts + un mot), les avis s'affichent sur la page du commerce
-- avec le résumé des points forts ; la note moyenne sert aux « Les mieux notés » / « Recommandé ».
-- Migration appliquée : avis_commerces.
alter table public.orders add column if not exists shop_tags text[];

create or replace function public.rate_shop_tags(p_token uuid, p_stars integer, p_tags text[], p_note text)
returns boolean language plpgsql security definer set search_path = public as $$
declare ok text[] := array['gout','chaud','portions','emballe','frais','prix','choix','accueil'];
begin
  if p_stars is null or p_stars < 1 or p_stars > 5 then raise exception 'bad_rating'; end if;
  update orders set shop_rating = p_stars,
    shop_tags = (select coalesce(array_agg(distinct x), '{}') from unnest(coalesce(p_tags, '{}')) x where x = any(ok)),
    shop_note = left(nullif(trim(p_note), ''), 300), shop_rated_at = now()
   where token = p_token and status = 'livree' and shop_id is not null and shop_rating is null and pickup_at > now() - interval '30 days';
  return found;
end $$;
grant execute on function public.rate_shop_tags(uuid, integer, text[], text) to anon, authenticated;

create or replace function public.shop_reviews(p_code text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'avg', (select round(avg(o.shop_rating)::numeric, 1) from orders o join shops s on s.id = o.shop_id where s.code = p_code and o.shop_rating is not null),
    'count', (select count(*) from orders o join shops s on s.id = o.shop_id where s.code = p_code and o.shop_rating is not null),
    'tags', coalesce((select json_object_agg(t, n) from (select t, count(*) n from orders o join shops s on s.id = o.shop_id, unnest(coalesce(o.shop_tags, '{}')) t
                       where s.code = p_code and o.shop_rating is not null group by t order by count(*) desc) z), '{}'::json),
    'list', coalesce((select json_agg(json_build_object('stars', x.shop_rating, 'note', x.shop_note, 'tags', x.shop_tags, 'name', split_part(coalesce(x.contact_name, ''), ' ', 1), 'at', x.shop_rated_at) order by x.shop_rated_at desc)
                       from (select o.shop_rating, o.shop_note, o.shop_tags, o.contact_name, o.shop_rated_at from orders o join shops s on s.id = o.shop_id
                              where s.code = p_code and o.shop_rating is not null order by o.shop_rated_at desc limit 10) x), '[]'::json));
$$;
