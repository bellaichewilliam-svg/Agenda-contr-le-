-- ============================================================================
-- « Prêt dans 15 min » au départ (demande du patron, 04/11/2026) — rien n'est effacé
-- Le client (souvent un commerce qui envoie un colis, ex. Bloovi) dit quand le colis sera prêt :
-- tout de suite, dans 15 min, 30 min ou 1 h. Le livreur le voit (« Prêt à 13:55 ») et arrive à l'heure.
-- Seulement pour une course « dès que possible » ; jamais plus de 3 h ; modifiable ensuite par le patron seul.
-- ============================================================================
alter table public.orders add column if not exists pickup_ready_at timestamptz;

create or replace function public.orders_zy_pickup_ready() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.pickup_ready_at is not null then
      if coalesce(new.urgency, 'asap') = 'programmee' or coalesce(new.shop_sent, false) then
        new.pickup_ready_at := null;
      else
        new.pickup_ready_at := least(greatest(new.pickup_ready_at, now()), now() + interval '3 hours');
        if new.pickup_ready_at < now() + interval '3 minutes' then new.pickup_ready_at := null; end if;
      end if;
    end if;
  elsif new.pickup_ready_at is distinct from old.pickup_ready_at and not public.is_admin() then
    new.pickup_ready_at := old.pickup_ready_at;
  end if;
  return new;
end $$;
create or replace trigger orders_zy_pickup_ready before insert or update of pickup_ready_at on public.orders
  for each row execute function public.orders_zy_pickup_ready();
revoke execute on function public.orders_zy_pickup_ready() from public, anon, authenticated;
