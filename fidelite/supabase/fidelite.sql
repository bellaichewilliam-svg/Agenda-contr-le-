-- Carte fidélité Wallet (projet séparé de HOP!, 26/11/2026). Tables fid_* : aucun lien avec les tables de HOP!.
-- Le commerçant s'inscrit sur pro.html (lien secret ?k=TOKEN), règle sa carte, imprime son QR.
-- Le client scanne (carte.html?s=CODE), crée sa carte, l'ajoute à Google Wallet / Apple Wallet.
-- Tout passe par des fonctions SECURITY DEFINER (RLS activé, aucune lecture directe).

create table if not exists public.fid_shops (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  token uuid not null unique default gen_random_uuid(),
  name text not null, name_he text,
  owner_phone text,
  logo text,                                  -- image carrée (data:image/png;base64 ou https), servie au Wallet par fid-wallet
  theme text not null default 'cafe',         -- cafe, pizza, burger, sushi, bakery, beauty, barber, flower, shop, sport, pet, heart
  color text not null default '#7A3E1D',
  stamps_needed int not null default 10 check (stamps_needed between 3 and 20),
  reward text, reward_he text,
  welcome_stamps int not null default 0 check (welcome_stamps between 0 and 3),
  referral_stamps int not null default 1 check (referral_stamps between 0 and 5),
  birthday_gift text, birthday_gift_he text,
  relance_days int not null default 30 check (relance_days between 0 and 365),
  relance_msg text, relance_msg_he text,
  review_url text, phone text, whatsapp text, instagram text, website text, address text,
  lat double precision, lon double precision, near_msg text, near_msg_he text,
  active boolean not null default true,
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fid_cards (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.fid_shops(id),
  token uuid not null unique default gen_random_uuid(),
  phone text not null, name text, birthday date, lang text default 'fr',
  stamps int not null default 0, total_stamps int not null default 0,
  rewards_ready int not null default 0, rewards_used int not null default 0,
  referred_by uuid references public.fid_cards(id), referrals int not null default 0,
  last_visit_at timestamptz, last_relance_at timestamptz, birthday_year int,
  wallet_at timestamptz, wallet_msg text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (shop_id, phone)
);
create index if not exists fid_cards_shop on public.fid_cards(shop_id, created_at desc);

create table if not exists public.fid_events (
  id bigserial primary key,
  card_id uuid references public.fid_cards(id), shop_id uuid references public.fid_shops(id),
  kind text not null, n int not null default 1, note text, at timestamptz not null default now()
);
create index if not exists fid_events_shop on public.fid_events(shop_id, at desc);

create table if not exists public.fid_apple_devices (
  device_id text not null, card_id uuid not null references public.fid_cards(id), push_token text not null,
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (device_id, card_id)
);

alter table public.fid_shops enable row level security;
alter table public.fid_cards enable row level security;
alter table public.fid_events enable row level security;
alter table public.fid_apple_devices enable row level security;

create or replace function public.fid_touch() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'fid_cards_touch') then
    create trigger fid_cards_touch before update on public.fid_cards for each row execute function public.fid_touch(); end if;
  if not exists (select 1 from pg_trigger where tgname = 'fid_shops_touch') then
    create trigger fid_shops_touch before update on public.fid_shops for each row execute function public.fid_touch(); end if;
end $$;

create or replace function public.fid_phone(p text) returns text language sql immutable as $$
  select case when d like '972%' then '0' || substr(d, 4) else d end from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') d) x
$$;

-- Ce que le client voit du commerce (jamais le jeton, ni le téléphone du patron)
create or replace function public.fid_shop_json(s public.fid_shops) returns jsonb language sql stable as $$
  select jsonb_build_object('code', s.code, 'name', s.name, 'name_he', s.name_he, 'logo', s.logo is not null, 'logo_v', extract(epoch from s.updated_at)::bigint,
    'theme', s.theme, 'color', s.color, 'stamps_needed', s.stamps_needed, 'reward', s.reward, 'reward_he', s.reward_he,
    'welcome_stamps', s.welcome_stamps, 'referral_stamps', s.referral_stamps, 'birthday_gift', s.birthday_gift, 'birthday_gift_he', s.birthday_gift_he,
    'review_url', s.review_url, 'phone', s.phone, 'whatsapp', s.whatsapp, 'instagram', s.instagram, 'website', s.website, 'address', s.address,
    'has_location', s.lat is not null, 'active', s.active)
$$;
create or replace function public.fid_card_json(c public.fid_cards) returns jsonb language sql stable as $$
  select jsonb_build_object('token', c.token, 'id', c.id, 'name', c.name, 'phone_end', right(c.phone, 4), 'stamps', c.stamps,
    'total_stamps', c.total_stamps, 'rewards_ready', c.rewards_ready, 'rewards_used', c.rewards_used, 'referrals', c.referrals,
    'birthday', to_char(c.birthday, 'DD/MM'), 'last_visit_at', c.last_visit_at, 'created_at', c.created_at, 'wallet', c.wallet_at is not null, 'lang', c.lang)
$$;

-- ===== Commerçant : inscription et réglages =====
create or replace function public.fid_signup(p_name text, p_phone text, p_theme text default 'cafe') returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare nm text := left(nullif(trim(coalesce(p_name, '')), ''), 40); ph text := fid_phone(p_phone); cd text; s fid_shops; n int;
begin
  if nm is null then raise exception 'bad_name'; end if;
  if ph !~ '^0(5\d{8}|7\d{8}|[2-489]\d{7})$' then raise exception 'bad_phone'; end if;
  select count(*) into n from fid_shops where created_at > now() - interval '1 hour';
  if n >= 30 then raise exception 'too_many'; end if;
  loop
    cd := upper(substr(md5(random()::text), 1, 6));
    exit when not exists (select 1 from fid_shops where code = cd);
  end loop;
  insert into fid_shops(code, name, owner_phone, theme) values (cd, nm, ph, coalesce(nullif(p_theme, ''), 'cafe')) returning * into s;
  return jsonb_build_object('token', s.token, 'code', s.code);
end $$;

create or replace function public.fid_pro_get(p_token uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare s fid_shops; m date := date_trunc('month', now())::date;
begin
  select * into s from fid_shops where token = p_token;
  if not found then raise exception 'unknown_shop'; end if;
  return jsonb_build_object('shop', fid_shop_json(s) || jsonb_build_object('relance_days', s.relance_days, 'relance_msg', s.relance_msg, 'relance_msg_he', s.relance_msg_he,
      'lat', s.lat, 'lon', s.lon, 'near_msg', s.near_msg, 'near_msg_he', s.near_msg_he, 'owner_phone', s.owner_phone, 'configured', s.reward is not null or s.reward_he is not null),
    'stats', jsonb_build_object(
      'cards', (select count(*) from fid_cards where shop_id = s.id),
      'new_month', (select count(*) from fid_cards where shop_id = s.id and created_at >= m),
      'stamps_month', (select coalesce(sum(n), 0) from fid_events where shop_id = s.id and kind = 'stamp' and at >= m),
      'rewards_month', (select coalesce(sum(n), 0) from fid_events where shop_id = s.id and kind = 'redeem' and at >= m),
      'wallet', (select count(*) from fid_cards where shop_id = s.id and wallet_at is not null),
      'referrals', (select coalesce(sum(referrals), 0) from fid_cards where shop_id = s.id)),
    'members', coalesce((select jsonb_agg(x order by (x->>'created_at') desc) from (
      select fid_card_json(c) || jsonb_build_object('phone', c.phone,
        'sleeping', s.relance_days > 0 and coalesce(c.last_visit_at, c.created_at) < now() - make_interval(days => s.relance_days)) x
      from fid_cards c where c.shop_id = s.id order by c.created_at desc limit 300) q), '[]'::jsonb));
end $$;

create or replace function public.fid_pro_save(p_token uuid, p jsonb) returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare s fid_shops; u text;
  t text := nullif(trim(coalesce(p->>'review_url', '')), ''); w text := nullif(trim(coalesce(p->>'website', '')), '');
  col text := coalesce(nullif(p->>'color', ''), '#7A3E1D'); lg text := p->>'logo';
begin
  select * into s from fid_shops where token = p_token;
  if not found then return false; end if;
  if t is not null and t !~ '^https://[^[:space:]]{4,300}$' then raise exception 'bad_link'; end if;
  if w is not null and w !~ '^https?://' then w := 'https://' || w; end if;
  if col !~ '^#[0-9A-Fa-f]{6}$' then col := '#7A3E1D'; end if;
  if lg is not null and lg <> '' and lg !~ '^(data:image/(png|jpeg|webp);base64,|https://)' then raise exception 'bad_logo'; end if;
  if length(coalesce(lg, '')) > 200000 then raise exception 'logo_big'; end if;
  update fid_shops set
    name = coalesce(left(nullif(trim(p->>'name'), ''), 40), name), name_he = left(nullif(trim(p->>'name_he'), ''), 40),
    logo = case when p ? 'logo' then nullif(lg, '') else logo end,
    theme = coalesce(nullif(p->>'theme', ''), theme), color = col,
    stamps_needed = greatest(3, least(20, coalesce((p->>'stamps_needed')::int, stamps_needed))),
    reward = left(nullif(trim(p->>'reward'), ''), 60), reward_he = left(nullif(trim(p->>'reward_he'), ''), 60),
    welcome_stamps = greatest(0, least(3, coalesce((p->>'welcome_stamps')::int, 0))),
    referral_stamps = greatest(0, least(5, coalesce((p->>'referral_stamps')::int, 1))),
    birthday_gift = left(nullif(trim(p->>'birthday_gift'), ''), 60), birthday_gift_he = left(nullif(trim(p->>'birthday_gift_he'), ''), 60),
    relance_days = greatest(0, least(365, coalesce((p->>'relance_days')::int, 30))),
    relance_msg = left(nullif(trim(p->>'relance_msg'), ''), 140), relance_msg_he = left(nullif(trim(p->>'relance_msg_he'), ''), 140),
    review_url = t, website = left(w, 200),
    phone = left(nullif(fid_phone(p->>'phone'), ''), 15), whatsapp = left(nullif(fid_phone(p->>'whatsapp'), ''), 15),
    instagram = left(nullif(regexp_replace(trim(coalesce(p->>'instagram', '')), '^@|^https?://(www\.)?instagram\.com/|/$', '', 'g'), ''), 40),
    address = left(nullif(trim(p->>'address'), ''), 120),
    lat = case when p ? 'lat' then (nullif(p->>'lat', ''))::double precision else lat end,
    lon = case when p ? 'lon' then (nullif(p->>'lon', ''))::double precision else lon end,
    near_msg = left(nullif(trim(p->>'near_msg'), ''), 80), near_msg_he = left(nullif(trim(p->>'near_msg_he'), ''), 80),
    active = coalesce((p->>'active')::boolean, true)
  where id = s.id;
  return true;
end $$;

create or replace function public.fid_add(p_card uuid, p_n int, p_kind text default 'stamp') returns fid_cards
language plpgsql security definer set search_path to 'public' as $$
declare c fid_cards; need int; won int;
begin
  select * into c from fid_cards where id = p_card for update;
  select stamps_needed into need from fid_shops where id = c.shop_id;
  need := coalesce(need, 10); won := (c.stamps + p_n) / need;
  update fid_cards set stamps = (c.stamps + p_n) % need, total_stamps = total_stamps + p_n, rewards_ready = rewards_ready + won,
    last_visit_at = case when p_kind = 'stamp' then now() else last_visit_at end where id = p_card returning * into c;
  insert into fid_events(card_id, shop_id, kind, n) values (c.id, c.shop_id, p_kind, p_n);
  if won > 0 then insert into fid_events(card_id, shop_id, kind, n) values (c.id, c.shop_id, 'reward', won); end if;
  return c;
end $$;

create or replace function public.fid_pro_find(p_token uuid, p_q text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare s fid_shops; q text := trim(coalesce(p_q, '')); d text := fid_phone(p_q); tk uuid;
begin
  select * into s from fid_shops where token = p_token;
  if not found then raise exception 'unknown_shop'; end if;
  tk := substring(q from '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}')::uuid;
  return coalesce((select jsonb_agg(fid_card_json(c) || jsonb_build_object('phone', c.phone)) from (
    select * from fid_cards c where c.shop_id = s.id and (
      (tk is not null and c.token = tk)
      or (tk is null and length(d) >= 4 and c.phone like '%' || d)
      or (tk is null and length(d) < 4 and length(q) >= 2 and lower(extensions.unaccent(c.name)) like lower(extensions.unaccent(q)) || '%'))
    order by c.last_visit_at desc nulls last limit 8) c), '[]'::jsonb);
end $$;

create or replace function public.fid_pro_stamp(p_token uuid, p_card uuid, p_n int default 1) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare s fid_shops; c fid_cards; before_rw int;
begin
  select * into s from fid_shops where token = p_token;
  if not found then raise exception 'unknown_shop'; end if;
  select * into c from fid_cards where token = p_card and shop_id = s.id;
  if not found then raise exception 'unknown_card'; end if;
  if p_n < 1 or p_n > 5 then raise exception 'bad_n'; end if;
  if exists (select 1 from fid_events where card_id = c.id and kind = 'stamp' and at > now() - interval '15 seconds') then raise exception 'too_fast'; end if;
  before_rw := c.rewards_ready;
  c := fid_add(c.id, p_n, 'stamp');
  return fid_card_json(c) || jsonb_build_object('phone', c.phone, 'won', c.rewards_ready > before_rw);
end $$;

create or replace function public.fid_pro_redeem(p_token uuid, p_card uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare s fid_shops; c fid_cards;
begin
  select * into s from fid_shops where token = p_token;
  if not found then raise exception 'unknown_shop'; end if;
  update fid_cards set rewards_ready = rewards_ready - 1, rewards_used = rewards_used + 1, last_visit_at = now()
    where token = p_card and shop_id = s.id and rewards_ready > 0 returning * into c;
  if not found then raise exception 'no_reward'; end if;
  insert into fid_events(card_id, shop_id, kind) values (c.id, s.id, 'redeem');
  return fid_card_json(c) || jsonb_build_object('phone', c.phone);
end $$;

create or replace function public.fid_pro_relanced(p_token uuid, p_card uuid) returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare s fid_shops; n int;
begin
  select * into s from fid_shops where token = p_token;
  if not found then return false; end if;
  update fid_cards set last_relance_at = now() where token = p_card and shop_id = s.id;
  get diagnostics n = row_count;
  if n > 0 then insert into fid_events(card_id, shop_id, kind) select id, s.id, 'relance' from fid_cards where token = p_card; end if;
  return n > 0;
end $$;

-- ===== Client =====
create or replace function public.fid_public(p_code text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare s fid_shops;
begin
  select * into s from fid_shops where code = upper(trim(p_code)) and active;
  if not found then return null; end if;
  return fid_shop_json(s);
end $$;

create or replace function public.fid_join(p_code text, p_phone text, p_name text, p_birthday date default null, p_ref uuid default null, p_lang text default 'fr') returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare s fid_shops; c fid_cards; ph text := fid_phone(p_phone); nm text := left(nullif(trim(coalesce(p_name, '')), ''), 30); n int;
begin
  if ph !~ '^0(5\d{8}|7\d{8}|[2-489]\d{7})$' then raise exception 'bad_phone'; end if;
  if nm is null then raise exception 'bad_name'; end if;
  select * into s from fid_shops where code = upper(trim(p_code)) and active;
  if not found then raise exception 'unknown_shop'; end if;
  select * into c from fid_cards where shop_id = s.id and phone = ph;
  if found then
    if lower(extensions.unaccent(coalesce(c.name, ''))) <> lower(extensions.unaccent(nm)) then raise exception 'phone_taken'; end if;
    return jsonb_build_object('card', fid_card_json(c), 'shop', fid_shop_json(s), 'again', true);
  end if;
  select count(*) into n from fid_cards where shop_id = s.id and created_at > now() - interval '1 day';
  if n >= 400 then raise exception 'too_many'; end if;
  insert into fid_cards(shop_id, phone, name, birthday, lang, stamps, total_stamps, referred_by)
    values (s.id, ph, nm, p_birthday, case when p_lang = 'he' then 'he' else 'fr' end, s.welcome_stamps, s.welcome_stamps,
            (select id from fid_cards where token = p_ref and shop_id = s.id)) returning * into c;
  insert into fid_events(card_id, shop_id, kind, n) values (c.id, s.id, 'join', s.welcome_stamps);
  if c.referred_by is not null and s.referral_stamps > 0 then
    update fid_cards set referrals = referrals + 1 where id = c.referred_by;
    perform fid_add(c.referred_by, s.referral_stamps, 'referral');
  end if;
  return jsonb_build_object('card', fid_card_json(c), 'shop', fid_shop_json(s), 'again', false);
end $$;

create or replace function public.fid_card(p_token uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare c fid_cards; s fid_shops;
begin
  select * into c from fid_cards where token = p_token;
  if not found then return null; end if;
  select * into s from fid_shops where id = c.shop_id;
  return jsonb_build_object('card', fid_card_json(c), 'shop', fid_shop_json(s));
end $$;

-- ===== Pour la fonction Edge fid-wallet (clé service seulement) =====
create or replace function public.fid_wallet_data(p_token uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare c fid_cards; s fid_shops;
begin
  select * into c from fid_cards where token = p_token;
  if not found then return null; end if;
  select * into s from fid_shops where id = c.shop_id;
  return jsonb_build_object('card', fid_card_json(c) || jsonb_build_object('wallet_msg', c.wallet_msg),
    'shop', fid_shop_json(s) || jsonb_build_object('lat', s.lat, 'lon', s.lon, 'near_msg', s.near_msg, 'near_msg_he', s.near_msg_he, 'updated', s.updated_at));
end $$;
create or replace function public.fid_logo(p_code text) returns text language sql security definer set search_path to 'public' as $$
  select logo from fid_shops where code = upper(p_code)
$$;
create or replace function public.fid_wallet_mark(p_token uuid) returns void language sql security definer set search_path to 'public' as $$
  update fid_cards set wallet_at = coalesce(wallet_at, now()) where token = p_token;
$$;
create or replace function public.fid_daily() returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare res jsonb; y int := extract(year from (now() at time zone 'Asia/Jerusalem'))::int; today date := (now() at time zone 'Asia/Jerusalem')::date;
begin
  with b as (
    update fid_cards c set birthday_year = y from fid_shops s
    where s.id = c.shop_id and s.active and c.birthday is not null and (s.birthday_gift is not null or s.birthday_gift_he is not null)
      and c.wallet_at is not null and coalesce(c.birthday_year, 0) < y
      and extract(month from c.birthday) = extract(month from today) and extract(day from c.birthday) = extract(day from today)
    returning c.token, 'birthday'::text kind, case when c.lang = 'he' then coalesce(s.birthday_gift_he, s.birthday_gift) else coalesce(s.birthday_gift, s.birthday_gift_he) end txt
  ), r as (
    update fid_cards c set last_relance_at = now() from fid_shops s
    where s.id = c.shop_id and s.active and s.relance_days > 0 and c.wallet_at is not null
      and coalesce(c.last_visit_at, c.created_at) < now() - make_interval(days => s.relance_days)
      and (c.last_relance_at is null or c.last_relance_at < now() - make_interval(days => s.relance_days))
    returning c.token, 'relance'::text kind, case when c.lang = 'he' then coalesce(s.relance_msg_he, s.relance_msg) else coalesce(s.relance_msg, s.relance_msg_he) end txt
  ), allx as (select * from b union all select * from r)
  select coalesce(jsonb_agg(jsonb_build_object('token', token, 'kind', kind, 'text', txt)), '[]'::jsonb) into res from allx;
  insert into fid_events(card_id, shop_id, kind, note)
    select c.id, c.shop_id, x->>'kind', 'wallet' from jsonb_array_elements(res) x join fid_cards c on c.token = (x->>'token')::uuid;
  return res;
end $$;
create or replace function public.fid_broadcast_ok(p_token uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare s fid_shops; lastm timestamptz;
begin
  select * into s from fid_shops where token = p_token;
  if not found then raise exception 'unknown_shop'; end if;
  select max(at) into lastm from fid_events where shop_id = s.id and kind = 'message';
  if lastm > now() - interval '20 hours' then raise exception 'broadcast_wait'; end if;
  insert into fid_events(shop_id, kind) values (s.id, 'message');
  return jsonb_build_object('tokens', coalesce((select jsonb_agg(token) from fid_cards where shop_id = s.id and wallet_at is not null), '[]'::jsonb));
end $$;

revoke execute on function public.fid_add(uuid, int, text), public.fid_wallet_data(uuid), public.fid_wallet_mark(uuid), public.fid_daily(),
  public.fid_broadcast_ok(uuid), public.fid_shop_json(public.fid_shops), public.fid_card_json(public.fid_cards) from public, anon, authenticated;
grant execute on function public.fid_signup(text, text, text), public.fid_pro_get(uuid), public.fid_pro_save(uuid, jsonb), public.fid_pro_find(uuid, text),
  public.fid_pro_stamp(uuid, uuid, int), public.fid_pro_redeem(uuid, uuid), public.fid_pro_relanced(uuid, uuid),
  public.fid_public(text), public.fid_join(text, text, text, date, uuid, text), public.fid_card(uuid), public.fid_logo(text) to anon, authenticated;

-- Chaque matin 7 h 17 UTC : anniversaires et relances dans les Wallet
-- select cron.schedule('fid-daily', '17 7 * * *', $$select net.http_post(url := 'https://qwabzgmlpkazzvwhzfki.supabase.co/functions/v1/fid-wallet', body := '{"action":"daily"}'::jsonb, headers := '{"Content-Type":"application/json"}'::jsonb)$$);
