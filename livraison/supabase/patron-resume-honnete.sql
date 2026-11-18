-- 18/11 (patron) : résumé du soir honnête. « Commande commencée » = le client a vraiment fait quelque chose
-- (article ajouté, « Continuer » appuyé, ajout depuis l'accueil ou les promos), plus seulement « page d'un magasin ouverte ».
-- Les simples visites de magasins sont comptées à part ; le blocage est dit en mots simples.
create or replace function public.boss_daily_summary() returns text
language plpgsql security definer set search_path = public as $function$
declare d0 timestamptz := date_trunc('day', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem';
  n_all int; n_ok int; n_ko int; n_run int; ca numeric; vis int; shp int; st int; sent int; blk text; blk_n int; body text;
begin
  select count(*), count(*) filter (where status = 'livree'), count(*) filter (where status in ('annulee', 'refusee')),
         count(*) filter (where status in ('nouvelle', 'confirmee', 'recuperee')), coalesce(sum(price) filter (where status = 'livree'), 0)
    into n_all, n_ok, n_ko, n_run, ca
    from orders o where created_at >= d0 and not coalesce((to_jsonb(o)->>'is_test')::boolean, false);
  select count(distinct session) filter (where kind = 'view'),
         count(distinct session) filter (where kind = 'shop_view'),
         count(distinct session) filter (where kind in ('cart_add', 'order_block', 'home_magic_add', 'promos_all_add', 'order_sent') or kind like 'order_step_%'),
         count(distinct session) filter (where kind = 'order_sent')
    into vis, shp, st, sent from site_all where created_at >= d0 and visitor not in (select visitor from staff_visitors);
  select page, count(distinct session) into blk, blk_n from site_all
   where created_at >= d0 and kind = 'order_block' and visitor not in (select visitor from staff_visitors)
   group by page order by count(distinct session) desc limit 1;
  blk := case when blk is null then null
              when blk ~* 'catalogBox|cartEmpty' then 'panier vide (appuie sur Continuer sans article)'
              when blk ~* 'address|number' then 'l''adresse'
              when blk ~* 'phone' then 'le téléphone'
              when blk ~* 'contact_name' then 'le prénom'
              when blk ~* 'adult' then 'la case 18 ans'
              when blk ~* 'kind|floor|apt|code|sum-' then 'la porte (type de lieu, étage, code)'
              when blk ~* 'ready' then 'l''heure où la commande sera prête'
              when blk ~* 'what_item' then '« ce qu''on transporte »'
              when blk ~* '^send:' then 'l''envoi de la commande (erreur)'
              else blk end || ' · ' || blk_n || ' client' || case when blk_n > 1 then 's' else '' end;
  body := n_all || ' commande' || case when n_all > 1 then 's' else '' end || ' · ' || n_ok || ' livrée' || case when n_ok > 1 then 's' else '' end
    || case when n_run > 0 then ' · ' || n_run || ' en cours' else '' end || case when n_ko > 0 then ' · ' || n_ko || ' annulée' || case when n_ko > 1 then 's' else '' end else '' end
    || E'\n💰 Livraisons : ' || round(ca) || ' ₪'
    || E'\n👀 ' || vis || ' visite' || case when vis > 1 then 's' else '' end
    || case when shp > 0 then ' · ' || shp || ' ont regardé un magasin' else '' end
    || E'\n🛒 ' || st || ' commande' || case when st > 1 then 's' else '' end || ' commencée' || case when st > 1 then 's' else '' end
    || ' · ' || sent || ' envoyée' || case when sent > 1 then 's' else '' end
    || case when st > sent then E'\n🚪 ' || (st - sent) || ' client' || case when st - sent > 1 then 's' else '' end || ' parti' || case when st - sent > 1 then 's' else '' end || ' en cours de commande' else '' end
    || case when blk is not null then E'\n⚠️ Blocage : ' || blk else '' end;
  perform public.boss_push('📊 HOP! · votre journée', body, 'hop-jour');
  return body;
end;
$function$;
revoke all on function public.boss_daily_summary() from public, anon, authenticated;
