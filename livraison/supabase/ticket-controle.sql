-- ============================================================================
-- Contrôle des tickets de caisse (patron, 15/11/2026) : un ticket au-dessus de 120 % du prévu (+5 ₪) — photo retouchée,
-- prix gonflé… — envoie tout de suite une notification au patron (« 🧾 Ticket à vérifier ») et reste dans ticket_flags
-- (historique par livreur, 30 jours). Côté appli livreur : la photo doit être prise à l'instant (pas une image de la galerie).
-- (en ligne, appliqué le 15/11)
-- ============================================================================
create table if not exists public.ticket_flags (
  order_id uuid primary key, courier_id uuid, courier_name text, spent numeric, expected numeric, at timestamptz not null default now(), checked boolean not null default false);
alter table public.ticket_flags enable row level security;
create or replace function public.orders_ticket_check() returns trigger language plpgsql security definer set search_path = public as $$
declare exp numeric; n int;
begin
  if new.goods_spent is null or new.goods_spent is not distinct from old.goods_spent then return new; end if;
  exp := coalesce(nullif(new.items_total, 0), nullif(new.goods_budget, 0));
  if exp is null or new.goods_spent <= exp * 1.2 + 5 then return new; end if;
  insert into ticket_flags (order_id, courier_id, courier_name, spent, expected)
    values (new.id, new.courier_id, new.courier_name, new.goods_spent, exp)
    on conflict (order_id) do update set spent = excluded.spent, expected = excluded.expected, at = now(), checked = false;
  select count(*) into n from ticket_flags where courier_id = new.courier_id and at > now() - interval '30 days';
  perform public.boss_push('🧾 Ticket à vérifier',
    coalesce(new.courier_name, 'Livreur') || ' : ticket ' || replace(new.goods_spent::text, '.00', '') || ' ₪ pour ≈ ' || round(exp)::text
      || ' ₪ prévus (+' || round((new.goods_spent / exp - 1) * 100) || ' %).' || case when n > 1 then E'\n' || n || ' tickets au-dessus du prévu en 30 jours.' else '' end
      || E'\nRegardez la photo du ticket dans la course.', 'hop-ticket');
  return new;
exception when others then return new;
end $$;
create or replace trigger orders_ticket_check after update of goods_spent on public.orders for each row execute function public.orders_ticket_check();
