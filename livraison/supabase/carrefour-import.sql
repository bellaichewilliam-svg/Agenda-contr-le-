-- ============================================================================
-- Import des produits Carrefour (carrefour.co.il) dans les rayons HOP! (table rayon_items)
-- 1) select public.carrefour_fetch(79684);            -- n° de catégorie de l'adresse carrefour.co.il/categories/<n°>/products
--    (plus de 100 produits : carrefour_fetch(79684, 100), puis 200…)
-- 2) attendre ~5 s, puis : select * from public.carrefour_import(<id rendu à l'étape 1>, 'super', 'bois', 'water', '💧');
--    → ajoute / met à jour les produits (prix Carrefour normal, sans promo), item_id = 'cf' || id Carrefour.
--    Un produit déjà importé garde son nom français (on ne met à jour que le prix et l'hébreu).
-- 3) les lignes rendues avec « a_traduire = true » ont un nom français provisoire : le traduire (update rayon_items set name_fr = …).
-- Agence de référence : Carrefour Online Kfar Saba (3003), la plus proche de Netanya. Le site exige le Referer (sinon Cloudflare 403).
-- ============================================================================
create table if not exists public.carrefour_brands (he text primary key, fr text not null);
insert into public.carrefour_brands (he, fr) values
 ('מי עדן','Mei Eden'),('נורדיק מיסט','Nordic Mist'),('סן בנדטו','San Benedetto'),('סן פלגרינו','San Pellegrino'),('שוופס','Schweppes'),
 ('סודה סטרים','SodaStream'),('טמפו','Tempo'),('קינלי','Kinley'),('עין גדי','Ein Gedi'),('נביעות','Neviot'),('אקווה נובה','Aqua Nova'),
 ('קוקה קולה','Coca-Cola'),('ספרייט','Sprite'),('פאנטה','Fanta'),('פפסי','Pepsi'),('פריגת','Prigat'),('ספרינג','Spring'),('תפוזינה','Tapuzina'),
 ('פרימור','Primor'),('טרופיקנה','Tropicana'),('תנובה','Tnuva'),('טרה','Tara'),('יטבתה','Yotvata'),('שטראוס','Strauss'),('אסם','Osem'),
 ('עלית','Elite'),('תלמה','Telma'),('ויסוצקי','Wissotzky'),('נסקפה','Nescafé'),('קרפור','Carrefour'),('יופלה','Yoplait'),('דנונה','Danone'),
 ('גולדסטאר','Goldstar'),('מכבי','Maccabee'),('קרלסברג','Carlsberg'),('הייניקן','Heineken'),('טובורג','Tuborg'),('רד בול','Red Bull'),('XL','XL')
on conflict (he) do nothing;
alter table public.carrefour_brands enable row level security;

create or replace function public.carrefour_fetch(p_cat int, p_from int default 0, p_size int default 100) returns bigint
language sql security definer set search_path = public, net as $$
  select net.http_get(
    url := format('https://www.carrefour.co.il/v2/retailers/1540/branches/3003/categories/%s/products?appId=4&from=%s&size=%s', p_cat, p_from, p_size),
    headers := jsonb_build_object('User-Agent', 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
      'Accept', 'application/json, text/plain, */*', 'Referer', format('https://www.carrefour.co.il/categories/%s/products', p_cat), 'Accept-Language', 'he-IL,he;q=0.9'),
    timeout_milliseconds := 30000);
$$;

create or replace function public.carrefour_import(p_req bigint, p_rayon text, p_cat text, p_img text default 'basket', p_emoji text default '🛒')
returns table (item_id text, name_fr text, name_he text, prix numeric, a_traduire boolean)
language plpgsql security definer set search_path = public, net as $$
#variable_conflict use_column
declare body json;
begin
  select r.content::json into body from net._http_response r where r.id = p_req and r.status_code = 200;
  if body is null then raise exception 'carrefour_pas_de_reponse (attendre quelques secondes, ou relancer carrefour_fetch)'; end if;
  return query
  with src as (
    select row_number() over () rn, p->>'id' pid, trim(p->'names'->'1'->>'short') nm, coalesce(p->'brand'->'names'->>'1', '') br,
           (p->'branch'->>'regularPrice')::numeric price, nullif(p->>'weight', '')::numeric w, coalesce(p->'unitOfMeasure'->'names'->>'1', '') uom,
           coalesce((p->>'numberOfItems')::int, 1) n
      from json_array_elements(body->'products') p
     where (p->'branch'->>'regularPrice') is not null
  ), t as (
    select s.*, coalesce(b.fr, s.br) brfr,
      case when s.w is null then '' when s.uom in ('ליטר', 'ק"ג', 'קג') then (case when s.w = trunc(s.w) then trunc(s.w)::text else rtrim(rtrim(s.w::text, '0'), '.') end)
           else trunc(s.w)::int::text end num,
      case when s.uom = 'ליטר' then 'L' when s.uom in ('ק"ג', 'קג') then 'kg' when s.uom = 'מ"ל' then 'ml' when s.uom = 'גרם' then 'g' else '' end ufr,
      case when s.uom in ('ליטר', 'ק"ג', 'קג') then coalesce(s.w, 0.3) when s.uom in ('מ"ל', 'גרם') then coalesce(s.w, 300) / 1000 else 0.3 end qty
    from src s left join carrefour_brands b on b.he = s.br
  ), up as (
    insert into rayon_items as i (rayon, item_id, cat, name_fr, name_he, price_lo, price_hi, img, emoji, sz, hidden, position, updated_at)
    select p_rayon, 'cf' || t.pid, p_cat,
      left(t.brfr || ' · ' || regexp_replace(t.nm, '\s+\d.*$', '') || case when t.num = '' then '' else ' ' || case when t.n > 1 then t.n || ' × ' else '' end || replace(t.num, '.', ',') || ' ' || t.ufr end, 80),
      left(t.br || ' · ' || regexp_replace(t.nm, '\s+\d.*$', '') || case when t.num = '' then '' else ' ' || case when t.n > 1 then t.n || ' × ' else '' end || t.num || ' ' || t.uom end, 80),
      round(t.price, 1), round(t.price, 1), p_img, p_emoji, least(8, greatest(1, ceil(t.qty * t.n * 0.9)))::int, false, 100 + t.rn::int, now()
    from t
    on conflict (rayon, item_id) do update set price_lo = excluded.price_lo, price_hi = excluded.price_hi, name_he = excluded.name_he, updated_at = now()
    returning i.item_id, i.name_fr, i.name_he, i.price_lo
  )
  select up.item_id, up.name_fr, up.name_he, up.price_lo, up.name_fr ~ '[֐-׿]' from up;
end $$;
revoke all on function public.carrefour_fetch(int, int, int) from public, anon, authenticated;
revoke all on function public.carrefour_import(bigint, text, text, text, text) from public, anon, authenticated;
