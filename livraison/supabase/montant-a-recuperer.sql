-- 19/11 (patron) : « des fois je dois me faire payer du client, et avec beaucoup de livraisons je ne sais plus combien
-- rendre à l'enseigne ». Le commerce note sur sa course le montant des articles que le livreur encaisse chez le client ;
-- le livreur le voit (à encaisser, puis à rendre), note « payé au commerce », et le commerce touche « reçu ».
-- Même suivi que les espèces des commandes clients (cash_goods / cash_shop_after), aussi quand le client paie par Bit.
create or replace function public.shop_collect_set(p_token uuid, p_id uuid, p_amount numeric) returns boolean
language plpgsql security definer set search_path = public as $function$
declare amt numeric := round(coalesce(p_amount, 0), 2); n int;
begin
  if amt < 0 or amt > 5000 then raise exception 'collect_amount'; end if;
  update orders o set cash_goods = amt, cash_shop_after = amt > 0
    from shops s
   where s.id = o.shop_id and s.token = p_token and o.id = p_id and o.shop_sent
     and o.cash_shop_at is null and o.status not in ('annulee', 'refusee');
  get diagnostics n = row_count;
  if n > 0 then insert into chat_messages (thread, author, body) values ('o:' || p_id::text, 'system', 'status:collect'); end if;
  return n > 0;
end $function$;
revoke all on function public.shop_collect_set(uuid, uuid, numeric) from public;
grant execute on function public.shop_collect_set(uuid, uuid, numeric) to anon, authenticated;

create or replace function public.courier_cash_mark(p_id uuid, p_mode text) returns boolean
language plpgsql security definer set search_path = public as $function$
declare n int;
begin
  if p_mode not in ('avance', 'rendu') then raise exception 'cash_mode'; end if;
  update orders set cash_courier_mode = p_mode, cash_courier_at = now()
   where id = p_id and courier_id = auth.uid() and (payment_method = 'cash' or cash_shop_after) and coalesce(cash_goods, 0) > 0
     and status in ('confirmee', 'recuperee', 'livree');
  get diagnostics n = row_count;
  if n > 0 then
    insert into chat_messages (thread, author, body) values ('o:' || p_id::text, 'system', 'status:cash_' || p_mode);
  end if;
  return n > 0;
end;
$function$;

create or replace function public.shop_cash_received(p_token uuid, p_id uuid, p_amount numeric) returns boolean
language plpgsql security definer set search_path = public as $function$
declare o orders; a record; amt numeric;
begin
  select o2.* into o from orders o2 join shops s on s.id = o2.shop_id
   where s.token = p_token and o2.id = p_id and (o2.payment_method = 'cash' or o2.cash_shop_after)
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
$function$;
