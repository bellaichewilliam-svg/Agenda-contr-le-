-- (patron 25/11) Le commerce marque la commande « prête » (espace commerce, shop_status = 'prete') :
-- le livreur qui a déjà la course reçoit tout de suite une notification « ✅ C'est prêt chez … » (FR + HE).
-- Avant : seuls les livreurs disponibles étaient prévenus, et seulement si personne n'avait pris la course (push_ready_orders).
create or replace function public.orders_courier_ready_push()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare nm text;
begin
  if new.shop_status = 'prete' and old.shop_status is distinct from 'prete'
     and new.courier_id is not null and new.status = 'confirmee' and not coalesce(new.is_test, false) then
    select coalesce(nullif(new.shop_name, ''), s.name) into nm from shops s where s.id = new.shop_id;
    nm := coalesce(nullif(split_part(coalesce(nm, new.shop_name, ''), ' · ', 1), ''), 'Le commerce');
    perform public.push_call(jsonb_build_object('courier_id', new.courier_id, 'tag', 'ready-' || new.id::text,
      'title', '✅ C''est prêt chez ' || nm || ' · ' || new.ref,
      'body', 'La commande est prête : vous pouvez y aller · ההזמנה מוכנה, אפשר לצאת לאסוף'));
  end if;
  return new;
end;
$function$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'orders_courier_ready_push' and tgrelid = 'public.orders'::regclass) then
    create trigger orders_courier_ready_push after update of shop_status on public.orders
      for each row execute function public.orders_courier_ready_push();
  end if;
end $$;
-- Même jour : retrait_docs_needed('autre') = aucun document ; orders_phone_order n'exige plus phone_paid (le livreur avance, max 100 ₪) ;
-- shop_pic renvoie Access-Control-Allow-Origin + Vary: Origin.
