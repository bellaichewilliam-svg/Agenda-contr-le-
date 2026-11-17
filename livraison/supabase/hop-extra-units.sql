-- Boutiques HOP! : articles écrits par le client (hors catalogue), comptés comme les autres (6 compris, puis 2 ₪ l'article :
-- 1 ₪ livreur, 1 ₪ HOP!) et dans la place du top case (2 places chacun) — accord du patron du 17/11/2026.
-- (appliqué en ligne : migration hop_buy_extra_units ; reprend orders_zzz_hop_buy de hop-boutiques-achat.sql)
alter table public.orders add column if not exists extra_units int;
-- Voir la migration en ligne pour le corps complet de public.orders_zzz_hop_buy() (ex := extra_units, ajouté à units et places).
-- courier_buy_check (migration courier_buy_check_extra_units) : u0 et u1 incluent extra_units, pour que le seuil des
-- 6 articles compris reste juste quand le livreur coche « Manquant ».
