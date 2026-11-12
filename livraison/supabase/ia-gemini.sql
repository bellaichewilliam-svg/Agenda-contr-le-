-- IA Gemini de HOP! (quota gratuit du patron, 12/11/2026).
-- La clé Gemini est dans les secrets Supabase (GEMINI_API_KEY), jamais ici ni dans l'appli.
-- La fonction hop-ia ne traite que les demandes écrites dans ia_jobs, reçues par leur id.
-- La clé anon ci-dessous est la clé publique de l'appli (déjà dans config.js), pas un secret.

create table if not exists public.ia_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  status text not null default 'attente',
  error text,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
alter table public.ia_jobs enable row level security;
alter table public.ia_jobs add column if not exists device text;
create index if not exists ia_jobs_device_idx on public.ia_jobs (device, created_at);
create index if not exists ia_jobs_created_idx on public.ia_jobs (created_at);

-- Pose une question à l'IA : écrit la demande dans ia_jobs, puis appelle la fonction hop-ia.
create or replace function public.ia_call(p_kind text, p_input jsonb default '{}'::jsonb) returns uuid
language plpgsql security definer set search_path = public, net as $$
declare j uuid;
begin
  if p_kind not in ('test', 'traduire_produits', 'commande_vocale', 'modeles', 'assistant') then raise exception 'tache_inconnue'; end if;
  insert into ia_jobs (kind, input) values (p_kind, coalesce(p_input, '{}'::jsonb)) returning id into j;
  perform net.http_post(
    url := 'https://qwabzgmlpkazzvwhzfki.supabase.co/functions/v1/hop-ia',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YWJ6Z21scGthenp2d2h6ZmtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MTQ3MDAsImV4cCI6MjEwNzk5MDcwMH0.O-MhDJnHp8h8XamlgwEL_Bxm3EIzQufySPwAiGLRrOs', 'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YWJ6Z21scGthenp2d2h6ZmtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MTQ3MDAsImV4cCI6MjEwNzk5MDcwMH0.O-MhDJnHp8h8XamlgwEL_Bxm3EIzQufySPwAiGLRrOs'),
    body := jsonb_build_object('id', j), timeout_milliseconds := 60000);
  return j;
end $$;
revoke all on function public.ia_call(text, jsonb) from public, anon, authenticated;

-- Commande à la voix (patron, 12/11) : le client dit « je veux un Mars et un lait » ou « un riz tartare chez Nini Sushi ».
-- On n'envoie à l'IA que le texte dit et la liste des commerces (code + nom) : jamais l'adresse, le nom ou le téléphone.
-- Limites : 8 demandes / 10 min par téléphone, 400 / heure en tout (le quota gratuit reste pour tout le monde).
create or replace function public.ia_voice(p_text text, p_lang text default 'fr', p_device text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare t text := left(btrim(coalesce(p_text, '')), 300); d text := left(coalesce(p_device, ''), 64); j uuid;
begin
  if length(t) < 2 then raise exception 'texte_court'; end if;
  if d <> '' and (select count(*) from ia_jobs where device = d and created_at > now() - interval '10 minutes') >= 8 then
    raise exception 'trop_de_demandes';
  end if;
  if (select count(*) from ia_jobs where kind = 'commande_vocale' and created_at > now() - interval '1 hour') >= 400 then
    raise exception 'trop_de_demandes';
  end if;
  j := ia_call('commande_vocale', jsonb_build_object(
    'text', t, 'lang', case when p_lang = 'he' then 'he' else 'fr' end,
    'shops', coalesce((select jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name) order by s.rank nulls last)
                         from shops s where s.status = 'actif' and not s.demo and (s.plan_until >= current_date or s.showcase)), '[]'::jsonb)));
  update ia_jobs set device = nullif(d, '') where id = j;
  return j;
end $$;
revoke all on function public.ia_voice(text, text, text) from public;
grant execute on function public.ia_voice(text, text, text) to anon, authenticated;

-- Le résultat d'une commande à la voix (seulement celles de moins de 15 min ; l'id est introuvable sans l'avoir demandé).
create or replace function public.ia_voice_result(p_id uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('status', j.status, 'output', j.output)
    from ia_jobs j where j.id = p_id and j.kind in ('commande_vocale', 'assistant') and j.created_at > now() - interval '15 minutes'
$$;
revoke all on function public.ia_voice_result(uuid) from public;
grant execute on function public.ia_voice_result(uuid) to anon, authenticated;

-- Règles en plus du cerveau de Hoppy : on les change ici (create or replace), sans redéployer la fonction hop-ia.
create or replace function public.ia_regles() returns text language sql immutable as $r$ select $t$
21. Restaurant ou magasin qui n'est pas sur HOP! (règles 11 et 20) : mets "from" (son nom, et sa rue si tu la connais) DÈS que tu connais le nom : l'appli affiche alors au client l'adresse et le téléphone qu'elle a dans son répertoire, et il confirme. Puis demande : « Vous avez déjà passé la commande chez eux ? »
   - OUI : demande « Elle sera prête dans combien de temps ? », écris-le dans le "name" du "basket" (ex. « Commande Pizza X · prête dans 20 min »), puis « J'envoie le livreur ? » ; à son oui : "go": true avec "service": "retrait".
   - NON : dis « Commandez chez eux, leur numéro s'affiche juste ici si on l'a. Je vous attends : revenez me dire dans combien de temps c'est prêt, et j'envoie le livreur. » (ne mets pas "go").
   - S'il dit que l'adresse affichée n'est pas la bonne, ou qu'on ne la connaît pas : demande le nom exact et la rue, et remets-les dans "from" (on l'ajoute à notre répertoire).
$t$::text $r$;

-- Restaurants / magasins demandés qui ne sont pas dans notre répertoire (pour les ajouter) : nom et rue seulement
create table if not exists public.places_asked (
  id uuid primary key default gen_random_uuid(), name text not null, device text, n int not null default 1,
  created_at timestamptz not null default now(), last_at timestamptz not null default now());
alter table public.places_asked enable row level security;
create unique index if not exists places_asked_name_idx on public.places_asked (lower(name));
create or replace function public.place_suggest(p_name text, p_device text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v text := left(btrim(coalesce(p_name, '')), 120);
begin
  if length(v) < 3 then return; end if;
  if (select count(*) from places_asked where created_at > now() - interval '1 hour') >= 200 then return; end if;
  insert into places_asked (name, device) values (v, left(coalesce(p_device, ''), 64))
  on conflict (lower(name)) do update set n = places_asked.n + 1, last_at = now();
end $$;
revoke all on function public.place_suggest(text, text) from public;
grant execute on function public.place_suggest(text, text) to anon, authenticated;

-- Patron : la liste des enseignes demandées à Hoppy et pas encore dans l'annuaire ; « traité » (ajoutée ou ignorée), sans rien effacer
alter table public.places_asked add column if not exists done_at timestamptz;
create or replace function public.admin_places_asked() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return coalesce((select json_agg(json_build_object('id', a.id, 'name', a.name, 'n', a.n, 'last_at', a.last_at) order by a.last_at desc)
                     from (select * from places_asked where done_at is null order by last_at desc limit 100) a), '[]'::json);
end $$;
revoke all on function public.admin_places_asked() from public, anon;
grant execute on function public.admin_places_asked() to authenticated;
create or replace function public.admin_place_asked_done(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update places_asked set done_at = now() where id = p_id and done_at is null;
  return found;
end $$;
revoke all on function public.admin_place_asked_done(uuid) from public, anon;
grant execute on function public.admin_place_asked_done(uuid) to authenticated;

-- 🎤 Hoppy, l'assistant qui parle (patron, 12/11) : un tour de conversation (ce que le client vient de dire, l'historique,
-- ce que l'appli sait déjà : adresse choisie oui / non, panier, rayons). Jamais d'adresse, de nom ni de téléphone dedans :
-- l'appli les demande et les garde elle-même. Limites : 60 tours / 10 min par téléphone, 2000 / heure en tout.
create or replace function public.ia_assist(p_input jsonb, p_device text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare d text := left(coalesce(p_device, ''), 64); j uuid;
begin
  if p_input is null or length(p_input::text) > 45000 or length(btrim(coalesce(p_input->>'text', ''))) < 1 then raise exception 'demande_invalide'; end if;
  if d <> '' and (select count(*) from ia_jobs where device = d and created_at > now() - interval '10 minutes') >= 60 then raise exception 'trop_de_demandes'; end if;
  if (select count(*) from ia_jobs where kind = 'assistant' and created_at > now() - interval '1 hour') >= 2000 then raise exception 'trop_de_demandes'; end if;
  j := ia_call('assistant', jsonb_build_object('text', left(p_input->>'text', 400), 'lang', case when p_input->>'lang' = 'he' then 'he' else 'fr' end,
    'history', coalesce(p_input->'history', '[]'::jsonb), 'ctx', coalesce(p_input->'ctx', '{}'::jsonb),
    'rayons', left(coalesce(p_input->>'rayons', ''), 26000), 'regles', public.ia_regles(),
    'shops', coalesce((select jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name, 'kind', s.kind) order by s.rank nulls last)
                         from shops s where s.status = 'actif' and not s.demo and (s.plan_until >= current_date or s.showcase)), '[]'::jsonb)));
  update ia_jobs set device = nullif(d, '') where id = j;
  return j;
end $$;
revoke all on function public.ia_assist(jsonb, text) from public;
grant execute on function public.ia_assist(jsonb, text) to anon, authenticated;

-- 🎤 Dialogue Hoppy d'une course (patron seulement, 12/11) : ce que le client a dit à Hoppy et ce que Hoppy a répondu,
-- sur le même téléphone, dans les 6 h avant la commande (et 30 min après). Sert aussi pour une course refusée.
create or replace function public.admin_ia_dialog(p_order uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare o record;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select id, ref, device_id, created_at into o from orders where id = p_order;
  if o.id is null or o.device_id is null then return '[]'::json; end if;
  return coalesce((select json_agg(json_build_object('at', j.created_at, 'client', j.input->>'text', 'hoppy', coalesce(j.output->>'say', j.output->>'reply'),
                                                     'panier', j.output->'basket', 'etat', j.status) order by j.created_at)
                     from ia_jobs j
                    where j.device = o.device_id::text and j.kind in ('assistant', 'commande_vocale')
                      and j.created_at between o.created_at - interval '6 hours' and o.created_at + interval '30 minutes'), '[]'::json);
end $$;
revoke all on function public.admin_ia_dialog(uuid) from public, anon;
grant execute on function public.admin_ia_dialog(uuid) to authenticated;
