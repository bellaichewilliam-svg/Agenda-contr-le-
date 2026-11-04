-- ============================================================================
-- Règle du patron (04/11/2026) : photo obligatoire seulement pour un dépôt devant la porte (sans contact).
-- Une photo demandée par le client depuis son suivi reste facultative (le livreur l'envoie s'il peut).
-- (appliqué en ligne : migration photo_seulement_sans_contact)
-- ============================================================================
create or replace function public.orders_photo_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'livree' and old.status is distinct from 'livree' and not coalesce(new.is_test, false)
     and coalesce(new.leave_at_door, false)
     and not exists (select 1 from chat_messages m where m.thread = 'o:' || new.id::text
                       and m.author in ('courier', 'admin') and m.image is not null) then
    raise exception 'photo_required';
  end if;
  return new;
end;
$$;
