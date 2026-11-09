-- 08/11 : catalogue plus léger (règle du patron : shop_catalog < 150 Ko), sans rien perdre.
--  · JSON compact (jsonb), champs vides omis (description, photo, category_id nuls)
--  · liens des photos Carrefour raccourcis : « https://d226b0iufwcjmj.cloudfront.net/gs1-products/1540/medium/… » → « @… »
--    (store.js / unpackCatalog remet le lien complet sur le téléphone). À appliquer APRÈS la mise en ligne de l'appli.
create or replace function public.shop_catalog(p_code text) returns json
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.position, c.created_at)
                              from shop_categories c where c.shop_id = s.id), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', p.id, 'category_id', p.category_id, 'name', p.name,
                              'description', p.description, 'price', p.price,
                              'photo', case when ext_photo_ok(p.photo_url)
                                              then regexp_replace(p.photo_url, '^https://d226b0iufwcjmj\.cloudfront\.net/gs1-products/1540/medium/', '@')
                                            when p.photo_h is null then null
                                            else coalesce((select f.path from shop_photo_files f where f.h = p.photo_h),
                                                          'ph:' || p.id || ':' || left(p.photo_h, 12)) end,
                              'available', p.available))
                              order by p.position, p.created_at)
                            from shop_products p where p.shop_id = s.id), '[]'::jsonb))::json
    from shops s
   where s.code = upper(trim(p_code)) and s.status in ('actif', 'en_attente') and s.plan_until >= current_date;
$$;

-- 09/11 (en ligne) : boutiques HOP! (HOPCARREFOUR, HOPBOOOM, HOPPANZER, catalogues gérés par nous) : l'identifiant
-- de rayon est raccourci à 8 caractères dans le catalogue envoyé au client (rayon et produits, même valeur).
-- HOP! chez Carrefour : 150,3 Ko → 135,8 Ko, ce qui a permis d'ajouter 58 chocolats et confiseries (Mars, Snickers,
-- Bounty, Twix, M&M's, Kinder, KitKat, Klik, Pesek Zman, Skittles…) au prix Carrefour normal (rayon super / snack) : 150,9 Ko.
create or replace function public.shop_catalog(p_code text)
 returns json
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', case when h.hop then left(c.id::text, 8) else c.id::text end, 'name', c.name) order by c.position, c.created_at)
                              from shop_categories c where c.shop_id = s.id), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', p.id,
                              'category_id', case when h.hop then left(p.category_id::text, 8) else p.category_id::text end, 'name', p.name,
                              'description', p.description, 'price', p.price,
                              'photo', case when ext_photo_ok(p.photo_url)
                                              then regexp_replace(p.photo_url, '^https://d226b0iufwcjmj\.cloudfront\.net/gs1-products/1540/medium/', '@')
                                            when p.photo_h is null then null
                                            else coalesce((select f.path from shop_photo_files f where f.h = p.photo_h),
                                                          'ph:' || p.id || ':' || left(p.photo_h, 12)) end,
                              'available', p.available))
                              order by p.position, p.created_at)
                            from shop_products p where p.shop_id = s.id), '[]'::jsonb))::json
    from shops s
    cross join lateral (select s.code in ('HOPCARREFOUR', 'HOPBOOOM', 'HOPPANZER') as hop) h
   where s.code = upper(trim(p_code)) and s.status in ('actif', 'en_attente') and s.plan_until >= current_date;
$function$;
