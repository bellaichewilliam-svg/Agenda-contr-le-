-- HOP! Fidélité (26/11/2026) : carte de fidélité des commerces, dans l'appli et dans Google Wallet.
-- Le commerce règle sa carte (nb de tampons, cadeau, anniversaire, parrainage, lien avis Google) dans son espace
-- (onglet « Fidélité »). Le client scanne le QR au comptoir (carte.html?s=CODE), donne prénom + téléphone,
-- et ajoute la carte à son Wallet. Le commerce tamponne (téléphone ou QR de la carte).
-- Tout passe par des fonctions SECURITY DEFINER : aucune lecture directe des tables.

create table if not exists public.loyalty_programs (
  shop_id uuid primary key references public.shops(id),
  active boolean not null default true,
  stamps_needed int not null default 10 check (stamps_needed between 3 and 20),
  reward text, reward_he text,
  review_url text,
  birthday_gift text, birthday_gift_he text,
  relance_days int not null default 30 check (relance_days between 0 and 365),
  relance_msg text, relance_msg_he text,
  referral_stamps int not null default 1 check (referral_stamps between 0 and 5),
  welcome_stamps int not null default 0 check (welcome_stamps between 0 and 3),
  color text not null default '#0F1F3D',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loyalty_cards (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id),
  token uuid not null unique default gen_random_uuid(),
  phone text not null,
  name text,
  birthday date,
  lang text default 'fr',
  stamps int not null default 0,
  total_stamps int not null default 0,
  rewards_ready int not null default 0,
  rewards_used int not null default 0,
  referred_by uuid references public.loyalty_cards(id),
  referrals int not null default 0,
  last_visit_at timestamptz,
  last_relance_at timestamptz,
  birthday_year int,
  wallet_at timestamptz,
  created_at timestamptz not null default now(),
  unique (shop_id, phone)
);
create index if not exists loyalty_cards_shop on public.loyalty_cards(shop_id, created_at desc);

create table if not exists public.loyalty_events (
  id bigserial primary key,
  card_id uuid references public.loyalty_cards(id),
  shop_id uuid references public.shops(id),
  kind text not null,          -- join, stamp, reward, redeem, referral, birthday, relance, message, wallet
  n int not null default 1,
  note text,
  at timestamptz not null default now()
);
create index if not exists loyalty_events_shop on public.loyalty_events(shop_id, at desc);

alter table public.loyalty_programs enable row level security;
alter table public.loyalty_cards enable row level security;
alter table public.loyalty_events enable row level security;

-- Téléphone israélien normalisé (05XXXXXXXX)
create or replace function public.loyalty_phone(p text) returns text language sql immutable as $$
  select case when d like '972%' then '0' || substr(d, 4) else d end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') d) x
$$;

create or replace function public.loyalty_prog_json(s public.shops, p public.loyalty_programs) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'shop', jsonb_build_object('code', s.code, 'name', s.name, 'kind', s.kind, 'address', s.address,
      'logo', case when s.logo ~ '^https://' or s.logo ~ '^img/' then s.logo else null end,
      'has_logo', s.logo is not null),
    'stamps_needed', p.stamps_needed, 'reward', p.reward, 'reward_he', p.reward_he,
    'review_url', p.review_url, 'birthday_gift', p.birthday_gift, 'birthday_gift_he', p.birthday_gift_he,
    'referral_stamps', p.referral_stamps, 'welcome_stamps', p.welcome_stamps, 'color', p.color,
    'relance_days', p.relance_days, 'relance_msg', p.relance_msg, 'relance_msg_he', p.relance_msg_he, 'active', p.active)
$$;

create or replace function public.loyalty_card_json(c public.loyalty_cards) returns jsonb language sql stable as $$
  select jsonb_build_object('token', c.token, 'id', c.id, 'name', c.name, 'phone_end', right(c.phone, 4),
    'stamps', c.stamps, 'total_stamps', c.total_stamps, 'rewards_ready', c.rewards_ready, 'rewards_used', c.rewards_used,
    'referrals', c.referrals, 'birthday', to_char(c.birthday, 'DD/MM'), 'last_visit_at', c.last_visit_at,
    'created_at', c.created_at, 'wallet', c.wallet_at is not null, 'lang', c.lang)
$$;

-- Page publique d'inscription (carte.html?s=CODE)
create or replace function public.loyalty_public(p_code text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare s shops; p loyalty_programs;
begin
  select * into s from shops where upper(code) = upper(trim(p_code)) and status <> 'suspendu';
  if not found then return null; end if;
  select * into p from loyalty_programs where shop_id = s.id and active;
  if not found then return null; end if;
  return loyalty_prog_json(s, p);
end $$;

-- Le client rejoint la carte (ou retrouve la sienne avec le même téléphone + même prénom)
create or replace function public.loyalty_join(p_code text, p_phone text, p_name text, p_birthday date default null,
  p_ref uuid default null, p_lang text default 'fr') returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare s shops; p loyalty_programs; c loyalty_cards; ph text := loyalty_phone(p_phone);
  nm text := left(nullif(trim(coalesce(p_name, '')), ''), 40); n int;
begin
  if ph !~ '^0(5\d{8}|7\d{8}|[2-489]\d{7})$' then raise exception 'bad_phone'; end if;
  if nm is null then raise exception 'bad_name'; end if;
  select * into s from shops where upper(code) = upper(trim(p_code)) and status <> 'suspendu';
  if not found then raise exception 'unknown_shop'; end if;
  select * into p from loyalty_programs where shop_id = s.id and active;
  if not found then raise exception 'no_program'; end if;
  select * into c from loyalty_cards where shop_id = s.id and phone = ph;
  if found then
    -- Même téléphone : on ne rend la carte que si le prénom correspond (sinon on ne montre rien d'autrui)
    if lower(extensions.unaccent(coalesce(c.name, ''))) <> lower(extensions.unaccent(nm)) then raise exception 'phone_taken'; end if;
    return jsonb_build_object('card', loyalty_card_json(c), 'program', loyalty_prog_json(s, p), 'again', true);
  end if;
  select count(*) into n from loyalty_cards where shop_id = s.id and created_at > now() - interval '1 day';
  if n >= 300 then raise exception 'too_many'; end if;
  insert into loyalty_cards(shop_id, phone, name, birthday, lang, stamps, total_stamps, referred_by)
    values (s.id, ph, nm, p_birthday, case when p_lang = 'he' then 'he' else 'fr' end,
            p.welcome_stamps, p.welcome_stamps,
            (select id from loyalty_cards where token = p_ref and shop_id = s.id))
    returning * into c;
  insert into loyalty_events(card_id, shop_id, kind, n) values (c.id, s.id, 'join', p.welcome_stamps);
  -- Parrainage : le parrain gagne ses tampons
  if c.referred_by is not null and p.referral_stamps > 0 then
    update loyalty_cards set referrals = referrals + 1 where id = c.referred_by;
    perform loyalty_add(c.referred_by, p.referral_stamps, 'referral');
  end if;
  return jsonb_build_object('card', loyalty_card_json(c), 'program', loyalty_prog_json(s, p), 'again', false);
end $$;

-- Ajoute des tampons ; carte pleine = un cadeau prêt et on repart à zéro
create or replace function public.loyalty_add(p_card uuid, p_n int, p_kind text default 'stamp') returns loyalty_cards
language plpgsql security definer set search_path to 'public' as $$
declare c loyalty_cards; need int; won int;
begin
  select * into c from loyalty_cards where id = p_card for update;
  select stamps_needed into need from loyalty_programs where shop_id = c.shop_id;
  need := coalesce(need, 10);
  won := (c.stamps + p_n) / need;
  update loyalty_cards set stamps = (c.stamps + p_n) % need, total_stamps = total_stamps + p_n,
    rewards_ready = rewards_ready + won, last_visit_at = case when p_kind = 'stamp' then now() else last_visit_at end
    where id = p_card returning * into c;
  insert into loyalty_events(card_id, shop_id, kind, n) values (c.id, c.shop_id, p_kind, p_n);
  if won > 0 then insert into loyalty_events(card_id, shop_id, kind, n) values (c.id, c.shop_id, 'reward', won); end if;
  return c;
end $$;
revoke all on function public.loyalty_add(uuid, int, text) from public, anon, authenticated;

-- Carte du client (carte.html?c=TOKEN, lien de la carte Wallet)
create or replace function public.loyalty_card(p_token uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare c loyalty_cards; s shops; p loyalty_programs;
begin
  select * into c from loyalty_cards where token = p_token;
  if not found then return null; end if;
  select * into s from shops where id = c.shop_id;
  select * into p from loyalty_programs where shop_id = c.shop_id;
  return jsonb_build_object('card', loyalty_card_json(c), 'program', loyalty_prog_json(s, p));
end $$;

-- ===== Espace commerce (p_token = jeton secret du commerce) =====
create or replace function public.loyalty_shop_get(p_token uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare s shops; p loyalty_programs; m date := date_trunc('month', now())::date;
begin
  select * into s from shops where token = p_token and status <> 'suspendu';
  if not found then raise exception 'unknown_shop'; end if;
  select * into p from loyalty_programs where shop_id = s.id;
  if not found then return jsonb_build_object('program', null, 'code', s.code); end if;
  return jsonb_build_object('code', s.code, 'program', loyalty_prog_json(s, p),
    'stats', jsonb_build_object(
      'cards', (select count(*) from loyalty_cards where shop_id = s.id),
      'new_month', (select count(*) from loyalty_cards where shop_id = s.id and created_at >= m),
      'stamps_month', (select coalesce(sum(n), 0) from loyalty_events where shop_id = s.id and kind = 'stamp' and at >= m),
      'rewards_month', (select coalesce(sum(n), 0) from loyalty_events where shop_id = s.id and kind = 'redeem' and at >= m),
      'wallet', (select count(*) from loyalty_cards where shop_id = s.id and wallet_at is not null),
      'referrals', (select coalesce(sum(referrals), 0) from loyalty_cards where shop_id = s.id)),
    'members', coalesce((select jsonb_agg(x order by (x->>'created_at') desc) from (
      select loyalty_card_json(c) || jsonb_build_object('phone', c.phone,
        'sleeping', p.relance_days > 0 and coalesce(c.last_visit_at, c.created_at) < now() - make_interval(days => p.relance_days)) x
      from loyalty_cards c where c.shop_id = s.id order by c.created_at desc limit 300) q), '[]'::jsonb));
end $$;

create or replace function public.loyalty_shop_save(p_token uuid, p jsonb) returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare s shops; rv text := nullif(trim(coalesce(p->>'review_url', '')), ''); col text := coalesce(nullif(p->>'color', ''), '#0F1F3D');
begin
  select * into s from shops where token = p_token and status <> 'suspendu';
  if not found then return false; end if;
  if rv is not null and rv !~ '^https://[^[:space:]]{4,300}$' then raise exception 'bad_link'; end if;
  if col !~ '^#[0-9A-Fa-f]{6}$' then col := '#0F1F3D'; end if;
  insert into loyalty_programs(shop_id, active, stamps_needed, reward, reward_he, review_url, birthday_gift, birthday_gift_he,
      relance_days, relance_msg, relance_msg_he, referral_stamps, welcome_stamps, color, updated_at)
    values (s.id, coalesce((p->>'active')::boolean, true), greatest(3, least(20, coalesce((p->>'stamps_needed')::int, 10))),
      left(nullif(trim(p->>'reward'), ''), 80), left(nullif(trim(p->>'reward_he'), ''), 80), rv,
      left(nullif(trim(p->>'birthday_gift'), ''), 80), left(nullif(trim(p->>'birthday_gift_he'), ''), 80),
      greatest(0, least(365, coalesce((p->>'relance_days')::int, 30))),
      left(nullif(trim(p->>'relance_msg'), ''), 160), left(nullif(trim(p->>'relance_msg_he'), ''), 160),
      greatest(0, least(5, coalesce((p->>'referral_stamps')::int, 1))), greatest(0, least(3, coalesce((p->>'welcome_stamps')::int, 0))),
      col, now())
  on conflict (shop_id) do update set active = excluded.active, stamps_needed = excluded.stamps_needed, reward = excluded.reward,
    reward_he = excluded.reward_he, review_url = excluded.review_url, birthday_gift = excluded.birthday_gift,
    birthday_gift_he = excluded.birthday_gift_he, relance_days = excluded.relance_days, relance_msg = excluded.relance_msg,
    relance_msg_he = excluded.relance_msg_he, referral_stamps = excluded.referral_stamps, welcome_stamps = excluded.welcome_stamps,
    color = excluded.color, updated_at = now();
  return true;
end $$;

-- Retrouver une carte : QR de la carte (jeton), téléphone complet ou 4 derniers chiffres, ou prénom
create or replace function public.loyalty_shop_find(p_token uuid, p_q text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare s shops; q text := trim(coalesce(p_q, '')); d text := loyalty_phone(p_q); tk uuid;
begin
  select * into s from shops where token = p_token and status <> 'suspendu';
  if not found then raise exception 'unknown_shop'; end if;
  tk := substring(q from '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}')::uuid;
  return coalesce((select jsonb_agg(loyalty_card_json(c) || jsonb_build_object('phone', c.phone)) from (
    select * from loyalty_cards c where c.shop_id = s.id and (
      (tk is not null and c.token = tk)
      or (tk is null and length(d) >= 4 and c.phone like '%' || d)
      or (tk is null and length(d) < 4 and length(q) >= 2 and lower(extensions.unaccent(c.name)) like lower(extensions.unaccent(q)) || '%'))
    order by c.last_visit_at desc nulls last limit 8) c), '[]'::jsonb);
end $$;

create or replace function public.loyalty_shop_stamp(p_token uuid, p_card uuid, p_n int default 1) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare s shops; c loyalty_cards; before_rw int;
begin
  select * into s from shops where token = p_token and status <> 'suspendu';
  if not found then raise exception 'unknown_shop'; end if;
  select * into c from loyalty_cards where token = p_card and shop_id = s.id;
  if not found then raise exception 'unknown_card'; end if;
  if p_n < 1 or p_n > 5 then raise exception 'bad_n'; end if;
  -- Anti double-clic : pas deux tampons sur la même carte en moins de 20 secondes
  if exists (select 1 from loyalty_events where card_id = c.id and kind = 'stamp' and at > now() - interval '20 seconds') then
    raise exception 'too_fast'; end if;
  before_rw := c.rewards_ready;
  c := loyalty_add(c.id, p_n, 'stamp');
  return loyalty_card_json(c) || jsonb_build_object('phone', c.phone, 'won', c.rewards_ready > before_rw);
end $$;

create or replace function public.loyalty_shop_redeem(p_token uuid, p_card uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare s shops; c loyalty_cards;
begin
  select * into s from shops where token = p_token and status <> 'suspendu';
  if not found then raise exception 'unknown_shop'; end if;
  update loyalty_cards set rewards_ready = rewards_ready - 1, rewards_used = rewards_used + 1, last_visit_at = now()
    where token = p_card and shop_id = s.id and rewards_ready > 0 returning * into c;
  if not found then raise exception 'no_reward'; end if;
  insert into loyalty_events(card_id, shop_id, kind, n) values (c.id, s.id, 'redeem', 1);
  return loyalty_card_json(c) || jsonb_build_object('phone', c.phone);
end $$;

-- Le commerce relance un client endormi (noté pour ne pas le relancer deux fois de suite)
create or replace function public.loyalty_shop_relanced(p_token uuid, p_card uuid) returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare s shops; n int;
begin
  select * into s from shops where token = p_token and status <> 'suspendu';
  if not found then return false; end if;
  update loyalty_cards set last_relance_at = now() where token = p_card and shop_id = s.id;
  get diagnostics n = row_count;
  if n > 0 then insert into loyalty_events(card_id, shop_id, kind) select id, s.id, 'relance' from loyalty_cards where token = p_card; end if;
  return n > 0;
end $$;

grant execute on function public.loyalty_public(text), public.loyalty_join(text, text, text, date, uuid, text),
  public.loyalty_card(uuid), public.loyalty_shop_get(uuid), public.loyalty_shop_save(uuid, jsonb),
  public.loyalty_shop_find(uuid, text), public.loyalty_shop_stamp(uuid, uuid, int), public.loyalty_shop_redeem(uuid, uuid),
  public.loyalty_shop_relanced(uuid, uuid) to anon, authenticated;
revoke execute on function public.loyalty_prog_json(public.shops, public.loyalty_programs), public.loyalty_card_json(public.loyalty_cards) from public, anon, authenticated;

-- ===== Pour la fonction Edge hop-wallet (clé service seulement) =====
create or replace function public.loyalty_wallet_mark(p_token uuid) returns void
language sql security definer set search_path to 'public' as $$
  update loyalty_cards set wallet_at = coalesce(wallet_at, now()) where token = p_token;
$$;

-- Messages du jour (une fois par jour) : anniversaires et clients endormis à relancer, déjà marqués comme envoyés
create or replace function public.loyalty_daily() returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare res jsonb := '[]'::jsonb; y int := extract(year from (now() at time zone 'Asia/Jerusalem'))::int;
  today date := (now() at time zone 'Asia/Jerusalem')::date;
begin
  with b as (
    update loyalty_cards c set birthday_year = y
    from loyalty_programs p
    where p.shop_id = c.shop_id and p.active and c.birthday is not null and p.birthday_gift is not null
      and c.wallet_at is not null and coalesce(c.birthday_year, 0) < y
      and extract(month from c.birthday) = extract(month from today) and extract(day from c.birthday) = extract(day from today)
    returning c.id, c.token, c.lang, 'birthday'::text kind, case when c.lang = 'he' then coalesce(p.birthday_gift_he, p.birthday_gift) else p.birthday_gift end txt
  ), r as (
    update loyalty_cards c set last_relance_at = now()
    from loyalty_programs p
    where p.shop_id = c.shop_id and p.active and p.relance_days > 0 and c.wallet_at is not null
      and coalesce(c.last_visit_at, c.created_at) < now() - make_interval(days => p.relance_days)
      and (c.last_relance_at is null or c.last_relance_at < now() - make_interval(days => p.relance_days))
    returning c.id, c.token, c.lang, 'relance'::text kind, case when c.lang = 'he' then coalesce(p.relance_msg_he, p.relance_msg) else p.relance_msg end txt
  ), allx as (select * from b union all select * from r)
  select coalesce(jsonb_agg(jsonb_build_object('token', token, 'kind', kind, 'lang', lang, 'text', txt)), '[]'::jsonb) into res from allx;
  insert into loyalty_events(card_id, shop_id, kind, note)
    select c.id, c.shop_id, x->>'kind', 'wallet' from jsonb_array_elements(res) x join loyalty_cards c on c.token = (x->>'token')::uuid;
  return res;
end $$;

-- Message du commerce à tous ses clients Wallet : au plus un toutes les 20 h
create or replace function public.loyalty_shop_broadcast_ok(p_token uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare s shops; lastm timestamptz;
begin
  select * into s from shops where token = p_token and status <> 'suspendu';
  if not found then raise exception 'unknown_shop'; end if;
  select max(at) into lastm from loyalty_events where shop_id = s.id and kind = 'message';
  if lastm > now() - interval '20 hours' then raise exception 'broadcast_wait'; end if;
  insert into loyalty_events(shop_id, kind) values (s.id, 'message');
  return jsonb_build_object('shop_id', s.id, 'code', s.code,
    'tokens', coalesce((select jsonb_agg(token) from loyalty_cards where shop_id = s.id and wallet_at is not null), '[]'::jsonb));
end $$;
revoke execute on function public.loyalty_wallet_mark(uuid), public.loyalty_daily(), public.loyalty_shop_broadcast_ok(uuid) from public, anon, authenticated;

-- ===== Apple Wallet : iPhone inscrits pour recevoir les mises à jour de la carte =====
alter table public.loyalty_cards add column if not exists updated_at timestamptz not null default now();
create or replace function public.loyalty_cards_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'loyalty_cards_touch') then
    create trigger loyalty_cards_touch before update on public.loyalty_cards for each row execute function public.loyalty_cards_touch();
  end if;
end $$;
create table if not exists public.loyalty_apple_devices (
  device_id text not null,
  card_id uuid not null references public.loyalty_cards(id),
  push_token text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (device_id, card_id)
);
alter table public.loyalty_apple_devices enable row level security;
alter table public.loyalty_cards add column if not exists wallet_msg text;   -- dernier message Wallet (dos de la carte Apple)

-- Chaque matin (7 h 17 UTC) : anniversaires et relances envoyés dans les Wallet
-- select cron.schedule('hop-fidelite-daily', '17 7 * * *', $$select net.http_post(url := 'https://qwabzgmlpkazzvwhzfki.supabase.co/functions/v1/hop-wallet', body := '{"action":"daily"}'::jsonb, headers := '{"Content-Type":"application/json"}'::jsonb)$$);
