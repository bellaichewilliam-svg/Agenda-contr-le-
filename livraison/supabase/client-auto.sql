-- 09/11 : le compte client se crée tout seul à la 1re commande (mot de passe au hasard, connu de personne) ;
-- le client peut ensuite choisir son mot de passe depuis ce téléphone (pour retrouver son compte ailleurs)
create or replace function public.client_set_password(p_key text, p_password text) returns boolean
language plpgsql security definer set search_path = public as $$
declare cid uuid := public.client_of(p_key);
begin
  if cid is null then raise exception 'no_session'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'weak_password'; end if;
  update clients set pass_hash = extensions.crypt(p_password, extensions.gen_salt('bf', 8)), fails = 0, locked_until = null where id = cid;
  return true;
end $$;
grant execute on function public.client_set_password(text, text) to anon, authenticated;
