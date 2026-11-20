-- 20/11 (patron : « fais tous les points ») : les promos et les prix de Rami Lévy se mettent à jour tout seuls.
--   • chaque jour, le robot GitHub (scripts/ramilevy_promos.py, tâche « Update prices daily ») refait
--     livraison/data/ramilevy-promos.json (les 300 meilleures promos du magasin 037) et, une fois par semaine,
--     livraison/data/ramilevy-prix.json (tout le magasin) à partir des fichiers officiels des prix ;
--   • chaque soir la base lit ces fichiers directement dans le dépôt (plus besoin de mise en ligne) et les charge ;
--   • une nouvelle promo arrive avec son nom hébreu : le français est ajouté tout seul (shop_translate_tick) et gardé ensuite ;
--   • une promo terminée n'est plus en vente (jamais effacée) et est allégée : le catalogue reste sous 150 Ko.
-- Migration appliquée : ramilevy_automatique.
create or replace function public.ramilevy_fetch() returns bigint
language plpgsql security definer set search_path = public, net as $$
declare r bigint;
begin
  r := net.http_get(url := 'https://raw.githubusercontent.com/bellaichewilliam-svg/Agenda-contr-le-/claude/shopping-price-comparison-aAUf1/livraison/data/ramilevy-promos.json?t=' || extract(epoch from now())::bigint,
    headers := jsonb_build_object('Accept', 'application/json'), timeout_milliseconds := 30000);
  insert into ramilevy_sync (req) values (r);
  return r;
end $$;

create or replace function public.rami_items_fetch() returns bigint
language plpgsql security definer set search_path = public, net as $$
declare r bigint;
begin
  r := net.http_get(url := 'https://raw.githubusercontent.com/bellaichewilliam-svg/Agenda-contr-le-/claude/shopping-price-comparison-aAUf1/livraison/data/ramilevy-prix.json?t=' || extract(epoch from now())::bigint,
    headers := jsonb_build_object('Accept', 'application/json'), timeout_milliseconds := 60000);
  insert into ramilevy_sync (req) values (r);
  return r;
end $$;

create or replace function public.ramilevy_import(p_req bigint default null) returns json
language plpgsql security definer set search_path = public, net as $$
declare sid uuid; v_req bigint; body json; p json; n int := 0; seen uuid[] := '{}'; pid uuid; url text; res json; v_name text; v_fr text; n_items int;
  rx constant text := '^[^א-ת]*[A-Za-zÀ-ÿ]{3,}[^א-ת]* · ';
begin
  select id into sid from shops where code = 'HOPRAMILEVY';
  if sid is null then return json_build_object('error', 'no_shop'); end if;
  v_req := coalesce(p_req, (select s.req from ramilevy_sync s join net._http_response h on h.id = s.req and h.status_code = 200 order by s.req desc limit 1));
  select h.content::json into body from net._http_response h where h.id = v_req and h.status_code = 200;
  if body is null or json_typeof(body->'items') <> 'array' then return json_build_object('error', 'no_response', 'req', v_req); end if;
  -- Fichier trop court = fichier cassé : on ne touche à rien (sinon toute la boutique se viderait)
  n_items := json_array_length(body->'items');
  if n_items < 150 then return json_build_object('error', 'too_few', 'req', v_req, 'items', n_items); end if;
  for p in select * from json_array_elements(body->'items') loop
    continue when coalesce((p->>'p')::numeric, 0) <= 0 or (p->>'p')::numeric > 5000;
    pid := md5('HOPRAMILEVY:' || (p->>'id'))::uuid;
    url := 'https://img.rami-levy.co.il/product/' || (p->>'c') || '/small.jpg';
    if not ext_photo_ok(url) then url := null; end if;
    v_fr := btrim(coalesce(p->>'fr', ''));
    v_name := left(case when v_fr = '' then btrim(p->>'he') else hop_market_name(v_fr, p->>'he') end, 160);
    insert into shop_products (id, shop_id, category_id, name, description, price, photo_url, available, position)
    values (pid, sid, md5('HOPRAMILEVY:cat:' || (p->>'cat'))::uuid, v_name, left(p->>'d', 300), (p->>'p')::numeric, url, true, coalesce((p->>'pos')::int, 0))
    on conflict (id) do update set category_id = excluded.category_id,
      -- sans nom français dans le fichier : on garde la traduction déjà faite par la base (si c'est toujours le même produit)
      name = case when v_fr = '' and shop_products.name ~ rx and position(left(excluded.name, 16) in shop_products.name) > 0
                  then shop_products.name else excluded.name end,
      description = excluded.description, price = excluded.price, photo_url = excluded.photo_url, available = true,
      position = excluded.position;
    seen := seen || pid; n := n + 1;
  end loop;
  -- Promo terminée : plus en vente (jamais effacée), sans photo ni texte pour ne pas alourdir le catalogue
  update shop_products set available = false, description = null, photo_url = null
   where shop_id = sid and not (id = any(seen)) and (available or description is not null or photo_url is not null);
  -- Sécurité : le catalogue doit rester sous 150 Ko (les anciennes promos y restent, en léger) : on retire les plus petites promos
  for i in 1 .. 12 loop
    exit when length(shop_catalog('HOPRAMILEVY')::text) <= 140000;
    update shop_products set available = false, description = null, photo_url = null
     where id in (select id from shop_products where shop_id = sid and available order by position desc limit 15);
  end loop;
  -- (la boutique n'est plus rouverte toute seule : si le patron la suspend, elle reste suspendue)
  res := json_build_object('req', v_req, 'products', n, 'at', body->>'at');
  update ramilevy_sync set done_at = now(), result = res where ramilevy_sync.req = v_req;
  return res;
end $$;

-- Le soir : 1) on demande les deux fichiers, 2) dix minutes après on les charge.
create table if not exists public.ramilevy_auto (day date primary key, promos_req bigint, prix_req bigint, result json, at timestamptz not null default now());
alter table public.ramilevy_auto enable row level security;

create or replace function public.ramilevy_auto_fetch() returns json
language plpgsql security definer set search_path = public as $$
declare a bigint; b bigint;
begin
  a := ramilevy_fetch(); b := rami_items_fetch();
  insert into ramilevy_auto (day, promos_req, prix_req) values (current_date, a, b)
  on conflict (day) do update set promos_req = excluded.promos_req, prix_req = excluded.prix_req, result = null, at = now();
  return json_build_object('promos', a, 'prix', b);
end $$;

create or replace function public.ramilevy_auto_import() returns json
language plpgsql security definer set search_path = public as $$
declare r ramilevy_auto; res json; x json; y json;
begin
  select * into r from ramilevy_auto where day = current_date;
  if r.day is null then return json_build_object('error', 'no_fetch'); end if;
  begin x := ramilevy_import(r.promos_req); exception when others then x := json_build_object('error', sqlerrm); end;
  begin y := rami_items_import(r.prix_req); exception when others then y := json_build_object('error', sqlerrm); end;
  res := json_build_object('promos', x, 'prix', y);
  update ramilevy_auto set result = res where day = r.day;
  return res;
end $$;
revoke all on function public.ramilevy_fetch(), public.rami_items_fetch(), public.ramilevy_import(bigint),
  public.ramilevy_auto_fetch(), public.ramilevy_auto_import() from public, anon, authenticated;

-- 22 h 10 / 22 h 20 en Israël (le robot GitHub passe dans l'après-midi)
select cron.schedule('hop-ramilevy-fetch', '10 20 * * *', 'select public.ramilevy_auto_fetch()');
select cron.schedule('hop-ramilevy-import', '20 20 * * *', 'select public.ramilevy_auto_import()');
-- Traduction française des nouveaux noms : Victory et Rami Lévy
select cron.schedule('hop-traductions', '*/5 * * * *', $c$select public.shop_translate_tick('HOPVICTORY'); select public.shop_translate_tick('HOPRAMILEVY');$c$);
