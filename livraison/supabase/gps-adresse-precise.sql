-- ============================================================================
-- Règle du 04/11/2026 (appliquée en ligne : migration gps_check_adresse_precise_seulement)
-- Le contrôle « vous êtes bien sur place » (Je suis arrivé, Colis récupéré, Livré) ne s'applique que si l'adresse
-- a été placée précisément sur la carte (pickup_exact / dropoff_exact), et jamais au patron.
-- Cas réel : « הפינה האדומה - רוטנברג 12 » placée au centre de Netanya (adresse approximative) : le patron, arrivé
-- au vrai magasin à 4,6 km de ce point, ne pouvait pas valider « Je suis arrivé ».
-- ============================================================================
do $mig$
declare d text; d2 text;
begin
  d := pg_get_functiondef('public.courier_update(uuid,text)'::regprocedure);
  d2 := replace(d, 'and o.pickup_lat is not null and o.pickup_near is null',
                   'and o.pickup_lat is not null and o.pickup_near is null and coalesce(o.pickup_exact, true) and c.role <> ''admin''');
  d2 := replace(d2, 'and st.id = 1 and o.dropoff_lat is not null',
                    'and st.id = 1 and o.dropoff_lat is not null and coalesce(o.dropoff_exact, true) and c.role <> ''admin''');
  if position('coalesce(o.pickup_exact, true)' in d2) = 0 or position('coalesce(o.dropoff_exact, true)' in d2) = 0 then
    raise exception 'courier_update : remplacement inattendu';
  end if;
  execute d2;

  d := pg_get_functiondef('public.orders_recup_on_site()'::regprocedure);
  d2 := replace(d, 'and new.pickup_near is null and not coalesce(new.unlocked, false)',
                   'and new.pickup_near is null and coalesce(new.pickup_exact, true) and not coalesce(new.unlocked, false)');
  d2 := replace(d2, 'and c.role in (''coursier'', ''admin'') and c.id = new.courier_id',
                    'and c.role = ''coursier'' and c.id = new.courier_id');
  if position('coalesce(new.pickup_exact, true)' in d2) = 0 or position('c.role = ''coursier'' and c.id = new.courier_id' in d2) = 0 then
    raise exception 'orders_recup_on_site : remplacement inattendu';
  end if;
  execute d2;
end
$mig$;
