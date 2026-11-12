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
  if p_kind not in ('test', 'traduire_produits', 'commande_vocale', 'modeles') then raise exception 'tache_inconnue'; end if;
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
    from ia_jobs j where j.id = p_id and j.kind = 'commande_vocale' and j.created_at > now() - interval '15 minutes'
$$;
revoke all on function public.ia_voice_result(uuid) from public;
grant execute on function public.ia_voice_result(uuid) to anon, authenticated;
