-- « Nouveau commerce » (04/11/2026) : la 1re livraison pour un commerce (commerce partenaire, ou société qui commande
-- comme Bloovi) est marquée first_shop à la création ; le livreur voit « 🆕 1re livraison pour ce commerce », le patron aussi.
alter table public.orders add column if not exists first_shop boolean not null default false;

create or replace function public.orders_zzzz_first_shop() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text := lower(btrim(coalesce(new.company, '')));
begin
  new.first_shop := (new.shop_id is not null or k <> '') and not exists (
    select 1 from orders o
     where ((new.shop_id is not null and o.shop_id = new.shop_id) or (k <> '' and lower(btrim(coalesce(o.company, ''))) = k))
       and o.status not in ('annulee', 'refusee') and (not coalesce(o.is_test, false) or o.status = 'livree'));
  return new;
end;
$$;
-- Dernier déclencheur : le commerce est alors définitif (une commande transformée en achat n'a plus de commerce)
create or replace trigger orders_zzzz_first_shop before insert on public.orders
  for each row execute function public.orders_zzzz_first_shop();

-- Courses en cours : marquées tout de suite
update public.orders n set first_shop = true
 where n.status in ('nouvelle', 'confirmee', 'recuperee') and not n.first_shop
   and (n.shop_id is not null or btrim(coalesce(n.company, '')) <> '')
   and not exists (select 1 from public.orders o
     where o.id <> n.id and o.created_at < n.created_at
       and ((n.shop_id is not null and o.shop_id = n.shop_id)
         or (btrim(coalesce(n.company, '')) <> '' and lower(btrim(coalesce(o.company, ''))) = lower(btrim(n.company))))
       and o.status not in ('annulee', 'refusee') and (not coalesce(o.is_test, false) or o.status = 'livree'));
