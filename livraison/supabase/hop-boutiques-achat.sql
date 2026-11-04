-- ============================================================================
-- BOUTIQUES HOP! = UN ACHAT FAIT PAR LE LIVREUR (décision du patron, 04/11/2026)
-- « HOP! chez Carrefour » (HOPCARREFOUR) et « HOP! chez BOOOM » (HOPBOOOM) : ce n'est pas un commerce qui prépare,
-- c'est le livreur HOP! qui fait les courses au magasin.
--   1. Prix : un petit achat (comme le rayon supermarché) : course habituelle (25 ₪ dans Netanya, grille des zones et
--      des villes) + 5 ₪ d'achat, minutes d'achats comprises (settings.purchase_min) puis l'attente annoncée.
--      6 articles compris, puis +2 ₪ par article (1 ₪ livreur, 1 ₪ HOP! : hop_share), 24 au plus. Le prix est calculé
--      par l'appli (comme toutes les courses) ; la base ne le recalcule pas et ne le refuse pas : rien à changer de ce côté.
--   2. La commande devient un achat (service « achat », pas de commerce à confirmer : elle part tout de suite aux
--      livreurs). Articles du catalogue gardés (items, avec le lien de leur photo), place prise dans le top case (buy_places).
--      Paiement des articles : le flux déjà en place pour ces boutiques (goods_choice) : Bit au livreur (articles + livraison,
--      après les courses) ou espèces à la livraison. Le livreur avance les articles en caisse ; le client le rembourse.
--   3. Regroupement : pendant ses achats, le livreur peut prendre d'autres commandes du MÊME magasin, 3 au plus en tout,
--      s'il reste de la place dans le top case (30 places, 4 sacs) et si sa plus ancienne course en cours a été acceptée
--      il y a moins de 15 min (hop_join_why). Deux nouvelles commandes du même magasin vont ensemble (pair_ok).
--   4. Liste à cocher (buy_check) : le livreur coche chaque article ou le marque « Manquant » (retiré de la commande,
--      prix des articles recalculé, le client prévenu), puis « Tout est dans le panier » ; avant ça, pas de « récupérée ».
-- Mêmes règles dans l'appli (config.js : hopShops, hopIncluded, hopJoinMinutes ; store.js en mode démo).
-- À coller tel quel dans Supabase › SQL Editor. Sans « drop » ni « delete » ; peut être relancé sans risque.
-- ============================================================================

alter table public.orders add column if not exists hop_buy boolean not null default false;  -- commande d'une boutique HOP! (achat par le livreur)
alter table public.orders add column if not exists buy_places int;                           -- place prise dans le top case (1 à 8 par article)
alter table public.orders add column if not exists buy_check jsonb;                          -- { "items": { <article>: "ok" | "manque" }, "done": true|false, "at": … }
alter table public.orders add column if not exists taken_at timestamptz;                     -- heure où le livreur a accepté la course

-- Les boutiques HOP! (même liste que CONFIG.hopShops dans config.js)
create or replace function public.hop_shop(p_shop uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from shops where id = p_shop and code in ('HOPCARREFOUR', 'HOPBOOOM'));
$$;

-- Place d'un article dans le top case, d'après la taille écrite dans son nom (« 6 × 1,5 L » → 8, « 500 g » → 1) : 1 à 8
-- (même calcul que l'import Carrefour et que Store.hopPlace dans l'appli)
create or replace function public.hop_place(p_name text) returns int
language plpgsql immutable as $$
declare m text[]; q numeric := 0.3;
begin
  m := regexp_match(coalesce(p_name, ''), '(?:(\d+)\s*[×x]\s*)?(\d+(?:[.,]\d+)?)\s*(kg|ml|l|g)(?![[:alpha:]])', 'i');
  if m is not null then
    q := replace(m[2], ',', '.')::numeric * coalesce(nullif(m[1], '')::int, 1);
    if lower(m[3]) in ('ml', 'g') then q := q / 1000; end if;
  end if;
  return least(8, greatest(1, ceil(q * 0.9)))::int;
end $$;

-- Nom d'article « Neviot · Eau 6 × 1,5 L · נביעות · מים 6 × 1.5 ליטר » : seulement la moitié dans la langue du client
create or replace function public.hop_bi(p_text text, p_he boolean) returns text
language sql immutable as $$
  with parts as (select x, ord from unnest(string_to_array(coalesce(p_text, ''), ' · ')) with ordinality as t(x, ord)),
       pick as (select string_agg(x, ' · ' order by ord) filter (where (x ~ '[א-ת]') = p_he) as mine,
                       count(*) filter (where x ~ '[א-ת]') as he, count(*) filter (where x !~ '[א-ת]') as other from parts)
  select case when he > 0 and other > 0 then mine else p_text end from pick;
$$;

-- Nouvelle commande dans une boutique HOP! : c'est un achat (dernier déclencheur avant l'enregistrement)
create or replace function public.orders_zzz_hop_buy() returns trigger
language plpgsql security definer set search_path = public as $$
declare units int; places int; list jsonb;
begin
  new.buy_check := null; new.taken_at := null;
  if new.shop_id is null or not public.hop_shop(new.shop_id) or new.items is null or jsonb_typeof(new.items) <> 'array'
     or jsonb_array_length(new.items) = 0 then
    new.hop_buy := false; new.buy_places := null;
    return new;
  end if;
  -- Les articles (déjà repris du catalogue par orders_items) + le lien de leur photo (jamais la photo elle-même)
  select jsonb_agg(x || jsonb_build_object('photo', case when p.photo is null then null
                   else coalesce((select f.path from shop_photo_files f where f.h = md5(p.photo)), 'ph:' || p.id || ':' || left(md5(p.photo), 12)) end)
                   order by t.ord),
         sum(coalesce((x->>'qty')::int, 1)), sum(coalesce((x->>'qty')::int, 1) * public.hop_place(x->>'name'))
    into list, units, places
    from jsonb_array_elements(new.items) with ordinality as t(x, ord)
    left join shop_products p on p.id::text = x->>'id';
  new.items := coalesce(list, new.items);
  new.hop_buy := true;
  new.service := 'achat';
  new.shop_status := null; new.prep_minutes := null; new.ready_at := null; new.shop_share := 0;
  new.fits_topcase := true;
  new.purchase_min := (select nullif(purchase_min, 0) from settings where id = 1);
  new.goods_prepay := false; new.goods_budget := 0; new.goods_after := false; new.goods_self_pay := false;
  new.goods_pay := null;
  new.buy_places := least(coalesce(places, 1), 200);
  -- 6 articles compris, puis 1 ₪ pour HOP! par article en plus (l'autre ₪ est pour le livreur), 24 au plus
  new.hop_share := coalesce(new.hop_share, 0) + greatest(0, least(coalesce(units, 0), 24) - 6);
  -- Espèces : le livreur paie lui-même le magasin en caisse (rien à rapporter ensuite à un commerce)
  if new.payment_method = 'cash' then
    new.cash_shop_after := false;
    new.cash_need := coalesce(new.cash_change, 0);
  end if;
  return new;
end;
$$;
revoke execute on function public.orders_zzz_hop_buy() from public, anon, authenticated;
create or replace trigger orders_zzz_hop_buy before insert on public.orders
  for each row execute function public.orders_zzz_hop_buy();

-- Rejoindre ses courses en cours dans la même boutique HOP! ? null = oui (ou pas concerné) ; sinon 'max', 'full', 'late'
create or replace function public.hop_join_why(p_courier uuid, o orders) returns text
language sql stable security definer set search_path = public as $$
  with act as (select x.* from orders x where x.courier_id = p_courier and x.status in ('confirmee', 'recuperee') and x.id <> o.id)
  select case
    when not coalesce(o.hop_buy, false)
      or not exists (select 1 from act x where x.hop_buy and x.shop_id = o.shop_id and x.status = 'confirmee') then null
    when (select count(*) from act) + 1 > 3 then 'max'
    when coalesce(o.buy_places, 1) + (select coalesce(sum(coalesce(x.buy_places, 1)), 0) from act x where x.hop_buy) > 30
      or greatest(coalesce(o.bags_count, 1), 1) + (select coalesce(sum(greatest(coalesce(x.bags_count, 1), 1)), 0) from act x) > 4 then 'full'
    when (select min(coalesce(x.taken_at, x.eta_at - make_interval(mins => coalesce(x.eta_min, 0)), x.created_at)) from act x)
         < now() - interval '15 minutes' then 'late'
  end;
$$;
revoke execute on function public.hop_join_why(uuid, orders) from public, anon;
grant execute on function public.hop_join_why(uuid, orders) to authenticated;

-- Deux commandes du même magasin HOP! d'un coup : place dans le top case, 15 min d'écart au plus
create or replace function public.hop_pair(a orders, b orders) returns boolean
language sql immutable as $$
  select a.id <> b.id and coalesce(a.hop_buy, false) and coalesce(b.hop_buy, false) and a.shop_id = b.shop_id
     and coalesce(a.buy_places, 1) + coalesce(b.buy_places, 1) <= 30
     and greatest(coalesce(a.bags_count, 1), 1) + greatest(coalesce(b.bags_count, 1), 1) <= 4
     and abs(extract(epoch from (a.pickup_at - b.pickup_at))) <= 15 * 60;
$$;

-- pair_ok et on_way : la règle des boutiques HOP! d'abord, sinon les règles habituelles (inchangées)
create or replace function public.pair_ok(a orders, b orders) returns boolean
language sql immutable as $$
  select case when coalesce(a.hop_buy, false) and coalesce(b.hop_buy, false) then public.hop_pair(a, b)
  else a.id <> b.id and public.groupable(a) and public.groupable(b)
     and not (coalesce(a.size, 'petit') = 'moyen' and coalesce(b.size, 'petit') = 'moyen')
     and greatest(coalesce(a.bags_count, 1), 1) + greatest(coalesce(b.bags_count, 1), 1) <= 4
     and public.km_between(a.pickup_lat, a.pickup_lon, b.pickup_lat, b.pickup_lon) <= 1.5
     and public.km_between(a.dropoff_lat, a.dropoff_lon, b.dropoff_lat, b.dropoff_lon) <= 1.2
     and abs(extract(epoch from (a.pickup_at - b.pickup_at))) <= 15 * 60 end;
$$;
create or replace function public.on_way(p_courier uuid, o orders) returns boolean
language sql stable security definer set search_path = public as $$
  with act as (select x.* from orders x where x.courier_id = p_courier and x.status in ('confirmee', 'recuperee') and x.id <> o.id)
  select case when coalesce(o.hop_buy, false) then
    exists (select 1 from act x where x.hop_buy and x.shop_id = o.shop_id and x.status = 'confirmee')
    and public.hop_join_why(p_courier, o) is null
  else public.groupable(o)
     and (select count(*) from act) between 1 and 2
     and not exists (select 1 from act x where not public.groupable(x))
     -- top case : un seul colis moyen en tout, 4 sacs au plus
     and (case when coalesce(o.size, 'petit') = 'moyen' then 1 else 0 end) + (select count(*) from act x where coalesce(x.size, 'petit') = 'moyen') <= 1
     and greatest(coalesce(o.bags_count, 1), 1) + (select coalesce(sum(greatest(coalesce(x.bags_count, 1), 1)), 0) from act x) <= 4
     and exists (select 1 from act x, couriers c where c.id = p_courier
                  and public.km_between(x.dropoff_lat, x.dropoff_lon, o.dropoff_lat, o.dropoff_lon) <= 1.2
                  and ((x.status = 'confirmee' and public.km_between(x.pickup_lat, x.pickup_lon, o.pickup_lat, o.pickup_lon) <= 1.5
                        and abs(extract(epoch from (x.pickup_at - o.pickup_at))) <= 15 * 60)
                    or (x.status = 'recuperee' and c.lat is not null and o.pickup_at <= now() + interval '10 minutes'
                        and public.km_between(c.lat, c.lon, o.pickup_lat, o.pickup_lon) + public.km_between(o.pickup_lat, o.pickup_lon, x.dropoff_lat, x.dropoff_lon)
                            <= public.km_between(c.lat, c.lon, x.dropoff_lat, x.dropoff_lon) + 1.0))) end;
$$;
revoke execute on function public.hop_pair(orders, orders), public.pair_ok(orders, orders), public.on_way(uuid, orders) from public, anon;
grant execute on function public.hop_pair(orders, orders), public.pair_ok(orders, orders), public.on_way(uuid, orders) to authenticated;

-- Acceptée : on note l'heure (taken_at). Boutique HOP! : rejoindre ses courses seulement si ça tient (place, 15 min) ;
-- « récupérée » seulement après « Tout est dans le panier » (sauf course ou livreur débloqué par le patron)
create or replace function public.orders_hop_buy_step() returns trigger
language plpgsql security definer set search_path = public as $$
declare why text; mine boolean;
begin
  mine := coalesce(auth.uid() = new.courier_id, false) and not coalesce(new.unlocked, false)
          and exists (select 1 from couriers c where c.id = new.courier_id and not coalesce(c.unlocked_until > now(), false));
  if new.status = 'confirmee' and old.status = 'nouvelle' and new.courier_id is not null then
    new.taken_at := now();
    if new.hop_buy and mine and exists (select 1 from couriers c where c.id = new.courier_id and c.role = 'coursier') then
      why := public.hop_join_why(new.courier_id, new);
      if why is not null then raise exception 'hop_join_%', why; end if;
    end if;
  end if;
  if new.status = 'recuperee' and old.status = 'confirmee' and new.hop_buy and mine
     and not coalesce((new.buy_check->>'done')::boolean, false) then
    raise exception 'buy_check';
  end if;
  return new;
end;
$$;
revoke execute on function public.orders_hop_buy_step() from public, anon, authenticated;
create or replace trigger orders_hop_buy_step before update of status on public.orders
  for each row execute function public.orders_hop_buy_step();

-- Le livreur de la course (lui seul) coche un article : 'ok', 'manque' (retiré : prix des articles recalculé, client prévenu),
-- '' pour décocher ; 'done' = « Tout est dans le panier » (chaque article coché ou manquant, au moins un dans le panier).
-- Décision du patron : un article manquant n'est pas acheté → son supplément « +2 ₪ au-delà de 6 articles » disparaît aussi
-- (prix de la course recalculé sur les articles vraiment achetés : 1 ₪ de moins pour HOP! (hop_share), 1 ₪ pour le livreur),
-- et la commission de HOP! est recalculée sur la nouvelle valeur de la course (même règle qu'à l'acceptation).
create or replace function public.courier_buy_check(p_id uuid, p_item text, p_state text) returns json
language plpgsql security definer set search_path = public as $$
declare o orders; bc jsonb; st jsonb; st0 jsonb; was text; n int; okc int; missc int; total numeric; lines text; nm text; done boolean := false;
        ph text; he boolean; u0 int; u1 int; d int; v_price numeric; v_hop numeric; v_com numeric; v_val numeric;
begin
  if not public.is_active_courier() then return json_build_object('ok', false); end if;
  select * into o from orders where id = p_id and courier_id = auth.uid() and status = 'confirmee' and hop_buy for update;
  if not found or o.items is null or jsonb_typeof(o.items) <> 'array' then return json_build_object('ok', false); end if;
  st := coalesce(o.buy_check->'items', '{}'::jsonb);
  st0 := st;
  if p_state = 'done' then
    select count(*), count(*) filter (where st->>(x->>'id') = 'ok'), count(*) filter (where st->>(x->>'id') = 'manque')
      into n, okc, missc from jsonb_array_elements(o.items) x;
    if okc + missc < n or okc = 0 then return json_build_object('ok', false, 'error', 'incomplete'); end if;
    done := true;
  else
    if coalesce(p_state, '') not in ('ok', 'manque', '') then return json_build_object('ok', false); end if;
    select public.hop_bi(x->>'name', o.lang = 'he') into nm from jsonb_array_elements(o.items) x where x->>'id' = p_item limit 1;
    if nm is null then return json_build_object('ok', false); end if;
    was := st->>p_item;
    st := case when p_state in ('ok', 'manque') then st || jsonb_build_object(p_item, p_state) else st - p_item end;
  end if;
  bc := jsonb_build_object('items', st, 'done', done, 'at', now());
  -- Prix des articles : seulement ceux qui ne manquent pas
  select coalesce(sum((x->>'price')::numeric * coalesce((x->>'qty')::int, 1)), 0),
         string_agg((x->>'qty') || ' × ' || (x->>'name'), E'\n' order by t.ord)
    into total, lines
    from jsonb_array_elements(o.items) with ordinality as t(x, ord) where coalesce(st->>(x->>'id'), '') <> 'manque';
  -- Supplément d'articles : 6 compris, puis 2 ₪ l'article (1 ₪ HOP!, 1 ₪ livreur), 24 au plus ; d = articles en plus gagnés / perdus
  select coalesce(sum(coalesce((x->>'qty')::int, 1)) filter (where coalesce(st0->>(x->>'id'), '') <> 'manque'), 0),
         coalesce(sum(coalesce((x->>'qty')::int, 1)) filter (where coalesce(st->>(x->>'id'), '') <> 'manque'), 0)
    into u0, u1 from jsonb_array_elements(o.items) x;
  d := greatest(0, least(u1, 24) - 6) - greatest(0, least(u0, 24) - 6);
  v_price := greatest(0, coalesce(o.price, 0) + 2 * d);
  v_hop := greatest(0, coalesce(o.hop_share, 0) + d);
  v_com := o.commission;
  if d <> 0 then
    v_val := v_price + coalesce(o.discount, 0) + coalesce(o.shop_share, 0) - v_hop;
    v_com := case when coalesce(o.network, false) then public.commission_network(v_val) else public.commission_for(v_val) end;
  end if;
  update orders set buy_check = bc, items_total = total, price = v_price, hop_share = v_hop, commission = v_com,
         shop_order = left(coalesce(lines, '') || coalesce(E'\n💬 ' || nullif(trim(items_note), ''), ''), 1000),
         cash_goods = case when payment_method = 'cash' then total else cash_goods end,
         cash_change = case when payment_method = 'cash' and coalesce(cash_note, 0) > 0 then cash_note - v_price - total else cash_change end,
         cash_need = case when payment_method = 'cash' then case when coalesce(cash_note, 0) > 0 then cash_note - v_price - total else 0 end else cash_need end,
         -- Espèces : le livreur a payé le magasin en caisse (« payé au départ »)
         cash_shop_at = case when payment_method = 'cash' and done and total > 0 then now() when payment_method = 'cash' then null else cash_shop_at end,
         cash_shop_amount = case when payment_method = 'cash' and done and total > 0 then total when payment_method = 'cash' then null else cash_shop_amount end,
         cash_courier_mode = case when payment_method = 'cash' and done and total > 0 then 'avance' when payment_method = 'cash' then null else cash_courier_mode end,
         cash_courier_at = case when payment_method = 'cash' and done and total > 0 then now() when payment_method = 'cash' then null else cash_courier_at end
   where id = o.id returning * into o;
  he := o.lang = 'he';
  -- Le client est prévenu : article manquant (ou finalement trouvé), puis le total à payer quand tout est dans le panier
  if p_state = 'manque' and was is distinct from 'manque' then
    insert into chat_messages (thread, author, author_name, body) values ('o:' || o.id::text, 'admin', 'HOP!',
      case when he then '❌ ' || nm || ': חסר בחנות, הוסר מההזמנה. לא תשלמו עליו' || case when d < 0 then ', וגם לא על התוספת שלו (' || (-2 * d) || ' ₪). משלוח: ' || replace(o.price::text, '.00', '') || ' ₪.' else '.' end
           else '❌ ' || nm || ' : manquant au magasin, retiré de votre commande. Vous ne le payez pas' || case when d < 0 then ', ni son supplément (' || (-2 * d) || ' ₪). Livraison : ' || replace(o.price::text, '.00', '') || ' ₪.' else '.' end end);
  elsif was = 'manque' and p_state is distinct from 'manque' and not done then
    insert into chat_messages (thread, author, author_name, body) values ('o:' || o.id::text, 'admin', 'HOP!',
      case when he then '✅ ' || nm || ': נמצא בסוף, חזר להזמנה.' else '✅ ' || nm || ' : finalement trouvé, remis dans votre commande.' end);
  end if;
  if done then
    ph := coalesce(o.courier_bit, o.courier_phone);
    insert into chat_messages (thread, author, author_name, body) values ('o:' || o.id::text, 'admin', 'HOP!',
      case when o.payment_method = 'bit' and o.payment_status <> 'paye' and ph is not null then
             case when he then '💳 הקניות מוכנות! שלחו עכשיו ' || replace((o.price + total)::text, '.00', '') || ' ₪ בביט למספר ' || ph
                               || ' (מוצרים ' || replace(total::text, '.00', '') || ' ₪ + משלוח ' || replace(o.price::text, '.00', '') || ' ₪), ואז לגעת ב"שילמתי".'
                  else '💳 Vos courses sont prêtes ! Envoyez maintenant ' || replace((o.price + total)::text, '.00', '') || ' ₪ par Bit au ' || ph
                       || ' (articles ' || replace(total::text, '.00', '') || ' ₪ + livraison ' || replace(o.price::text, '.00', '') || ' ₪), puis touchez « J''ai payé ».' end
           else case when he then '✅ הקניות מוכנות והשליח בדרך אליכם.' else '✅ Vos courses sont prêtes, votre livreur arrive.' end end);
  end if;
  return json_build_object('ok', true, 'items_total', total, 'price', o.price, 'buy_check', o.buy_check);
end;
$$;
revoke execute on function public.courier_buy_check(uuid, text, text) from public, anon;
grant execute on function public.courier_buy_check(uuid, text, text) to authenticated;

-- Boutique HOP! payée par Bit : pas de demande de paiement dès l'acceptation (le montant des articles n'est connu
-- qu'après les courses) ; elle part avec « Tout est dans le panier » (courier_buy_check)
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.orders_pay_ask()'::regprocedure);
  if position('hop_buy' in d) = 0 then
    n := replace(d, 'or coalesce(new.shop_sent, false)', 'or coalesce(new.shop_sent, false) or coalesce(new.hop_buy, false)');
    if n = d then raise notice 'orders_pay_ask : motif introuvable, demande de paiement laissée telle quelle';
    else execute n; end if;
  end if;
exception when undefined_function then raise notice 'orders_pay_ask absente : rien à changer';
end $$;

notify pgrst, 'reload schema';
