-- ============================================================================
-- Deux boutiques HOP! à nous, séparées (demande du patron, 03/11/2026) :
--   • « HOP! chez Carrefour » (HOPCARREFOUR) : on fait vos courses pour vous chez Carrefour.
--     Produits = ceux des rayons importés de Carrefour (rayon_items 'cf…'), recopiés tout seuls
--     (prix Carrefour normal, nom, masqué / visible) par hop_market_put (déclencheur sur rayon_items).
--   • « HOP! chez BOOOM » (HOPBOOOM) : on fait vos courses pour vous chez BOOOM Netanya (האורזים 42).
--     Produits forts + promos de leur site, mis à jour tout seuls (booom_fetch + booom_import, toutes les 6 h).
--     Un produit qui n'est plus sur leur site, ou une promo finie, passe « available = false » (jamais effacé).
-- Logos et couvertures : img/market/{carrefour,booom}-{logo,cover}.webp (mis dans shops.logo / cover).
-- ============================================================================

-- 1) HOP! Market devient « HOP! chez Carrefour » (créé le même jour, aucune commande dessus)
update public.shops set code = 'HOPCARREFOUR', name = 'HOP! chez Carrefour · HOP! בקרפור',
  tagline = '🛒 On fait vos courses pour vous chez Carrefour', tagline_he = '🛒 עושים לכם את הקניות בקרפור',
  about = 'Eaux, boissons, jus, lait… au prix Carrefour. Vous choisissez, on fait les courses pour vous et on vous livre au plus vite.',
  about_he = 'מים, משקאות, מיצים, חלב… במחיר של קרפור. אתם בוחרים, אנחנו עושים לכם את הקניות ומביאים הכי מהר.',
  admin_note = 'Boutique HOP! (service du patron). Le livreur achète chez Carrefour, prix Carrefour normal (pas la promo du jour). Produits recopiés tout seuls des rayons.'
where code = 'HOPMARKET';

-- 2) « HOP! chez BOOOM »
insert into public.shops (code, status, name, kind, city, address, lat, lon, contact_name, phone, whatsapp, lang,
  tagline, tagline_he, about, about_he, hours, client_pays, cash_ok, featured, showcase, rank, plan_until, kosher, admin_note)
select 'HOPBOOOM', 'actif', 'HOP! chez BOOOM · HOP! בבום', 'epicerie', 'netanya', 'האורזים 42, נתניה',
  coalesce((select lat from public.shops where code = 'PARISTEXAS'), 32.2795), coalesce((select lon from public.shops where code = 'PARISTEXAS'), 34.8636),
  'HOP!', '0527790361', '972527790361', 'fr',
  '🔥 On fait vos courses pour vous chez BOOOM', '🔥 עושים לכם את הקניות בבום',
  'Les produits forts et les promos de BOOOM Netanya, à petits prix. Vous choisissez, on fait les courses pour vous et on vous livre au plus vite.',
  'המוצרים החזקים והמבצעים של בום נתניה, במחירים של פעם. אתם בוחרים, אנחנו עושים לכם את הקניות ומביאים הכי מהר.',
  '[{"d":0,"h":"09:00-21:00"},{"d":1,"h":"09:00-21:00"},{"d":2,"h":"09:00-21:00"},{"d":3,"h":"09:00-21:00"},{"d":4,"h":"09:00-21:00"},{"d":5,"h":"09:00-14:00"},{"d":6,"h":""}]'::jsonb,
  true, true, true, true, 2, '2099-12-31', false,
  'Boutique HOP! (service du patron). Le livreur achète chez BOOOM Netanya, האורזים 42 (à côté de Testamobil). Produits forts + promos repris tout seuls de booomisrael.co.il toutes les 6 h. Horaires à vérifier.'
where not exists (select 1 from public.shops where code = 'HOPBOOOM');

-- 3) Le catalogue Carrefour suit le nouveau code
create or replace function public.hop_market_put(i public.rayon_items) returns void
language plpgsql security definer set search_path = public as $$
declare sid uuid; k text; cid uuid; pid uuid; ph text; path text; cn text; cp int;
begin
  if i.rayon <> 'super' or i.item_id not like 'cf%' then return; end if;
  select id into sid from shops where code = 'HOPCARREFOUR';
  if sid is null then return; end if;
  pid := md5('HOPMARKET:' || i.item_id)::uuid;
  if i.name_fr is null or i.name_fr ~ '[א-ת]' or i.price_lo is null then
    update shop_products set available = false where id = pid and available;
    return;
  end if;
  k := case i.emoji when '💧' then 'eaux' when '🥤' then 'sodas' when '🧃' then 'jus' when '⚡' then 'energy' when '🥛' then 'lait'
       else coalesce(i.cat, 'bois') end;
  if k = 'booom' then k := 'bois'; end if;
  select c.name, c.pos into cn, cp from hop_market_cat(k) c;
  if cn is null then k := 'bois'; select c.name, c.pos into cn, cp from hop_market_cat(k) c; end if;
  cid := md5('HOPMARKET:cat:' || k)::uuid;
  insert into shop_categories (id, shop_id, name, position) values (cid, sid, cn, cp) on conflict (id) do nothing;
  if i.photo ~ '^data:image/(jpeg|png|webp);base64,' then ph := i.photo;
  elsif i.img is not null then
    select a.data into ph from app_pics a where a.name = i.img;
    path := 'img/qc/' || i.img || '.webp';
    if ph is not null and path ~ '^img/[a-z0-9-]+/[a-z0-9-]+\.(webp|png|jpg)$' then
      insert into shop_photo_files (h, path) values (md5(ph), path) on conflict (h) do nothing;
    end if;
  end if;
  insert into shop_products (id, shop_id, category_id, name, description, price, photo, available, position)
  values (pid, sid, cid, hop_market_name(i.name_fr, i.name_he), null, i.price_lo, ph,
          not coalesce(i.hidden, false), coalesce(i.ord, i.position, 0))
  on conflict (id) do update set category_id = excluded.category_id, name = excluded.name, price = excluded.price,
    photo = excluded.photo, available = excluded.available, position = excluded.position;
end $$;

-- 4) BOOOM : traductions françaises (id BOOOM → nom, pictogramme) ; un nouveau produit sans traduction
--    garde son nom hébreu (la traduction automatique du catalogue essaie quand même)
create table if not exists public.booom_tr (id int primary key, fr text not null, img text);
alter table public.booom_tr enable row level security;
insert into public.booom_tr (id, fr, img) values
  (63, 'Tempo · Soda 275 ml', 'cupstraw'),
  (64, 'Blue · Boisson énergisante canette 250 ml', 'voltage'),
  (65, 'Farine blanche ou semoule 1 kg', 'bread'),
  (66, 'Sugat · Riz thaï 1 kg', 'rice'),
  (67, 'Sauce tomate extra concentrée 580 g', 'canned'),
  (68, 'Barilla · Pâtes, au choix 500 g', 'spaghetti'),
  (69, 'Pinuk · Gel douche 700 ml (2 max)', 'soap'),
  (70, 'Oreo · Biscuits 176 g', 'cookie'),
  (71, 'Papier cuisson 50 feuilles', 'paper'),
  (72, 'Wissotzky · Thé 50 sachets', 'tea'),
  (73, 'Yekev Jérusalem · Jus de raisin 1 L', 'grapes'),
  (74, 'Mor Ulevona · Huile d''olive extra 750 ml', 'olive'),
  (75, 'Lot de 3 · Châtaignes bio grillées 100 g', 'nut'),
  (76, 'Lot de 3 · Gobelets boissons chaudes ×40', 'coffee'),
  (77, 'Corn-flakes 750 g', 'corn')
on conflict (id) do nothing;

create table if not exists public.booom_sync (req bigint primary key, at timestamptz not null default now(), done_at timestamptz, result json);
alter table public.booom_sync enable row level security;

create or replace function public.booom_fetch() returns bigint
language plpgsql security definer set search_path = public, net as $$
declare r bigint;
begin
  r := net.http_get(url := 'https://booomisrael.co.il/api/bootstrap',
    headers := jsonb_build_object('User-Agent', 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
      'Accept', 'application/json', 'Referer', 'https://booomisrael.co.il/'), timeout_milliseconds := 30000);
  insert into booom_sync (req) values (r);
  return r;
end $$;

-- Pictogramme d'après le nom hébreu (quand le produit n'est pas encore traduit)
create or replace function public.booom_pic_for(he text) returns text
language sql immutable as $$
  select case
    when he ~ 'אורז' then 'rice' when he ~ '(פסטה|ספגטי|אטריות|נודלס)' then 'spaghetti'
    when he ~ '(רוטב|עגבני|שימורי|מלפפונים)' then 'canned' when he ~ '(עוגי|אוראו|פתי בר|חטיף|ופל)' then 'cookie'
    when he ~ 'תה' then 'tea' when he ~ 'קפה' then 'coffee' when he ~ '(מיץ|ענבים|תירוש)' then 'grapes'
    when he ~ 'שמן' then 'olive' when he ~ '(ערמונ|אגוז|שקד)' then 'nut' when he ~ '(קורנפלקס|דגני)' then 'corn'
    when he ~ '(קמח|סולת|לחם)' then 'bread' when he ~ '(סבון|תחליב|שמפו|רחצה|מברש|סיליט|ניקוי|אקונומיקה)' then 'soap'
    when he ~ '(נייר|מפיות|מגבונים|מטליות)' then 'paper' when he ~ '(פחית|אנרגיה)' then 'voltage'
    when he ~ '(סודה|משקה|קולה)' then 'cupstraw' when he ~ '(חלב)' then 'milk'
    when he ~ '(כוסות|צלחות|חד)' then 'coffee' end;
$$;

-- Importer la dernière réponse du site BOOOM (ou p_req) : produits forts + promos en cours
create or replace function public.booom_import(p_req bigint default null) returns json
language plpgsql security definer set search_path = public, net as $$
declare sid uuid; v_req bigint; body json; p json; tr booom_tr; he text; dhe text; fr text; nm text; descr text;
        pr numeric; lot int; m text[]; promo boolean; k text; cid uuid; pid uuid; img text; ph text; path text;
        seen uuid[] := '{}'; n int := 0; pos int := 0; res json; url text;
begin
  select id into sid from shops where code = 'HOPBOOOM';
  if sid is null then return json_build_object('error', 'no_shop'); end if;
  v_req := coalesce(p_req, (select s.req from booom_sync s join net._http_response h on h.id = s.req and h.status_code = 200
                            order by s.req desc limit 1));
  select h.content::json into body from net._http_response h where h.id = v_req and h.status_code = 200;
  if body is null or json_typeof(body->'products') <> 'array' then return json_build_object('error', 'no_response', 'req', v_req); end if;
  insert into shop_categories (id, shop_id, name, position) values
    (md5('HOPBOOOM:cat:promo')::uuid, sid, '🏷️ Promos de la semaine · מבצעי השבוע', 0),
    (md5('HOPBOOOM:cat:forts')::uuid, sid, '🔥 Produits forts · המוצרים החזקים', 1)
  on conflict (id) do nothing;
  for p in select * from json_array_elements(body->'products') loop
    continue when coalesce((p->>'expired')::boolean, false);
    he := trim(coalesce(p->>'name', ''));
    continue when he = '';
    dhe := nullif(trim(coalesce(p->>'description', '')), '');
    -- Prix : « 10.90 », ou « 5 ב 10 » (5 pour 10 ₪), ou « 3 ב-10.90 » écrit dans la description
    pr := null; lot := null;
    m := regexp_match(coalesce(p->>'price', ''), '^\s*(\d+)\s*ב-?\s*(\d+(?:\.\d+)?)\s*$');
    if m is not null then lot := m[1]::int; pr := m[2]::numeric;
    elsif coalesce(p->>'price', '') ~ '^\s*\d+(\.\d+)?\s*$' then pr := (p->>'price')::numeric;
      m := regexp_match(coalesce(dhe, ''), '(\d+)\s*ב-?\s*(\d+(?:\.\d+)?)');
      if m is not null and m[2]::numeric = pr then lot := m[1]::int; end if;
    end if;
    continue when pr is null or pr <= 0 or pr > 5000;
    promo := nullif(p->>'expiry', '') is not null;
    select * into tr from booom_tr where id = (p->>'id')::int;
    fr := tr.fr;
    nm := case when fr is not null then hop_market_name(fr, case when lot is not null then lot || ' ב-' || pr || ' · ' || he else he end)
               else left(case when lot is not null then lot || ' ב-' || pr || ' · ' || he else he end, 80) end;
    descr := left(concat_ws(' · ',
      case when promo then 'Promo jusqu''au ' || (p->>'expiry') end,
      dhe, case when promo then 'מבצע עד ' || (p->>'expiry') end), 300);
    k := case when promo then 'promo' else 'forts' end;
    cid := md5('HOPBOOOM:cat:' || k)::uuid;
    pid := md5('HOPBOOOM:' || (p->>'id'))::uuid;
    img := coalesce(tr.img, booom_pic_for(he));
    ph := null;
    if img is not null then
      select a.data into ph from app_pics a where a.name = img;
      path := 'img/qc/' || img || '.webp';
      if ph is not null then insert into shop_photo_files (h, path) values (md5(ph), path) on conflict (h) do nothing; end if;
    end if;
    -- La vraie photo du produit sur leur site (par lien), le pictogramme en secours
    url := 'https://booomisrael.co.il' || coalesce(p->>'image_url', '');
    if not ext_photo_ok(url) then url := null; end if;
    insert into shop_products (id, shop_id, category_id, name, description, price, photo, photo_url, available, position)
    values (pid, sid, cid, nm, nullif(descr, ''), pr, ph, url, true, pos)
    on conflict (id) do update set category_id = excluded.category_id, name = excluded.name, description = excluded.description,
      price = excluded.price, photo = coalesce(excluded.photo, shop_products.photo), photo_url = excluded.photo_url, available = true, position = excluded.position;
    seen := seen || pid; n := n + 1; pos := pos + 1;
  end loop;
  -- Plus sur leur site, ou promo finie : invisible pour les clients (jamais effacé)
  update shop_products set available = false where shop_id = sid and available and not (id = any(seen));
  res := json_build_object('req', v_req, 'products', n);
  update booom_sync set done_at = now(), result = res where booom_sync.req = v_req;
  return res;
end $$;
revoke all on function public.booom_fetch(), public.booom_import(bigint), public.hop_market_put(public.rayon_items) from public, anon, authenticated;

-- 5) Mise à jour toute seule (si pg_cron est là) : on demande le site, puis on importe 5 min après
select cron.schedule('hop-booom-fetch',  '7 */6 * * *',  'select public.booom_fetch()');
select cron.schedule('hop-booom-import', '12 */6 * * *', 'select public.booom_import()');
-- Les eaux gazeuses (🫧) vont dans « Eaux » ; pictogramme de la rubrique si le produit n'en a pas (voir hop_market_put en ligne).
-- Logos / couvertures : petite image dans shops.logo / cover, reliée par son empreinte (shop_photo_files) au vrai fichier img/market/….

-- ============================================================================
-- Vraies photos des produits (03/11/2026) : prises par lien sur le site du magasin (jamais copiées dans le catalogue)
--   • shop_products.photo_url / rayon_items.photo_url (Carrefour : image « medium » du site, BOOOM : /uploads/…)
--   • ext_photo_ok(url) : seuls ces deux sites sont acceptés ; l'appli fait la même vérification (UI.extPic)
--   • shop_catalog / order_addable / rayons_live renvoient ce lien ; le pictogramme reste en secours
--   • carrefour_import remplit photo_url à chaque import ; booom_import aussi
-- (fonctions en ligne : voir les migrations vraies_photos, booom_vraies_photos, rayon_photo_url)
-- ============================================================================
