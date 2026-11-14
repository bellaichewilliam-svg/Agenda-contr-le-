-- 14/11 : site_track accepte aussi « voice_mic » (étapes de la voix de Hoppy : ouvert, micro, enregistré, envoyé, erreur),
-- rangé dans site_steps (colonne page = l'étape). Aucun son, aucune donnée perso : on voit seulement où un téléphone bloque.
create or replace function public.site_track(p jsonb) returns void
language plpgsql security definer set search_path = public as $function$
declare s text := left(coalesce(p->>'session', ''), 40); k text := p->>'kind';
begin
  if length(s) < 8 or length(coalesce(p->>'visitor', '')) < 8
     or k not in ('view', 'order_start', 'order_sent', 'shop_view', 'cart_add', 'order_step_2', 'order_step_3', 'order_block', 'wa_list', 'voice_mic') then return; end if;
  if (select count(*) from site_all where session = s and created_at > now() - interval '1 hour') >= 200 then return; end if;
  if k in ('view', 'order_start', 'order_sent', 'shop_view') then
    insert into site_events (visitor, session, kind, page, source, medium, campaign, first_source, ref_host, device, lang, app, shop_code, order_ref, amount)
    values (left(p->>'visitor', 40), s, k, left(p->>'page', 40), left(lower(p->>'source'), 60), left(lower(p->>'medium'), 40), left(p->>'campaign', 60),
            left(lower(p->>'first_source'), 60), left(lower(p->>'ref_host'), 80), left(p->>'device', 12), left(p->>'lang', 4),
            coalesce((p->>'app')::boolean, false), left(upper(p->>'shop_code'), 30), left(p->>'order_ref', 30),
            case when (p->>'amount') ~ '^[0-9]+(\.[0-9]+)?$' then least((p->>'amount')::numeric, 100000) end);
  else
    insert into site_steps (visitor, session, kind, page, source, medium, campaign, first_source, ref_host, device, lang, app, shop_code, order_ref, amount)
    values (left(p->>'visitor', 40), s, k, left(p->>'page', 40), left(lower(p->>'source'), 60), left(lower(p->>'medium'), 40), left(p->>'campaign', 60),
            left(lower(p->>'first_source'), 60), left(lower(p->>'ref_host'), 80), left(p->>'device', 12), left(p->>'lang', 4),
            coalesce((p->>'app')::boolean, false), left(upper(p->>'shop_code'), 30), left(p->>'order_ref', 30), null);
  end if;
end;
$function$;
