-- 2e chemin d'envoi des commandes (patron, 15/11/2026) — appliqué en ligne.
-- Un client au Beit Habad (internet filtré « casher ») ne pouvait pas commander : le filtre laissait passer tout le reste
-- mais remplaçait l'envoi de la commande par une page web (« Unexpected token '<' »), sans que rien n'arrive à la base.
-- Quand l'appli reçoit une page web à la place de la réponse, elle renvoie la commande encodée (base64) par cette fonction.
-- La fonction garde le rôle du client (security invoker) : mêmes droits, mêmes contrôles et mêmes déclencheurs que l'envoi normal.
create or replace function public.order_submit(p text) returns void
language plpgsql security invoker set search_path = public as $$
declare j jsonb; cols text;
begin
  j := convert_from(decode(p, 'base64'), 'UTF8')::jsonb;
  if j is null or jsonb_typeof(j) <> 'object' then raise exception 'order_bad'; end if;
  select string_agg(quote_ident(k), ',') into cols
    from jsonb_object_keys(j) k
   where exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'orders' and c.column_name = k);
  if cols is null then raise exception 'order_bad'; end if;
  execute format('insert into public.orders (%1$s) select %1$s from jsonb_populate_record(null::public.orders, $1)', cols) using j;
end $$;
revoke all on function public.order_submit(text) from public;
grant execute on function public.order_submit(text) to anon, authenticated;

-- Même chose sous un nom neutre (c'est celui qu'appelle l'appli : les filtres peuvent bloquer les adresses avec « order »)
create or replace function public.hop_send(p text) returns void
language sql security invoker set search_path = public as $$
  select public.order_submit(p);
$$;
revoke all on function public.hop_send(text) from public;
grant execute on function public.hop_send(text) to anon, authenticated;
