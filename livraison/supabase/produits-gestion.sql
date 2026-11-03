-- ============================================================================
-- Gestion des produits façon boutique en ligne (patron) : rayons « Courses du quotidien », pharmacie, tabac…
-- • ord : l'ordre choisi par le patron (produits dans leur catégorie, catégories dans leur rayon)
-- • rayon_log : historique de chaque changement (avant → après), avec « Annuler »
-- • enregistrement groupé (plusieurs produits d'un coup)
-- • photos servies par lien (rayon_pic), jamais dans la liste envoyée aux clients
-- • import Carrefour depuis le panneau patron + « Mettre à jour les prix Carrefour »
-- Rien n'est jamais effacé : masquer / rétablir.
-- ============================================================================
alter table public.rayon_items add column if not exists ord int;
alter table public.rayon_cats add column if not exists ord int;

create table if not exists public.rayon_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  kind text not null,              -- 'item' ou 'cat'
  rayon text not null,
  ref_id text not null,
  src text,                        -- patron, carrefour, annulation, import
  before jsonb,
  after jsonb
);
create index if not exists rayon_log_at on public.rayon_log (at desc);
create index if not exists rayon_log_ref on public.rayon_log (rayon, ref_id);
alter table public.rayon_log enable row level security;

-- Historique : seulement les vrais changements (l'ordre seul n'est pas noté)
create or replace function public.rayon_log_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare a jsonb; b jsonb; k text; id text;
begin
  a := to_jsonb(new) - 'updated_at';
  b := case when tg_op = 'UPDATE' then to_jsonb(old) - 'updated_at' end;
  if b is not null and (a - 'ord' - 'position') = (b - 'ord' - 'position') then return new; end if;
  if tg_op = 'INSERT' and coalesce(a->>'name_fr', '') = '' and a->>'price_lo' is null and coalesce((a->>'hidden')::boolean, false) = false then return new; end if;
  k := case when tg_table_name = 'rayon_items' then 'item' else 'cat' end;
  id := case when k = 'item' then new.item_id else new.cat_id end;
  insert into rayon_log (kind, rayon, ref_id, src, before, after)
  values (k, new.rayon, id,
    coalesce(nullif(current_setting('hop.src', true), ''), case when public.is_admin() then 'patron' else 'import' end), b, a);
  return new;
end $$;
create or replace trigger rayon_items_log after insert or update on public.rayon_items for each row execute function public.rayon_log_trg();
create or replace trigger rayon_cats_log after insert or update on public.rayon_cats for each row execute function public.rayon_log_trg();

-- Enregistrer un produit / une catégorie (patron) : + l'ordre (ord)
create or replace function public.admin_rayon_item_save(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if coalesce(p->>'rayon', '') = '' or coalesce(p->>'item_id', '') !~ '^[a-z0-9_-]{1,40}$' then raise exception 'bad_id'; end if;
  insert into rayon_items (rayon, item_id) values (p->>'rayon', p->>'item_id') on conflict do nothing;
  update rayon_items set
    cat      = case when p ? 'cat' then nullif(p->>'cat', '') else cat end,
    name_fr  = case when p ? 'name_fr' then nullif(trim(p->>'name_fr'), '') else name_fr end,
    name_he  = case when p ? 'name_he' then nullif(trim(p->>'name_he'), '') else name_he end,
    price_lo = case when p ? 'price_lo' then (p->>'price_lo')::numeric else price_lo end,
    price_hi = case when p ? 'price_hi' then (p->>'price_hi')::numeric else price_hi end,
    img      = case when p ? 'img' then nullif(p->>'img', '') else img end,
    emoji    = case when p ? 'emoji' then nullif(p->>'emoji', '') else emoji end,
    photo    = case when p ? 'photo' then nullif(p->>'photo', '') else photo end,
    sz       = case when p ? 'sz' then (p->>'sz')::int else sz end,
    adult    = case when p ? 'adult' then nullif(p->>'adult', '') else adult end,
    opts     = case when p ? 'opts' then nullif(p->'opts', 'null'::jsonb) else opts end,
    hidden   = case when p ? 'hidden' then coalesce((p->>'hidden')::boolean, false) else hidden end,
    position = case when p ? 'position' then coalesce((p->>'position')::int, 0) else position end,
    ord      = case when p ? 'ord' then (p->>'ord')::int else ord end,
    updated_at = now()
  where rayon = p->>'rayon' and item_id = p->>'item_id';
end $$;

create or replace function public.admin_rayon_cat_save(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if coalesce(p->>'rayon', '') = '' or coalesce(p->>'cat_id', '') !~ '^[a-z0-9_-]{1,40}$' then raise exception 'bad_id'; end if;
  insert into rayon_cats (rayon, cat_id) values (p->>'rayon', p->>'cat_id') on conflict do nothing;
  update rayon_cats set
    name_fr  = case when p ? 'name_fr' then nullif(trim(p->>'name_fr'), '') else name_fr end,
    name_he  = case when p ? 'name_he' then nullif(trim(p->>'name_he'), '') else name_he end,
    img      = case when p ? 'img' then nullif(p->>'img', '') else img end,
    emoji    = case when p ? 'emoji' then nullif(p->>'emoji', '') else emoji end,
    hidden   = case when p ? 'hidden' then coalesce((p->>'hidden')::boolean, false) else hidden end,
    position = case when p ? 'position' then coalesce((p->>'position')::int, 0) else position end,
    ord      = case when p ? 'ord' then (p->>'ord')::int else ord end,
    updated_at = now()
  where rayon = p->>'rayon' and cat_id = p->>'cat_id';
end $$;

-- Plusieurs d'un coup (masquer, changer de catégorie, prix, ordre) : une seule requête
create or replace function public.admin_rayon_save_many(p_kind text, ps jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare e jsonb; n int := 0;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if jsonb_typeof(ps) <> 'array' or jsonb_array_length(ps) > 1000 then raise exception 'bad_list'; end if;
  for e in select * from jsonb_array_elements(ps) loop
    if p_kind = 'cat' then perform public.admin_rayon_cat_save(e); else perform public.admin_rayon_item_save(e); end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Historique (sans le contenu des photos), le plus récent d'abord
create or replace function public.admin_rayon_log(p_limit int default 150, p_rayon text default null, p_ref text default null) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return coalesce((select json_agg(json_build_object('id', l.id, 'at', l.at, 'kind', l.kind, 'rayon', l.rayon, 'ref', l.ref_id, 'src', l.src,
      'before', l.before - 'photo' - 'opts', 'after', l.after - 'photo' - 'opts',
      'photo', (l.before->>'photo') is distinct from (l.after->>'photo')) order by l.id desc)
    from (select * from rayon_log where (p_rayon is null or rayon = p_rayon) and (p_ref is null or ref_id = p_ref)
          order by id desc limit least(greatest(p_limit, 1), 500)) l), '[]'::json);
end $$;

-- Annuler un changement : on remet la ligne comme avant (un ajout est masqué, jamais effacé ;
-- p_hide : produit ajouté par le patron, sans rien avant)
create or replace function public.admin_rayon_undo(p_id bigint, p_hide boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare l rayon_log;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into l from rayon_log where id = p_id;
  if not found then raise exception 'not_found'; end if;
  perform set_config('hop.src', 'annulation', true);
  if l.kind = 'item' then
    if l.before is null or p_hide then
      update rayon_items set hidden = true, updated_at = now() where rayon = l.rayon and item_id = l.ref_id;
    else
      update rayon_items t set cat = coalesce(r.cat, t.cat), name_fr = coalesce(r.name_fr, t.name_fr), name_he = coalesce(r.name_he, t.name_he), price_lo = r.price_lo, price_hi = r.price_hi,
             img = r.img, emoji = r.emoji, photo = r.photo, sz = r.sz, adult = r.adult, opts = r.opts, hidden = r.hidden, updated_at = now()
        from jsonb_populate_record(null::rayon_items, l.before) r
       where t.rayon = l.rayon and t.item_id = l.ref_id;
    end if;
  else
    if l.before is null or p_hide then
      update rayon_cats set hidden = true, updated_at = now() where rayon = l.rayon and cat_id = l.ref_id;
    else
      update rayon_cats t set name_fr = coalesce(r.name_fr, t.name_fr), name_he = coalesce(r.name_he, t.name_he), img = r.img, emoji = r.emoji, hidden = r.hidden, updated_at = now()
        from jsonb_populate_record(null::rayon_cats, l.before) r
       where t.rayon = l.rayon and t.cat_id = l.ref_id;
    end if;
  end if;
end $$;

-- Photo d'un produit de rayon, servie comme une image (gardée en mémoire par le téléphone)
create or replace function public.rayon_pic(r text, i text, v text default '') returns "*/*"
language plpgsql stable security definer set search_path = public as $$
declare ph text;
begin
  select photo into ph from rayon_items where rayon = r and item_id = i and photo like 'data:image/%';
  if ph is null then
    perform set_config('response.status', '404', true);
    return null;
  end if;
  perform set_config('response.headers', json_build_array(
    json_build_object('Content-Type', substring(ph from '^data:(image/[a-z]+);base64,')),
    json_build_object('Cache-Control', 'public, max-age=31536000, immutable'))::text, true);
  return decode(substring(ph from position(',' in ph) + 1), 'base64');
end $$;
grant execute on function public.rayon_pic(text, text, text) to anon, authenticated;

-- Liste publique des rayons : légère (sans champs vides, photos par lien rp:<rayon>:<produit>:<empreinte>)
create or replace function public.rayons_live() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'cats', coalesce((select json_agg(jsonb_strip_nulls(to_jsonb(c) - 'updated_at') order by c.position, c.updated_at) from rayon_cats c), '[]'::json),
    'items', coalesce((select json_agg(jsonb_strip_nulls((to_jsonb(i) - 'updated_at' - 'photo')
        || case when i.photo like 'data:image/%' then jsonb_build_object('photo', 'rp:' || i.rayon || ':' || i.item_id || ':' || left(md5(i.photo), 10))
                when i.photo is not null then jsonb_build_object('photo', i.photo) else '{}'::jsonb end)
      order by i.position, i.updated_at) from rayon_items i), '[]'::json));
$$;

-- --- Import Carrefour depuis le panneau patron -------------------------------------------------------------
-- Chaque catégorie Carrefour importée est retenue (rayon, rubrique, pictogramme) : « Mettre à jour les prix »
-- les reprend toutes.
create table if not exists public.carrefour_sources (
  cat_no int primary key,
  rayon text not null,
  cat text not null,
  img text,
  emoji text,
  last_at timestamptz,
  last_total int
);
alter table public.carrefour_sources enable row level security;
insert into public.carrefour_sources (cat_no, rayon, cat, img, emoji) values
  (79684, 'super', 'bois', 'water', '💧'), (79681, 'super', 'bois', 'cupstraw', '🥤'), (95097, 'super', 'bois', 'juice', '🧃'),
  (79683, 'super', 'bois', 'bottle', '⚡'), (79679, 'super', 'bois', 'juice', '🧃'), (79723, 'super', 'lait', 'milk', '🥛')
on conflict (cat_no) do nothing;

create or replace function public.admin_carrefour_fetch(p_cat int, p_from int default 0) returns bigint
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_cat is null or p_cat <= 0 or p_from < 0 then raise exception 'bad_cat'; end if;
  return public.carrefour_fetch(p_cat, p_from, 100);
end $$;

-- Rend { pending } tant que Carrefour n'a pas répondu, sinon { total, count, added, changed, to_translate }
create or replace function public.admin_carrefour_import(p_req bigint, p_cat_no int, p_rayon text, p_cat text, p_img text default null, p_emoji text default null)
returns json language plpgsql security definer set search_path = public, net as $$
declare r record; body json; ids text[]; old jsonb; n int; added int; changed int; tr int; total int;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select h.status_code, h.content, h.timed_out, h.error_msg into r from net._http_response h where h.id = p_req;
  if not found then return json_build_object('pending', true); end if;
  if r.status_code is distinct from 200 then raise exception 'carrefour_%', coalesce(r.status_code::text, 'injoignable'); end if;
  body := r.content::json;
  total := coalesce((body->>'total')::int, json_array_length(body->'products'));
  select array_agg('cf' || (p->>'id')) into ids from json_array_elements(body->'products') p;
  select coalesce(jsonb_object_agg(item_id, price_lo), '{}'::jsonb) into old from rayon_items where rayon = p_rayon and item_id = any(coalesce(ids, '{}'));
  perform set_config('hop.src', 'carrefour', true);
  select count(*),
         count(*) filter (where not old ? x.item_id),
         count(*) filter (where old ? x.item_id and (old->>x.item_id)::numeric is distinct from x.prix),
         count(*) filter (where x.a_traduire)
    into n, added, changed, tr
    from public.carrefour_import(p_req, p_rayon, p_cat, coalesce(nullif(p_img, ''), 'basket'), coalesce(nullif(p_emoji, ''), '🛒')) x;
  insert into carrefour_sources (cat_no, rayon, cat, img, emoji, last_at, last_total)
  values (p_cat_no, p_rayon, p_cat, nullif(p_img, ''), nullif(p_emoji, ''), now(), total)
  on conflict (cat_no) do update set rayon = excluded.rayon, cat = excluded.cat, img = coalesce(excluded.img, carrefour_sources.img),
    emoji = coalesce(excluded.emoji, carrefour_sources.emoji), last_at = now(), last_total = excluded.last_total;
  return json_build_object('total', total, 'count', n, 'added', added, 'changed', changed, 'to_translate', tr);
end $$;

create or replace function public.admin_carrefour_sources() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return coalesce((select json_agg(json_build_object('cat_no', s.cat_no, 'rayon', s.rayon, 'cat', s.cat, 'img', s.img, 'emoji', s.emoji,
      'last_at', s.last_at, 'last_total', s.last_total) order by s.rayon, s.cat, s.cat_no) from carrefour_sources s), '[]'::json);
end $$;

revoke all on function public.admin_rayon_save_many(text, jsonb) from public, anon;
revoke all on function public.admin_rayon_log(int, text, text) from public, anon;
revoke all on function public.admin_rayon_undo(bigint, boolean) from public, anon;
revoke all on function public.admin_carrefour_fetch(int, int) from public, anon;
revoke all on function public.admin_carrefour_import(bigint, int, text, text, text, text) from public, anon;
revoke all on function public.admin_carrefour_sources() from public, anon;
grant execute on function public.admin_rayon_save_many(text, jsonb), public.admin_rayon_log(int, text, text), public.admin_rayon_undo(bigint, boolean),
  public.admin_carrefour_fetch(int, int), public.admin_carrefour_import(bigint, int, text, text, text, text), public.admin_carrefour_sources() to authenticated;
