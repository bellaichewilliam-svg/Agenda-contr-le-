-- 20/11 (patron) : un livreur qui a déjà une course n'entend sonner que les courses qu'il peut vraiment ajouter
-- (sur son chemin : public.on_way, les mêmes règles que la liste de l'appli). Les livreurs libres entendent tout.
-- Utilisée par la fonction hop-push (onDuty) avant d'envoyer la sonnerie « Nouvelle course ».
create or replace function public.ring_filter(p_order uuid, p_ids uuid[]) returns uuid[]
language plpgsql stable security definer set search_path = public as $f$
declare o orders; res uuid[] := '{}'; c uuid;
begin
  select * into o from orders where id = p_order;
  if not found then return p_ids; end if;
  foreach c in array coalesce(p_ids, '{}'::uuid[]) loop
    if not exists (select 1 from orders x where x.courier_id = c and x.status in ('confirmee', 'recuperee') and x.id <> p_order)
       or (o.urgency is distinct from 'express' and public.on_way(c, o)) then
      res := res || c;
    end if;
  end loop;
  return res;
end $f$;
revoke all on function public.ring_filter(uuid, uuid[]) from public, anon, authenticated;
