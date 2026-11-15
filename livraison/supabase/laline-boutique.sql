-- ============================================================================
-- Boutique « HOP! chez Laline » (HOPLALINE, patron, 15/11/2026) : le livreur HOP! achète chez Laline, Kanyon HaSharon
-- (הרצל 60, נתניה). Les meilleures ventes de laline.co.il/collections/best-seller : vrais prix du site, vraies photos (par lien).
--   • lecture par la base : select public.laline_fetch(); ~10 s après : select public.laline_load(<id>);  (→ laline_items)
--   • les 130 premières meilleures ventes disponibles, noms français + hébreu, 7 rubriques.
--   • refaire ce fichier après une nouvelle lecture met à jour les prix et les photos (jamais d'effacement).
-- ============================================================================
create table if not exists public.laline_items (id text primary key, pos int, he text, kind text, handle text, img text, price numeric, old numeric, available boolean, updated_at timestamptz not null default now());
alter table public.laline_items enable row level security;
create or replace function public.laline_fetch() returns bigint language plpgsql security definer set search_path = public as $$
declare r bigint;
begin
  r := net.http_get(url := 'https://www.laline.co.il/collections/best-seller/products.json?limit=250',
    headers := jsonb_build_object('User-Agent', 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36', 'Accept-Language', 'he-IL'), timeout_milliseconds := 60000);
  return r;
end $$;
revoke all on function public.laline_fetch() from public, anon, authenticated;
create or replace function public.laline_load(p_req bigint) returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into laline_items (id, pos, he, kind, handle, img, price, old, available, updated_at)
  select p->>'id', o::int, btrim(p->>'title'), nullif(btrim(p->>'product_type'), ''), p->>'handle', split_part(p->'images'->0->>'src', '?', 1),
         (p->'variants'->0->>'price')::numeric, nullif(p->'variants'->0->>'compare_at_price', '')::numeric, coalesce((p->'variants'->0->>'available')::boolean, false), now()
    from net._http_response r, jsonb_array_elements((r.content::jsonb)->'products') with ordinality t(p, o)
   where r.id = p_req and r.status_code = 200
  on conflict (id) do update set pos = excluded.pos, he = excluded.he, kind = excluded.kind, handle = excluded.handle, img = excluded.img,
     price = excluded.price, old = excluded.old, available = excluded.available, updated_at = now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.laline_load(bigint) from public, anon, authenticated;

-- Logo et couverture : la base garde une petite copie ; l'appli sert les fichiers img/market/laline-*.webp (shop_photo_files)
-- Boutique HOP! + photos Laline autorisées (même règle que UI.extPic dans common.js)
create or replace function public.hop_shop(p_shop uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from shops where id = p_shop and code in ('HOPCARREFOUR', 'HOPBOOOM', 'HOPPANZER', 'HOPRAMILEVY', 'HOPVICTORY', 'HOPLALINE'));
$$;
create or replace function public.ext_photo_ok(u text)
 returns boolean language sql immutable as $function$
  select coalesce(u ~ '^https://(d226b0iufwcjmj\.cloudfront\.net/(gs1-products|product-images|items)/|booomisrael\.co\.il/uploads/|cdn\.shopify\.com/s/files/1/(0371/7965/4281|0598/4278/9424)/|img\.rami-levy\.co\.il/product/|dlv1nnscfbvda\.cloudfront\.net/(gs1|media)/)[A-Za-z0-9._~/%?=&:-]+$', false);
$function$;

insert into public.shops (code, status, name, kind, city, address, lat, lon, contact_name, phone, whatsapp, lang, plan_until, client_pays, cash_ok, kosher,
  featured, showcase, rank, tagline, tagline_he, about, about_he, admin_note, hours, logo, cover)
select 'HOPLALINE', 'suspendu', 'HOP! chez Laline · HOP! בללין', 'boutique', 'netanya', 'הרצל 60, קניון השרון, נתניה', 32.32641, 34.8619,
  'HOP!', '0527790361', '972527790361', 'fr', '2099-12-31', true, true, false, true, true, 6,
  '🎁 Soins, parfums et cadeaux Laline, livrés chez vous', '🎁 טיפוח, בישום ומתנות של ללין עד הבית',
  'Les meilleures ventes de Laline, au vrai prix de la boutique. Vous choisissez, on achète pour vous au Kanyon HaSharon et on vous livre au plus vite. Idéal pour un cadeau de dernière minute.',
  'המוצרים הנמכרים ביותר של ללין, במחיר האמיתי של החנות. אתם בוחרים, אנחנו קונים בשבילכם בקניון השרון ומביאים הכי מהר. מושלם למתנה של הרגע האחרון.',
  'Boutique HOP! (service du patron). Le livreur achète chez Laline, Kanyon HaSharon (הרצל 60), tél. boutique 054-334-5021. Prix du site laline.co.il (meilleures ventes).',
  '[{"d": 0, "h": "09:30-21:00"}, {"d": 1, "h": "09:30-21:00"}, {"d": 2, "h": "09:30-21:00"}, {"d": 3, "h": "09:30-21:00"}, {"d": 4, "h": "09:30-21:00"}, {"d": 5, "h": "09:00-14:00"}, {"d": 6, "h": ""}]'::jsonb,
  'data:image/webp;base64,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',
  'data:image/webp;base64,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'
where not exists (select 1 from public.shops where code = 'HOPLALINE');
insert into public.shop_photo_files (h, path)
select md5(logo), 'img/market/laline-logo.webp' from public.shops where code = 'HOPLALINE' and logo is not null
union all select md5(cover), 'img/market/laline-cover.webp' from public.shops where code = 'HOPLALINE' and cover is not null
on conflict (h) do update set path = excluded.path;
insert into public.shop_categories (id, shop_id, name, position)
select md5('HOPLALINE:cat:' || k)::uuid, (select id from public.shops where code = 'HOPLALINE'), n, p from (values
  ('corps', '🧴 Corps · גוף', 1),
  ('parfums', '🌸 Brumes & parfums · בישום', 2),
  ('mains', '🤲 Mains · ידיים', 3),
  ('bain', '🛁 Bain & douche · רחצה', 4),
  ('maison', '🕯️ Maison & bougies · לבית', 5),
  ('visage', '💆 Visage · פנים', 6),
  ('cadeaux', '🎁 Cadeaux · מתנות', 7)) v(k, n, p)
on conflict (id) do nothing;

-- Les 130 meilleures ventes (noms français ici, hébreu et prix : laline_items)
with fr(id, fr, cat) as (values
('7594168156208','Crème mains Vanilla Pink Pepper 30 ml','mains'),
('7717166809136','Crème corps riche Shea & Kukui 250 ml','corps'),
('7590479331376','Fleur de douche en dentelle','bain'),
('7594167861296','Brume corps Vanilla Pink Pepper 60 ml','parfums'),
('7590478676016','Gommage lèvres 15 g','visage'),
('7594174283824','Crème mains Frozen Pear 30 ml','mains'),
('7590490636336','Pierre parfumée pour voiture Vanilla Pink Pepper','maison'),
('7590481625136','Diffuseur électrique Bluetooth avec lumière','maison'),
('7594173890608','Brume corps Frozen Pear 60 ml','parfums'),
('7594170777648','Diffuseur de parfum classique Frozen Pear 200 ml','maison'),
('7594187391024','Crème corps Warm Vanilla 350 ml','corps'),
('7766529343536','Gel douche Shea & Kukui 300 ml','bain'),
('7622215663664','Crème corps riche Mineral 250 ml','corps'),
('7590491914288','Pierre parfumée pour voiture Frozen Pear','maison'),
('7686484951088','Gommage corps Vanilla Pink Pepper 300 g','corps'),
('7590495486000','Brume corps Warm Vanilla 100 ml','parfums'),
('7590479298608','Brosse à cheveux','cadeaux'),
('7718118457392','Brume corps Shea & Kukui 100 ml','parfums'),
('7717166841904','Crème gommante Shea & Kukui 250 ml','corps'),
('7718551879728','Peignoir éponge rose','cadeaux'),
('7766497853488','Boîte cadeau classique crème M','cadeaux'),
('7590495715376','Diffuseur de parfum classique Warm Vanilla 200 ml','maison'),
('7594131259440','Boîte cadeau classique crème L','cadeaux'),
('7594164813872','Brume corps Vanilla Pink Pepper 100 ml','parfums'),
('7622215893040','Crème mains Mineral 30 ml','mains'),
('7594167173168','Crème mains Vanilla Pink Pepper 100 ml','mains'),
('7727738683440','Peignoir éponge blanc','cadeaux'),
('7622215761968','Crème mains Mineral 100 ml','mains'),
('7590478184496','Lingettes démaquillantes','visage'),
('7590483230768','Crème corps riche Botanic 250 g','corps'),
('7687614201904','Gommage corps Warm Vanilla 300 g','corps'),
('7594135453744','Crème beurre Collagène + Vitamine C 250 ml','corps'),
('7594171465776','Brume corps Frozen Pear 100 ml','parfums'),
('7590492897328','Baume à lèvres hydratant SPF Shea & Kukui 10 g','visage'),
('7590477463600','Mousse nettoyante visage 150 ml','visage'),
('7590475989040','Crème corps pour homme','corps'),
('7773029957680','Gel douche Mineral 300 ml','bain'),
('7590487719984','Huile parfumée pour diffuseur électrique Ocean','maison'),
('7590481756208','Lot de 4 trousses de toilette nude','cadeaux'),
('7766501163056','Gel douche Warm Vanilla 500 ml','bain'),
('7594166124592','Crème corps Vanilla Pink Pepper 350 ml','corps'),
('7590490800176','Diffuseur de parfum classique Vanilla Pink Pepper 100 ml','maison'),
('7590495223856','Crème mains Warm Vanilla 100 ml','mains'),
('7594188275760','Crème beurre Warm Vanilla 200 ml','corps'),
('7594190897200','Pierre parfumée pour voiture Warm Vanilla','maison'),
('7926967271472','Gel douche Vanilla Pink Pepper 500 ml','bain'),
('7594167533616','Crème soufflée Vanilla Pink Pepper 300 ml','corps'),
('7594173268016','Crème mains Frozen Pear 100 ml','mains'),
('7622216155184','Diffuseur de parfum Mineral 220 ml','maison'),
('7626587897904','Brume corps Mineral 100 ml','parfums'),
('7594164486192','Coffret voyage Vanilla Pink Pepper','cadeaux'),
('7590477398064','Gommage nettoyant visage 100 ml','visage'),
('7713774796848','Parfum pour textile Shea 500 ml','maison'),
('7590480543792','Éponge en bambou avec poignée','bain'),
('7594121723952','Déodorant stick Mr Laline','corps'),
('7590493323312','Bougie d''ambiance en verre Shea & Kukui 160 g','maison'),
('7686485344304','Diffuseur de parfum en verre Shea & Kukui 220 ml','maison'),
('7590484770864','Huile corps Collagène + Vitamine C 100 ml','corps'),
('7590477037616','Crème corps Yaldut 350 g','corps'),
('7590495649840','Diffuseur de parfum classique Warm Vanilla 100 ml','maison'),
('7590492045360','Diffuseur de parfum classique Frozen Pear 100 ml','maison'),
('7686226935856','Gommage corps Frozen Pear 300 g','corps'),
('7590491357232','Crème corps Vanilla Pink Pepper 200 ml','corps'),
('7594178019376','Diffuseur de parfum classique Violet Amber 200 ml','maison'),
('7590478381104','Crème visage protection SPF 50','visage'),
('7590476054576','Crème mains pour homme 100 g','mains'),
('7686485573680','Crème soufflée Warm Vanilla 300 ml','corps'),
('7590495420464','Savon mousse fouettée Warm Vanilla 200 ml','bain'),
('7718552404016','Huile de douche Shea & Kukui 300 ml','bain'),
('7718551912496','Peignoir éponge gris','cadeaux'),
('7895567466544','Huile parfumée pour brûleur Mineral','maison'),
('7594178215984','Coffret voyage Violet Amber','cadeaux'),
('7594122018864','Shampooing + gel douche Mr Laline 500 ml','bain'),
('7590483951664','Crème mains Pro Collagène + Vitamine C 100 ml','mains'),
('7631955460144','Lait corps Mineral 200 ml','corps'),
('7877053579312','Miroir de maquillage avec éclairage LED','cadeaux'),
('7594181132336','Crème corps Violet Amber 350 ml','corps'),
('7590476283952','Crème visage Mr Laline 90 ml','visage'),
('7590483722288','Gel douche Pro Collagène + Vitamine C','bain'),
('7590492373040','Crème corps Frozen Pear 200 ml','corps'),
('7594121527344','Parfum Mr Laline 100 ml','parfums'),
('7590489980976','Bain moussant et gel corps Cherry Blossom 500 ml','bain'),
('7590476709936','Brume corps Yaldut 60 ml','parfums'),
('7626587570224','Gommage corps végan Mineral 250 g','corps'),
('7594125492272','Brume corps Yaldut 150 ml','parfums'),
('7626588094512','Sérum corps biphasé Mineral 100 ml','corps'),
('7594173628464','Crème soufflée Frozen Pear 300 ml','corps'),
('7686485901360','Bougie de massage Shea & Kukui 160 g','maison'),
('7590478118960','Crème de nuit riche 50 ml','visage'),
('7599060582448','Diffuseur électrique Starlight à brume froide','maison'),
('7926967304240','Gel douche Frozen Pear 500 ml','bain'),
('7594165370928','Savon mousse fouettée Vanilla Pink Pepper 200 ml','bain'),
('7718552305712','Parfum pour textile Warm Vanilla 30 ml','maison'),
('7718118490160','Lait-crème corps Shea & Kukui 200 ml','corps'),
('7686236897328','Crème soufflée Ocean 300 ml','corps'),
('7590484017200','Crème corps Pro Collagène + Vitamine C 200 ml','corps'),
('7989975744560','Carte de vœux Botanic Peony','cadeaux'),
('7590483886128','Gommage corps végan Pro Collagène + Vitamine C 250 g','corps'),
('7590483689520','Huile visage Pro Collagène + Vitamine C 30 ml','visage'),
('7590490898480','Diffuseur de parfum classique Vanilla Pink Pepper 200 ml','maison'),
('7590493880368','Pierre parfumée pour voiture Violet Amber','maison'),
('7623723352112','Bougie parfumée Mineral','maison'),
('7626587439152','Crème corps Frozen Pear 350 ml','corps'),
('7594154754096','Crème mains Ocean 100 ml','mains'),
('7594128212016','Crème Hydra riche en hydratation 50 ml','visage'),
('7594159210544','Brume corps Cherry Blossom 100 ml','parfums'),
('7623723155504','Parfum pour textile Olive & Babassu 500 ml','maison'),
('7590476480560','Brosse à cheveux avec miroir','cadeaux'),
('7594158719024','Diffuseur de parfum classique Cherry 200 ml','maison'),
('7590476120112','Baume après-rasage 90 g','visage'),
('7590483427376','Bougie en verre Olive & Babassu 255 g','maison'),
('7594178641968','Brume corps Violet Amber 100 ml','parfums'),
('7590478315568','Masque visage en tissu GLOW','visage'),
('7686485475376','Eau de toilette Warm Vanilla 100 ml','parfums'),
('7590479429680','Brosse corps à manche','bain'),
('7687614136368','Gommage corps Ocean 300 g','corps'),
('7626588454960','Huile corps Mineral 100 ml','corps'),
('7594125590576','Gel douche Yaldut 350 ml','bain'),
('7631954903088','Savon mousse corps et mains Vanilla Pink Pepper 300 ml','mains'),
('7594171858992','Savon mousse fouettée Frozen Pear 200 ml','bain'),
('7590477987888','Booster raffermissant 30 ml','visage'),
('7957880930352','Bougie d''ambiance Warm Vanilla 70 g','maison'),
('7686485377072','Gommage corps Violet Amber 300 g','corps'),
('7590495354928','Crème corps Warm Vanilla 200 ml','corps'),
('7590483132464','Gommage corps végan Botanic 250 ml','corps'),
('7718552436784','Huile sèche scintillante Shea & Kukui 100 ml','corps'),
('7623713947696','Masque de nuit Mineral 100 ml','visage'),
('7590494011440','Diffuseur de parfum classique Violet Amber 100 ml','maison'),
('7590476841008','Savon mousse fouettée Yaldut 200 ml','bain'),
('7631955198000','Savon mousse corps et mains Violet Amber 300 ml','mains')
)
insert into public.shop_products (id, shop_id, category_id, name, description, price, photo_url, available, position)
select md5('HOPLALINE:' || v.id)::uuid, (select id from public.shops where code = 'HOPLALINE'), md5('HOPLALINE:cat:' || fr.cat)::uuid,
  (select case when char_length(x) <= 80 then x else regexp_replace(left(x, 81), '\s+\S*$', '') end from (select fr.fr || ' · ' || replace(btrim(v.he, E' \n\r\t'), '&amp;', '&') x) z),
  null, v.price, v.img || '?width=600', v.available and v.price > 0, v.pos
from public.laline_items v join fr on fr.id = v.id where v.img is not null
on conflict (id) do update set name = excluded.name, price = excluded.price, photo_url = excluded.photo_url, available = excluded.available, position = excluded.position;

-- Après la mise en ligne de l'appli (config.hopShops + common.js EXT_PIC) : update public.shops set status = 'actif' where code = 'HOPLALINE';
