-- ============================================================================
-- Boutique « HOP! chez Victory » (HOPVICTORY, patron, 10/11/2026) : le livreur HOP! fait les courses chez Victory Netanya
-- (האורזים 4, à côté de Rami Lévy). Vraies promos, vrais prix, vraies photos (par lien) :
--   • promos : la page « מבצעים » de la boutique en ligne Victory (victoryonline.co.il/category/מבצעים?page=40, 480 promos),
--     lue par la base (victory_sync → victory_items). Le site officiel des prix (laibcatalog) refuse les connexions hors d'Israël.
--   • les 125 plus grosses remises (≥ 10 %, sans alcool, ≤ 150 ₪), noms français (data/victory-fr.tsv) + hébreu, rubriques.
--   • lots « 2 ב-₪25 » → « 2 pour 25 ₪ au lieu de 2 × prix » ; prix simples → « X ₪ au lieu de Y ₪ » (même format que Rami Lévy :
--     promos_all() et promos_home() les lisent tout seuls).
-- ============================================================================
-- Lecture des promos (base) : la page « מבצעים » du site Victory (?page=40 = toutes les promos d'un coup, ~480)
create table if not exists public.victory_sync (req bigint primary key, at timestamptz not null default now());
alter table public.victory_sync enable row level security;
create table if not exists public.victory_items (id text primary key, he text, brand text, img text, price numeric, old numeric, tag text, slug text, updated_at timestamptz not null default now());
alter table public.victory_items enable row level security;
-- insert into victory_sync (req) select net.http_get(url := 'https://www.victoryonline.co.il/category/%D7%9E%D7%91%D7%A6%D7%A2%D7%99%D7%9D?page=40',
--   headers := jsonb_build_object('User-Agent', 'Mozilla/5.0 …', 'Accept-Language', 'he-IL'), timeout_milliseconds := 60000);
-- puis, ~15 s après : chaque carte « data-component="product-card" » → victory_items (id, nom = alt de l'image, taille, photo
-- dlv1nnscfbvda.cloudfront.net/gs1|media, prix, ancien prix, étiquette « 2 ב-₪25 » ou « ₪12.9 ליחידה »).

-- Boutique HOP! + photos Victory autorisées (même règle que UI.extPic dans common.js)
create or replace function public.hop_shop(p_shop uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from shops where id = p_shop and code in ('HOPCARREFOUR', 'HOPBOOOM', 'HOPPANZER', 'HOPRAMILEVY', 'HOPVICTORY'));
$$;
create or replace function public.ext_photo_ok(u text)
 returns boolean language sql immutable as $function$
  select coalesce(u ~ '^https://(d226b0iufwcjmj\.cloudfront\.net/(gs1-products|product-images|items)/|booomisrael\.co\.il/uploads/|cdn\.shopify\.com/s/files/1/0371/7965/4281/|img\.rami-levy\.co\.il/product/|dlv1nnscfbvda\.cloudfront\.net/(gs1|media)/)[A-Za-z0-9._~/%?=&:-]+$', false);
$function$;

insert into public.shops (code, status, name, kind, city, address, lat, lon, contact_name, phone, whatsapp, lang, plan_until, client_pays, cash_ok, kosher,
  featured, showcase, rank, tagline, tagline_he, about, about_he, admin_note, logo, cover)
select 'HOPVICTORY', 'suspendu', 'HOP! chez Victory · HOP! בויקטורי', 'epicerie', 'netanya', 'האורזים 4, נתניה', 32.3208081, 34.8715060,
  'HOP!', '0527790361', '972527790361', 'fr', '2099-12-31', true, true, false, true, true, 5,
  '🛒 On fait vos courses pour vous chez Victory', '🛒 עושים לכם את הקניות בויקטורי',
  'Les promos de Victory, au vrai prix Victory. Vous choisissez, on fait les courses pour vous et on vous livre au plus vite.',
  'המבצעים של ויקטורי, במחיר האמיתי של ויקטורי. אתם בוחרים, אנחנו עושים לכם את הקניות ומביאים הכי מהר.',
  'Boutique HOP! (service du patron). Le livreur achète chez Victory Netanya, האורזים 4 (à côté de Rami Lévy). Promos de la boutique en ligne Victory ; lots « 2 pour … » à respecter.',
  'data:image/webp;base64,UklGRvIDAABXRUJQVlA4IOYDAADwEgCdASpgAGAAPsFWpk6npCOiKBOaqPAYCUAZgg92Aoyu2Z8wHQd3lX0Oelibxbyr76ffHh23sWAuliZ/JP1m3YNi/FkDe124x9/Uw2Gewv9bU61ospGFIFtSwDEKmkPoNac5kuwuc/9yJ9qyA1uUnvBr0hXUkbVpdB4nmS6vf3iIgjR++MInLKIRuGcS+tWKBzm1vv+wGe6NcF6KfS4AAP74Ryo8B2BPjz1mlhzA9Sb/exwcUiIhS5fY4PgzWrSVoLPniww1j2onVdNBCTSXh22BpIbnzGbrNRsYdyh1mAG9rJD9R1nKcabCH4/5nI7IVYobNfm+UAlIRGXtaXOlgj43zgKwHjAnNklXK+t0U8aClBu0ag0AynnKbqXakotpQX0dOUzq1osQDaM6yODSoUS2pc8rqGQqq1GPjf6UUVWC3leaSQD2hqFBIRINO5MRx4RJqN3AzBtsnTEntpDGVVKTbegh2ckydO6ybctbVbms4TdVSq+gBz9o+H7daqdmwLiVPFAvZKFiGx3ornZy7GxCtA77nOAXZ/kcVHdXCQTl9rIkdxQ+HLN8Tn4tZoCHXPzzu8mVfyiu/KIgOXP4GclgirQ91uwHLykG+o3khAGaos6J1HHp5wRjDZ3setiwLjA8aldPIEEEiksrO+8jKZ+8WkTghHZJ4Jvx07pHiDE3PZvKNq3CAgn1z3zFOhj+lY039AqIraQy98/CED9PXeuB2YZoUI42pciP0peyFcNZ/li9IYxJo/fmbDI2VFu3zKpboj/aVfV/gh0AKF/7sdjbwA0SarPTKxfET/fLAaMMr//5u/C8K2MrcK5f03tqZU5h/YLYEH1Dl9zUCbK+tGF0DBG6kGEM/nIGs7lAp/H3KHpydoCc0LG6ZmnR/tcGPcymgAlj77Y7vPYdRp7Zu7qXIj9p2LAnuxnU87ydCe4pjlxZHZvtWq9iSATAZohhaa48MoijOKLfoYz0r+LYdqRiN/V5h2CEV96AvFY93Qjqdf6o7Mo21mRC1HgtyxSjOxbN+m+19Beu0gk7y0xSoK/yZFWfS8TeCv0Af2LJwVM1T7jJZBiJcNdVt4L806Zj+XcHUdDtgMrpzvUuq3WIY+bJN/PuBEPLdfyIT99lINnWtCQgsX1/SUUkki9enUO0l0LFrO3xG0DdGHnY2RldiBpEH6m8G4KOcY7EZekEtLukRCNb+D7vIPwuyX5BE1WFWUfA8cDNzitXOGWYDkCQNCzyAaveDHSBoX6E+TJ4L3SWospavP4mMZDj2KY4hyE9q/o0OgQuO817naoEyNpW2djCOoYN7Csd9vq4erBRQFA0MAAAAA==', 'data:image/webp;base64,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'
where not exists (select 1 from public.shops where code = 'HOPVICTORY');
insert into public.shop_photo_files (h, path)
select md5(logo), 'img/market/victory-logo.webp' from public.shops where code = 'HOPVICTORY' and logo is not null
union all select md5(cover), 'img/market/victory-cover.webp' from public.shops where code = 'HOPVICTORY' and cover is not null
on conflict (h) do update set path = excluded.path;
insert into public.shop_categories (id, shop_id, name, position)
select md5('HOPVICTORY:cat:' || k)::uuid, (select id from public.shops where code = 'HOPVICTORY'), n, p from (values
  ('snacks', '🍫 Snacks & douceurs · חטיפים ומתוקים', 1),
  ('epicerie', '🥫 Épicerie · מזווה', 2),
  ('laitier', '🧀 Laitiers & desserts · מוצרי חלב', 3),
  ('boissons', '🥤 Boissons · משקאות', 4),
  ('surgeles', '❄️ Surgelés · קפואים', 5),
  ('hygiene', '🧴 Hygiène & beauté · טיפוח', 6),
  ('maison', '🧽 Maison · לבית', 7),
  ('bebe', '👶 Bébé · תינוקות', 8)) v(k, n, p)
on conflict (id) do nothing;

-- Les 125 promos (noms français : data/victory-fr.tsv) ; refaire l'import met à jour prix et promos (jamais d'effacement)
with fr(id, fr, cat) as (values
('2764','XCream · Glaces vanille enrobage pistache-kadaïf « Dubaï » (5 pièces)','surgeles'),
('26633','Boss · Multicuiseur friteuse à air 8 L','maison'),
('5803','Achva · Halva vanille 100 g','snacks'),
('12692','Haofé · Farine de blé blanche tamisée 1 kg','epicerie'),
('18059','Popcorn Popuko Bamba 80 g','snacks'),
('19218','Osem · Chips ondulées 45 g','snacks'),
('19222','Osem · Chips nature 45 g','snacks'),
('19299','Osem · Chips ondulées tomates rôties 45 g','snacks'),
('4936','Popcorn Popko beurre et miel 80 g','snacks'),
('6915','Coton hydrophile','hygiene'),
('10788','Nouilles instantanées goût poulet 70 g','epicerie'),
('11923','Plant Bite · Bouchées schnitzel tofu et maïs 500 g','surgeles'),
('11924','Plant Bite · Bouchées de tofu fondantes 500 g','surgeles'),
('11925','Plant Bite · Nuggets de tofu panés 500 g','surgeles'),
('11931','Plant Bite · Schnitzel tofu et maïs 500 g','surgeles'),
('4979','Osem · Petit-beurre 500 g','snacks'),
('13646','Bamba fourré crème nougat 60 g','snacks'),
('18049','Bamba Munch cheddar 60 g','snacks'),
('18060','Bamba Pro protéinée 80 g','snacks'),
('2844','Roshen · Chocolat noir bullé 80 g','snacks'),
('2845','Roshen · Chocolat au lait bullé 80 g','snacks'),
('2826','Roshen · Barre chocolat au lait crème brûlée 43 g','snacks'),
('2829','Roshen · Barre chocolat au lait caramel 43 g','snacks'),
('2857','Roshen · Barre chocolat au lait beurre de cacahuète 43 g','snacks'),
('2886','Roshen · Barre chocolat au lait amande-coco 38 g','snacks'),
('18056','Mana Hama · Nouilles goût bœuf en sachet 70 g','epicerie'),
('18057','Mana Hama · Nouilles goût poulet en sachet 70 g','epicerie'),
('3844','M&M''s · Chocolat 45 g','snacks'),
('3845','M&M''s · Cacahuètes 45 g','snacks'),
('13647','Bouillon de poule en poudre 400 g','epicerie'),
('19483','Barre protéinée caramel, chocolat au lait et noisettes 60 g','snacks'),
('24586','Red Bull · Sans sucre 250 ml','boissons'),
('24613','Red Bull · Allégé 250 ml','boissons'),
('8279','Argaliot · Gaufrettes cacao 300 g','snacks'),
('8280','Argaliot · Gaufrettes fraise 300 g','snacks'),
('10745','Lait de coco thaï en boîte 400 ml','epicerie'),
('10681','Disques démaquillants 3 × 80','hygiene'),
('3092','Glade · Recharge diffuseur lavande-vanille 269 ml','maison'),
('3094','Glade · Recharge diffuseur parfum lessive 269 ml','maison'),
('9758','Raviolis aux fromages, blé dur 330 g','epicerie'),
('2805','Président · Fromage à la crème 24,5 % 180 g','laitier'),
('9759','Raviolis à la patate douce, blé dur 330 g','epicerie'),
('10676','Cure-dents avec fil dentaire (×100)','hygiene'),
('10797','Argania · Sérum ricin fortifiant racines 100 ml','hygiene'),
('10798','Argania · Sérum acide hyaluronique et kératine 100 ml','hygiene'),
('14281','Apropo · Snack italien 50 g','snacks'),
('14754','Dubonim · Snack goût pizza 40 g','snacks'),
('14755','Dubonim · Snack zoo 40 g','snacks'),
('14772','Apropo · Enrobé chocolat au lait 40 g','snacks'),
('19230','Apropo Tubes · Goût rondelles d''oignon 50 g','snacks'),
('19277','Bamba-Bissli Mix · Grill 70 g','snacks'),
('19278','Bamba-Bissli Mix · Oignon 70 g','snacks'),
('19279','Bamba-Bissli Mix · Barbecue 70 g','snacks'),
('19336','Apropo Tubes · Aigre-piquant 50 g','snacks'),
('4931','Dubonim · Snack 40 g','snacks'),
('4934','Apropo · Classique 50 g','snacks'),
('7843','Dubonim · Snack petits lapins 40 g','snacks'),
('13381','Tahina crue traditionnelle 500 g','epicerie'),
('8573','Tahina au sésame complet 500 g','epicerie'),
('8574','Tahina crue 500 g','epicerie'),
('4886','Pricounim · Galettes soufflées nature 80 g','snacks'),
('4924','Pricounim · Galettes soufflées maïs 80 g','snacks'),
('4995','Osem · Pricounim riz et miel 80 g','snacks'),
('13635','Osem · Chapelure 350 g','epicerie'),
('20172','Pâtes de blé dur semoule 500 g','epicerie'),
('20173','Pâtes de blé dur · Farfalle 500 g','epicerie'),
('20174','Pâtes de blé dur · Penne 500 g','epicerie'),
('23684','Châtaignes entières grillées et épluchées 100 g','snacks'),
('24325','Chips d''algues grillées au sel de mer 40,5 g','snacks'),
('18045','Bissli · Barbecue 70 g','snacks'),
('18048','Bissli · Oignon 70 g','snacks'),
('4925','Bissli · Falafel 70 g','snacks'),
('4926','Bissli · Grill 70 g','snacks'),
('4927','Bissli · Pizza 70 g','snacks'),
('4952','Bamba bébé 80 g','bebe'),
('4989','Osem · Bretzels « huit » salés 80 g','snacks'),
('16775','Air Wick · Spray désodorisant linge frais 237 g','maison'),
('16779','Air Wick · Spray désodorisant framboise-citron vert 237 ml','maison'),
('2860','Roshen · Gaufrettes roulées cacao 140 g','snacks'),
('16649','Bamba fourré crème nougat, grand format 150 g','snacks'),
('24611','Red Bull · Fraise-abricot 250 ml','boissons'),
('24612','Red Bull · Fruits rouges-raisin 250 ml','boissons'),
('5114','XL · Boisson énergisante mangue 250 ml','boissons'),
('5134','XL · Fruits rouges 250 ml','boissons'),
('24577','Bonbons gélifiés acidulés vers 70 g','snacks'),
('24578','Bonbons gélifiés cerises 70 g','snacks'),
('24580','Bonbons gélifiés cola 70 g','snacks'),
('24581','Bonbons gélifiés oursons 70 g','snacks'),
('24582','Bonbons gélifiés serpents 70 g','snacks'),
('22579','Liguori · Spaghetti n° 3 500 g','epicerie'),
('22580','Liguori · Linguine n° 7 500 g','epicerie'),
('22581','Liguori · Caserecce n° 27 500 g','epicerie'),
('22582','Liguori · Farfalle n° 30 500 g','epicerie'),
('22583','Liguori · Fusilli n° 31 500 g','epicerie'),
('22584','Liguori · Gnocchetti sardi 500 g','epicerie'),
('22585','Liguori · Penne rigate n° 42 500 g','epicerie'),
('3241','Raid · Aérosol insectes rampants 300 ml','maison'),
('3243','Raid · Aérosol anti-fourmis 300 ml','maison'),
('10805','Argania · Masque cheveux acide hyaluronique et kératine 500 ml','hygiene'),
('10807','Argania · Masque cheveux kératine et argan 500 ml','hygiene'),
('17473','Osem · Vinaigrette 295 g','epicerie'),
('17474','Osem · Sauce salade à l''ail 290 ml','epicerie'),
('22709','Pivetti · Farine de blé spéciale hallah 1 kg','epicerie'),
('12695','Haofé · Farine d''épeautre blanche tamisée 1 kg','epicerie'),
('24662','Real Food · Galettes de maïs sans gluten 150 g','snacks'),
('10167','Yulo · Chocolat au lait 123 g','snacks'),
('10168','Yulo · Chocolat noir 123 g','snacks'),
('19264','Osem · Sauce soja classique 290 ml','epicerie'),
('16285','Dessert soja bio pêche 150 g','laitier'),
('16286','Dessert soja bio fraise 150 g','laitier'),
('16287','Dessert soja bio douceur 150 g','laitier'),
('18617','Dessert soja bio banane-caramel 150 g','laitier'),
('24585','Red Bull · Classique 250 ml','boissons'),
('24609','Red Bull · Pastèque 250 ml','boissons'),
('25131','Dessert soja tarte au citron 150 g','laitier'),
('5699','Préparation pour sauce de rôti 22 g','epicerie'),
('19356','Spark · Eau gazeuse 6 × 250 ml','boissons'),
('10362','Bella Italia · Tomates concassées 3 × 400 g','epicerie'),
('22711','Pivetti · Farine de blé blanche tamisée 1 kg','epicerie'),
('9071','Dentifrice enfant raisin 70 g','hygiene'),
('2015','Orbit White · Chewing-gum fruits sans sucre 64 g','snacks'),
('2016','Orbit White · Chewing-gum menthe sans sucre 64 g','snacks'),
('2021','Orbit · Chewing-gum pastèque, flacon 64 g','snacks'),
('4978','Osem · Petit-beurre cacao 500 g','snacks'),
('13384','Tahina crue traditionnelle 1 kg','epicerie')
), t as (
  select v.*, fr.fr, fr.cat,
    (regexp_match(v.tag, '^(\d+)\s*ב-₪([\d.]+)'))[1]::int lot, (regexp_match(v.tag, '^(\d+)\s*ב-₪([\d.]+)'))[2]::numeric lot_total
  from public.victory_items v join fr on fr.id = v.id where v.img is not null
)
insert into public.shop_products (id, shop_id, category_id, name, description, price, photo_url, available, position)
select md5('HOPVICTORY:' || t.id)::uuid, (select id from public.shops where code = 'HOPVICTORY'), md5('HOPVICTORY:cat:' || t.cat)::uuid,
  (select case when char_length(x) <= 80 then x else regexp_replace(left(x, 81), '\s+\S*$', '') end from (select t.fr || case when t.lot > 1 then ' (lot de ' || t.lot || ')' else '' end || ' · ' || replace(btrim(t.he, E' \n\r\t'), '&amp;', '&') x) z),
  case when t.lot > 1 then t.lot || ' pour ' || replace(trim(to_char(t.lot_total, 'FM999990.00')), '.', ',') || ' ₪ au lieu de ' || replace(trim(to_char(t.price * t.lot, 'FM999990.00')), '.', ',') || ' ₪ · ' || t.lot || ' ב־' || t.lot_total || ' ₪'
       else replace(trim(to_char(t.price, 'FM999990.00')), '.', ',') || ' ₪ au lieu de ' || replace(trim(to_char(t.old, 'FM999990.00')), '.', ',') || ' ₪ · מבצע' end,
  coalesce(t.lot_total, t.price), t.img, true, row_number() over (order by t.cat, t.id)::int
from t
on conflict (id) do update set name = excluded.name, description = excluded.description, price = excluded.price, photo_url = excluded.photo_url, available = true;

-- Après la mise en ligne de l'appli (config.hopShops) : update public.shops set status = 'actif' where code = 'HOPVICTORY';
-- 10/11 (en ligne) : vraies positions (OpenStreetMap), zone industrielle ancienne (prix de la zone) — accord du patron :
--   update public.shops set lat = 32.3220762, lon = 34.8714103 where code = 'HOPRAMILEVY';  -- Rami Lévy, האורזים 8
--   update public.shops set lat = 32.3208081, lon = 34.8715060 where code = 'HOPVICTORY';   -- Victory, האורזים 4
