-- 21/11 (patron : « une sécurité automatique ») : un catalogue ne doit pas dépasser 150 Ko (le magasin s'ouvrirait lentement).
-- Chaque nuit (4 h 30 Israël, tâche hop-catalog-guard) : au-dessus de 149,5 Ko, on allège, sans rien effacer :
--   1) les produits déjà hors vente perdent leur photo et leur texte (gardés dans catalog_guard_backup) ;
--   2) si besoin, 2 par 2, une variante d'une marque très présente passe hors vente (ex. le 9ᵉ parfum Schweppes),
--      jamais un produit ajouté à la main, jamais une marque qui a moins de 4 produits.
-- Pour remettre : catalog_guard_backup garde la photo, le texte et l'état d'avant.
-- Migrations appliquées : catalogue_garde_fou, catalogue_garde_fou_149, catalogue_garde_fou_doux (version ci-dessous).
-- 1er passage (21/11) : Carrefour 150,1 Ko → 149,5 Ko (8 parfums Schweppes hors vente ; Coca-Cola, Fanta… restés en vente).
create table if not exists public.catalog_guard_backup (id bigserial primary key, product_id uuid not null, shop_code text, photo_url text, photo text,
  description text, was_available boolean, at timestamptz not null default now());
alter table public.catalog_guard_backup enable row level security;
-- (définitions de catalog_guard(text, int) et catalog_guard_all() : voir la migration catalogue_garde_fou_doux)
select cron.schedule('hop-catalog-guard', '30 2 * * *', 'select public.catalog_guard_all()');
