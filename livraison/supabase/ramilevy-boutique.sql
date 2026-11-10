-- ============================================================================
-- Boutique « HOP! chez Rami Lévy » (HOPRAMILEVY, patron, 10/11/2026) : le livreur HOP! fait les courses chez Rami Lévy
-- (comme Carrefour, BOOOM, Panzer). Vraies promos, vrais prix, vraies photos :
--   • promos et prix : fichiers officiels de la loi sur la transparence des prix (url.publishedprices.co.il, compte « RamiLevi »),
--     magasin 037 « Netanya Nord » (האורזים 8). Promos de novembre pour tous les clients, sans condition (pas de « dès 75 ₪ »,
--     pas de cadeau, pas de carte club), avec le prix normal du même fichier. Les 300 plus grosses réductions, réparties par rayon
--     (le catalogue doit rester sous 150 Ko), noms en français et en hébreu.
--   • photos : celles de Rami Lévy (img.rami-levy.co.il/product/<code-barres>/small.jpg), par lien.
--   • données : livraison/data/ramilevy-promos.json (publié avec l'appli) → ramilevy_fetch() puis ramilevy_import().
--     Pour mettre à jour : refaire le fichier, mettre en ligne, puis relancer les deux fonctions.
-- Logo identique à nos autres boutiques ; couverture = photo des vrais produits en promo.
-- ============================================================================
insert into public.shops (code, status, name, kind, city, address, lat, lon, contact_name, phone, whatsapp, lang, plan_until, client_pays, cash_ok, kosher,
  featured, showcase, rank, tagline, tagline_he, about, about_he, admin_note, logo, cover, hours, hours_store)
select 'HOPRAMILEVY', 'suspendu', 'HOP! chez Rami Lévy · HOP! ברמי לוי', 'epicerie', 'netanya', 'האורזים 8, נתניה', 32.3292, 34.8566,
  'HOP!', '0527790361', '972527790361', 'fr', '2099-12-31', true, true, false, true, true, 4,
  '🛒 On fait vos courses pour vous chez Rami Lévy', '🛒 עושים לכם את הקניות ברמי לוי',
  'Les promos de Rami Lévy, au vrai prix Rami Lévy. Vous choisissez, on fait les courses pour vous et on vous livre au plus vite.',
  'המבצעים של רמי לוי, במחיר האמיתי של רמי לוי. אתם בוחרים, אנחנו עושים לכם את הקניות ומביאים הכי מהר.',
  'Boutique HOP! (service du patron). Le livreur achète chez Rami Lévy Netanya Nord, האורזים 8 (à côté de BOOOM). Promos officielles du magasin (fichier de transparence des prix), prix promo avec la date de fin ; « max N par client » à respecter.',
  'data:image/webp;base64,UklGRooEAABXRUJQVlA4IH4EAAAwFQCdASpgAGAAPsFSpU2npCOiK5TqGPAYCWIAzjZQwEwEzkG2R53P/IepneNvQa6V//HzUKYbeF9peHffvKiYC6TKaR5HtQkxf49wrx1QfRDuGcIRQYRZBQ0z5DD/IYW9kwmAYhXVCnPwJ1ODkbPnY8MWwpSrhZHG4AgS/FRNcU+QHJYa2lG8R73yt0dK1iu9GS+uH2ZirTKX2TcMMEb+JZIU3dp7Hk1QVufRG2XnChUAAP709Du4VWHPcQXSdsbVTBgBYdd3U/c6RbpFvkAe6OCbIosWE6p4QdmJkM4jygNBQJKx+Mvni47IXSy7yepIgQQ5eh2kWQJnp/H/MY2Zw5p1KFfriR1sEZbBqCt13TF8qzVyMkisUgdDdIMb71hOffqdUXolQ9cOOWUrIQM/kauqa2i8q5DNfgkRsHjaQeg1dxhO1S5vbr09253mz1Y2MczryBf6Ubh9PpQqeKS5sO0gupGklTe1+zqoKlWqpT3D3kDnKiF4cy1j73PyKn+IYfsnX9eFGCLh9mp3FOjmCm2458j8HI045IHvgY+GN7vRag17sdPkQO8c5tmNc4hHaKqpHk6aAsnZM95ldapuz1WRV3hvvAj5LkA+MLXGGAYSEJp50uAmmt8Hf6PncW1bkfOB+SfnBWjl5IFSKjcLm8fU5C1awx9dDLaJnAIhBIgrQTdn5qIr7kU+kaXylY79frkZvEl/F7vYOYC78QPf1YaemxbzWC8Wi39d4QyFp06gh4Ur3hlQlB2rS9aieydJcs+3r0OvfuVDndqrfmlxuF7scFYG0NUmPYvCft9qonzU23u8P+j8D9Lokdt1iPbmRf3rdRLjzfeZlwl78O9SP4OBkFdvXj3BZne0VMrrtv9p4gjv77dfvOxff1UIjFIrj7KRKK5easbyp2z+nPWL/TcJj4WNHjrOT2+o6eFyWOoDXhZGkV9WhSVbpNOQcVFWMoix4OedWiRaq+Us21DUDjRh7X+/budFZVw+dW4oGaR5pXPYP8nPIGco9RkKJct1wxcJugAdvJ056zZvZL7Tmj/k1YS2NVhGMBqiuxENv+tJr3mkO18DimCjgBz+FJLKGtucToXyvC7WqzRgv2yeTqCyCJsTYrr9YZRuSO4F5z+9L0VSKFD6k/pB1NigLsNWUpKV9QqXmj1mWFtZK1c3RjaMzxt2EDD7wUbZ/+/PsB5EjIaXzvmMY72Ueag7WWLOi4MUc9Xgvjvr/vJRLeM6EisKokkR3UUufAeCBlSDp+QfI+/0c2HofQtV1TTm8qM7V3szs3+9Cdo6DXxeGU8ZzFVCSHKDY8mZvra7goz4Ka9YymkYeblhwTTn+ek2gQccVcO9LSek/pSEJhRA/xVxMJ4yyuQGBcox2/0AG7KxByPbNa92uazwKDjcMyT3G+f8QE0/x+ILXd5HBb7+ScVpqQbz1WQjYIHNPgqaVgqinqmgnaHrSC/lxqeMNkvEgzRI0J5+TDQc+YbMGxL6i60r/8iHIRQEMfC74N9awAlYCc1+uZjv9lrTBlHrwAAA', 'data:image/webp;base64,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', '[{"d":0,"h":"09:30-20:00"},{"d":1,"h":"09:30-20:00"},{"d":2,"h":"09:30-20:00"},{"d":3,"h":"09:30-20:00"},{"d":4,"h":"09:30-20:00"},{"d":5,"h":"09:30-14:00"},{"d":6,"h":""}]'::jsonb, '[{"d":0,"h":"09:30-20:00"},{"d":1,"h":"09:30-20:00"},{"d":2,"h":"09:30-20:00"},{"d":3,"h":"09:30-20:00"},{"d":4,"h":"09:30-20:00"},{"d":5,"h":"09:30-14:00"},{"d":6,"h":""}]'::jsonb
where not exists (select 1 from public.shops where code = 'HOPRAMILEVY');
insert into public.shop_photo_files (h, path)
select md5(logo), 'img/market/ramilevy-logo.webp' from public.shops where code = 'HOPRAMILEVY' and logo is not null
union all select md5(cover), 'img/market/ramilevy-cover.webp' from public.shops where code = 'HOPRAMILEVY' and cover is not null
on conflict (h) do nothing;

insert into public.shop_categories (id, shop_id, name, position)
select md5('HOPRAMILEVY:cat:' || k)::uuid, (select id from public.shops where code = 'HOPRAMILEVY'), n, p from (values
  ('fruits', '🍎 Fruits & légumes · פירות וירקות', 1),
  ('viande', '🥩 Viande, poulet & poisson · בשר, עוף ודגים', 2),
  ('laitier', '🧀 Laitiers & œufs · חלב, גבינות וביצים', 3),
  ('pain', '🍞 Pain & gâteaux · לחם ומאפים', 4),
  ('epicerie', '🥫 Épicerie · מזווה', 5),
  ('snacks', '🍫 Snacks & douceurs · חטיפים ומתוקים', 6),
  ('boissons', '🥤 Boissons & café · משקאות וקפה', 7),
  ('surgeles', '❄️ Surgelés · קפואים', 8),
  ('hygiene', '🧴 Hygiène & beauté · טיפוח והיגיינה', 9),
  ('maison', '🧽 Maison & ménage · ניקיון ובית', 10),
  ('bebe', '👶 Bébé · תינוקות', 11)) v(k, n, p)
on conflict (id) do nothing;

-- Boutiques HOP! (le livreur fait l'achat)
create or replace function public.hop_shop(p_shop uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from shops where id = p_shop and code in ('HOPCARREFOUR', 'HOPBOOOM', 'HOPPANZER', 'HOPRAMILEVY'));
$$;
-- Photos autorisées par lien : + celles de Rami Lévy (même règle que UI.extPic dans common.js)
create or replace function public.ext_photo_ok(u text)
 returns boolean language sql immutable as $function$
  select coalesce(u ~ '^https://(d226b0iufwcjmj\.cloudfront\.net/(gs1-products|product-images|items)/|booomisrael\.co\.il/uploads/|cdn\.shopify\.com/s/files/1/0371/7965/4281/|img\.rami-levy\.co\.il/product/)[A-Za-z0-9._~/%?=&:-]+$', false);
$function$;

create table if not exists public.ramilevy_sync (req bigint primary key, at timestamptz not null default now(), done_at timestamptz, result json);
alter table public.ramilevy_sync enable row level security;

create or replace function public.ramilevy_fetch() returns bigint
language plpgsql security definer set search_path = public, net as $$
declare r bigint;
begin
  r := net.http_get(url := 'https://hop-livraison.vercel.app/data/ramilevy-promos.json?t=' || extract(epoch from now())::bigint,
    headers := jsonb_build_object('Accept', 'application/json'), timeout_milliseconds := 30000);
  insert into ramilevy_sync (req) values (r);
  return r;
end $$;

-- Charge les promos : un produit par promo (nom « FR · HE », prix promo du lot, « au lieu de … · jusqu'au … » en description,
-- vraie photo par lien). Une promo absente du fichier passe « available = false » (jamais effacée). La boutique devient visible.
create or replace function public.ramilevy_import(p_req bigint default null) returns json
language plpgsql security definer set search_path = public, net as $$
declare sid uuid; v_req bigint; body json; p json; n int := 0; seen uuid[] := '{}'; pid uuid; url text; res json;
begin
  select id into sid from shops where code = 'HOPRAMILEVY';
  if sid is null then return json_build_object('error', 'no_shop'); end if;
  v_req := coalesce(p_req, (select s.req from ramilevy_sync s join net._http_response h on h.id = s.req and h.status_code = 200 order by s.req desc limit 1));
  select h.content::json into body from net._http_response h where h.id = v_req and h.status_code = 200;
  if body is null or json_typeof(body->'items') <> 'array' then return json_build_object('error', 'no_response', 'req', v_req); end if;
  for p in select * from json_array_elements(body->'items') loop
    continue when coalesce((p->>'p')::numeric, 0) <= 0 or (p->>'p')::numeric > 5000;
    pid := md5('HOPRAMILEVY:' || (p->>'id'))::uuid;
    url := 'https://img.rami-levy.co.il/product/' || (p->>'c') || '/small.jpg';
    if not ext_photo_ok(url) then url := null; end if;
    insert into shop_products (id, shop_id, category_id, name, description, price, photo_url, available, position)
    values (pid, sid, md5('HOPRAMILEVY:cat:' || (p->>'cat'))::uuid, left(hop_market_name(p->>'fr', p->>'he'), 160), left(p->>'d', 300),
            (p->>'p')::numeric, url, true, coalesce((p->>'pos')::int, 0))
    on conflict (id) do update set category_id = excluded.category_id, name = excluded.name, description = excluded.description,
      price = excluded.price, photo_url = excluded.photo_url, available = true, position = excluded.position;
    seen := seen || pid; n := n + 1;
  end loop;
  update shop_products set available = false where shop_id = sid and available and not (id = any(seen));
  if n > 0 then update shops set status = 'actif' where id = sid and status = 'suspendu'; end if;
  res := json_build_object('req', v_req, 'products', n);
  update ramilevy_sync set done_at = now(), result = res where ramilevy_sync.req = v_req;
  return res;
end $$;
revoke all on function public.ramilevy_fetch(), public.ramilevy_import(bigint) from public, anon, authenticated;
