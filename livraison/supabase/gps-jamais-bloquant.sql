-- ============================================================================
-- Règle du patron (04/11/2026) : le GPS ne bloque plus jamais un livreur sur place.
-- (appliqué en ligne : migration gps_jamais_bloquant ; patron : couriers.unlocked_until = 2099-12-31)
-- S'il dit « trop loin », le livreur peut « valider quand même » (courier_update_force) ; c'est noté sur la course
-- (orders.gps_forced : étape, heure, distance, âge du GPS), visible du patron. Photo devant la porte, code de remise
-- et paiement restent exigés.
-- ============================================================================
alter table public.orders add column if not exists gps_forced jsonb;

do $mig$
declare d text; d2 text;
begin
  d := pg_get_functiondef('public.courier_update(uuid,text)'::regprocedure);
  d2 := replace(d, 'coalesce(o.pickup_exact, true) and c.role <> ''admin''',
                   'coalesce(o.pickup_exact, true) and c.role <> ''admin'' and coalesce(current_setting(''hop.gps_force'', true), '''') <> ''1''');
  d2 := replace(d2, 'coalesce(o.dropoff_exact, true) and c.role <> ''admin''',
                    'coalesce(o.dropoff_exact, true) and c.role <> ''admin'' and coalesce(current_setting(''hop.gps_force'', true), '''') <> ''1''');
  if (length(d2) - length(replace(d2, 'hop.gps_force', ''))) / length('hop.gps_force') <> 2 then
    raise exception 'courier_update : remplacement inattendu';
  end if;
  execute d2;
  d := pg_get_functiondef('public.orders_recup_on_site()'::regprocedure);
  d2 := replace(d, 'coalesce(new.pickup_exact, true) and not coalesce(new.unlocked, false)',
                   'coalesce(new.pickup_exact, true) and not coalesce(new.unlocked, false) and coalesce(current_setting(''hop.gps_force'', true), '''') <> ''1''');
  if position('hop.gps_force' in d2) = 0 then raise exception 'orders_recup_on_site : remplacement inattendu'; end if;
  execute d2;
end
$mig$;

create or replace function public.courier_update_force(p_id uuid, p_action text) returns boolean
language plpgsql security definer set search_path = public as $$
declare o orders; c couriers; m int; pre text;
begin
  if not public.is_active_courier() or p_action not in ('arrivee', 'recuperee', 'livree') then return false; end if;
  select * into o from orders where id = p_id and courier_id = auth.uid();
  if not found then return false; end if;
  select * into c from couriers where id = auth.uid();
  pre := case when p_action = 'livree' then 'dropoff' else 'pickup' end;
  m := case when c.lat is null then null
            when pre = 'pickup' and o.pickup_lat is not null then round(6371000 * sqrt(radians(c.lat - o.pickup_lat) ^ 2 + (radians(c.lon - o.pickup_lon) * cos(radians(o.pickup_lat))) ^ 2))
            when pre = 'dropoff' and o.dropoff_lat is not null then round(6371000 * sqrt(radians(c.lat - o.dropoff_lat) ^ 2 + (radians(c.lon - o.dropoff_lon) * cos(radians(o.dropoff_lat))) ^ 2)) end;
  update orders set gps_forced = coalesce(gps_forced, '[]'::jsonb)
         || jsonb_build_array(jsonb_build_object('step', p_action, 'at', now(), 'm', m,
                                                 'gps_age_s', case when c.position_at is null then null else round(extract(epoch from now() - c.position_at)) end))
   where id = p_id;
  perform set_config('hop.gps_force', '1', true);
  return public.courier_update(p_id, p_action);
end $$;
revoke execute on function public.courier_update_force(uuid, text) from public, anon;
grant execute on function public.courier_update_force(uuid, text) to authenticated;

-- Le patron n'est jamais contrôlé par le GPS (ni dans l'appli, ni dans la base)
update public.couriers set unlocked_until = '2099-12-31' where role = 'admin' and (unlocked_until is null or unlocked_until < '2099-12-31');
