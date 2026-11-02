-- À appliquer JUSTE APRÈS la mise en ligne du lot « Boutique HOP! payée au livreur » (sinon l'ancienne appli
-- afficherait une erreur vague). 1) Plafond espèces des nouveaux clients ; 2) catalogue Jus payé au livreur.
create or replace function public.orders_zz_cash_guard() returns trigger
language plpgsql security definer set search_path = public as $function$
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
  -- Nouveau client (moins de cash_first_orders courses livrées) : en espèces, tout compris, au plus cash_first_max
  if coalesce(st.cash_first_orders, 0) > 0 and coalesce(st.cash_first_max, 0) > 0 and total > st.cash_first_max
     and not coalesce(new.shop_sent, false) and not public.is_admin()
     and (select count(*) from orders o where o.status = 'livree'
            and public.phone_digits(o.contact_phone) = public.phone_digits(new.contact_phone)) < st.cash_first_orders
  then raise exception 'cash_first_max'; end if;
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
$function$;
update public.shops set pay_bit = null, cash_ok = true, address = 'Boutique HOP!' where code = 'HOPJUS';
