-- 15/11 (patron : « absolument ») : le client est prévenu à CHAQUE étape, sans durée chiffrée.
-- Il recevait déjà : livreur trouvé (confirmee), en route avec la commande (recuperee), livré (livree).
-- En plus : « votre livreur est au magasin / sur place » (arrived_at) et « votre livreur arrive » (à moins de 250 m de chez lui).
-- Passe par la fonction de notifications déjà en ligne (événement « notice ») : rien à redéployer. Une erreur d'envoi ne bloque
-- jamais le livreur (tout est sous « exception »).
alter table public.orders add column if not exists near_push_at timestamptz;

create or replace function public.orders_client_push_arrived() returns trigger
language plpgsql security definer set search_path = public as $function$
declare he boolean; shop boolean;
begin
  if new.arrived_at is not null and old.arrived_at is null and new.status = 'confirmee'
     and exists (select 1 from client_push_subs s where s.order_token = new.token or s.phone = public.phone_digits(new.contact_phone)) then
    begin
      he := new.lang = 'he';
      shop := new.service = 'achat' or coalesce(new.shop_name, '') <> '';
      perform public.push_call(jsonb_build_object('client_order', new.id, 'event', 'notice',
        'title', case when he then case when shop then '🏪 השליח שלכם מהופ! הגיע לחנות' else '📍 השליח שלכם מהופ! הגיע לנקודת האיסוף' end
                      else case when shop then '🏪 Votre livreur HOP! est au magasin' else '📍 Votre livreur HOP! est sur place' end end,
        'body', case when he then 'הוא אוסף את ההזמנה ואז יוצא אליכם · ' else 'Il récupère votre commande, puis il vient chez vous · ' end || coalesce(new.ref, '')));
    exception when others then null;
    end;
  end if;
  return new;
end;
$function$;
create or replace trigger orders_client_push_arrived after update of arrived_at on public.orders
  for each row execute function public.orders_client_push_arrived();

create or replace function public.couriers_near_push() returns trigger
language plpgsql security definer set search_path = public as $function$
declare o record;
begin
  if new.lat is null or new.lon is null or (new.lat is not distinct from old.lat and new.lon is not distinct from old.lon) then return new; end if;
  begin
    for o in select id, ref, lang, token, contact_phone from orders
              where courier_id = new.id and status = 'recuperee' and near_push_at is null and dropoff_lat is not null and dropoff_lon is not null
                and 111320 * sqrt(power(dropoff_lat - new.lat, 2) + power((dropoff_lon - new.lon) * cos(radians(new.lat)), 2)) < 250
    loop
      update orders set near_push_at = now() where id = o.id and near_push_at is null;
      if exists (select 1 from client_push_subs s where s.order_token = o.token or s.phone = public.phone_digits(o.contact_phone)) then
        perform public.push_call(jsonb_build_object('client_order', o.id, 'event', 'notice',
          'title', case when o.lang = 'he' then '🛵 השליח שלכם מהופ! מגיע!' else '🛵 Votre livreur HOP! arrive !' end,
          'body', case when o.lang = 'he' then 'הוא ממש קרוב אליכם · ' else 'Il est tout près de chez vous · ' end || coalesce(o.ref, '')));
      end if;
    end loop;
  exception when others then null;
  end;
  return new;
end;
$function$;
create or replace trigger couriers_near_push after update of lat, lon on public.couriers
  for each row execute function public.couriers_near_push();
