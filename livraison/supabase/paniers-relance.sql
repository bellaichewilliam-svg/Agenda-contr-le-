-- Paniers laissés (04/11/2026) : relancer même un client sans nom ni numéro.
-- * Notification sur son téléphone (s'il l'a acceptée au 1er article) : client_push_subs.device = l'appareil du panier.
--   30 min sans bouger, pas commandé, entre 9 h et 22 h : « 🛒 Votre panier … vous attend » (une seule fois par panier).
-- * « Prévenez-moi à l'ouverture » (commerce ou service fermé) : notification dès que c'est ouvert, et le patron le voit.
-- * L'étape où le client s'arrête (panier, adresse, détails, récapitulatif, envoi) : carts.step.
-- * Les paniers faits depuis le téléphone du patron (essais) : carts.boss, mis à part dans l'onglet Paniers.
alter table public.client_push_subs add column if not exists device text;
create index if not exists client_push_subs_device on public.client_push_subs (device);
alter table public.carts add column if not exists step text;
alter table public.carts add column if not exists boss boolean not null default false;
alter table public.carts add column if not exists push_ok boolean not null default false;
alter table public.carts add column if not exists push_reminded_at timestamptz;
alter table public.carts add column if not exists open_notice boolean not null default false;
alter table public.carts add column if not exists open_notice_at timestamptz;
alter table public.carts add column if not exists open_noticed_at timestamptz;

-- Abonnement aux notifications depuis le panier (sans commande) : lié à l'appareil
create or replace function public.cart_push_subscribe(p_device text, p_endpoint text, p_p256dh text, p_auth text, p_lang text default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_device is null or length(p_device) < 8 or length(p_device) > 80
     or coalesce(p_endpoint, '') !~ '^https://' or length(p_endpoint) > 1000 then return false; end if;
  insert into client_push_subs (endpoint, p256dh, auth, device, lang)
    values (p_endpoint, left(p_p256dh, 200), left(p_auth, 100), p_device, left(p_lang, 5))
    on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, device = excluded.device,
      lang = coalesce(excluded.lang, client_push_subs.lang);
  update carts set push_ok = true where device = p_device;
  return true;
end;
$$;
revoke execute on function public.cart_push_subscribe(text, text, text, text, text) from public;
grant execute on function public.cart_push_subscribe(text, text, text, text, text) to anon, authenticated;

-- Le panier (même règles qu'avant) + l'étape, le panier du patron, « prévenez-moi à l'ouverture »
create or replace function public.cart_save(p_device text, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare n int := greatest(0, least(500, coalesce((p->>'count')::int, 0)));
  stp text := nullif(left(p->>'step', 20), '');
  bos boolean := coalesce(p->>'boss', '') = 'true';
  opn boolean := coalesce(p->>'open_notice', '') = 'true';
begin
  if p_device is null or length(p_device) < 8 or length(p_device) > 80 or pg_column_size(p) > 30000 then return; end if;
  insert into carts as c (device, lang, client_name, client_phone, kind, shop_code, shop_name, items, count, total, status, updated_at, step, boss, open_notice, open_notice_at)
  values (p_device, left(p->>'lang', 5), left(nullif(p->>'name', ''), 80), left(nullif(p->>'phone', ''), 20), left(p->>'kind', 20),
    left(nullif(p->>'shop_code', ''), 40), left(nullif(p->>'shop_name', ''), 120),
    case when jsonb_typeof(p->'items') = 'array' then p->'items' else '[]'::jsonb end, n,
    case when (p->>'total') ~ '^[0-9]+(\.[0-9]+)?$' then (p->>'total')::numeric end,
    case when n = 0 then 'vide' else 'actif' end, now(), coalesce(stp, 'panier'), bos, opn, case when opn then now() end)
  on conflict (device) do update set
    lang = excluded.lang,
    client_name = coalesce(excluded.client_name, c.client_name),
    client_phone = coalesce(excluded.client_phone, c.client_phone),
    kind = case when n = 0 then c.kind else excluded.kind end,
    shop_code = case when n = 0 then c.shop_code else excluded.shop_code end,
    shop_name = case when n = 0 then c.shop_name else excluded.shop_name end,
    items = case when n = 0 and c.status = 'commande' then c.items else excluded.items end,
    count = case when n = 0 and c.status = 'commande' then c.count else n end,
    total = case when n = 0 and c.status = 'commande' then c.total else excluded.total end,
    -- nouveau panier après une commande ou un panier vidé : on repart de zéro
    created_at = case when n > 0 and c.status in ('commande', 'vide') then now() else c.created_at end,
    ordered_at = case when n > 0 and c.status in ('commande', 'vide') then null else c.ordered_at end,
    order_ref = case when n > 0 and c.status in ('commande', 'vide') then null else c.order_ref end,
    reminded_at = case when n > 0 and c.status in ('commande', 'vide') then null else c.reminded_at end,
    remind_count = case when n > 0 and c.status in ('commande', 'vide') then 0 else c.remind_count end,
    push_reminded_at = case when n > 0 and c.status in ('commande', 'vide') then null else c.push_reminded_at end,
    open_notice = case when n > 0 and c.status in ('commande', 'vide') then opn else (c.open_notice or opn) end,
    open_notice_at = case when opn and not c.open_notice then now() when n > 0 and c.status in ('commande', 'vide') and not opn then null else c.open_notice_at end,
    open_noticed_at = case when n > 0 and c.status in ('commande', 'vide') then null else c.open_noticed_at end,
    step = case when n = 0 and c.status = 'commande' then c.step else coalesce(stp, c.step, 'panier') end,
    boss = c.boss or bos,
    status = case when n = 0 then (case when c.status = 'commande' then 'commande' else 'vide' end)
                  when c.status = 'relance' then 'relance' else 'actif' end,
    -- (le client qui avance d'une étape remet le compteur « laissé depuis » à zéro : il est encore là)
    updated_at = case when n = 0 and c.status = 'commande' then c.updated_at else now() end;
end $$;

-- Commerce (ou service HOP!) ouvert maintenant, pour un panier
create or replace function public.cart_open_now(p_shop_code text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select accepting from settings where id = 1), true)
     and (p_shop_code is null
          or coalesce((select public.hours_open_at(s.hours, now()) from shops s where upper(s.code) = upper(p_shop_code) limit 1), true));
$$;

-- Toutes les 5 min : relance des paniers laissés + « c'est ouvert » (une seule notification par panier)
create or replace function public.carts_push_check() returns int
language plpgsql security definer set search_path = public as $$
declare r record; k int := 0; h int := extract(hour from now() at time zone 'Asia/Jerusalem')::int; nm text;
begin
  -- « Prévenez-moi à l'ouverture » : dès que c'est ouvert
  for r in select c.* from carts c
            where c.open_notice and c.open_noticed_at is null and c.ordered_at is null and c.status in ('actif', 'relance') and c.count > 0
              and c.open_notice_at > now() - interval '3 days' and public.cart_open_now(c.shop_code) loop
    update carts set open_noticed_at = now(), push_reminded_at = coalesce(push_reminded_at, now()) where device = r.device;
    if exists (select 1 from client_push_subs s where s.device = r.device) then
      nm := r.shop_name;   -- déjà dans la langue du client (enregistré par son téléphone)
      perform public.push_call(jsonb_build_object('cart_device', r.device,
        'title', case when r.lang = 'he' then '🟢 ' || coalesce(nullif(nm, ''), 'הופ!') || ' פתוח עכשיו' else '🟢 ' || coalesce(nullif(nm, ''), 'HOP!') || ' est ouvert' end,
        'body', case when r.lang = 'he' then 'הסל שלכם מחכה לכם 🛒 לגעת כדי להזמין, אנחנו מביאים מהר.' else 'Votre panier vous attend 🛒 Touchez pour commander, on vous livre au plus vite.' end));
      k := k + 1;
    end if;
  end loop;
  -- Panier laissé depuis 30 min (et moins de 24 h), pas commandé, notifications acceptées, en journée (9 h – 22 h)
  if h between 9 and 21 then
    for r in select c.* from carts c
              where c.status in ('actif', 'relance') and c.count > 0 and c.ordered_at is null and c.push_reminded_at is null and not c.boss
                and not c.open_notice and c.updated_at < now() - interval '30 minutes' and c.updated_at > now() - interval '24 hours'
                and exists (select 1 from client_push_subs s where s.device = c.device) loop
      update carts set push_reminded_at = now() where device = r.device;
      nm := r.shop_name;
      perform public.push_call(jsonb_build_object('cart_device', r.device,
        'title', case when r.lang = 'he' then '🛒 הסל שלכם' || coalesce(' ב' || nullif(nm, ''), '') || ' מחכה לכם' else '🛒 Votre panier' || coalesce(' ' || nullif(nm, ''), '') || ' vous attend' end,
        'body', case when r.lang = 'he' then 'נשאר רק ללחוץ "להזמנה" ו-הופ! מביאים לכם עד הבית 🛵' else 'Il ne reste qu''à toucher « Commander » : HOP! vous l''apporte au plus vite 🛵' end));
      k := k + 1;
    end loop;
  end if;
  return k;
end;
$$;
revoke execute on function public.carts_push_check() from public, anon, authenticated;
revoke execute on function public.cart_open_now(text) from public, anon, authenticated;
select cron.schedule('hop-carts-push', '*/5 * * * *', 'select public.carts_push_check()');
