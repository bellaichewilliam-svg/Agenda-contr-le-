-- Boutique HOP! chez Panzer (05/11/2026) : charcuterie casher de Panzer, 24 rue Moshe Smilansky, Netanya
-- (09-866-6533 · 053-238-6533). Comme Carrefour et BOOOM : le livreur HOP! fait l'achat ; catalogue lu sur leur site
-- (collection « charcuterie », au prix du site), chaque taille (100 g… 500 g, nombre de saucisses) = un article
-- « Nom · שם [100 g · 100 גרם] » (l'appli les regroupe en une carte avec le choix de la taille).
-- Photos : celles du site (cdn.shopify.com, boutique Panzer), par lien. Mise à jour des prix chaque nuit (panzer_fetch / panzer_import).

-- Photos autorisées par lien : celles de la boutique Panzer
create or replace function public.ext_photo_ok(u text) returns boolean language sql immutable as $$
  select coalesce(u ~ '^https://(d226b0iufwcjmj\.cloudfront\.net/gs1-products/|booomisrael\.co\.il/uploads/|cdn\.shopify\.com/s/files/1/0371/7965/4281/)[A-Za-z0-9._~/%?=&:-]+$', false);
$$;
-- Boutiques HOP! (le livreur fait l'achat)
create or replace function public.hop_shop(p_shop uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from shops where id = p_shop and code in ('HOPCARREFOUR', 'HOPBOOOM', 'HOPPANZER'));
$$;

insert into public.shops (code, status, name, kind, city, address, lat, lon, phone, whatsapp, plan_until, client_pays, cash_ok, kosher,
  tagline, tagline_he, about, about_he, admin_note, logo, hours, hours_store)
select 'HOPPANZER', 'suspendu', 'HOP! chez Panzer · HOP! בפנזר', 'traiteur', 'netanya', 'משה סמילנסקי 24, נתניה', 32.3268286, 34.8536691,
  '0527790361', '972527790361', '2099-12-31', true, true, true,
  '🥩 La charcuterie casher Panzer, livrée chez vous', '🥩 השרקוטרי הכשר של פנזר, עד הבית',
  'La charcuterie artisanale casher de Panzer (Netanya) : pickel, viandes fumées, dinde, saucisses, saucissons secs, pâtés. Vous choisissez, on va la chercher pour vous et on vous livre au plus vite.',
  'השרקוטרי הכשר בעבודת יד של פנזר בנתניה: פיקל, בשרים מעושנים, הודו, נקניקיות, נקניקים יבשים ופטה. אתם בוחרים, אנחנו קונים בשבילכם ומביאים הכי מהר.',
  'Panzer : 09-866-6533 · 053-238-6533 · 24 Smilansky', 'data:image/webp;base64,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',
  '[{"d":0,"h":"09:00-19:00"},{"d":1,"h":"09:00-19:00"},{"d":2,"h":"09:00-19:00"},{"d":3,"h":"09:00-19:00"},{"d":4,"h":"09:00-19:00"},{"d":5,"h":"08:30-14:00"},{"d":6,"h":""}]'::jsonb,
  '[{"d":0,"h":"09:00-19:00"},{"d":1,"h":"09:00-19:00"},{"d":2,"h":"09:00-19:00"},{"d":3,"h":"09:00-19:00"},{"d":4,"h":"09:00-19:00"},{"d":5,"h":"08:30-14:00"},{"d":6,"h":""}]'::jsonb
where not exists (select 1 from public.shops where code = 'HOPPANZER');

-- Rayons
insert into public.shop_categories (id, shop_id, name, position)
select md5('HOPPANZER:cat:' || k)::uuid, (select id from shops where code = 'HOPPANZER'), n, p from (values
  ('fume', '🥩 Viandes fumées · בשרים מעושנים', 0),
  ('dinde', '🦃 Dinde · הודו', 1),
  ('saucisses', '🌭 Saucisses · נקניקיות', 2),
  ('sec', '🥖 Saucissons secs · נקניקים יבשים', 3),
  ('pate', '🍷 Pâtés & foie gras · פטה וכבד אווז', 4),
  ('autres', '🆕 Nouveautés · חדש', 5)) v(k, n, p)
on conflict (id) do nothing;

-- Noms FR · HE, rayon et casherout de chaque produit du site (id Shopify)
create table if not exists public.panzer_tr (id bigint primary key, fr text not null, he text not null, cat text not null, kosher text, pos int not null default 0);
alter table public.panzer_tr enable row level security;
insert into public.panzer_tr (id, fr, he, cat, kosher, pos) values
  (5130796990601, 'Veau pressé', 'עגל כבוש', 'fume', 'r', 13),
  (5130767892617, 'Veau à l''os', 'עגל על העצם', 'fume', 'r', 14),
  (4768361775241, 'Cubes mixtes (façon lardons)', 'קוביות מעורבות לבישול', 'sec', 'r', 9),
  (4768358006921, 'Saucisses de veau', 'נקניקיות עגל', 'saucisses', 'r', 1),
  (5146168721545, 'Dinde au miel Glatt', 'הודו בדבש חלק', 'dinde', 'g', 5),
  (5146170491017, 'Rosbif Glatt', 'רוסטביף חלק', 'fume', 'g', 2),
  (5146167836809, 'Dinde barbecue Glatt', 'הודו ברביקיו חלק', 'dinde', 'g', 6),
  (4768354336905, 'Saucisses de bœuf fumées', 'נקניקיות בקר מעושנות', 'saucisses', 'r', 3),
  (4768346505353, 'Saucisses de Strasbourg', 'נקניקיות שטרסבורג', 'saucisses', 'r', 4),
  (4768343720073, 'Saucisses de veau fumées', 'נקניקיות עגל מעושנות', 'saucisses', 'r', 2),
  (4768340967561, 'Pâté de foie de volaille aux morilles', 'פטה כבד עוף עם פטריות מורל', 'pate', '', 4),
  (4768332218505, 'Pâté de foie de volaille au vin blanc', 'פטה כבד עוף ביין לבן', 'pate', '', 3),
  (4768326779017, 'Langue de bœuf', 'לשון בקר', 'fume', 'g', 12),
  (4768323534985, 'Magret d''oie fumé', 'חזה אווז מעושן', 'fume', 'r', 10),
  (4768312098953, 'Pickel nostalgie', 'פיקל נוסטלגיה', 'fume', 'g', 5),
  (4768307937417, 'Bâton de berger (saucisson sec)', 'מקל רועים (נקניק יבש)', 'sec', 'g', 6),
  (4768305152137, 'Soubressade', 'סוברסדה', 'sec', 'r', 7),
  (4768292176009, 'Salami tunisien aux pistaches', 'סלמי תוניסאי עם פיסטוקים', 'sec', 'g', 8),
  (4768278216841, 'Pickel à l''ail', 'פיקל שום', 'fume', 'r', 6),
  (4768274579593, 'Pickel blanc tradition', 'פיקל לבן מסורתי', 'fume', 'r', 4),
  (4768272089225, 'Rosbif', 'רוסטביף', 'fume', 'r', 3),
  (4768264454281, 'Épaule de bœuf poivrée', 'כתף בקר בפלפל', 'fume', 'r', 8),
  (4768260653193, 'Oie fumée', 'אווז מעושן', 'fume', 'r', 11),
  (4768177389705, 'Poitrine de dinde barbecue', 'חזה הודו ברביקיו', 'dinde', 'r', 3),
  (4767458394249, 'Dinde au miel', 'הודו בדבש', 'dinde', 'r', 1),
  (4767451316361, 'Dinde au paprika', 'הודו בפפריקה', 'dinde', 'r', 2),
  (4767442927753, 'Dinde shawarma jumbo', 'הודו שווארמה ג׳מבו', 'dinde', 'r', 4),
  (4767433326729, 'Épaule de bœuf fumée', 'כתף בקר מעושנת', 'fume', 'r', 7),
  (4767422709897, 'Galantine aux pistaches (100 g)', 'גלנטין עם פיסטוקים (100 גרם)', 'pate', '', 5),
  (4767414485129, 'Entrecôte fumée au poivre', 'אנטריקוט מעושן בפלפל', 'fume', 'g', 1),
  (4767401934985, 'Chorizo', 'צ׳וריסו', 'sec', 'g', 4),
  (4767395348617, 'Saucisson sec', 'נקניק יבש', 'sec', 'g', 1),
  (4767385845897, 'Coppa italienne', 'קופה איטלקית', 'sec', 'g', 5),
  (4767359959177, 'Rosette', 'רוזט', 'sec', 'g', 2),
  (5146174161033, 'Saucisson sec au poivre « Milano »', 'נקניק יבש בפלפל ״מילאנו״', 'sec', 'g', 3),
  (5215959646345, 'Foie gras maison', 'כבד אווז ביתי', 'pate', '', 1),
  (5215968362633, 'Carpaccio de bœuf (surgelé)', 'קרפצ׳יו בקר (קפוא)', 'pate', '', 6),
  (5230079180937, 'Pâté de foie maison', 'פטה כבד ביתי', 'pate', '', 2)
on conflict (id) do update set fr = excluded.fr, he = excluded.he, cat = excluded.cat, kosher = excluded.kosher, pos = excluded.pos;

create table if not exists public.panzer_sync (req bigint primary key, created_at timestamptz not null default now(), done_at timestamptz, result json);
alter table public.panzer_sync enable row level security;

-- Taille d'un article : « 100gr » → « 100 g · 100 גרם », « 5 Saucisses » → « 5 saucisses · 5 נקניקיות »…
create or replace function public.panzer_size(t text) returns text language plpgsql immutable as $$
declare m text[]; s text := btrim(coalesce(t, ''));
begin
  if s = '' or s ilike 'default title' then return null; end if;
  m := regexp_match(s, '^(\d+(?:\s*-\s*\d+)?)\s*/?\s*g(?:r)?$', 'i');
  if m is not null then return replace(m[1], ' ', '') || ' g · ' || replace(m[1], ' ', '') || ' גרם'; end if;
  m := regexp_match(s, '^(\d+)\s*saucisses?$', 'i');
  if m is not null then return m[1] || ' saucisses · ' || m[1] || ' נקניקיות'; end if;
  m := regexp_match(s, '^(\d+)\s*batons?$', 'i');
  if m is not null then return m[1] || case when m[1] = '1' then ' bâton · מקל אחד' else ' bâtons · ' || m[1] || ' מקלות' end; end if;
  m := regexp_match(s, '^(\d+)$');
  if m is not null then return m[1] || case when m[1] = '1' then ' pièce · יחידה אחת' else ' pièces · ' || m[1] || ' יח׳' end; end if;
  return left(s, 30);
end $$;

-- Lecture du site (comme BOOOM) : la collection charcuterie
create or replace function public.panzer_fetch() returns bigint language plpgsql security definer set search_path = public, net as $$
declare r bigint;
begin
  r := net.http_get(url := 'https://panzer-delicatessen.com/collections/charcuterie/products.json', params := '{"limit":"250"}'::jsonb,
                    headers := '{"User-Agent":"Mozilla/5.0 (HOP! catalogue)","Accept":"application/json"}'::jsonb, timeout_milliseconds := 20000);
  insert into panzer_sync (req) values (r) on conflict do nothing;
  return r;
end $$;

-- Import : un article par taille, au prix du site ; un produit qui disparaît du site est masqué (pas supprimé)
create or replace function public.panzer_import(p_req bigint default null) returns json language plpgsql security definer set search_path = public, net as $$
declare sid uuid; v_req bigint; body json; p json; v json; tr panzer_tr; sz text; nm text; img text; pid uuid; i int;
        seen uuid[] := '{}'; n int := 0; res json; k text; cpos int;
begin
  select id into sid from shops where code = 'HOPPANZER';
  if sid is null then return json_build_object('error', 'no_shop'); end if;
  v_req := coalesce(p_req, (select s.req from panzer_sync s join net._http_response h on h.id = s.req and h.status_code = 200 order by s.req desc limit 1));
  select h.content::json into body from net._http_response h where h.id = v_req and h.status_code = 200;
  if body is null or json_typeof(body->'products') <> 'array' then return json_build_object('error', 'no_response', 'req', v_req); end if;
  for p in select * from json_array_elements(body->'products') loop
    select * into tr from panzer_tr where id = (p->>'id')::bigint;
    k := coalesce(tr.cat, 'autres');
    cpos := case k when 'fume' then 0 when 'dinde' then 1 when 'saucisses' then 2 when 'sec' then 3 when 'pate' then 4 else 5 end;
    img := p->'images'->0->>'src';
    if img is not null then img := img || case when img like '%?%' then '&' else '?' end || 'width=600'; end if;
    if not ext_photo_ok(img) then img := null; end if;
    i := 0;
    for v in select * from json_array_elements(p->'variants') loop
      i := i + 1;
      continue when coalesce((v->>'price')::numeric, 0) <= 0;
      sz := panzer_size(v->>'title');
      nm := coalesce(tr.fr || ' · ' || tr.he, p->>'title');
      nm := left(nm, 80 - coalesce(length(sz) + 3, 0)) || coalesce(' [' || sz || ']', '');
      pid := md5('HOPPANZER:' || (p->>'id') || ':' || (v->>'id'))::uuid;
      insert into shop_products (id, shop_id, category_id, name, description, price, photo, photo_url, available, position)
      values (pid, sid, md5('HOPPANZER:cat:' || k)::uuid, nm,
        case tr.kosher when 'g' then 'Casher Glatt Beit Yossef · כשר חלק בית יוסף' when 'r' then 'Casher Rabbanout Netanya · כשר רבנות נתניה' end,
        (v->>'price')::numeric, null, img, coalesce((v->>'available')::boolean, true), cpos * 1000 + coalesce(tr.pos, 99) * 10 + i)
      on conflict (id) do update set category_id = excluded.category_id, name = excluded.name, description = excluded.description,
        price = excluded.price, photo_url = excluded.photo_url, available = excluded.available, position = excluded.position;
      seen := seen || pid; n := n + 1;
    end loop;
  end loop;
  update shop_products set available = false where shop_id = sid and available and not hand_added and not (id = any(seen));
  res := json_build_object('req', v_req, 'articles', n);
  update panzer_sync set done_at = now(), result = res where panzer_sync.req = v_req;
  return res;
end $$;
revoke execute on function public.panzer_fetch() from public, anon, authenticated;
revoke execute on function public.panzer_import(bigint) from public, anon, authenticated;

-- Appliqué en deux migrations (boutique_hop_panzer_1 et _2), import du 05/11 : 150 articles (38 produits × tailles).
-- Mise à jour chaque nuit : cron « hop-panzer-fetch » 02:17 UTC (panzer_fetch) puis « hop-panzer-import » 02:22 (panzer_import).
-- La boutique est créée « suspendu » ; passée « actif » quand l'appli (config.hopShops + photos cdn.shopify.com) est en ligne.
-- Horaires (patron, 05/11) : dim–jeu 10 h–19 h ; vendredi 10 h–14 h en attendant sa confirmation ; chabbat fermé.
-- Téléphones de Panzer : seulement dans la note du patron (admin_note). Le téléphone et le WhatsApp de la boutique sont ceux de HOP!
-- (commande HOP! : le client appelle HOP!, jamais le magasin).

-- Logo et couverture (04/11/2026, demande du patron : même logo que les autres boutiques HOP!) :
--   img/market/panzer-logo.webp (tuile bleu nuit + viande 3D, « HOP! chez Panzer / HOP! בפנזר »)
--   img/market/panzer-cover.webp (fond crème, icônes 3D : herbes, poulet, viande, baguette, piment, ail ; rien de laitier)
-- shops.logo / cover = petites versions ; liées au vrai fichier APRÈS la mise en ligne des fichiers :
-- insert into public.shop_photo_files (h, path) values
--   ('047488c413dde6bd095d3f0005d527dd', 'img/market/panzer-logo.webp'),
--   ('b28fcde40bcce16be3dbdc01e5388e12', 'img/market/panzer-cover.webp') on conflict do nothing;
-- (04/11, plus tard) Logo et couverture en grand directement dans shops.logo / cover (≈ 9 et 13 Ko) : servis par lien
-- (img_ref → ph:… → shop_pic), nets tout de suite, sans mise en ligne Vercel. Fichiers recopiés depuis GitHub par pg_net
-- et vérifiés par leur empreinte md5 avant la mise à jour. La liaison shop_photo_files ci-dessus n'est plus nécessaire.
