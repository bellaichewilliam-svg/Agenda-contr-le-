-- ============================================================================
-- HOP! Market : le catalogue HOP! à nous (comme HOP! Jus), mis en avant sur l'accueil.
-- • Les produits Carrefour des rayons (rayon_items 'super', item_id 'cf…') y sont recopiés automatiquement :
--   prix, nom, masqué / visible, ordre. Un import Carrefour ou un changement du patron dans les rayons
--   met le catalogue à jour tout seul (déclencheur hop_market_trg).
-- • Rubrique « 🔥 Petits prix BOOOM » : produits de BOOOM Netanya (HaOrzim 42), ajoutés à la main.
-- • Photos : pictogrammes de l'appli (img/qc/…webp), servis par lien (shop_photo_files).
-- Rien n'est jamais effacé : un produit masqué passe « available = false » (invisible pour les clients).
-- Le logo et la couverture (img/market/logo.webp, cover.webp) sont mis dans shops.logo / shops.cover.
-- ============================================================================

insert into public.shops (code, status, name, kind, city, address, lat, lon, contact_name, phone, whatsapp, lang,
  tagline, tagline_he, about, about_he, hours, client_pays, cash_ok, featured, showcase, rank, plan_until, kosher, admin_note)
select 'HOPMARKET', 'actif', 'HOP! Market · HOP! מרקט', 'epicerie', 'netanya', 'Boutique HOP!', 32.3292, 34.8566, 'HOP!',
  '0527790361', '972527790361', 'fr',
  '✨ Nouveau · Vos courses au prix du supermarché, livrées chez vous',
  '✨ חדש · הקניות שלכם במחיר הסופר, עד הבית',
  'Eaux, boissons, jus, lait… et les petits prix BOOOM. Vous choisissez, on fait les courses et on vous livre au plus vite.',
  'מים, משקאות, מיצים, חלב… וגם המחירים החזקים של בום. אתם בוחרים, אנחנו קונים ומביאים אליכם הכי מהר.',
  '[{"d":0,"h":"08:00-22:00"},{"d":1,"h":"08:00-22:00"},{"d":2,"h":"08:00-22:00"},{"d":3,"h":"08:00-22:00"},{"d":4,"h":"08:00-22:00"},{"d":5,"h":"08:00-14:00"},{"d":6,"h":""}]'::jsonb,
  true, true, true, true, 2, '2099-12-31', false,
  'Catalogue HOP! (service du patron). Produits Carrefour : le livreur achète au supermarché, prix Carrefour normal. Rubrique BOOOM : BOOOM Netanya, האורזים 42.'
where not exists (select 1 from public.shops where code = 'HOPMARKET');

-- Rubriques : une par famille de produits (id fixe, pour pouvoir les retrouver)
create or replace function public.hop_market_cat(k text) returns table (name text, pos int)
language sql immutable as $$
  select x.name, x.pos from (values
    ('booom',   '🔥 Petits prix BOOOM · מחירים חזקים',  0),
    ('eaux',    '💧 Eaux · מים',                         1),
    ('sodas',   '🥤 Boissons gazeuses · משקאות מוגזים', 2),
    ('jus',     '🧃 Jus & sirops · מיצים וסירופים',      3),
    ('energy',  '⚡ Énergisantes · משקאות אנרגיה',       4),
    ('lait',    '🥛 Lait · חלב',                         5),
    ('pain',    '🍞 Pain · לחם',                         6),
    ('fruit',   '🍌 Fruits & légumes · פירות וירקות',    7),
    ('dej',     '🍯 Petit-déj · ארוחת בוקר',             8),
    ('epic',    '🍝 Épicerie · מזווה',                   9),
    ('surg',    '❄️ Surgelés · קפואים',                  10),
    ('shabbat', '🕯️ Shabbat & fêtes · שבת וחגים',        11),
    ('snack',   '🍫 Snacks & douceurs · חטיפים ומתוקים', 12),
    ('hyg',     '🧼 Hygiène · היגיינה',                  13),
    ('maison',  '🧻 Maison · לבית',                      14),
    ('bois',    '🥤 Boissons · שתייה',                   15)
  ) x(k, name, pos) where x.k = k;
$$;

-- Un produit des rayons → le catalogue HOP! Market
create or replace function public.hop_market_put(i public.rayon_items) returns void
language plpgsql security definer set search_path = public as $$
declare sid uuid; k text; cid uuid; pid uuid; ph text; cn text; cp int;
begin
  if i.rayon <> 'super' or i.item_id not like 'cf%' then return; end if;
  select id into sid from shops where code = 'HOPMARKET';
  if sid is null then return; end if;
  pid := md5('HOPMARKET:' || i.item_id)::uuid;
  -- Pas encore traduit, ou sans prix : pas montré
  if i.name_fr is null or i.name_fr ~ '[א-ת]' or i.price_lo is null then
    update shop_products set available = false where id = pid and available;
    return;
  end if;
  k := case i.emoji when '💧' then 'eaux' when '🥤' then 'sodas' when '🧃' then 'jus' when '⚡' then 'energy' when '🥛' then 'lait'
       else coalesce(i.cat, 'bois') end;
  select c.name, c.pos into cn, cp from hop_market_cat(k) c;
  if cn is null then k := 'bois'; select c.name, c.pos into cn, cp from hop_market_cat(k) c; end if;
  cid := md5('HOPMARKET:cat:' || k)::uuid;
  insert into shop_categories (id, shop_id, name, position) values (cid, sid, cn, cp) on conflict (id) do nothing;
  ph := case when i.photo like 'data:image/%' then i.photo
             when i.img is not null and i.img ~ '^[a-z0-9-]+$' then 'img/qc/' || i.img || '.webp' end;
  if ph like 'img/%' then insert into shop_photo_files (h, path) values (md5(ph), ph) on conflict (h) do nothing; end if;
  insert into shop_products (id, shop_id, category_id, name, description, price, photo, available, position)
  values (pid, sid, cid, i.name_fr || ' · ' || replace(coalesce(i.name_he, ''), ' · ', ' '), null, i.price_lo, ph,
          not coalesce(i.hidden, false), coalesce(i.ord, i.position, 0))
  on conflict (id) do update set category_id = excluded.category_id, name = excluded.name, price = excluded.price,
    photo = excluded.photo, available = excluded.available, position = excluded.position;
end $$;

create or replace function public.hop_market_trg() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.hop_market_put(new);
  return new;
end $$;
create or replace trigger rayon_items_hop_market after insert or update on public.rayon_items
  for each row execute function public.hop_market_trg();

-- Tout recopier (première fois, ou pour remettre d'aplomb)
create or replace function public.hop_market_sync() returns int
language plpgsql security definer set search_path = public as $$
declare i rayon_items; n int := 0;
begin
  for i in select * from rayon_items where rayon = 'super' and item_id like 'cf%' order by coalesce(ord, position, 0), item_id loop
    perform public.hop_market_put(i);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.hop_market_put(public.rayon_items), public.hop_market_sync() from public, anon, authenticated;
