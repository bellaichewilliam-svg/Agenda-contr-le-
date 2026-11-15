-- Espèces : 10 ₪ de marge sur les plafonds (patron, 15/11/2026 : « on dit 100, mais 102, 104, 108, ça va ») — appliqué en ligne.
-- On affiche toujours « jusqu'à 100 ₪ » (nouveaux clients) / « jusqu'à 200 ₪ » ; la base accepte jusqu'à 110 / 210.
-- Seul changement dans orders_zz_cash_guard : « > st.cash_max + slack » et « > st.cash_first_max + slack » (slack = 10).
-- (Définition complète : voir pg_get_functiondef('public.orders_zz_cash_guard'::regproc) ; même corps qu'avant sinon.)

-- Accusé de réception des notifications (15/11/2026) — appliqué en ligne : le téléphone signale chaque notification reçue.
create table if not exists public.push_got (endpoint text not null, tag text, at timestamptz not null default now());
create index if not exists push_got_at on public.push_got (at desc);
alter table public.push_got enable row level security;
create or replace function public.push_got_mark(p_endpoint text, p_tag text) returns void
language sql security definer set search_path = public as $$
  insert into push_got (endpoint, tag)
  select p_endpoint, left(coalesce(p_tag, ''), 80)
  where exists (select 1 from push_subs where endpoint = p_endpoint)
    and (select count(*) from push_got where endpoint = p_endpoint and at > now() - interval '1 hour') < 300;
$$;
revoke all on function public.push_got_mark(text, text) from public;
grant execute on function public.push_got_mark(text, text) to anon, authenticated;
