-- ============================================================================
-- Recherche intelligente (demande du patron du 06/11/2026 : « la personne marque un truc et on trouvera tout »)
-- • synonymes français / hébreu / anglais / translittération (pain = לחם = lehem = bread…), table search_synonyms
--   (le patron peut en ajouter : une ligne = un groupe de mots qui veulent dire la même chose)
-- • sans accents, singulier / pluriel (œufs = oeuf), petites fautes de frappe (similarité pg_trgm)
-- • automatique pour TOUS les commerces, y compris les prochains catalogues et les produits ajoutés plus tard
-- Le client appelle products_search_v3 (repli sur v2 puis v1) ; search_synonyms() sert aussi aux rayons HOP!.
-- Uniquement create / create or replace / if not exists : rien n'est supprimé.
-- ============================================================================
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create table if not exists public.search_synonyms (
  id bigserial primary key,
  words text[] not null,
  created_at timestamptz not null default now()
);
alter table public.search_synonyms enable row level security;

-- Texte comparable : minuscules, sans accents, œ → oe
create or replace function public.search_norm(p text) returns text
language sql immutable set search_path = public, extensions as $$
  select regexp_replace(lower(extensions.unaccent(replace(replace(coalesce(p, ''), 'œ', 'oe'), 'Œ', 'oe'))), '\s+', ' ', 'g')
$$;

-- Premier remplissage (seulement si la table est vide)
insert into public.search_synonyms (words)
select g from (values
  (array['pain','pains','lehem','לחם','לחמים','bread']),
  (array['lait','halav','חלב','milk']),
  (array['oeuf','oeufs','ביצה','ביצים','beitsim','egg','eggs']),
  (array['eau','mayim','מים','water']),
  (array['couche','couches','חיתול','חיתולים','pampers','huggies','diapers']),
  (array['lingettes','מגבונים','wipes']),
  (array['papier toilette','papier wc','נייר טואלט','toilet paper']),
  (array['fromage','fromages','גבינה','גבינות','gvina','cheese']),
  (array['beurre','חמאה','butter']),
  (array['yaourt','yaourts','yogourt','יוגורט','yogurt']),
  (array['cafe','קפה','coffee']),
  (array['the','תה','tea']),
  (array['sucre','סוכר','sugar']),
  (array['sel','מלח','salt']),
  (array['riz','אורז','rice']),
  (array['pates','פסטה','pasta','spaghetti','ספגטי']),
  (array['huile','שמן','oil']),
  (array['tomate','tomates','עגבניה','עגבניות','tomato']),
  (array['concombre','concombres','מלפפון','מלפפונים','cucumber']),
  (array['banane','bananes','בננה','בננות','banana']),
  (array['pomme','pommes','תפוח','תפוחים','apple']),
  (array['poulet','עוף','chicken']),
  (array['viande','בשר','meat']),
  (array['poisson','דג','דגים','fish']),
  (array['chocolat','שוקולד','chocolate']),
  (array['bonbons','bonbon','ממתקים','ממתק','candy']),
  (array['chips','צ''יפס','ציפס']),
  (array['coca','coca-cola','coca cola','קוקה קולה','קולה','cola']),
  (array['biere','bieres','בירה','beer']),
  (array['vin','vins','יין','wine']),
  (array['cigarette','cigarettes','סיגריה','סיגריות','sigariot']),
  (array['paracetamol','acamol','אקמול','dexamol','דקסמול']),
  (array['shampoing','shampooing','שמפו','shampoo']),
  (array['savon','סבון','soap']),
  (array['dentifrice','משחת שיניים','toothpaste']),
  (array['lessive','אבקת כביסה','ג''ל כביסה','detergent']),
  (array['piles','pile','סוללות','סוללה','batteries']),
  (array['glace','glaces','גלידה','ice cream']),
  (array['jus','מיץ','juice']),
  (array['croquettes','אוכל לכלבים','אוכל לחתולים']),
  (array['fleurs','fleur','bouquet','פרחים','זר פרחים','flowers']),
  (array['bamba','במבה']),
  (array['bissli','ביסלי']),
  (array['houmous','humus','hummus','חומוס']),
  (array['pita','pitas','pitot','פיתה','פיתות']),
  (array['challah','hala','halla','חלה']),
  (array['farine','קמח','flour']),
  (array['cornichons','cornichon','חמוצים','מלפפון חמוץ','pickles']),
  (array['pain de mie','לחם פרוס','toast']),
  (array['petits pains','lahmaniot','לחמניות'])
) v(g)
where not exists (select 1 from public.search_synonyms);

-- Mots à chercher pour une requête : la requête, son singulier, et ses synonymes
create or replace function public.search_terms(p_q text) returns text[]
language sql stable security definer set search_path = public, extensions as $$
  with q as (select public.search_norm(trim(p_q)) s),
  base as (select s from q union select regexp_replace(s, '(s|x)$', '') from q where length(s) > 3)
  select coalesce(array_agg(distinct t), '{}') from (
    select s as t from base
    union select public.search_norm(w) from public.search_synonyms g, unnest(g.words) w
     where exists (select 1 from base b, unnest(g.words) x where public.search_norm(x) = b.s)
  ) z where length(t) >= 2
$$;

-- Tous les groupes de synonymes (pour les rayons HOP!, côté téléphone)
create or replace function public.search_synonyms_all() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(words order by id), '[]'::json) from public.search_synonyms
$$;
grant execute on function public.search_synonyms_all() to anon, authenticated;

-- Recherche des produits de tous les commerces : mêmes champs que v2 (photo par lien, jamais intégrée)
create or replace function public.products_search_v3(p_q text) returns json
language sql stable security definer set search_path = public, extensions as $$
  with t as (select public.search_terms(p_q) terms, public.search_norm(trim(p_q)) q),
  cand as (
    select p.id, p.name, p.price, p.photo_url, p.photo_h, p.category_id, p.position, s.code, s.name as shop, s.kind, s.rank,
           public.search_norm(p.name) nn, public.search_norm(coalesce(p.description, '')) dd
      from shop_products p join shops s on s.id = p.shop_id
     where p.available and s.status = 'actif' and not s.demo and (s.plan_until >= current_date or s.showcase)
  ),
  scored as (
    select c.*, (select coalesce(max(case when c.nn like tt || '%' then 4
                                         when c.nn like '% ' || tt || '%' or c.nn like '%·' || tt || '%' or c.nn like '%· ' || tt || '%' then 3
                                         when c.nn like '%' || tt || '%' then 2
                                         when c.dd like '%' || tt || '%' then 1 end), 0)
                   from unnest(t.terms) tt) as sc,
           extensions.word_similarity(t.q, c.nn) as sim
      from cand c, t
     where length(t.q) >= 2
  ),
  hits as (select * from scored where sc > 0),
  -- Fautes de frappe : seulement si on n'a presque rien trouvé
  fuzzy as (select * from scored where sc = 0 and sim >= 0.5 and (select count(*) from hits) < 4)
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
           limit 24) x
$$;
grant execute on function public.products_search_v3(text) to anon, authenticated;
