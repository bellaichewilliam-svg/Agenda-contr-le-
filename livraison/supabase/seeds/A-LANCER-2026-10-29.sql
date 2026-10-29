-- À coller tel quel dans Supabase → SQL Editor → Run (tout est « create or replace » / « if not exists », rien n'est supprimé)
-- Contenu : heure dans la note, rappel 20 min, espèces dès la 1re commande, « Mettre en avant », espèces des articles notées des deux côtés, Marylou Traiteur.

-- ============================================================================
-- HEURE ÉCRITE DANS LA NOTE (« à partir de 16 h ») → « pas avant », visible partout ; rappel 20 min avant ;
-- espèces dès la 1re commande ; commerce partenaire : le livreur rapporte l'argent des articles après la livraison
-- ============================================================================
alter table public.orders add column if not exists not_before timestamptz;          -- livraison demandée à partir de…
alter table public.orders add column if not exists remind_at timestamptz;           -- rappel « dans 20 min » envoyé
alter table public.orders add column if not exists cash_shop_after boolean not null default false; -- articles d'un commerce partenaire : rapportés après la livraison
alter table public.orders add column if not exists cash_alert_at timestamptz;       -- patron prévenu : espèces pas rapportées

-- Une heure dans un texte (« à partir de 16 h », « vers 16h30 », « après 16:00 », « מ-16 », « אחרי 16:30 ») → ce soir à cette heure
-- (ou demain si elle est déjà passée depuis plus d'une heure). « avant 18 h » / « jusqu'à 18 h » / « לפני » n'est pas un « pas avant ».
create or replace function public.note_time(p_note text) returns timestamptz
language plpgsql stable set search_path = public as $$
declare m text[]; h int; mi int; d date; t timestamptz;
begin
  if p_note is null or trim(p_note) = '' then return null; end if;
  m := regexp_match(p_note, '(?:partir d[e''’]?\s*|apr[èe]s\s*|pas avant\s*|vers\s*|d[èé]s\s*|pour\s*|מ-\s*|מ\s+|אחרי\s*|החל מ-?\s*|בשעה\s*|ב-\s*)(\d{1,2})\s*(?:h|H|:|\.)?\s*(\d{2})?(?!\d)', 'i');
  if m is null then
    if p_note ~* '(avant|jusqu|max|לפני|עד)\s*(la |ה)?\s*\d{1,2}' then return null; end if;
    m := regexp_match(p_note, '(?<![\d/.,-])(\d{1,2})\s*(?:h|H|:)\s*(\d{2})?(?![\d/])');
  end if;
  if m is null then return null; end if;
  h := m[1]::int; mi := coalesce(nullif(m[2], '')::int, 0);
  if h < 6 or h > 23 or mi > 59 then return null; end if;
  d := (now() at time zone 'Asia/Jerusalem')::date;
  t := (d + make_interval(hours => h, mins => mi)) at time zone 'Asia/Jerusalem';
  if t < now() - interval '1 hour' then t := t + interval '1 day'; end if;
  return t;
end;
$$;
grant execute on function public.note_time(text) to anon, authenticated;

-- À la commande : si le client n'a pas programmé la course mais a écrit une heure dans sa note, elle devient « pas avant »
create or replace function public.orders_note_time() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.urgency = 'programmee' or new.appt_at is not null then new.not_before := null; return new; end if;
  if new.not_before is null then new.not_before := public.note_time(new.notes); end if;
  if new.not_before is not null and new.not_before < now() + interval '20 minutes' then new.not_before := null; end if;
  if new.not_before is not null and new.not_before > now() + interval '14 days' then new.not_before := null; end if;
  return new;
end;
$$;
drop trigger if exists orders_note_time on public.orders;
create trigger orders_note_time before insert on public.orders
  for each row execute function public.orders_note_time();

-- Le commerce prépare pour l'heure demandée : « prête dans 15 min » accepté à 11 h pour une livraison à 16 h → prête à 15 h 50
create or replace function public.orders_ready_not_before() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.not_before is not null and new.ready_at is not null and new.shop_status = 'acceptee' and old.shop_status is distinct from 'acceptee' then
    new.ready_at := greatest(new.ready_at, new.not_before - interval '10 minutes');
  end if;
  return new;
end;
$$;
drop trigger if exists orders_ready_not_before on public.orders;
create trigger orders_ready_not_before before update of shop_status on public.orders
  for each row execute function public.orders_ready_not_before();

-- Proposée aux livreurs 40 min avant l'heure demandée (comme un rendez-vous), jamais avant
create or replace function public.offer_base(o orders) returns timestamptz
language sql stable set search_path = public as $$
  select case when o.not_before is not null then greatest(o.created_at, o.not_before - interval '40 minutes',
                     case when o.shop_status is not null or o.phone_order
                          then coalesce(o.ready_at, o.not_before) - make_interval(mins => coalesce((select pro_lead_min from settings where id = 1), 8))
                          else o.created_at end)
              when o.appt_at is not null then greatest(o.created_at, o.appt_at - interval '40 minutes')
              when o.shop_status is not null or o.phone_order
              then greatest(o.created_at, o.ready_at - make_interval(mins => coalesce((select pro_lead_min from settings where id = 1), 8)))
              else o.created_at end;
$$;

-- Retards : comptés à partir de l'heure demandée, pas de l'heure de la commande
create or replace function public.late_orders_alert() returns int
language plpgsql security definer set search_path = public as $$
declare o record; n int := 0; why text; step text; ref_at timestamptz;
begin
  for o in select * from orders where status in ('nouvelle', 'confirmee', 'recuperee')
            and greatest(pickup_at, coalesce(not_before, pickup_at)) < now() - interval '15 minutes'
  loop
    ref_at := greatest(o.pickup_at, coalesce(o.not_before, o.pickup_at));
    step := null;
    if o.status = 'nouvelle' and o.courier_id is null and coalesce(o.docs_status, 'ok') = 'ok'
       and (o.shop_status is null or o.shop_status in ('acceptee', 'prete')) and ref_at < now() - interval '15 minutes' then
      step := 'libre'; why := 'Personne n''a pris la course';
    elsif o.status = 'confirmee' and ref_at < now() - interval '45 minutes' then
      step := 'pas_recuperee'; why := 'Pas encore récupérée, 45 min après l''heure';
    elsif o.status = 'recuperee' and ref_at < now() - interval '2 hours' then
      step := 'pas_livree'; why := 'Pas encore livrée, 2 h après l''heure';
    end if;
    if step is null or o.late_alert is not distinct from step then continue; end if;
    update orders set late_alert = step where id = o.id;
    perform public.push_call(jsonb_build_object('order_id', o.id, 'event', 'late', 'why', why));
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.late_orders_alert() from public, anon, authenticated;

-- Rappel 20 min avant (course programmée, « pas avant », rendez-vous) : le livreur et le patron reçoivent une notification,
-- l'appli se rafraîchit ; et le patron est prévenu quand des espèces d'articles n'ont pas été rapportées 3 h après la livraison
create or replace function public.remind_orders() returns int
language plpgsql security definer set search_path = public as $$
declare o record; a record; n int := 0; tgt timestamptz; hhmm text; ttl text; body text;
begin
  for o in select *, coalesce(not_before, case when urgency = 'programmee' then pickup_at end, appt_at) as tgt_at from orders
            where status in ('nouvelle', 'confirmee') and remind_at is null
              and coalesce(not_before, case when urgency = 'programmee' then pickup_at end, appt_at) between now() and now() + interval '20 minutes'
  loop
    tgt := o.tgt_at;
    hhmm := to_char(tgt at time zone 'Asia/Jerusalem', 'HH24:MI');
    update orders set remind_at = now() where id = o.id;
    ttl := '⏰ Dans 20 min : course n° ' || o.ref || ' pour ' || hhmm;
    body := coalesce(o.shop_name, o.pickup_place, o.pickup_address, '') || ' → ' || coalesce(o.dropoff_address, '') || ', ' || coalesce(o.to_city, '')
            || case when o.courier_id is null then ' · PERSONNE DESSUS' else ' · ' || coalesce(o.courier_name, '') end;
    if o.courier_id is not null then
      perform public.push_call(jsonb_build_object('courier_id', o.courier_id, 'tag', 'remind-' || o.id::text, 'title', ttl, 'body', body));
    end if;
    for a in select id from couriers where role = 'admin' and (o.courier_id is null or id <> o.courier_id) loop
      perform public.push_call(jsonb_build_object('courier_id', a.id, 'tag', 'remind-' || o.id::text, 'title', ttl, 'body', body));
    end loop;
    insert into chat_messages (thread, author, body) values ('o:' || o.id::text, 'system', 'status:remind');
    n := n + 1;
  end loop;
  for o in select * from orders where status = 'livree' and cash_shop_after and coalesce(cash_goods, 0) > 0 and cash_shop_at is null
            and cash_alert_at is null and delivered_at < now() - interval '3 hours'
  loop
    update orders set cash_alert_at = now() where id = o.id;
    for a in select id from couriers where role = 'admin' loop
      perform public.push_call(jsonb_build_object('courier_id', a.id, 'tag', 'cash-' || o.id::text,
        'title', '💵 Espèces pas rapportées au commerce · ' || o.ref,
        'body', coalesce(o.courier_name, 'Le livreur') || ' doit rapporter ' || replace(o.cash_goods::text, '.', ',') || ' ₪ à ' || coalesce(o.shop_name, 'le commerce') || ' (livrée il y a plus de 3 h).'));
    end loop;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.remind_orders() from public, anon, authenticated;
do $$ begin
  if not exists (select 1 from cron.job where jobname = 'hop-remind') then
    perform cron.schedule('hop-remind', '* * * * *', 'select public.remind_orders()');
  end if;
exception when others then raise notice 'pg_cron indisponible : pas de rappel 20 min avant';
end $$;

-- Espèces : plus de refus à la première commande. Le plafond ne concerne que ce que le livreur avance lui-même (achats).
-- Articles d'un catalogue partenaire sans lien de paiement : le livreur prend la commande sans payer, encaisse tout chez le client,
-- et rapporte l'argent des articles au commerce (qui touche « Espèces reçues »). Il n'a donc rien à avoir sur lui.
create or replace function public.orders_zz_cash_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare st settings; goods numeric; adv numeric; total numeric; note int; shop_after boolean;
begin
  if exists (select 1 from blocked_phones where phone = public.phone_digits(new.contact_phone)) then raise exception 'client_blocked'; end if;
  if new.payment_method <> 'cash' then
    new.cash_note := null; new.cash_goods := 0; new.cash_change := 0; new.cash_need := 0; new.cash_shop_after := false;
    return new;
  end if;
  select * into st from settings where id = 1;
  shop_after := new.items is not null and new.goods_pay is null and new.shop_id is not null and coalesce(new.items_total, 0) > 0;
  goods := case when new.items is not null and new.goods_pay is null then coalesce(new.items_total, 0)
                when coalesce(new.goods_prepay, false) then coalesce(new.goods_budget, 0) else 0 end;
  adv := case when coalesce(new.goods_prepay, false) then coalesce(new.goods_budget, 0) else 0 end;
  total := coalesce(new.price, 0) + goods;
  if coalesce(new.price, 0) + adv > st.cash_max then raise exception 'cash_max'; end if;
  note := case when new.cash_note in (20, 50, 100, 200, 500) then new.cash_note else 0 end;
  if note > 0 and note < total then raise exception 'cash_note_small'; end if;
  new.cash_note := note;
  new.cash_goods := goods;
  new.cash_shop_after := shop_after;
  new.cash_change := case when note > 0 then note - total else 0 end;
  new.cash_need := (case when shop_after then 0 else goods end) + new.cash_change;
  new.direct_pay := true; new.paid_to := 'livreur'; new.prepaid_required := false;
  return new;
end;
$$;

-- Récupérer : en espèces « après », pas besoin que le commerce ait déjà reçu l'argent
create or replace function public.orders_paid_before_pickup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'recuperee' and old.status is distinct from 'recuperee' and new.direct_pay and new.paid_to = 'livreur'
     and not new.unlocked and coalesce(auth.uid() = new.courier_id, false)
     and not exists (select 1 from couriers where id = new.courier_id and (role = 'admin' or unlocked_until > now())) then
    if new.payment_method = 'cash' then
      if new.cash_goods > 0 and new.shop_id is not null and new.cash_shop_at is null and not new.cash_shop_after then raise exception 'cash_shop'; end if;
    elsif new.payment_status <> 'paye' then
      raise exception 'payment_required_pickup';
    end if;
  end if;
  return new;
end;
$$;

-- Le commerce : « Espèces reçues » à tout moment (en prenant la commande ou après la livraison)
create or replace function public.shop_cash_received(p_token uuid, p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update orders o set cash_shop_at = now()
    from shops s
   where s.token = p_token and o.shop_id = s.id and o.id = p_id and o.payment_method = 'cash'
     and coalesce(o.cash_goods, 0) > 0 and o.cash_shop_at is null and o.status not in ('annulee', 'refusee');
  get diagnostics n = row_count;
  if n > 0 then
    insert into chat_messages (thread, author, body) values ('o:' || p_id::text, 'system', 'status:cash_shop');
  end if;
  return n > 0;
end;
$$;
revoke execute on function public.shop_cash_received(uuid, uuid) from public;
grant execute on function public.shop_cash_received(uuid, uuid) to anon, authenticated;

-- L'espace commerce voit « pas avant » (heure demandée) et « espèces rapportées après la livraison »
create or replace function public.shop_dashboard(p_token uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'shop', (select to_jsonb(s) - 'referrer_id' - 'admin_note' from shops s where s.token = p_token),
    'sales', coalesce((select json_agg(json_build_object('token', c.token, 'receipt_number', c.receipt_number, 'receipt_at', c.receipt_at,
                                                         'amount', c.amount, 'courses', c.courses) order by c.receipt_at desc)
                         from carnet_sales c join shops s on s.id = c.shop_id where s.token = p_token), '[]'::json),
    'orders', coalesce((select json_agg(x order by x.pickup_at desc) from (
        select o.id, o.ref, o.token, o.status, o.created_at, o.pickup_at, o.urgency, o.price, o.payment_status,
               o.to_city, o.dropoff_address, o.dropoff_contact, o.contact_name, o.receipt_number, o.courier_name,
               o.shop_order, o.shop_status, o.prep_minutes, o.ready_at, o.shop_share, o.wait_fee, o.wait_minutes, o.shop_ref,
               o.items, o.items_total, o.items_note, o.hop_share, o.direct_pay, o.bags_count,
               o.payment_method, o.cash_goods, o.cash_shop_at, o.goods_pay, o.goods_pay_at,
               o.not_before, o.cash_shop_after, o.notes,
               case when o.status in ('confirmee', 'recuperee') then o.courier_bit end as courier_bit
          from orders o join shops s on s.id = o.shop_id
         where s.token = p_token order by o.pickup_at desc limit 100) x), '[]'::json),
    'drops', coalesce((select json_agg(x order by x.created_at desc) from (
        select o.id, o.ref, o.status, o.created_at, o.pickup_at, o.from_city, o.notes,
               split_part(coalesce(o.contact_name, ''), ' ', 1) as first_name,
               (select max(n.created_at) from shop_notices n where n.order_id = o.id) as notice_at,
               (select count(*) from shop_notices n where n.order_id = o.id) as notices
          from orders o join shops s on s.id = o.drop_shop_id
         where s.token = p_token and o.status not in ('annulee', 'refusee') and o.created_at > now() - interval '60 days'
         order by o.created_at desc limit 60) x), '[]'::json));
$$;

-- « 🔥 Mettre en avant » (patron) : le commerce passe en tête de la rangée Populaires de l'accueil, l'automatique suit
alter table public.shops add column if not exists featured boolean not null default false;
create or replace function public.shops_showcase() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('code', s.code, 'name', s.name, 'kind', s.kind, 'city', s.city, 'logo', s.logo, 'cover', s.cover,
           'tagline', s.tagline, 'tagline_he', s.tagline_he, 'client_pays', s.client_pays, 'shop_pays', s.shop_pays, 'hours', s.hours, 'kosher', s.kosher,
           'pro', coalesce(s.plan_until >= current_date, false), 'promo', s.promo, 'promo_he', s.promo_he, 'rank', s.rank,
           'created_at', s.created_at, 'featured', s.featured,
           'orders30', (select count(*) from orders o where o.shop_id = s.id and o.status in ('confirmee', 'recuperee', 'livree') and o.created_at >= now() - interval '30 days'),
           'rating', (select round(avg(o.shop_rating)::numeric, 1) from orders o where o.shop_id = s.id and o.shop_rating is not null),
           'ratings', (select count(*) from orders o where o.shop_id = s.id and o.shop_rating is not null),
           'products', (select count(*) from shop_products p where p.shop_id = s.id and p.available),
           'top', (select coalesce(json_agg(json_build_object('name', t.name, 'price', t.price)), '[]'::json) from (
                     select p.name, p.price from shop_products p where p.shop_id = s.id and p.available
                      order by p.position, p.created_at limit 6) t))
           order by s.rank nulls last, (s.cover is not null) desc, (s.logo is not null) desc, s.name), '[]'::json)
    from shops s where s.status = 'actif' and (s.plan_until >= current_date or s.showcase) and not s.demo;
$$;
grant execute on function public.shops_showcase() to anon, authenticated;

-- ============================================================================
-- ESPÈCES DES ARTICLES, NOTÉES DES DEUX CÔTÉS : le commerce saisit le montant qu'il a reçu du livreur
-- (cash_shop_amount, « Espèces reçues »), le livreur note s'il a avancé l'argent au commerce en prenant la
-- commande (cash_courier_mode = 'avance') ou s'il l'a rendu après la livraison ('rendu'). Le patron voit
-- les deux et un écart éventuel ; tout reste écrit sur la course.
-- ============================================================================
alter table public.orders add column if not exists cash_shop_amount numeric(10, 2);
alter table public.orders add column if not exists cash_courier_mode text check (cash_courier_mode in ('avance', 'rendu'));
alter table public.orders add column if not exists cash_courier_at timestamptz;

-- Le commerce : « Espèces reçues » avec le montant (par défaut le montant des articles) ; un écart prévient le patron
create or replace function public.shop_cash_received(p_token uuid, p_id uuid, p_amount numeric) returns boolean
language plpgsql security definer set search_path = public as $$
declare o orders; a record; amt numeric;
begin
  select o2.* into o from orders o2 join shops s on s.id = o2.shop_id
   where s.token = p_token and o2.id = p_id and o2.payment_method = 'cash'
     and coalesce(o2.cash_goods, 0) > 0 and o2.cash_shop_at is null and o2.status not in ('annulee', 'refusee');
  if not found then return false; end if;
  amt := round(coalesce(p_amount, o.cash_goods), 2);
  if amt < 0 or amt > 5000 then raise exception 'cash_amount'; end if;
  update orders set cash_shop_at = now(), cash_shop_amount = amt where id = p_id;
  insert into chat_messages (thread, author, body) values ('o:' || p_id::text, 'system', 'status:cash_shop');
  if amt <> o.cash_goods then
    insert into chat_messages (thread, author, body) values ('o:' || p_id::text, 'system', 'status:cash_diff');
    for a in select id from couriers where role = 'admin' loop
      perform public.push_call(jsonb_build_object('courier_id', a.id, 'tag', 'cashdiff-' || p_id::text,
        'title', '💵 Écart d''espèces · ' || o.ref,
        'body', coalesce(o.shop_name, 'Le commerce') || ' dit avoir reçu ' || replace(amt::text, '.', ',') || ' ₪ au lieu de ' || replace(o.cash_goods::text, '.', ',') || ' ₪'
                || case when o.courier_name is not null then ' · livreur ' || o.courier_name else '' end));
    end loop;
  end if;
  return true;
end;
$$;
revoke execute on function public.shop_cash_received(uuid, uuid, numeric) from public;
grant execute on function public.shop_cash_received(uuid, uuid, numeric) to anon, authenticated;
-- (l'ancienne forme, sans montant, reste : même chose avec le montant des articles)
create or replace function public.shop_cash_received(p_token uuid, p_id uuid) returns boolean
language sql security definer set search_path = public as $$
  select public.shop_cash_received(p_token, p_id, null);
$$;

-- Le livreur : « j'ai avancé l'argent au commerce » (en prenant la commande) ou « je l'ai rendu » (après la livraison)
create or replace function public.courier_cash_mark(p_id uuid, p_mode text) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_mode not in ('avance', 'rendu') then raise exception 'cash_mode'; end if;
  update orders set cash_courier_mode = p_mode, cash_courier_at = now()
   where id = p_id and courier_id = auth.uid() and payment_method = 'cash' and coalesce(cash_goods, 0) > 0
     and status in ('confirmee', 'recuperee', 'livree');
  get diagnostics n = row_count;
  if n > 0 then
    insert into chat_messages (thread, author, body) values ('o:' || p_id::text, 'system', 'status:cash_' || p_mode);
  end if;
  return n > 0;
end;
$$;
revoke execute on function public.courier_cash_mark(uuid, text) from public, anon;
grant execute on function public.courier_cash_mark(uuid, text) to authenticated;

-- L'espace commerce voit le montant saisi et ce que le livreur a noté
create or replace function public.shop_dashboard(p_token uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'shop', (select to_jsonb(s) - 'referrer_id' - 'admin_note' from shops s where s.token = p_token),
    'sales', coalesce((select json_agg(json_build_object('token', c.token, 'receipt_number', c.receipt_number, 'receipt_at', c.receipt_at,
                                                         'amount', c.amount, 'courses', c.courses) order by c.receipt_at desc)
                         from carnet_sales c join shops s on s.id = c.shop_id where s.token = p_token), '[]'::json),
    'orders', coalesce((select json_agg(x order by x.pickup_at desc) from (
        select o.id, o.ref, o.token, o.status, o.created_at, o.pickup_at, o.urgency, o.price, o.payment_status,
               o.to_city, o.dropoff_address, o.dropoff_contact, o.contact_name, o.receipt_number, o.courier_name,
               o.shop_order, o.shop_status, o.prep_minutes, o.ready_at, o.shop_share, o.wait_fee, o.wait_minutes, o.shop_ref,
               o.items, o.items_total, o.items_note, o.hop_share, o.direct_pay, o.bags_count,
               o.payment_method, o.cash_goods, o.cash_shop_at, o.cash_shop_amount, o.cash_courier_mode, o.cash_courier_at, o.goods_pay, o.goods_pay_at,
               o.not_before, o.cash_shop_after, o.notes,
               case when o.status in ('confirmee', 'recuperee') then o.courier_bit end as courier_bit
          from orders o join shops s on s.id = o.shop_id
         where s.token = p_token order by o.pickup_at desc limit 100) x), '[]'::json),
    'drops', coalesce((select json_agg(x order by x.created_at desc) from (
        select o.id, o.ref, o.status, o.created_at, o.pickup_at, o.from_city, o.notes,
               split_part(coalesce(o.contact_name, ''), ' ', 1) as first_name,
               (select max(n.created_at) from shop_notices n where n.order_id = o.id) as notice_at,
               (select count(*) from shop_notices n where n.order_id = o.id) as notices
          from orders o join shops s on s.id = o.drop_shop_id
         where s.token = p_token and o.status not in ('annulee', 'refusee') and o.created_at > now() - interval '60 days'
         order by o.created_at desc limit 60) x), '[]'::json));
$$;

-- Courses en cours passées avant cette mise à jour : l'heure écrite dans la note devient « pas avant » (alertes de retard justes)
update public.orders set not_before = public.note_time(notes)
 where not_before is null and notes is not null and status in ('nouvelle', 'confirmee', 'recuperee')
   and urgency <> 'programmee' and appt_at is null and public.note_time(notes) > now() + interval '20 minutes';

do $$ declare sid uuid; cid uuid; begin
  insert into shops (code, name, kind, city, address, lat, lon, phone, whatsapp, lang, status, kosher, tagline, tagline_he, client_pays, showcase, rank, plan_until, logo, cover, admin_note)
  values ('MARYLOU', 'Marylou Traiteur · מרילו קייטרינג', 'traiteur', 'netanya', 'Ussishkin 2', 32.3305, 34.8578, '09-773-9145', '972525345224', 'fr', 'actif', true,
          'Traiteur tunisien casher lemehadrine · Chabbat, séoudot, réceptions', 'קייטרינג תוניסאי כשר למהדרין · שבת, סעודות, אירועים', true, true, 2, current_date + 30,
          'data:image/webp;base64,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',
          'data:image/webp;base64,UklGRgxqAABXRUJQVlA4IABqAACwJASdASqwBAgCPmEskkgkIi6poLIrwdAMCWduH4oFx8A08fzlub9NSdNfWf95yvudf1nvl/kv+9/hvJa88/wPsB/q/6MP+F3gncP917A/hJ80/2v6fv/f9GujZ/s+Yf7Mvbpr4y94/Xzzz/4/53rcalvR2mFEy+cZfS+OY/D//b6NfjP+1/+f/D55/Bz+H/mftr7c+xf4r/38DL8H1F//fn7+Kf83oEe1uaGpr9Wb73/Vehv2U9gD+cfuZ66d9r9y/2XsAfoH0G//P/P+iT6t/9vuI/rt1uxwVYkXlYJJKTPIt/rUciMzhqUhTz1enaa06OOrozGfIjmDdFLIGJrulS0TDriVZioBLLPkmyzBtcodCwp9tLDx1jheGZBFhPyqg4jo+0YFMnoXWwdVIe3tdfcbyrMCrRLO4cIFjSjq2YRqztlrk/zJdUmiGOvKZFcjsj59NNfaoiTgbWzFXNZpltULh6vNlNIlQmIDpuneKtyc/FqbBqZ6X6wFvZOJEp/cqN6x0SKHA6ktoqWpz06Ynx2XEXPQW2w0WvY6vUFmhisG6Q/J6342jm6IMtqBBx3Rl7Bs+/IdZBBtr04j4RRaycRXqTCa1HzeADCVGgQ9lIcl0pDu2PWX5IQxb65sBpzYwyhjiKY6nPXiEchalrhFNw7sI90YOGulkJRZTfYmZcuL/Q7WX4eCZHlSiPUdBXpjy5ajOKk8LWL4Rx5TSCGr0/GCRzrcb8EeWUr/cdIORm1l53FxTCN+sE0+CIXV0/wWpLtuNB5ahkK1xIR1Lp7IEIKSDcRkUoof9E/NDWfvMuvMrchM9JTHneEftaUfT/796OpxDoVhPqeLhYEQZbN7s5j/SzLXP3iaWbNAXzqtHyZpSYz04D4Drbc+RPOI5M0LNYxLuTCQ4sVLk2Vwy8Qw2yHN+Pl3frqKBGh7GGqPP5+toJE5GQzMFyqQ82Y0pFhh6Vuo4yFJejgb4gMJNRA1KxFTtDlH1+mQNHVOOrGCm4o9YgUtP6IspHCELDkmY8clSnCbAQYJOtaq6knVKrs2ghiHwKmmqBJYkCudz5a4R3xULdI84sb+s7UBobssGy9kRJ2bQu2+QLwbu2OiSo2qgq8NbcSNAmDQcBBNbUpBo6kPkDIY/s8SLJ+PRaGdlcXN65Nz46sSbSBlJgKeHrIZrXmA6Wc8hEWy7Z/vpE4kavJE0BKLNmgG7Ei8aEa6buHwp0t39pnCqOJLw2jM5Kj/ZupiHcFn0ndhtF5n6QbaFjXSmVEINY88/0hZIID+2wFX7wfNTbzb7qbBFdW3uUtaQh5EyCnqugmBv78jZcwPISvw+gyzTcWmd7iZdbpOlNflcX6vRG+SlB+xcZKqdpLXr6UI86z2gLTKz+kBwems9ISTNSa0LGnMeKOeiBa1QYqDeRScOZUMlmU5LbM18Xd/1bqo0OSwW/MTHKaT2Xrcraoeg/WLTsaijgVrGosRWDAskarh5SiAO7xx4HJ9BaqqW9AfW518C9pBc2x2HprmUoyhyki/HE0AFHkK0JKCzPD3yDYhLszh9rqtC0u9yTP6AF2DIwvpAgwf05nxcNDA4TgUStORNkECbvmKbpCdQ5Tuu2vBJ+nb1vmJGOxfunFpLeVQ8puh+HBu8r0C/cKwYzq1dRVkepPnbhhJiDRM4LkN4wz2Kl+UIP8POLwHOV9HaDMn3gyMzLs8UvKwkVxsHPSewQNDmGZCCSOqigU1Q3VkF202hJgqEWgEqcVvL5e3kkG0cLIjkyk9VqIT/5/MFUnX0wSNFsPfeV4BPT0jS0bOc/A2+Q3HiQMcsb/MT9Rz4T5V9Frfv5mP8y1YuKzqR27GgT8bYBnTq9b8cFR/kD5sS4V6bcRgMd+P5H9e9b/nCs2pyXzZM+yx1ayS3eQ8E6SBjQF1whnmp3/D+wQdywFqGuxCBPymoDtd1Fa4GsLnraXXZsGozR5H6rcL8yvqwVVDp0PfOllzxqiaJtfJGqPg2Cl8KLPymseTLp2TBu3n6Yox7LzYlYul4YXAzYHgJ6klWfF1PEAu+WYilUItCwkKbTdrMEhTWGqZCGarues/BqJDc3LQ8CFGad31ExxiJ6MVC76R1Qn/9+jYgHynB/NbA58w0d13VW5VuVbmFAnnjeBygb6V3/dcXo3G7erAiTyvtNI4RYnmvI1PO4Cu59iJIxLLZLQwFlXoGylmGKNEgnF63tVgkrlsdT9hIepF1x/s1bd6EihThcSTm826m4L97wzwZG3qUu4kmw6QoGFYSPp/NPR/v/uIQfVuhFg1PANL8ZLTUrNrthwteuHeTVvkVZgaEW1TVViakH9aXx/zZPHgWHc+GOH0NGhyxlUQ7gVqJ2tVQciJxyI2WkRQoJHJLa9WJab/AQfM5wtM5M6aoGCetJrEiZJjSOcM+M0EnL3KXnPTyonTqzb+moCHOA/gAluxS29YpyuRvbCdp+TOWuMeqaVcEKCf/BZtqM1cTr6hSCOnwMPQmA+30ZrsBVXXIkNZgFxfzm8KiM8JhUitA5SFx2Ip2v1AeB/+xDkdY4/w7q9giiUSDP8Lk5+SkfvzkPLR8E8gA/gKIIZMj4E0cW45Q7E1Ak3u3MkV71Nzwxhjf5Tf2sBUMGsH/GDv7P77D76X1R1htC0BbshhXfUglx6oqgzV2xHW6y2P4Zgdfl4JrrYGmTGfoOdFtDOVC3sI95Q7rNk5Sd4wYA1KOdssJChtlLEly0sTX0oMGMiKPOpKo6zkiZEoGS7NF807ghKYpPjYq7KjMXoHQE06WgzPtHz3CuGHTHtgdCKakdM12bEPseMewKq7NCOYn5CI0ceAPW/7+ZFaMNBbbadghB1Ju+z87XajM1i8kz9MWeeDnJweImhlfWqi8pyTh7LL7HRW+sJ/3BD0bfxXVi35330bwh8c997OQ3N1RKcxeCghwPYOsFVRDSNEgHZNwgiTsTDBy7Yuso9C3GUAJRGnyNPHT1nChgi6CkAi5ZpNjPnFLgP37192Ubn/947m1YIJLXN60tk6RBe071V/ags/1zUtslbjVMLgdINxMbo1ZtPsjzNt6ExSL7z9Sbx1v91C7FGIT+YX4d09/i/8TAWBUQsSJP6Cfs777O1/3F96m8pwbAI82AwwflLoGONsmoiJlOBRUP/V8Xt4oYiudUrz11oEfA1jSsldXnGwrNBG68UMFgTg0dGu/FDjWaVT1m2ZeWFXBOcNsCs1KnY+SkzBYfCIbPtNIauHCrkfl8QKbQdBz9L4NuvuYDYzh9vwaRAHvBOrY26ZFwCxDx6TQyVlQRnMjVzFStAYaG4fKkvDRjphQ8EF1zHiYngm0AfPXTEJ0i2hvneA3URrFEaii5mIpQIcTppv0vUwj0GJ1yLAcqZvCzYtQphmM5w2EG+ppg1ryrUES5YAU6+pUdWsSABD6aZaDoB17iT45ADoSGPR7ScsJDN/RaTZH5qVL+6lDOB/J2q0uSwx3TEdy4qDQPZlPWopUDWX6/ljsWP59W3blxJci4wgj65tpwwxbYXsNLUIJZ2aZXzfRa6+qNVtHIXzEvUMXCK7k/thsRacwp/gLsKaIYmGdHh1+iMmzcbGSBbxh6GV4CVNBP7dqERPSo4McNEbv0PUwnMp79ALzbVWJAXXfjGGo0+kyhYEThoZ6MZEf/sSxqFlbdtXG0ErrjnFyFjEPXnsc0gPW71St1U5WbZw7gpodq5TpaPNYoUg7DOwDXn26lAo6ZFLP7JifgdqZvJCaPWfKYgtux7z+UbzzB+oOYiUUsM8oz92OCU+VSalfKAydNC/1u56LOrAWC/EcWusLEgR3pRepPdQf5HlPsbLxssI88d5IMAhaEg3Sd7++GCY8xrd+r10tiqbbTCu+nK22483gUKTHx2Eig3K0qqqhOMS0QAzwB1CFt5rfn3pOinjhj5a8eWyils8ThpUuzBYD+kSituD/LKchdX12z2VhGD8KLciGErHDl0Lff+2jqvgTR4I2KmLwIxIne2+LzLs7A4Cef3ips+YMDDT6rnpTRapG93ZlVFP6Tw+9mjhP5kzIrk6xCZUoul2Gy+cbqTEOgwZOKNv6tumR1YsCSj61zwzJdAi0gj6UT4hTq5nYLfF9tjXN/TGji8KNjBHBxbRxcAESGUskInIErPnzCq3SlNczFVyyxH01//NqWw1YX/IQ8s5uYwQ6MpSlFD4okY3LwsGAjr7Aqoi06g6J1JZqd1P6GVb2rzK3TUUvTpzz2skqVkTEnL7KQ37OQs2gk25n/qAxsYM2AyN4OgOI30Z3eJWoHw0kHvfG8rzaAn/aT/hfiGTD/0TMIlfitGa5UP+zUYdjZ1fwC/dsN5FEWs5S+1WrkLAou+HiCbLtlaPYGt/JqNV/uBbXOq0NpuVNYhESf8rNH/sJ8th9knbrvcSBP0Iq9mCm88l+0HJMiKu20qe/fYIBrSmJVLDd/QjEpYQXN+NZn3QPm9/d7kFfqzA+6UpSqxUbdzHXZOo6yOp4qD1gZhqwVIo76JLUiTZjHXXBjiJzwF1yMfKWyYbGY2R5m+IiVKXI7x/GWxgf2IhIuhx/XGhzqzmwXROdiOLro340zGvwfa6LPM7diaV+CkEZdppOWSkMl6i2sMwRSIMulUUMqM0jJUoCNSrcw/v9C+aygQxCgRpnE4SxTshdp0atUIvNbppAPfxUcNWJHwNASpLG+RhlfRMXcSD6Gu3+rIsOezBj2Z6l+Zzc3Y22LpJ2/n2KBuTcHNZMOe7gutkx/D0fbxe2f7ZRJWDBR4doY9USQ40rv5sKvD5w2Pjfo5XsD0Efqd4qVqCX7mQ0F8FOFyCKSL35x9NVnePPitQ0fV/bCPMptgP8Iy0lwvfIxxKMIHy3kAZjM9ve/YUgFbo8K2NYYKApUQtMi74XctsPAa3I8p6p0aYe5lI+WQbW+DKeq2mlh68DWrysU5c+fgGOM/5Xe+kWltu0t0WcTD3hppDNinCyIoZ4nwNEZf+TfQ6iCsZRzEYQ2rO3I6Qa47Hu5P0yHFb1a+6OsR5JhyJRg0RDBNJ1uu3sERO6CRHKuOIDFpuwZ9+p8R9xUTxeS2PaPf6skMkXkShEDM0MHMeu0jOE+gUW4aw93j+7fypVg8kQiNgDh9rzy6lug6T50GjyKQU0sTJUICEf0RlUCz/CJeK/jcGmLcQiBjKTJzmGCcKnTbFsacNu5vv23To5HtHYdYKqYtGFiRJtrhOINwsgQ//vOEwEyKGoBbqgsAb9fY7oZeYGZ+qg7WyewpFkei6Ux3losUzBssaeCm2y3wv2SnPlz/QMnZIUeaoqCRCeKOQ3LCAhshIghIGkpDcPS/72dNHGy19tBYmnCBr0PP6CZHscycJ6kjN5ll+Ulo2iVA42yEmCEwE0uanCyyG8bQvEAWIkke8gOq26nxiBMBM2VWyJnsGrtq82cMTwcSiLM1PZ5qk6dlVi9bs47JYpCLGjgGjeB79QkCmyoK5uXH9jFoH0e7htoZK/84u6ct9G+yvvAIoBunW5qJHq6oQIFUW4NpoMzO4etknZDremZMLlwf3ASrOOkruZEOaWxxTKHi+GEySCBLgTREEZKEYJZRbn3xbRI6QS97P2uQCDLE/0pClw+W8mDA9xcRm3KQ26zkTBtd+9vrpmCjZsirZwzmFi6cPxQpkWMUYg6MCGEYiE2rI0ILL0wETNvBGWQybqG/BmGtxqbL7td564rJAEwZf4iCcIPFzo6m9iButZUNNgXKymKH+yC9vIdxWQ47NZ3sJD9P99gUrMCaq3DkbS1alYdCW3eCTNPV8vGjohZHLnfM/i3XOVR8kRWl3PhbmGebVLF+BBiZlAq2tTIhBA1hJUrA87QNz9CwS4wNAvI7anjxyLShD+pJsCSH3WZt8AwLltjROhHO6rggCsIVnAMudUhbigJYnigW4p9oH0iSfX0MMJQAu1Evv5ofFN1d5pEOqSPl2DoHYFv08BiSF8/H5cdw64u2NVZ+DeLQCuwzSzA0/8TJL4cHvOWhiTNWyune3kF7dpWandS/KgbjuNz2661nd7YdX8rUxOOylZYMn11ZneRjRpz9mUmtWL9Tt7RZJfCOvEK4D9+t/3JctXpqany8T/yLv6VA1n81EHqAit+NTZXP+dM5dVU63USwMDYlSisRBgqlZ+WEhgnIqM/YCzPB1XQqqX10BI7JR85onJGppFmdflaGv4WvBqqPTFA15X6jkB3BIjl1OOTdKUAMEb1JByoA6NuIq+qUKntbaKD1UnTS5UDJjBcT0ShHgcONnPr4Ozrev53JKA8jzGcWoa04RGsZPrFvQT0eK8AFr40NfM1+/ifR7raGwTqDbxi25DHzc9vG2NtaW3Vs0LUNdWWEeg2P4MqWaq9dgRa7RG9bVEuDFyEblvZ3GNMkaMAkfSFtMDzmj1kbZxNQ5BqeLguxmB+bv7FrQmirvBPXTTBTFz+SOcotxmgo7oMIy5mLKTOCpvDXBiSkuodgEc3wcmn04coP43iDll/qfqst/VUO0q3QRNNVlOwRaajh+OnDZpjC2CiAJJOvVgMMLHW9rclcPcRaNh+UxbvGxHI0Aik9G8IvyAC5GSRdVsDE3m9b0bXYlAZNgcYSOwqXFfbkRKRbfIqc4//pfMU1Mzk3XD2hz9Jxr2cMfSxX1E8zykWn1p2Yj86T207q7AfaQMSC37ugxfFzyd4L+RaWKeqIlo1l4EDqIxyWWQqgKHSln4SY+R8v53fcljWx2c1CGgJXVRzr82F3qawdOClTTh5r34ypue6zjse7Q8ZTWWUBHCNs48D6FF8gOEbseSk6GMkcVMSqJbrznOl/gaVq/kUWhyt3PVIZRjJ4wxu/U87LXGhXHLynd7+kJU6POCAy9skc7jp9Es+brWe3fBz1lUr8BAM38zVPOs8nB+6RFJkbosjferyg0b8fV7FS7EKxidBrjq1yMUxXsWnAzhyGI+n0YHM6wkuAkw5quEz30/REXqsZ/722fdY9nmtZryuTnaMyn9WXb17E+N+i22UFK/NPhX/PYXyCkhfgI5vBIiS5cLGDrPqHecptAImcrY3zh/z1rJEsyoG41X2uOJ20EIL6dhdx23dGUAafcOAvRu1PKW6Md9+FzLjedTEHBmn3j53QU3qRjQySlshZ9LE84uKTXJ9Bg02uQZb6rl1CNHuyVzR7Xqrs1TEYLU7vVPTGcn4Ibsy1nEbY6gUBiNITT+lh4QQa0hAf5FexXYzFvifm3wZKIs2LrOBNi3kf2Ec4iljr/ZETqLe7Oou2I9E1BaZMiCGSwhi+qT+Dx+BmWHW2taj3qqyIj/I6/bbM4LbTcrhvYCeAImI4F2ilMDdWC6RYKSKBwtK31eGA9dNY+etYvnzFPlSh5YvgHU2plLPe/eKQWOi/ZB/c+XeJp45O8Abui2D6MFNR4o2X4iNQ+ObzA1qKIzCAO4YMJIelKgxidBXTMHYd2VwNWH+V7+SpayoMyOnVDaHXkvi8Oq4zE3t4Cjmy/386kbdzKUPMPzj8L4bawFrE38kSYynJ/amJoT92z0NVOfxPDrfs8rNQvysv4qYv25Ig+FEmYOe9Tns04ivzeDJJZ5X2kcV7gXEYzJhTF/iws2tejzCi2yMaRKOexTQSNDGcIHFo6NU5k9uFZ+mP3JgG23i7lI9QvR1+LiwVEBulHzlFN08qnQyszy92abRhzelY+Jh10yKCNLKRQ60R+9BM/QvM12deX99TL3VYF+mM5qEOcGq66rSYZsdFtNSpQ5S1NdU1eVuw5vRz0Tm25vHHvS22t9bPCFk4sikQJrjBNnsG5N8AsjaOtofskvj9dgDqgGmtLAgos+BOk5P5L/bRyu8al7+/hGVUnqSaxcr0mwbAsWP2zMRxRygIKI6y4H5Vhs87AN3DVrloHYdswk5IE8/hyQGgYglKLqtDurjqDU1JuZs8Wsl0KQv5lavZRk+5rPlRN3m1KxF9URCsnWn/iLxupMBa5uuuFmToUFScHCYnbBCV8FIhXyzx1ub7tDwY8UcRq22UTGEeOGQoFRudMBstEu6fV9JtJ0BajPOHFDClXly5Zi8HSMM+/NMq+lQ6dAP6+EQBvwew/moZGaL3oJcqB4pubw2WkKuZtUR4Mjj30GF5J/jDldx1eq/5F4Y4EvzpPWQRAEtV3coNrCd9c3a53eUMOq7aNKPs5d3taoaOyGK63UipHlJD80rlM/n/OhEy717fVwmdnrrWvsi8gwlDWyhOVIOGoha0nQ1oiMu+PvwnIEnclROpMzXYWpLTxwHIh6TULcPeXGVQgEKvEgyT5t1ExTje3LGBHv94AzZrSji50JP2nwOP1Yv0fohSjUWwLoQiTnjlAVynWcn5CUteiNo5vseU2lgxtGcw61eQ52w+SpZD9XkyG+3hiTwyy2pxroBjWfW/7bYZy9CEqzNBI1Dcqh4OTLAe/vbevD7OJ5iKFbL7c2yXzurDWZx3KhpP//gvx6qHtWXLLMK1a9J4pjlvhNOecVjj4PfxbZUvJ36ofLvom2N5X0jcdjaARCxRYhq1+ch4dJK6M0oCiZpxnz5BR7ZZ7h+TDo1Qip6wOu/KchPAFGj0kElyXUesReH0UoyvfHu5EGJlaejxEmKXiIwP4oRcfpu72Isfb9WVUFq0phIcVQZ5QSItZiQihJ/q8dQC9lDoKknsU9nQKmgINmYSR0JrV5BhpK+0qzEmFuhsHimqN3TjZ5NEqkhMPE2edeWRIbRAgGvluwQxgVsSkpI/4axlX4EAweD1lmMaU7TBIcPV8zpiZ2AorfN+UfhHs49hbH4VLQlMdrbF/FUCKu2EMru2gPYMr08SE8M/RH8CDWifefDAPleKpBNMtOqoNlen0J/Rd8+zH6ghG/D5CruKfHyDHsIO062DYaanIjELmp4qVIlTeweXCMZEPwPSfkS7vegTOzNnFTz/vG1uXv7W6T5vCVt4NIbbPNDjHBpK7/SsnBIIDtHszF2FoLEYRNfznyJxrar56VVATQRIn0hRMJYaTXzeWBqppzTpzuMz/j4SBcWaWd+DF18eyWwoS8N0iFbLjI9uIHHeTgpkK05r3Id/VgveRvtB8QS1CPJb8FsGnOvYL/dyt7K3p1Wo2y0QQ2P6QEQmyDFdA94QDf4K/9cEneQQnme78+NDeTmEs+3mG2ageec4nAtp0QG51b+ko2YUCFyeYSkcVKmjCVPuJ7lKIoKfidtWaFT+n92m7AtZa3z8YDJ5K8EU4ZO4UJLuyYvCuUnsxg+IU2TpmbS46jRuCms4Aece9omVw8HrLOOQ25xRsMzoQ0uoB3RJ0StVXJTQMJvsVgzBEk58rioArKNdyBmRLevYxRy5k6Z579pCjXu4n4sSMOInOl0GjWXTcPvYR+EpR5uBIs5xg0P9pEmhNTZQv4XDhZadzxqTCep1cO4m1Jr3+I2fs36esR/2fzJPWoQK6C2djaCZZeHodvQD3MhKzOUSC3u1TXMae2+3+cSc8e/q2ptkVzkyrQKqL6rhlLVZ87uXiLQHFLz4RAlRl58xEl0/gU0VjRdExquYsJKVcpSVOtSoEnGp/2Iy5GXNCmxibV8fRB+0vvXBzH35E0siNw9Jn9dX8mzMycGszFJQbqUWAUJJy54I8kQhH1FF0jh+/pHJeQp0gmIa8vJSaviSr5ngNMa5wYVJFg2X6qRuLYMo38L4rg8RWusOsEP+agW1sTE0E8lqAe3/XXXQ7IPDVpZKk9rRCKdZhskT1fRmEXGmCoebJ6AubiXAwpeibC9ZGSZxeIpwIfV3ZXeE73w21u3/0BctbXjUQLD7UgCocjVD4/LmPmbRsSJxE1HpneEq+BNHyTD1ULRzcKGAoIRJMU+bf/CrHBHYJN5+cg1tyS3v2VzF5JQcH8bWINJxm2USjKvSinsNjdi0sLYEvqI/PhFpHU4mfj9Ve3d+jxB4ghITrEpsbEbjs1KWWsl/0kf4Xk25IfVnX4I060inf/JWRkPT6lyL1E9IZEvzCuotU8e68p3Qb4ig85BQRUg3xUHY67DF8f+Vj2e3QR24VFhJAFBStDd4CaLHqTmB7eUC6y8ocC3xHSQYIjpB8hOUcFtfllRYvZodaVvbprcaO/Sf1EJtj3fHXS+JKYZ0YHI4VbyBe2ayw1moFI73QGb6fH6SKGEItripN60bIltucA2/WWV1GiBLyPlOl85cRTN73W7JblYd74rM8Iln4bNXcxf7t8TM2U4wLYLqhcznjbWgc9PUCMPBh4OQ8k4ZNOpuekUOvaRNp5BHClHjan6hUluSFPq2kaNUDYUXZ0i+zjvwiYIC7BN5/dQGAlwkqnNXfJKy9lwJcNxjPnqQgHtiwKSzNRr7E9VkKSn2B7mxeoZNXfcF0D7QHg0455Rx8pZ1MVtSc19Y86lbeYzjzeXu50NMwj0+paI2ItaDBFJx6thp4Phv5bFlxPOT3skrccnVtA9rt60oBz5hLEUxSXzY2788u88eMenbpZYZIIciKSBgA9hPH1SU9IGeOLuDffmjHrF5eCQkkoPQIzRzEJrLHHM4mgRJKgzxTvdS4UL/UMrIPrK/VUTX+6WbXtnhO3SCxmUoyzhLQkZiBPcjpFuD7F102xInMocFJrU7r3ljL89iLjCajgvFg8fDRLNsWggCErMV13a9yftGk3Xo3TjBAwZLLSBXE7AFzG2eIk+gi+GJCIlZbo3X/p2x1gIJwHiszipRvqgMndG4AfKN5pQNqixSlDa+GlE22FV7AnO4dCCC/Wphex/MmXOAmqdi2Wr2n7sU3kDp70hjraC1qReGVrYhxh90UTIlU8TV+Vou6IR41iTqe3DA7F4N/XeqDisFIQoB6KQhPjMBLtsHxIc4kGpgFGu5Bw4ezc5NHVL6JiVUBrdXcs3o7oTCm++/18cJY4vHCEXlAsv/pmolX9nkP1sI0yeU2su7RFL99ev+j1WJMctkjZBVsVsT7Vkh13Ytlg2/aE1KEPuAGq6i3jl6/Rc2AJW22GX6CvZdmpaEzh3dVadvjVX8iLFAats6s8PTBPHP57WwlrZIlQZW10ZNJ8jqX3rxuRK3xpB1ZTUwHTKYgmLBUYeY5fteqYHMfDaEEYDp54gnEae98sARkuKFyTKWAfwi7HoZ9Cw7L+zOnuSB3PJJvkpPTpMZfZVgscOqBOREfsvTI8XmE2mLt+z3NIt0TD8qtVUr9Vyexfp4Ht8A6KaphY4Pqbs47ctF8qhbT7bNqXAUfK0B4ivL4Uph1RCgU3OXT//MNnDDbWuI5Sx3tQ1bfWS31IEM8R/RwvDD5JO/lA32wybPLJ18C+mK6dBTWQ3ubcTen/azj01zkgKDOqK4uol4oeQxlr/Fv4CAgr38JdE36KWe6gT4QpgNXRL6YAP76ohYmJ/7K8deXOfP+2nxo9mmH8/0qRlIdKDLTHpLexvzvJbipL6o6IG2M0aFSbE49SEt6WM9LjPqBrn9XW+vq88gojULo+4atyo4IdEmCsQIuUPnQuoga3mcIYewQPwkA4s4Da+4S4rOX/OVgD8IfKLiivGryo5Leu2t+ayIt0+Sa4cunW05hcG6ViMQX2XvewNMwsoCnLt+zqmJXbNQBb33DkytwhX3IL5CI+S6gLzwoWvWpq7Y/6QECiT+5+vqAmeuSCWgAvICuHSMdFmja7r0NRGyQixmjPtyhD1AfcpUVyl9Cyfpp6U2q/JfCbDFcIeAI4Kbgct54YzosEN+pFo8Wc9UW6M2kvmEKP9VvfKaXyarvceZ9YFn+Hi5dBF/hdl/0mBUi0uANm9L9oXI+V9c25iMPqe5JPKR2peiTm0EMMUBgJJp6qmiqzyr5b4rSwc9fxZfiNoAEl2YkUlYjdvLUZvhWQiIbwNjSWk/9EA9jzXb54J+wc01DUzw/2BBtbpJOcbigHZvib3xcrfs56i2srQE/ydCh+Nxf8+vnr3TKVQEl7ZyyoFDruD305RqdKWgK8ZwTedlyBGVD8jEwi9YyOyVcbcxnOisqkm+g0facy+o9YGdBIH6M5tjoQkWzxG3w/ussHHYMaVmFvUex9O7OOxL4oGP5oRvp6HR9EfFIOk7vy58qkc532OgNm/M8jXp2Aw4o6714aXuDv8JRMqXrF/XFBt6e7pzUh5nAKcQIdA/rJwGL5sMdWr0aGdJbsrbUbB+a2urL6eC28vo1FfAFKvChVLbilJ5ClZM2VhMx83+n5YsH10H9/NGir8naw7ZOfMeQPNU+yqT3aqLG0YnzLXUyUkZ+9MT9DiWNh7DH54CoMQI1muPi2n6DMcMW56kIGdjh/SuY1fOCmQpoLV02Y224lrDpGwlgu+H/UWSET/ofa0FBU0JOsFBbJQ6yCl/5+/jxsfd7YMWM7zwrM/k2wP9e61uiRk1FWPx4+XrxfcX0ki+J/tG/44TbOG5jwzdwYRksN+J8oCC6QDXBelopouDlG5LMdGUYbyhppy3OpLKChjwHNPl6FBlYtb4+WTkpo/ogHLHkpNFfBmG0gneg07SK+p64BeGUrVjkplo8WueV339Ic7oSi/ORYbmnly13SyOBsOTeOOBTwoNOndAf1wWLp0xQhYU/fXD0qkCjJvU+EbR/h+m74dDK9bXOc13GLpRdKmFcSAc2oTo2muC0AeczUGZm3bLqPeJJPYsyAnrfgcdWYYC0c+iMHsJg4N2PEjp9RZCsVQXCMAHx99sxQcG+P32mHdUVyNdoyfe+vFHI9b1Cmlj8crkXALhJsv3nkgWuw/v1z3+7k8uuUTfdTOFMnS611IWwQ/qJwV1o2DxNvqNrIs/mOqIeEg7KMgmTYHu+st7bx9yUVLEECuKRfsq/eXjH5zl9o24tjAWtMAhIOyIfkkKyLuojP6MNWvO8uU/3qOk65dt6fXu39A4GP8qWIV7SryBdIHgms7xADgJmi2MbR8aKntGxub8+NcmpaOblNvUur23D54C6Za/wjYbE9kUrRmYk0Ka2hOm8DU/YBmdz7x3b8RfD94JPMpFM2Gyy6P4jVTKvyi1w40fNj0qvSC/L0CzgfWCaae98CKSwMaiolR9kEisTuoEgRqa1ZCzn9TSSRKoA6qpiD/PWrAIdf6ilRLXTOBSyGOgVHVV0HluJXqc0eFnQrI5QVqi9QTlrctVJf0HIYar7BD708P9veOXndUnmz54bFdTU7fIVOfrwG5Ih1TdZ6tC41A84Du6ujrQQ58rx3VQXklYWE+bJplpgVyF5acIx71a+Krn9KRJrFmEzWTFiGfWjqqGnq0Vo/X3m/tpmEBAUibz5ajvVE0KCfYvehL+lG48+46zzf/7wEeRnDVJ/azCvzgCCD6ay7GCzmCTfjn3ODs5UTqN0PXJtqQ6WQlKiJ76kaejful0UwBQ3lAeL/p3Hr5MjCA24uSxNN0s1+yY/eqV63K1dUUEAsWS65V8/3esPX0dHS9edFnRN7fhvAQ4gWELSKDtn2BkMYM75iB2rirXYB7q9VMLMQ+KFprQEXNAoF+Xd4VqQYVfpEv/ve2p1gZya+yuNXJLUy3WL/Z+nUgPVf2Yg+UM1IyoQld4WF/20D4OS9KmhRVGGKzaIQGn2rwYo2+8qmNao8F4WTB6pQQH8IiPyeEUiDK3tL9w3HvQBRfrLbu5Tbc9+ZFJqgXmhJTu41Cj6hY1CpHyHVv3ExYniG2Xku0iEcb2bcuzAc6LokomPv6UnTnMCcsdV/7rPUZv6tQ7qOvVyFtbWLcOfWycTKth9VvsZQKLMW7BZsFfEmBe9GzfqsBE+wlPO+ZFw/68hf2a55OQnyEmqavgQJdsONVS6sdggZm02nOv49CM34cTcg6/ZIuRRfBnT25pWHxB1aoswu9hGxbN1Y44NtwG2Rnn0hVthV2lw3Eumz1tgNwNqagckkDFip2ctOuou0muAdeMtTNomfSxPKpXR7Xc6UGIhFMAGykA8A+E3HP7bB4vBj7PGkTJ7H0sOk+oeqkYVXvSyZPDBAVCYL5uxCgnuuS7QHpil4zhlo9AnRAKL8BoYO3aW3fr1D4o/CcNMRjKAsQ0foF1OpPnU9mnQVqZOcIh7f+lb1U0n9PYYAVaxyY/ZqhFl+b3BD0FcjKMf3RtQ+ZnNN4AgaY9ScLrhuNXYehFs0ikmeQftOZ7W9zlO5NL+Tu/KxhfGcWqbN1X3ueiKcCpRDgbmGH1tbWBh1TRrte0R79zsda6pAfLKabL8C81bPQrJFS6Dy7LhzeN4vhIoYf2tONxliWb/vNqLS5NPptnPnKLbCUaKIKqD+mS8aVqX4UEKi5XpbMlwUzp9yGIooAUP7MF61KDQS9LfpUS9uio+ORzoUt+COOiNS1bd/waI0r0KJFWroqDdKoMLxty7+uq/21tYHLekdaal4gJAiUsIjJka6Bz+W3iJCfMQN8wD5FbCvJMUKAGsWzqKRegb9yOjOFWaGkoSzRqwIq9rxlV5Ax6FeR/7FMfI0Ax33sIDIG/ugTKSND5OQRIjoSEilnp/d9k3FLiEILlzJJA1JbLWrRLwtNKJLodScLpsRjvWUTamdVDBHM5eOAA+KDNYVMmOV357UZ8E4vkz2b83qjpbS7S1IZg7ZKT20hZ3SpRB74iOaKC0AbSE+9VIrVrz6RePoc3Be2jjSOqHecagww9TksWzSR5ZHmyycMf0yoRWDqnVUJa518hb7vwY3CQTUXN8UIRdy2iKFQQyGqLZYhwglvbNM36IZUZN6gvk9qiwk+anzMl541Dwf48eQETkGNDcYLIYp9zv27NZtgbN2UndiUOzXV4h6KhZDkZnPU668O0bN/+7sLqbAml4k+kvKIruEwExDUMl9oqFC9t17fKfO/HZqrW3zxYFysqVmCoZNr9qQrqC/XFAvbQmUAxapg81JAoj6f8vXFcPzji5J/wEkITWvPFaiH0KY+2trt5xeAtM+Tml8rw/CGhwC4j5kyPQ9vUkxHk8eC3dUSPUIq114k+MMPpV/gQsWnDw/5RlMNiLDAHU9eDZJuAGa6yxif2l1SmoOQeqDvSaA6/9NV74XlVlemTmUzmpdlqYlcPhP+nXS6IR1EZZKABTw3FRKbkAWiY3+l48EtXA3bSMPO+RLB1ZVaG73iF588oKL1qihy7yusRtuINqthK8tq5kfUZR0H1lxheftTguMexLiEFCJljuclE533akpOCgSYdXLN8OvFcSbbvrLKkcOOA0eGBcWk9o1+ZiwLFYUtFQPs1ctDnod3jtDpKYPp/hcp67wREcbylfBCQlAiSE5/Y2VSEVPU1r9rTtsBYgtv+aLIGaeEUQ+GTR37vAg/Dvwi+x/xQW2U6KRv4MXfrUE6miq+KtXL5nXXWcFRi8fG6Cy+7xfFFsrvL3IEiIT2PVPdISd3mZaB9RLfDStOaxep/lozczI4xltIZCPx8VcVg+C2rrKOj7O2O01rZwQShgkUQmzI0wssjz+hR1pNVduUldkSJ407n5V0v8PHWxuCB9fmxkPfVMwaSeVmsmSvXOpIkTcqkTiTjCsNuBkfTnW6QGGtrewCVbfXIFdMaZ9ZIOJOcN5wHf1y/v+kmIhZjnAeYaLKGAhxBWcqIBwaNU5r+VyDK85iA6UQx0J3n4xPHuK8Awns5F7OU2IJA1U9yvN6t2nUk/XBHdq4ERiSuzcCXUj2mGrFZGwcaqPvuZFbSYStTj4UXqEx5yuTFcTxGQ1+VthKBRD59//KEGTw6UqctprrqaBVRXX+6Fo4rORU7DSurP2M1BrESR0rYAOwQ+9eTiKIjlUX4NiE4ShRRJLAf4p+i9jeNd4UKjneTMouAvg84fnzkJLCxdI7Nlghbju7fBoK+aFbXLUIpVqckb1xLpsYlpWwk1mm3hHBv/CDbHOczENSz7OBG6+XkKJGLtmmYGDmrXxjlKoZdlAzoIrUJKobkFdx3JbFvhIzdFTRNqzDMf2oY/sdNPh+Dyf7hFMv0cDGVz2SD42tcmASJFJFC8WRnabN5qfJomh6NZZmPs2o5ceScJNLqGhFoZVV2ARVis89WjxmLJLq00LT8eRBNIP7pHiSYCaEVofL3cOBDWwYpOpHNj55Neouy8BwGC5NKXzU2uDMzTfjBWj9GzzPpsoQfC32vExigc1RIs0+DmwaOkOBzki83sV0eNbC9U/6eOxga6gBVLK1ix9Bzu2jYLstInwm16e4XoLvIn3xOINrx6lfhN1wJ23UAaJoKrtkQezew+mdfw1PbxhVDmxTgIYHFT/r1f395GkcFpnIioQdm2A64SW6dUPHZacOIvBlqWc0hlrGsW76PZPwzgamL3AkYWPzJg8bpq2gmlHhegSCrk3k/gmnKPqmr58/lXF7gmMME+9pU53PAA/WCGHEkFRSbwB2DMQanTieo6eqj0EVtYoJvWXsq3A6bdHRbSfsM25Bq9/G3F49PmVBbouGvax9D12quSXSgC20EezUO3H8mcdcD+qkalaukpAWWwa5Ut4i2D6qRB7rG+GYLgYLoy4zxo1psN2jK1ppQpsWOSVLIurgJy4s8D/9kE6Fr8C3rl1j8mNLbcCeheRUSlg+a50Ic+I8zBZ5Zb4T7hxJxBPy3WTnmvzJfGBjOGFhhsASV5utYkqwtfklkQhuSoOsn6mR9ph+xAmHpJfMY5T3lCMH2/V4INbjy8/wIk0daKXCoF65ihWS0tlC+dVsXzaYMLfSegXg4gmnatFz2cph2FfrA/2MQOUFKQpC4hDDL4PfQC4cD4M63LadtVMCUVGkh4TNf5S0US8R4qTmk6KS8B1kj0emMAEX/8fNNpoaUFOw8kXUrYzlWKKT33zd6U0hzL/ZJthC47tbSDuKxJ39O227Y+r03bGtnDfEbW6Djf+qJZLWcOWMgadjbUwOso5K61p54+DD31y09heAqqeyOGbJvlhaTASxYWfokw2G1MQyCVrY3pb7Fgn/jQsDtL+Trh8x32rIL87Vz8gs1eAR84SZSBwY3Xv/WQrueDdR8m47t1paSrDldNyF4jVamBptjVepUQ4c3R/RdUQIdOIh5I+Jc6QqgKyxMJAuee+nyVESU7Rg1LmFRkAIMnhfiC1hlpahKxq27hmeNSZZ51UijF6pNRUYFs+FX20Tss4cpmnzdfAgwACyhVp4z812wi9vcH3zhf7fvWxJDQcEzfEnK47iW5FJlYv7d0usOglNWskj6zVBV4XpG0ZdRoOlFixR+SCyaldF7h9mo2ygLMHa5v91Ez0vJndwyR8nHRH8I5TKhuJ7BVn32GQzutQWUtSbhz9dBlgiE5Kzd2QOEhbWfd6yy65xfQbRZLhnvIyodSMQCvfM0vYw3TrMCLPlBkAfHDgrN+skSS9rHwZXzYHBi2sXLblZgLoxJX2hmXTdkXUaO/MMNYCsLXKa5Ge79bGZjVuspp1E4LwXxFZeFWFzgwtE1vZUU1TkbXb8vKwGN7j6QBa0XV6ElxU2aVXUIZCq3RfUBOUTAHGwSj2xlEalvD5BEI9Tq2d2E9+9ozwIALOPdTHz2Q07RdexGaDAlkCchEBWApmUShMvGeF+OrrmS5A5+q/IcH7BTfYD5PqQHb9xlKd80u0aHSKeI3qZKkK77ecxwNbKStftgDAoSvDTUMTeXSmH1gARPbeVlN8nW0GQI8AIDzjXQ2JLMYc/vumhoQWpeQA9WnAnEKEDjRSLMU3hKWK5oZkBZmquuWgpGPpeGE+OxHbx9/gXV1oS5mTKnyc/pzDsYXWHuV+EAT8r9QLK8308In2hpVR+ZyNzKj1pDSZAQGks80svTSDEzgejn/9nnlAo/VfWJjNqWCq6J5mpBneolPuU6Z9mxmfihy5zO5CiXbHdIedMLCkeSRN6KAWBDPLiHHJ6L4HYVs6SNSOW5TfkDLvY42rZZwRUN2Cswi+ImEL3CX6JEaABp+1IjoPTFfACYmPuWAcLaXHiQwrxBDVqpe6BGCKdpORyPQ4bLprxtVfC7pYbvF1Q6qhEbXkwy81+eAcu2wMJw94JK78dQUSp6OnBmAnZ6MlLEC5E6So3FK4LLFG7kkB1OtUXwNhoP08eLy+Uj/YCE/sQiBmRWGkA4DkD0VRjF3lT/eaqBfrC3UPo3LSIy2sSldUkXWiYZjg50SfkgwXlLakYCnINqI6Dg50RhYyoQFt7qg8FiUaNE+AWp58Zz2NrduSNg9BVD7+0sG9aQGZ0/AqIke7AgGfbptsBQrPlBPl98xKzh9JltOhh6ZIsHO8Fr7GOAnOBH8H/Lh/gTlqAp8wMX9Az71vDu+3g5JTBR8ZjAsK0QZNoZJQ9KTNomB9lKKmMLGGRNa53Aw5TIVK4G/rqh8iCL1U60ihlvl1OoTt7Qv6rLoaz/3OgRZklyASL4FLXL3s2EsK3NBzAVIWyM7xuLTxBzqsC4v+W9845n81ILyJ3OysqOyvS3qKErQpkYVzxfPuOx+OOq0unjh4YWQWoyX5xpIzSGhaOGo/51IGuyMkdjTIkJntks3lkwuasExkaXdDbSLjE2uFWBC3HRIYmL13MN3MDdVzuOCn7R9U4T9ogky1La5M6LYR4nurBykxzZr5vaDAodh3P/wkhOjYCpvpmeRJ1L30Ze11HBHp571JyMUw1dw4elmlqoa5zQ5Jhu+CdbEiOXSfZp0pa732N7yQA4Z8QNjf/UKfxRwAaKxY+2I1viQqHSDaJDQPx/JAno1sZziZ+fYN9pNHWNXRbcLnreK/gexdLEdWCeT+SmTroIGgvH0UFrskBnwFlmXYsaB+KWjU+UplTWcBox14XqO8H3lQoDO+WQmYJqN4AKm7DaXVzsaU8tWQxjyGxt1uejoJ544kulAXnhAa5FoB6Vn9UDjPMDIAh1qG1SKSeYHgkgroODuWGAFrjF/fHGajM5Ac68rOW6Z+Dn3PejF9OaJk3fcTDSWEpAQm4x/1zQV5cIj4vhURXN4h8kLFNgPCUQbqE/ZPZk68YCevD4ErCAAAAAAAAAAAApQB/XimRsqQ+gAtYlOIbcNXI0VAU00Dqr0tKiTNrulLXX4NrJlTTtLzK8Ha97fM74miFKUTatEINpONtAOx1FSv9pfgdq6awKbHl7k+ZvHYAH/MsKjocCHEA99TJK50y+HBFK9/1dNzbqR9UnFjApKGLbjp4I7pkPMntm2E4WnXfUbqipcOqaz+sSLgTe+JHKnJi0GKTbT1St+6L+hqMVSufMltoEDV6ld1hnxv2PDW3S9BSpd0rh169tteIs341zGLXP8j7a+s/ivfyLHbVPx8vvv0Zm1QoLe3mT7f37mpuav2fEt0RlSuNyT9K0hpGJvgeOt8zi1ORPyBXkMmLSHh3wEWXj9kd+nZEpMfGTmDKBANra9F04ublBCLX7fNdA+2DFBUbMqPVNqvw114PcFT0fEOMrwsuiLFhmI0cS7dsmZyQR2VJSSiIBJDeIPJkT3IcyQ5eo8Pcx9hpw8Fy/Kel7jxnuCYbyhfXrqVqz+n1IAK4IEByVTfpGZk3jLjvPfKvZXHwERoAauhKt0N+GIQNfYlPaPR3Qv2oreHBV66z1PQ7FIFL4kgS2/HC5b6rw8I+6dZX78XiMuXY3DP+Vn5lTxdV0nVZ1saehfn4Oi2uAaQXvVrs1AToDapiQ6MwqnPLl9WNzobWl4n8sdd+HH7nkDGWDJZmzGpl6Hr1VRE58Co+tE3HAAAAB44AXG6RMArypYmPE1obzA74I3+lOF4BzjEab5CZmDiipHdxZIXTaMFYWG1ABF8jpyzBW6K7rOQ4uhaB2GcPyPtn+tC2+v/rkC67qG6j77JYltshB4zX7tnDILmLNZRUTW2JOqutHgZiGUW89WIROBZGT/i0Y0gy4hvpbpDg8u9Scs/Qzewad3jyPYvAF2vdXP1Ha9gGQAzbtiy7P6JGtJEqUAgGcFpOI6l2AAGIEOFTXWvf0VCzfO5myd7NiawixX6pDhfFC9av4She9t/w7xUTEr/F+YwPUiY191L2pZhZHlcPFVpeir76MuL5wjR8d5dDd6hPsZyvgD3Wl+CWTNBN54fkZ+0cJ7uu8LSJk/Ubh/t5aoRNVkdZg6gTZO9UWlHnHnewlfs10ra58/EezimZaIyuQ2XA+6my2bYxv/E9NW9xW0neerQVBDNiX9Sof48kUI0C0eL51O9o3tt7KlR6QSSgsMdo12oPZyLaNsjCiXkt671N/xI/DLLuyS6BvmDK1YcBFH7JSR35OH6hImD6gSymfhp4T46CxldBX/q15DOmf8gu7dZdgtQd+8AplgTKo1i7BXaiC40Jxd2lz4c49FkKPplWosucmjAt1TY+CLv1Nho6JTSaACWhPwGX049xoKnztBvNpFvcX9BGtz62G1hcraI/2RPLk0GMxIKN+Ac79RqlIn8VDH4+O+GTxAV5EXfisK7N8aNOlNdAtwTZcQQfHEkQE91L4KRPOAI74AdlJbP51RfXcCDyJrfoUgMD6eHUqiVmS+6h5TmDiPQjhNL7CmT8Iy/47RniAeouTQx703KAAGd6jT+A5Vvsoqz3FGdMXR3MDo+96nThbDotp13E97FldGO1zcc/gDNtG/4NJtOuISJa8QnslmSzvXgqA3DvPSBPTUZr8NRQ10Rtv/0lis/cTBUYO8mN23Q2bfZE4s3Z9hoUlAGegV+4404E/JijIJhvhD79QJfxolGFOCxHb8vt0+3SL2aHb8THDtgwWcgnCbBmVbHLBtp6bGwAdVuFNxzVZaYRwdLz9bmTZtbbhSRvbYmpwCLiv9/ydWeZblQ1ZNz5WjsUDhHzEWAQ3MSzEE7G86GeB4OhRVj2NdsHvys67cEwnjLWoU3VSYXvYe0v7GX4Z3yafBOeQysXM4eBn6/gWO6zDN1K4nYKRmCAgr+7qO5iN5BnbyT8SJ65v4JVaHEu2Jj4oAAE17/IfeZO0Ctij14wBUzflLPzQ1YKLF3Gs9omf7/ydnqZSpg2sszZlNvJI0JcuWIrCtLe5yFseYVzvgmAM/LcAZBAZ0fpErvjFI5pwxiH9ivE+WDbWzW6pI5PTAvXgDEd/J7MBtzCqWVumnYeWkCUVfDfUWahqX8OILphmJEkS8nYaV8gsXt8i+s5dhUv1GWormMSuf8eInBe5+0VSYQLiZ5zk6uG8NJMVp6cJkSTOL+f4Ygro0+laTO/QRI90cYPkG93HpLF4SlcQKygoY0YdgLf7qsbzhXmwmnjP8sB4sJURdGKU12yi/QAARKIZtvH/tI2KWLkxUDK1nKuBMY/r9wtvpuGPXMjq4VAW6b2LyfQRWjVrPKo3aWQRHB85VhGHlf9BYRAys2PU0HMMYgjTlNag4Dnr/I3K/oO8d4+ST16vlSd7gcufqZS2plubLjqP3WXC3vmLZYFdltkKd86Q/hUuvYkPn6OSh/xK1sGz+lAQB57vWMXKIETZvzBBNJvGwFaMkXzJucAAU8FIUf8FV1r/0WcTQgJag4G/leOMAB7Wr7HrfMbqoQJk+ajPbCp0cEWwc7ny9i7z0i8bXbYsWxY1tjx5sS6wFsnEipuSfcZ8wpufZerHOwRZZ3uT9pKTOJCkY8MoJxm1ysi7DyGQwstQfXwcz54dPZ7Ag0jbJ8Nc9MHWbR13jRZZeTlBkC07MPB2qGvuB0rRVbPONOov2Vs1VaJXq84InnKRIH8KCPWZYzdpFtm/KlybXoZ3K8BUDIqWHlixbuEyEPY1cdB5zet0FVTzzNy75PjdDoK3S5nhssbtfSIOpic/wyQLr7X9e7//ti3yJzPNFMxvGe0swcuZR8TCUK/n+Q+6cz+Rlwx9d590BM0vvIqn5mZ+bc3qFy2y8Q4KhpQ9PuGLpvRi5giyuBaXZuw39Di3Iw7pAAABt6Ln/Bp4zJxgah6P/8FZYyGaXmtz4m2Mhb94Fy5ZXnOfrdf9AIXltyKQQIEIWf1URbSSDpx9VAgd/QyNcxV6QnyIiS5mtBhAs97M/XNnxgxvzuhX/qsOOBjD9TXJSNmSPC6Gkgnd4sSExTfavp69UGn3YlYyMqygUfw2tYMXgpLIyPnIZdOYgZ8Q32CXo3B9twg6hhObJuOF+x1CuYhz6F2nDtyPyl8OqtOS2IZu99xUdcjY+PQYb1PgrfURblni1h1j/InA5msHYu19zPIMHusmzpnZaYJzL6uHTlGW9AlSAUH5iiFkOJ4Z2sEC6Vge4ntNLOyxcjzqEWCe1lWoByUVBGMZXS1r101Ge3vIR/a4MUJ8AopfGVzZ2NRDMn66K2i6WMAU8yE8Jkmpiq5wixQq1RGViLi/sK2uo3FOYe6lYRzAnSjzMXznG2JAnMcNNQvz5ehfwyfD3Z2VePBucObIXrjlwQADFFgdGy8tyHvP+7dthox/7anpYHMDs4MyfDTF4L5UyXtKbjxfbLge+uckXPcx2HatLEm1IjuIj18tXVGFOLrFQ4nVo2HKG+voxjQx+WAUrJn+O/91iVJrugYPZIekzPgCGv7rAvKEa3DW5j35jMZ1vtF7/npG3MyS/oRiRMXFkDO5NBnnj5DzqSc1TAJPmnC30qYmQ3/bEBVNG7hRZvVv5IiD4ktxngQbeKVXuOLajDY1UZZDIowBF/hwowqaPW5KwSOy8HgID6oFo2CVjDtW/NHT8UcKpojtzxOMmpVEAAEPT3fc+qD4KzJlTr40eATmgoaIBjKa1c9sahWZj0HjpJiawc6yJosIIc/NsebLIMTkIUiq0WK59ADHS+DW0OST9mDIeTWX0Xy1V8xD2/7itoBZPhN/M9hvcXTRH+xyOX2ocUKLr4tyEWRjUN8CodhbJW4Rut5MeEWXJwX4MisNdZofgIITbAYmNGbM+D36kiYhjoR83qO/ksBpIxhTfYrGPlP/XmcbWFXZvCKsmKxVoKcNIrWV4aPzuCc82CLLpq6FVhJS1DRHwUEg9qJSUEvjFwAcr1VZqtcxUyDiIPr1fDBLW8rQ9iODEmJxo69NjqJVIZUKETHOPpy8iizqP+xd8/w350R87Hhuc37WOf42XGD+PROCGfzBwr6ikwpNXpdKgQQKVn7ppXQWxmt8nhh7wk6ZrS23piu21r/a/M427EhDHILYg0x6pNdMO0oxT9bragA4FPdZgNMDtw7AKPdAXIb9oMRG6I8fXXKIfCzQKKAAA/rtfg5ahCxp+xWiuyhL9poWCQaFAyWnXCTuZkQvB9Tr9F/Ktl4haMinzaWgvzkFbL2BPL4Se0VUY1Jt89mLhp60vXiuZ47v8h6ynU91IInamNNgXX/7oHE8XW+pZql9/tPkwx/g3Wm2jJUc3tDzJkH4PlNt28pKn0PGQoQCnkXaKGGRhHlWIuAABX049MSmJZytw8jbavPKPGUUgJyiNOJIQGckM6pB4RJhXPo44jzfjLbJYQw0cd3X7J1GSQaxWK5iof+yVpGWsMdSXx5xBSsK8ODzkkxXWNYKWLN7bubYmWgmQws7u/dfyswCX8WwKeIcr+xj1Q1Lz5HaD4YNOADnje/r/BS7rBl6/NSgnwlSL53N44/DMVX2d7PQztfMK9PzDAtn3JgP/o9cW5cWj+MmDsaN2aGEVfVfw8xBd6wndb06ZU3oG61DJ9ypuRhx6E5Byrc/ymmGTkVW6982EOnB83rZbibrVvq97YxYscxidvfBlPxAfZ4KJTtU/qxA0y1uaxtXbBXjXb0t6pvzMki1bqWLt9NNbirul1lA2nCX/t7aPV7ilt4yViqTMxOqwhtmfnYxzbXlZ968kDBbQJnhgBQnzLXIciAiLu495HzcBgdDXLO7Wpg7atc6EQxRgvZMzYDO8DVtxJvXgvW7IUsjPvNC8hxg07OKKwjtUTtpFNhf+Erox4X8Txb6VsrABXhxlPYJ0+n7d/Q+kKsvhYXj92G+XfCYiopcWz95Y3qQKyrx23ZhbU2XM3Q4emr3xdrw4eapj/o4X2V+0uFWxH6oNC+UrybdqjaBsPS6flBzInIA5y7iLhr7yCiiAAAAAAABK5fCAZ6V0OJlSkQIO1iLQCev3fTlFsMd9gQ37rhh6fi8P1vBiWKP+tGcgdG2AMbWUaACxP0p9KJyE4784O4FOCaTwkvYVdDEnVCt+6zAnOwZaFSgobK2zAPB2jrdXXjWcUkxtwZH2hvuC9Qfal712WBB/GfFLVbAnaLQ4bvmx/mCGIswel9gxkzG0HuHqZIZpc7Oqs/EqnCLSeYRN4E0K/zwoainQEyiSm/A/IfMOImplmpNe63FNwKTPR15n+7lMhlMV6WK4d3Xmxrf1/SFt1H804c0/SYXYWapZrvYYMPGUD+H9c5NGHIKlKdwAOclF6ZeSp1O/5UdkTIdi3SSW7Cd9budk9QarAiEK2FFoI8CDuokr369q64FKmBMQHV0q7TnSxLGEzoFKXkjRQFLXtkHa07tVnx11znXKCJGTLEIDuSJvnsL4tutaofe4XNdNm7A6qN2hfiUpUVH6fINbDq1RQIebvgxNLpOmxYodMa7YI1uJ3Wn54+nusy92h/Ek/Q5VQfUrBjOJT6He+RfbDrBecbnNOzN0q4OPJubrh7nUFTgZ8SrcMUfWY9Sf6F3W7LVLvTxdIVbJ/xwbfsykfnAb1ktlVO3cOGITSBmfWsKjpq9AzNvL5cQu10JMT1aUCYXd9sVP/V3XD+eAhJ2OgbSA4HLw+tmqusbLkMXJwGTGfcd2D+Kl0Q16TtioI1/zZ7U4rHweE8rc6BLWY/qjstEzx9SoGskzJ4CYYD/w0ZyY8tDUpKQZJ1Av1ZKkpiSndwuqP0ueJl4rN+mDVZwUJ6Ev1Jp5L7R9aj2bEu6zqJ2/aBOLdghZ+Nv198HnmgaqcrY0t5esY8miLOc6C+Jm/35a/H3vtYDE78eqA8UDXfyuKkg53Rb+FOAOzDa1pPLwKHpjq/8OM2dyMYn6t2WdbuErnDEdIWMP1JMjtg3tgKsPjn1vGhLiAO9kFrq1zNwATim+mXMoDAzwy21MVkcWduu6ZWAjz6DQ/sWVFltz49OOizzcjTlaf9QipMJWEJYjImlDX2LvuPCmus/PUy9FiD9IZ//nBT8x3cp43h8Ju6u9qm/q/7Wf75QEWraJLtyW+Aa9epHgaZi23VR0t8LQlnHEMJxAACL0pNdTEOTS99xMS7x7738Ehf9ZZcvevie8Ub7ZSHMmC4WdhqTEksJAxM/ikuRbAS+evUS6FPf/CpIkSSNUyUbpy6V7ipgGIdzoaFG+yHJjRCG6UtE/EajNeinzFQhChVH2HU8+9QzhxtSQxJ+VMv+ryd+h0TMuqS00+S17Y2jebwwNaVbQpCJh4cCac8UqBsqnGyV7OBDC7mzJI5OGBNVV3QgK104V8n0CveSOSbYQCy3nmD/xF3p8+3pv/qJ8e8AmbziH0eoNjRkec/a2d0kBG4OXw2vffU30K6R9Jsbj2n+x7KjJgMBQo6cq0uqZrBNg2LxtCncA5ANh0QUalWkQ/ByPA85iPzg4OLFSScMm84Mz7BkJcuLLm31uQkgb+Lst0jpR+kTcT6wY54J1T6Qb7SCN5z1iOq7c8fo5tnyBHFCpRhUo++1CXZLTByvdoxnhyb9NEhjuBnaWqnC06WApSaRLtaFyw6CD8H2sZS4voxnxCBnhjY5aa3IneD2REldPywCcVtDSEBGpBykZExYlglZUBd44piSBJkoRAQdvYALoK4/eek6BBLq4R4wr/DK1jZmwqfiysYUS+gRJ2xnPV2qtSol/gnMzmjnDZg8sIooZSbqRKYeUoEPdHKp89etZMR9thoydTS4rn/GyI5P3julfFyDrbjcVS+ZQJPynszEbf2h1/0gRX1E8b8Mj4sFvxHayO8Tc634+YuIICS+jpRfSsQDBmCaHQ1rE+xJf2TKaGsZvMj1hCtf7VVMebZgn9/Eln1eU6nqpA/sSzQ+jPJpdkDjnAFIgdvtOtfnQ60DPaFzgaFESiX7WwsCOJOxHGrkRQiEPYbk+QVLH0PcwZVqnWNMY6k8MRWaI21BL+7fHaKhJFVPwQgMgCsoBlMwjds3q01pfccKlwQUQIKXbaKtgi6STmuPGAvWbDQf/pLr7mc3fP3WKW7KMvCDA4PoiIZz7WdA7AprXl6Ez8Kx9svd6Szg0lpZuZNCmwkuz5t4Ga6FBjyGf2n5VooJXRsPu12maQHxqOUwtC2dBXi0K245i3TMt31jHWeOp1SnZmcq3pc6YkMcKeb9Fc70B1tNw7VR5JKbxRw1kjDZgdsGJnHA9hDQvaddEsCfsA7eemvN+L3Z5FvlVwk7+bvLGOddNxfwoqBfflF56cVcvvzOmiOXVAGh/zdTOtjgmpT69WMePB+q9WC+gv/2vWMVevIuzftKJRHWgnpZjjKObABVGhcU4mF8NT94AL/+itoOTseY6AKxLIlvX8UxypV1QzKKkfRbLZE0wP3y/Tv/LF03mODHbHaBLle1mFq7kZS4tm/wzM5VvR7cgSEDpqz075Z+pCCryu2NhyQpCvHaOZZBydRq3htRWsS33XW4qgLlAS9ShX0a1LRAprzwBXTTxHG3f26Qns3+V1RGKZ/lUCjb83XBRnB8wx9wX5cx/iW14jH6k9rRRYblkwkZWatyFSQPF0Xek83DQzdcsV7SCq5e4DPcsHemo/v7sWcP1EIKVtg+cBJEUfFi7h0mpJMd7RCBa8BiR9Sn+qyBTCYqk7UQBnkGPdlDuqAGYXro1pUTNL9KiHjcBN1HNyOzyohZkcLC8++F+UfcIT3YuyRVHwazDOAKJGPUsS82uceC4+46MrejSuQEEZ8BjoCzsXlmEEVFabuRqOoT0+Xnj+iXBO/i2dVSgzcGp+XGjVpyAhTVoVXsUGPFV1Glk/vDSm7iOVTxWPk8X3HR8YuXvZnw/Ia5NvL75PbzgZulUgHzQ3zwmLjTdJrA8xMva8Iuj9U3TeVtA+RrJLMJQLWMVINtJ7/uvMTzk35IhtD2GShHMbdLMZ0afwXknJm2uiQppVDGrnN43pIKtOvFz8anp9gp604ALKcvP4TZgJfhPbDZNu1Ut4KkPJGe08BuZGc8loh4ju4ZGjQdEAdluuvWBrUL0JNfZJoOlzQalk3nYhujkfBsuv6M+z9edBwRpn8aljL3gsTAp3SxpewmDNgr30PjXNYDSvG787TWPXA2tcX1iRAIjPJiZQuNDn2Q7DvhbziJUkUZ8frh/d5c+x7Yxc4QAnkwaSFypgzgWc557QyLpDtTD0dbsONKTPcFnPMYay2MeXwvyce9SdE+FzHaeVaJbSwigG+YAs2gk7qOIUKVYfjZMSlnFJK+XLrvVaTDgJJ3u37Rbmx2ROWlACkzIg3TQq37EzyRoVKbBwcPbJEwBjkApU5x++D8N5axcQ9aFeidrDG5NKgde6Lzzfg6fHGg3yfKQBXaNmkoeFYafOzEcOQ1Ta3Zy2iXwnCWpwksZ5ZQesYdYLVBMzRDUfoOAOaYzcyi9lSv1F2H4seKOHnfHJN9OCjkBN7CiIe7tICPfHkPurQM7vPD0Y3wt5gV70U4O3Y6FRTk9e9D6a3z/yQZbzzBOHFdcILIEpUMw5vkefsWDjA08+tE3MvTY5gKbRYoJrCH2Ure7jYeblI+LcCVmZ3xn7JQ8G5OgT1h3wOpcXtlg8DmQ2adftmLji9K/Jlad5y/BfC2X18LZWQKHJOwOKnQNoH43fvHIOXNZLKVPXZTb3ox9nkgxkbTCnYO2RmDFySlEBbn3s/XR5MhRmTf84Qz137myUbDb4GpyX/nd+NEkGZEbt7gP+n6gMFej+OwZYiPVDTKwRlmH9ffBaPk4oagIrP+cq0Ci0hdfnKHn3/6Jnq3z/8Y+ZLDnuhDPGAAZj9uQqwgtYGrzXJjAOKG3v86Ed/1URL2wA5Fo16hZUZSctMkJzyOHDIe/8qU/Z+gAuQWj9zwQ9zsWkxmiNByszGbHYVBkzaqcRLLHr+cRqrXMIL8DLkhH7YECJWH728t6xTzrmAhZVyq5P1CPLppjAYgupyp2/Ndr/tvdY77Et35sQYA57RxxtHl/05nj4qANQHPyYJtKB2miRbxo3vCbxLB8faO4+MM8K7YXmFP4MBKUsZQaxMXIGdG3mn/OFNdTpx/UkgTiPYSu8C9ph0XabAuEpm4ST4sbDEgZAGlJOcydB4GVWQECbE2hc/7Ds5NYPyMTC7Kdj1r4bBhxJYQL1zr1fJsWNoU3t+1RMQwBKpi0Das4BnEvQjmRGMBZ62fg6+SGa2rFAUjiGI6+Cb078Mf9eDT0IjPvM5WLkEdTlP4Mu51liRKZDVRpTrysrBBEpKHMIkiGKqz43js8t0NwknNzd1Q38bKSyXfMMWS0x4UzQ429jUueThEczD7lT4a7v7GxMHF6K8vuq00dDdYttBVeFgmBb2ZlexvxvIzLaf2TllAdIXgGEwg/fxxDaXABqyQ50PWo/bPgzsRbfHlr+8/GCyz9Bpx99q/yLaaxaH35ifhFXIveN32v3Mn3rQ6/SJ5+Ml7rjDhcel3lMyynSI/r1qQbY/4HXl55fXAG+or+CIGHvupWefchfO9UyqDY8lYfWdvixgVDlhYmYb/TUWGDzUCjx3YvF40vk4RzfFDsP4+hVQUSOGfQUq9cWy5D69yCFXkGXK9N0vcBux+qBZRqhtEkLCyumIg55lU0aU5WLyG1RAUDYRUCa1B/7w3bMNIDIo6OogMl04F2/Aw+XHggruH+0228gks72XtT+HuTDrScRDORJwwNpn39BrsbaX6VytUWdrQpBSG0N57/CKe1ljRRhyUJoRmC29T/se2p2/LLBARhdzUP4iYeD/PfZbg5x6YbHgs1DfxXX6FkWMtScOgG9KkdJBy4FfYV2+mxuIsXbuj8yKsTAWdafsXGCJsSpFS3f50g/UK+WgPv4tyK7Wmz9m9T2M9Y6iHCNca921MbHVwRA7fNrBxqrIPbB6Ls0BJ5ASnrOYcVYpkxblfFoh+R5SSTIIb8gykD1CMieOt5njR3UkqeUZOn4zCKjf1842Z7eujYiwFdoAg1nT2UySNhSZXwtpeOK5zhLAEl5roFnBHgT6lLRdWcBGtfSsaAqwRe5huhukVA/ixNjGPytZ3qui3RFWHkQ4RnR3ADyvUh+TECkHEApySXFmG8qRDUWRL7fFTQjX4n06z0iDr58DbYibIf8dvuE2gc4EnHlPLly7KHEjVjc/af4JbxwpN+HUosXMF4QGYLn3XmRZO237CJ86B1+LYLMmlkEJ2yPoy5aOrdvZgXQdhQ6xmAx4O6m0U3SXD5ggunqJAUiEXA43JS4l5vHC9cGaOdDrubrcMdDpnGbeJ+OQmVuYWd3HIzyZOd8++O2EoDIn9YNJN8TKZIscYqGGmaKzD8J9CkSt5LQkG3diD60yIV4i/bPaA5Vy+BpI4DGOkbjXygogAi6axZBCq0eKmIa4t1yVe3LhINyC8jvgRLsAJgq7wAAK0Kib7vfXZVsqbgM2HbTu2clbal+M7m2a/Kl9P5GeXG0QSU0tpDf7QHnrRc30RXer05r8pp2qXtOWw2R65XuCaSDVnKOjRxAHmZnB0ROMBLJriKRbHRVgI6ftaI/+lA5WgRYB407AC+ru5Pa1uP1XlbAOCI8oUneo2WL2k9zRJXEO5wuCHYueTarM9LyzoQ5QyjPAbuYPItjh5StV6aD14PNaPy+RvPcXsco889eWox10wO1ld6/IodkT219a0yA+3/H733KnnYaDGV7tNvVLegZAF2AW8fjaLmm5sMAL+1aNQGz6GDlnclGUm1sSI9wwh3bYJTqrj5MnE9RbEWC/f3IapL1DhjzHfFm6wMlEBJk1XPP0nmg5iK/cBUtxHfbzOM2fJpVGunRvaRNYf+uEDRwF6T6yYKc/x60XyU4mpJQZ8FnV1uuulHHWcJnwmx3t2qamUrJysQd7+U1NZSFSwN3ofvxrHICIFJdvWOAEHzlkn6ZIPAirYqVI1zLcv+HVDLmtFMBGLnFcugBtc1OSXY0VXsWTEyyTZI2RUkLRK0e3Qki+oSykl9kyvj0jEVEVQjtj3+4YLhwAAAAAAAAAAjYyAbpV5W+TqpT/RJY5VpV+xSOb9p4RXExwYI6EUp/ItLUnwdloPaoY85/590zCMuztR0LCLV5gELVi4TtvZOYh7ci6jDhXc2ZjFA80ZyftbFcdq3oWFXDYmzD9tMP6tlk6eCuqoduZygWocm/QL/TcTFEM4WcK06tvvx2E8DVeazyLTiORRiHcZsRMEfmY0zUrrtKbWXI/9iER2O8UcqF8Vi9NsW2ql8Qq1C+rvLEjqViNiS6mEPJo/x/86GpQYK8kJGIfXpfpwjwQiRLDGtAaGwKRuVTxPwZFk2E4P3ZxPmBMisc6mT7pH3NolnZshSkRCZujyexRBy9EdM9nlALfbKIai68B0Y1vZgMghspxVdVbHwtNdFaH+0dkkvae7dSK/GmEQlcFH9LVEjYoRyu2TAqOq+78Rlnw/paX0DxhuoKlU6lfiNXhF/eagjVvxed6kdIemd9569nHaKUsL7+y9kqPw4tvbrs/mm+z1MfscAoS4SH5TIkFepJRKGC7lJBpOFyJ6weJyb9jMOdrqd4A7GzXbHlqUZUvgM3V7rYaJHSw5oUb3/Z8b4M8OfCu0vJTBnIywN+Q9BAAAAAAAB+KD55Py1BZjFqtVyJv7cZNTvNjeN6WunpDauP/WP0wd01bwawV8PFpLMrc1/mwvfb4HEruXo45accyB7lyvUobi9JFp7Toz50EZRckjh398/Mqyx9CMbNG5l7vJcPBgFlW6Dl8Es0WDEXjae5yCetdnrB4OHqR9YId4jxVJaqYyQSttUIcK49oqgsVHWcGjOa6hQC+7jGUbxfLuGM5xp0bfiGIn77BXAvy18se/QAWQcyJk6f6E4lqBqEI7I86Mi/SiCzIa7jihHpe2Jr3IhLLxTptdOgLPGjK62DmMk/N3dcUlYvj448liJazEzAMlNjaeN5kmYuvwOXvPSBPxGRXdUTjV+2IJDDfs3oOgkpc4QnjSF2z3bJ5hoO1FPldyns4USwZnkACTHuZ4L9C3bb0jNfSlYjSFf7oFtqoUgcPCzG6PoPyiGfsAjxxp6GmzhYCkfR+0v9h+zpvLZ0+MF8cH50T3CoLmmP9Drrc0pMjsTtZp5GsmNn6RtrXtfgcsASbp7h69YrQ5bKDw+it4zzivqgw64jQT7PiT0+Piq6dxcf4PvGlaEVPtiOwZ7CE43b6V39q2kUa1Ywk7nOS1XJ8IIVKvj4Gsk1KZRc3+5++Qak2H7G8sFUqIIHX6iy1ZqkElq3kcrLIALDUR7n7uKgelM0pb5krn6quiOe7wDVDaHhfGLE42xf+6IO/82lxHtuG/rA2xbWyDOXd1HS3PBFvjzEBvVV0jBm7WmMh//appnUj1MImnvb8z/nk+iUcNGENWDhwYBjMbHYEVLfcpk09JF2BLv4brpZceJ9wIf3mWsVLudg7Tp1i8emULSSEcKQA6zdcFLQIx5o9O4YdcJRNDCKWfh2dZwWN5cl2ptph38XbTfpH5INnjnBLMHNaWvr7HM/dDYCOadgg5jaCi2g+4cvSLrtgB8ZATwKfh+gpXMeEKSzBnhjOWDtaL97xvQyqqqXFEZseHNCdkkVKlaqc2qi3sJ7a3wdUleQUaK0AyqIxruzB5TpreaSd+UQWs39T9hTUNe/pgOW1+APMOlZsF+ZHmKQCqJ4v1YBHXyPzxNWsqN5PNTWQDtvZzu5FwV0MO4Wi73zdS+ks/R1DzUsvhc3GUgSppi8f1rD/BDdsViJ2rL3hoVnXT9iGrQubw734prWh3inkNVdU5BXPVb05Fvo+GVLg4erUVVgkMHrvB1Iy8T5T13NUlvzz2ThO9NIm2i3dasEqNC7kBzdtUehIyAH3313XQcuGd35Erf+pwmdEB8IHziS1ivYfJ3NgycKAysyW3dwGwsr2ocI+WtVjXKmU8D/MPYw3ANG4WbsV2L246l0TUTmR4ZRovqDmAgCkDtWLOXtX5ns28k1L8iRYBiqYaL6nZJ+18kldLufUdyU3jHioIn8DgzNchUVBDVWBg90f5KI8vVmSa0ut2QGpO7eYm2QGzA8TBDcRPy6WtMnsWWJf/mg4I932Tlw1mGAWkT/RXgjNnp3gnIC+S0K1X2PafHFm30KKbX4VYCSaPCZoABE/VHCip/e1s0mHIR7oHz/jk2yHzAKpFIt5jyPIYaogZb9zMPHLzh2mH40iaJR02qrNLVkSrp2+XTbUMpPYjSUFmfzChSIMKpIFj4+gYC/EyeIz1nHn2ZiiEQ2QqmxTxxYmLGQ1Uq1w9IpH2pj6C+3i7h689eJpFCktybZl6C/Wf5b/W/H++u2C+pTPNgmy67QnQwB3eXbZlO42JkSo0wHso8UmHmQ+jzrlZwo/En7qbCF2pey8vGua+vJ7jmaNkhvqomLYiNYOhfsDYxxzEfM2mKFi07l3SsY1AyBUSsNBYU5RzaR/6eSU0KXleLpuHKmnNB9LXx7KHsSCUz1T+9+GDb2wpIavTBXb9JMGUUV5dtA1vrJTtsoKdgARb4TxIaDjjYyBwaTUIzts5AAZVhRm6jw94eVRogsw7EPEzcjuojBZ9cleCIvoK+n00RSpH4EEcwD2cyvRND9KNAGzJu7rSXEfBE3k6S5jaqlVzQSaDMQ8DTvEFsvJ/TcUoTaSQnw79Bm+WzpT84Q/gNR9W775/Fj6LN3/AFPckJfs/rMOWJSAh6vSFmj4sasng/O8UZQqfdx5Mp9V29iklSEoBQ9Wf3jseILeSgGo/RjijISqxMLeJl8IVto8/CaPUW0Xm/dlUXyhite+gwFGiAPWfcsBiFKlC6cKVAr/KfdVP3eS3lc17tC7zmntR9kGyy9zAE7VWxY9rFB9y6onaiHYJI/XfpBgtgM4MsUcgRdQrsjwBt0xlt/nI9YYCh7B+jzzDUWC5L37ta4rjVchIYH15uFGe1qtwut0Uy9UqXmuvKh4ktLQIEwKY90yBlctvg8KleQqI/y9mrZn+aXNpx7aXvRRay3Ml2yEwKZdPFJuewJ1LDE1l+sfhq8/FO2FlgVEUtK5SM2CCPUz+pxmiPcB/+NLYlXmlgZnu5ukor+2tJk+pCgebs2NuwISN97GeSE3N3Y+kK5g4kwWMRGLFaFsjCX7HiELzJbHjk1m2O1LXfqqyjEWOl0Wcl7HqCcxpygowZOlUxnDAZiu3yoEMLx7Bnnn0UJSOfU1k2HipyTotSz4gM5KCXR8VltoznAFWbtAg4KZdlOeH08L/hKqW9DpgE3nC6Fiozhu/CajaUSIhZ/bNfrps0WCWZh2S9A3rYqYK2PThfQ2n7MwE00ZBfKxWY3TiVt4PJFIgJWZnWwBsquCMwrH5drH3OQLyO/21tSHC+E62kmktm6w8JRYa9Zk7QVGG0M85U3ucuczJxsCTiavYeqr0dYO7Km18IYMxUEzEiLNOVzTH/q+jljXObZp9vyR5/zg6nUTgFsp6vAcaeRpKMizdPu9+xmxZR76Q3/FXb8Bd/Q9yYh0FwbSE+hRb61cnUSjCmi8I4CHaDF48g6MCSpK8YUWnSSlkAO0kVsWwTrGCyp2Lp64gpTyiyZ3X8xIRqzNiRgzf6kaZWa8dTP6aBBXLUt+KadS+j4HhX9zR7sxzfNlPzKs+6W+XBpI8OilR2riVbJfHKK9eCE0br0fZJvSImMu5EOjU3PiGL7L52YnYUEVd/hOQmqa3VfCNlSdi/k/9Lf22KdTSaC0F9SC1jL8JVrQom2cwgnnTyYP361FLoTskxrkwIAl3fetS3if0vDrYM7+Yy7IE9U5Q6VBpqag/I0U9YNSk/a/qFkvx4xV0gbOitJW9nkS3pI1tUuzgn7ysJwlaSz2n0/YJrtnRU5ju/mHE3s4MTHjtbNf0nHAPfqXfI55Urpii8YlzAQPnXrdQDzdk2oE99Vr4DaklPEB8vvOu1ZNTlGsvkkUsUw+O9EU5+oPdLBlFXTj06t1ZQ39wOaa3RVW4xYut3MqcVps78gPFkqNvtdzkQTeMrmYjcyAdWrnuAHAYTL3hpfr5s8E36JpsrxxXRcLT6Q8d+r+B7GBwmf7YLpHtd2QT0MoP1SilrPKXEjNeISzDpYtK/3heE6NVj8Us4VOppCJ8Fy9KRt/ECIOT4pyeY1MsoM9r9d5dzRD1iynO9rfxL4d8WVkt3KQLSl9t3cTP/FeQ8ParK+angrzTsVipf9rJ3jbi9CAoCFfHI+/DL3MTSoH712yBhM3VvC5GolJELALUMkfAFcMbxUxllAmRUg9C51YROth5pUVT57fm1a+BNwsUJE/SDu/9l9UaOHah6cWWgydTTuHoo0labSvn12CEI3ndtnDh+VtChHP1DPdMVGmDZZHoxGEmEt8YKNL3I0XgN8NsY1BnoE3hBnNH5akms75rc+AqBl17PKKHMikH6J/vLrBPsDb2+24u0lJuStFlQjilCcXXGWZIFkjmpz81w/+D5HZj4JFm7LvRNNDbfRaAbV77jXaLabjTs8OUZ0reA0KNHME48ASLS8aJoWuqVSJZWZLJTXF8Y5LZQFS3fRWzYsYPSRupJ3Tpo9CgB5TvnRG+1Nf9uc8hNEc72MHj4tX8baoeCzilWsCTMK807iD7SogPNN0SWQokaTPpi8tEQpIZ/OMs6EeXWSE8BJT1ukXpEfIrqg1pZanHRpfb+qd9l+eKQR8hYnVEd00uY57yagwXRHC32ksOevPrKjdFCsPc+Nu/kyA4D9VKBLqXuijXLcuk3P3Tf1OrZNU33zS2qKiU0YpEUIEmagmdpZby63OeAb3HTqy9E8k+KIaaDwLIOuBdVYguu6mbIyjMw2UURaVuhaqNdFAJtl1DUWsQeyX1B03BMHwSkOQGti9B3uTjq0wuGn3ZUA2yp/dEVu1TV3psIBuNsfzTkdxgpTkWFdCB3KotTx3DaaAbyCJYtrwJGCMRTyFeCSjNtZAtabydM0EKjmMuNq7JsQ1lML8wrtUMhJMqmMQZaK1isN+0Cd9VISiYi8jCFEZHabRB6/+MGHzJY4M8s6iEMiSbyqexD/5aY+CU3WI67GVoIY0CgeU+MRdcSUu12oLKkbBVaVnLOwmr35/ty1PlzMolrsfldlGgd/AzlCcpbB2BL4d72YRPc/e5XrST05UQcIeyIJEoKMQmGKHIiTtYaoaGROxNPNwMkfeKdLKz/O9f9lPcyUrYe63jFwUyI3DqaVmd20Z145d++aY6HDOYnKqck2JnAtWod7iAcaoJ4O4VPEle/4b5JZRSOCGhSPiHp3HXdxmNyl9rAAL9/eU5sAEW27aqGL+HwpCWP/2BfUeLPLZ8NW2azTVkS+h046hyeHll3lYlRzb6MG1Peyty56TgYFR2hTmA6IV5ugnXxguY6crt5YqEwaG7ZU2Hsc32OcwN8YXOuPtqbh2ztVbYEbXv7ccPe7rIhxZ0z3x7x+oH8VzKqiZ21m6moiZPb2GJaJbUtvV98nhASsa1ru1wOZ5a5LhByDr9BAjTBECdFAfbMxt1A3y4Be7HHWPfznFIjerVzGKCVBrsG86ZKpTohTvq67wyfnVM+41aOPT4WQxFE4td63hC/pVQlrZAMWYBqblTxKbiOeNj4DHqXTAmZjWmfjNp+aqW7o8kHg3rpxY2Wrjv3LY/+Mko1mZ9/1D1DLE29OnfLDGoApfSEglgxB5pRJZe290ezxrobPi0WC7aZw/QkuhFSquORIMVys2CLkTAHr8qxppgydvwCsI7/5vQiDrYdGphyy0N5CDN17Ilqzzc4NgfO0pMk9H2uzQsfKaVn/oyfuco7qGfgCPEKLb2TvXVf0gp92+P/zUtSqaVXYJX/hu975LSH/ifSKuCr9E3NbFUlLLtwR8j9lyk6sKthV9CRRdG/DAsiWHVITtPHM9mGtmzMS0Ywg7aKmo0Bxhh1ezlNNnUXDFUjlKlcx6vPLxhG3e5UIaYB7R6nbLVqy4OylQkOzyP64HKawewc2wtCIGG1rExmyzN87/tO4SlDJNAiWuJh4/hayEwvb8aMplYFFIE9XhqY6V0c5MTOswuETMwza0FSzRG0qfJCEwSZxUzHfokAKloWwAFOwpxAAa6JXmYcjGjA99uqunlrEU+1YgtOnjfkh6Da+D2DLY6QWaFAjOBvk7nJaPMmSRykGWj5TFNqV9PfHLMSTXwSu+IWKEF9e7s2uYxjIbK5bISJga87Gs5wriBCaOPsMUkIVsFzl+jTqe1lo6JIXsbyH6YfETn7MEcZmsBYkVmsudYPCgrHYq3Vo+QmhKV5elGGjjU/01vI0KhcluVX9yQzD3vk5ArNbEy9gMC8BxoYZhK+6vf6xGiHjZoS2LXHeEQ/+cHCMzx5W3zuC5hHUsyzIPk/Yp/ymHxoxTt4Y+OT21gUj2E9QAAA',
          'Ajouté par HOP! depuis sa carte (Facebook « Marylou Netanya »). Casher lemehadrine, viande Mahfoud. Tél. 09-773-9145, WhatsApp 052-534-5224. Position GPS approximative (Ussishkin 2) : à vérifier. Prix de la carte, à confirmer avec le commerce.')
  on conflict (code) do update set name = excluded.name, kind = excluded.kind, address = excluded.address, phone = excluded.phone, whatsapp = excluded.whatsapp, kosher = excluded.kosher,
     tagline = excluded.tagline, tagline_he = excluded.tagline_he, logo = coalesce(shops.logo, excluded.logo), cover = coalesce(shops.cover, excluded.cover), status = 'actif', showcase = true
  returning id into sid;
  select id into cid from shop_categories where shop_id = sid and name = 'Kabalat Chabbat';
  if cid is null then insert into shop_categories (shop_id, name, position) values (sid, 'Kabalat Chabbat', 0) returning id into cid; end if;
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Grand banatage thon', 12, 0 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Grand banatage thon');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Grand banatage viande', 15, 1 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Grand banatage viande');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Grand fricassé', 12, 2 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Grand fricassé');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Pizza tunisienne', 12, 3 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Pizza tunisienne');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Feuilletés saucisse (boîte de 5)', 50, 4 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Feuilletés saucisse (boîte de 5)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Bricks pomme de terre thon (boîte de 5)', 60, 5 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Bricks pomme de terre thon (boîte de 5)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Nems au poulet (boîte de 6)', 60, 6 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Nems au poulet (boîte de 6)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Boulette tunisienne', 15, 7 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Boulette tunisienne');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Boulette de poisson', 12, 8 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Boulette de poisson');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Filet de merlan (2 tranches)', 60, 9 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Filet de merlan (2 tranches)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Menina au poulet', 60, 10 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Menina au poulet');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Menina au poulet et pâtes', 60, 11 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Menina au poulet et pâtes');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Boutargue (le kg)', 650, 12 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Boutargue (le kg)');
  select id into cid from shop_categories where shop_id = sid and name = 'Minis du vendredi';
  if cid is null then insert into shop_categories (shop_id, name, position) values (sid, 'Minis du vendredi', 1) returning id into cid; end if;
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Plateau mixte 15 pièces (5 minis pizzas, 5 minis banatages, 5 minis fricassés)', 90, 0 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Plateau mixte 15 pièces (5 minis pizzas, 5 minis banatages, 5 minis fricassés)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Minis hamburgers (10 pièces)', 90, 1 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Minis hamburgers (10 pièces)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Minis hot-dogs (10 pièces)', 70, 2 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Minis hot-dogs (10 pièces)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Navettes thon (10 pièces)', 70, 3 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Navettes thon (10 pièces)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Minis bagels saumon (7 pièces)', 63, 4 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Minis bagels saumon (7 pièces)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Minis bagels charcuterie (7 pièces)', 63, 5 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Minis bagels charcuterie (7 pièces)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Minis fish (6 pièces)', 60, 6 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Minis fish (6 pièces)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Tartillas crevettes (6 pièces)', 55, 7 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Tartillas crevettes (6 pièces)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Tartillas poisson (6 pièces)', 55, 8 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Tartillas poisson (6 pièces)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Minis tunisiens (6 pièces)', 55, 9 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Minis tunisiens (6 pièces)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Minis shnitzel (6 pièces)', 55, 10 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Minis shnitzel (6 pièces)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Mini barquette poisson tempura', 45, 11 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Mini barquette poisson tempura');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Minis feuilletés saucisses (8 pièces)', 40, 12 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Minis feuilletés saucisses (8 pièces)');
  select id into cid from shop_categories where shop_id = sid and name = 'Minis à la pièce (composez vos plateaux)';
  if cid is null then insert into shop_categories (shop_id, name, position) values (sid, 'Minis à la pièce (composez vos plateaux)', 2) returning id into cid; end if;
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Mini pizza', 5, 0 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Mini pizza');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Mini fricassé', 7, 1 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Mini fricassé');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Mini banatage thon', 7, 2 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Mini banatage thon');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Navette thon', 7, 3 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Navette thon');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Mini bagel saumon', 9, 4 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Mini bagel saumon');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Mini tunisien', 9.5, 5 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Mini tunisien');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Tartilla ou navette crevettes', 9.5, 6 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Tartilla ou navette crevettes');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Tartilla ou navette poisson', 9.5, 7 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Tartilla ou navette poisson');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Mini fish', 12, 8 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Mini fish');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Mini feuilleté saucisse', 5, 9 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Mini feuilleté saucisse');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Mini hot-dog', 7, 10 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Mini hot-dog');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Mini bagel charcuterie', 9, 11 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Mini bagel charcuterie');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Mini hamburger', 9, 12 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Mini hamburger');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Tartilla shnitzel', 9.5, 13 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Tartilla shnitzel');
  select id into cid from shop_categories where shop_id = sid and name = 'Salades';
  if cid is null then insert into shop_categories (shop_id, name, position) values (sid, 'Salades', 3) returning id into cid; end if;
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Slata mechouia (douce ou piquante)', 17, 0 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Slata mechouia (douce ou piquante)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Mekbouba (douce ou piquante)', 17, 1 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Mekbouba (douce ou piquante)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Artichauts cuits', 17, 2 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Artichauts cuits');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Fèves', 17, 3 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Fèves');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Pommes de terre thon', 17, 4 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Pommes de terre thon');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Pommes de terre œufs mayonnaise', 17, 5 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Pommes de terre œufs mayonnaise');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Pommes de terre harissa cumin', 17, 6 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Pommes de terre harissa cumin');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Œufs mayonnaise', 17, 7 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Œufs mayonnaise');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Coleslaw', 17, 8 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Coleslaw');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Chou blanc', 17, 9 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Chou blanc');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Chou rouge mayonnaise', 17, 10 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Chou rouge mayonnaise');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Aubergines frites', 17, 11 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Aubergines frites');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Aubergines mayonnaise', 17, 12 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Aubergines mayonnaise');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Variantes', 17, 13 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Variantes');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Navets harissa (selon saison)', 17, 14 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Navets harissa (selon saison)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Kohlrabi blanc', 17, 15 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Kohlrabi blanc');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Fenouil harissa (selon saison)', 17, 16 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Fenouil harissa (selon saison)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Fenouil blanc (selon saison)', 17, 17 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Fenouil blanc (selon saison)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Betteraves', 17, 18 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Betteraves');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Piments frits', 17, 19 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Piments frits');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Piments oignons', 17, 20 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Piments oignons');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Concombres piments crus', 17, 21 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Concombres piments crus');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Taboulé', 17, 22 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Taboulé');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Carottes râpées', 17, 23 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Carottes râpées');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Carottes cuites au cumin', 17, 24 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Carottes cuites au cumin');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Pommes de terre charcuterie', 20, 25 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Pommes de terre charcuterie');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Amandes à l''eau', 20, 26 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Amandes à l''eau');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Olives', 20, 27 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Olives');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Salade de pâtes', 20, 28 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Salade de pâtes');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Salade de riz', 20, 29 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Salade de riz');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Riz cantonais', 20, 30 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Riz cantonais');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Salade chinoise chou poulet', 35, 31 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Salade chinoise chou poulet');
  select id into cid from shop_categories where shop_id = sid and name = 'Entrées';
  if cid is null then insert into shop_categories (shop_id, name, position) values (sid, 'Entrées', 4) returning id into cid; end if;
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Poisson à la marocaine, filet amnon (boîte de 2)', 40, 0 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Poisson à la marocaine, filet amnon (boîte de 2)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Poisson hleimi piquant, saumon (boîte de 2)', 60, 1 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Poisson hleimi piquant, saumon (boîte de 2)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Filets de merlan (boîte de 2)', 60, 2 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Filets de merlan (boîte de 2)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Joue au cumin', 65, 3 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Joue au cumin');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Boulettes au cumin', 70, 4 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Boulettes au cumin');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Menina poulet ou poulet pâtes', 60, 5 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Menina poulet ou poulet pâtes');
  select id into cid from shop_categories where shop_id = sid and name = 'Plats';
  if cid is null then insert into shop_categories (shop_id, name, position) values (sid, 'Plats', 5) returning id into cid; end if;
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Pkaïla + semoule', 65, 0 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Pkaïla + semoule');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Bouillon + semoule + boulette', 65, 1 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Bouillon + semoule + boulette');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Camounia + semoule', 65, 2 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Camounia + semoule');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Ganaouia + semoule', 65, 3 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Ganaouia + semoule');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Blé harissa', 65, 4 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Blé harissa');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Dafina marocaine', 65, 5 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Dafina marocaine');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Nikitouche + semoule', 65, 6 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Nikitouche + semoule');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Blanquette de veau', 70, 7 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Blanquette de veau');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Bœuf bourguignon + riz ou tagliatelles', 65, 8 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Bœuf bourguignon + riz ou tagliatelles');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Rôti de dinde sauce champignons (4-5 pers.)', 150, 9 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Rôti de dinde sauce champignons (4-5 pers.)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Rôti de poulet farci au veau (4-5 pers.)', 160, 10 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Rôti de poulet farci au veau (4-5 pers.)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Rôti de veau farci au veau (4-5 pers.)', 160, 11 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Rôti de veau farci au veau (4-5 pers.)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Rôti de paleron sauce champignons (5-6 pers.)', 180, 12 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Rôti de paleron sauce champignons (5-6 pers.)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Rôti de veau sauce moutarde (4-5 pers.)', 190, 13 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Rôti de veau sauce moutarde (4-5 pers.)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Cuisses de poulet (le kg)', 79, 14 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Cuisses de poulet (le kg)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Shnitzel (le kg)', 90, 15 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Shnitzel (le kg)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Rosbeef sauce moutarde (le kg, cuit)', 220, 16 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Rosbeef sauce moutarde (le kg, cuit)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Carré de veau à la coupe (le kg)', 280, 17 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Carré de veau à la coupe (le kg)');
  select id into cid from shop_categories where shop_id = sid and name = 'Accompagnements';
  if cid is null then insert into shop_categories (shop_id, name, position) values (sid, 'Accompagnements', 6) returning id into cid; end if;
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Riz jaune à l''ail', 40, 0 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Riz jaune à l''ail');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Riz blanc vermicelles', 40, 1 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Riz blanc vermicelles');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Pommes de terre au four', 25, 2 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Pommes de terre au four');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Haricots verts', 40, 3 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Haricots verts');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Pâtes à la sauce', 40, 4 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Pâtes à la sauce');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Nouilles au poulet', 50, 5 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Nouilles au poulet');
  select id into cid from shop_categories where shop_id = sid and name = 'Plateaux';
  if cid is null then insert into shop_categories (shop_id, name, position) values (sid, 'Plateaux', 7) returning id into cid; end if;
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Plateau de fruits', 300, 0 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Plateau de fruits');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Plateau de légumes', 300, 1 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Plateau de légumes');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Plateau de poissons tempura', 250, 2 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Plateau de poissons tempura');
  select id into cid from shop_categories where shop_id = sid and name = 'Gâteaux';
  if cid is null then insert into shop_categories (shop_id, name, position) values (sid, 'Gâteaux', 8) returning id into cid; end if;
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Mini yoyo (la pièce)', 9, 0 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Mini yoyo (la pièce)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Harissa (gâteau)', 40, 1 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Harissa (gâteau)');
  insert into shop_products (shop_id, category_id, name, price, position) select sid, cid, 'Minis boulous au chocolat (boîte de 8)', 40, 2 where not exists (select 1 from shop_products p where p.shop_id = sid and p.name = 'Minis boulous au chocolat (boîte de 8)');
end $$;
