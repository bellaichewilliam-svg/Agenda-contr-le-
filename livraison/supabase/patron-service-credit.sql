-- ============================================================================
-- Règles du patron (04/11/2026) — rien n'est effacé
--  1) Ouvert / fermé selon SON service, pas selon les horaires des magasins :
--     le patron passe en service → HOP! prend les commandes immédiates (settings.accepting = vrai) ;
--     il termine son service → « Fermé pour le moment » (les clients peuvent programmer).
--     « Je suis complet » reste possible à la main pendant le service.
--     Les boutiques HOP! (Carrefour, BOOOM) n'utilisent plus les horaires du magasin
--     (gardés dans shops.hours_store, pour les remettre un jour si besoin).
--  2) Crédit de départ des livreurs : 25 ₪ (au lieu de 50), aussi pour les livreurs déjà validés
--     (leur crédit offert de 50 ₪, pas encore utilisé, passe à 25 ₪).
--  3) Le patron peut retirer du crédit à un livreur (correction, crédit offert en trop…).
-- ============================================================================

-- 1) Service du patron = ouverture de HOP!
create or replace function public.couriers_boss_duty() returns trigger
language plpgsql security definer set search_path = public as $$
declare only_boss boolean;
begin
  if new.role = 'admin' and new.online is distinct from old.online then
    select coalesce(boss_only, false) into only_boss from settings where id = 1;
    update settings
       set accepting = coalesce(new.online, false)
           or exists (select 1 from couriers c where c.id <> new.id and c.online and c.status = 'actif'
                        and (c.role = 'admin' or not only_boss))
     where id = 1;
  end if;
  return new;
end $$;
create or replace trigger couriers_boss_duty after update of online on public.couriers
  for each row execute function public.couriers_boss_duty();
revoke execute on function public.couriers_boss_duty() from public, anon, authenticated;

alter table public.shops add column if not exists hours_store jsonb;
update public.shops set hours_store = hours where code in ('HOPCARREFOUR', 'HOPBOOOM') and hours_store is null and hours is not null;
update public.shops set hours = null where code in ('HOPCARREFOUR', 'HOPBOOOM') and hours is not null;

-- État actuel : ouvert si le patron est déjà en service
update public.settings set accepting = exists (select 1 from couriers where role = 'admin' and online) where id = 1;

-- 2) Crédit de départ : 25 ₪
update public.settings set welcome_credit = 25 where id = 1 and welcome_credit <> 25;
update public.courier_topups set amount = 25
 where note = 'Crédit de départ offert' and status = 'ok' and amount = 50;

-- 3) Retirer du crédit à un livreur (enregistré comme une retenue, message clair au livreur)
create or replace function public.admin_credit_remove(p_courier uuid, p_amount numeric, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid; why text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 2000 then raise exception 'bad_amount'; end if;
  why := left(coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Crédit ajusté par HOP'), 300);
  insert into courier_penalties (courier_id, amount, reason) values (p_courier, round(p_amount, 2), why) returning id into pid;
  insert into chat_messages (thread, author, author_name, body)
  values ('c:' || p_courier::text, 'admin', 'HOP!', '➖ ' || round(p_amount, 2) || ' ₪ retirés de votre crédit HOP : ' || why || '.');
  return pid;
end $$;
revoke execute on function public.admin_credit_remove(uuid, numeric, text) from public, anon;
grant execute on function public.admin_credit_remove(uuid, numeric, text) to authenticated;
