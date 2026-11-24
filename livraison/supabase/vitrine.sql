-- Vitrines « menu éclaté » des restaurants (patron, 24/11) : une page très personnelle par enseigne (ses couleurs, ses plats
-- détourés, leurs ingrédients qui volent autour). Les noms, prix et descriptions viennent du catalogue (shop_products) ;
-- ici seulement la mise en scène. Le client touche un ingrédient pour l'enlever (« sans oignons », clé off = mod de l'appli)
-- ou ajoute une sauce (add = un produit du catalogue). Création seulement, aucune donnée supprimée.
create table if not exists public.shop_vitrine (
  shop_id uuid primary key references public.shops(id),
  cfg jsonb not null,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.shop_vitrine enable row level security;

create or replace function public.shop_vitrine(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select v.cfg from public.shop_vitrine v join public.shops s on s.id = v.shop_id
  where s.code = upper(p_code) and v.published and s.status = 'actif'
$$;
grant execute on function public.shop_vitrine(text) to anon, authenticated;

-- Smash It (casher viande : aucune image ni mot laitier ; « cheddar végétal » vient du menu du restaurant)
insert into public.shop_vitrine (shop_id, cfg, published)
select s.id, jsonb_build_object(
  'colors', jsonb_build_object('dark', '#16100C', 'ink', '#FFFFFF'),
  'words', jsonb_build_object('fr', jsonb_build_array('Smashé', 'Croustillant', 'Juteux', 'Fait maison', 'Brioché', 'Grillé', 'Casher', 'Généreux'),
                              'he', jsonb_build_array('סמאש', 'קריספי', 'עסיסי', 'תוצרת בית', 'בריוש', 'על הגריל', 'כשר', 'נדיב')),
  'dishes', jsonb_build_array(
    jsonb_build_object('product', 'c9f6da07-9925-4f7e-872b-e2e038d73890', 'img', 'img/smashit/burger-royal.webp', 'bg', '#F2B21B', 'w', 230,
      'tags', jsonb_build_object('fr', jsonb_build_array('Best-seller', '2 × 110 g'), 'he', jsonb_build_array('הכי נמכר', '2 × 110 גר׳')),
      'ing', jsonb_build_array(
        jsonb_build_object('img', 'img/smashit/pain.webp', 'w', 118, 'x', -148, 'y', -104, 'r', -14),
        jsonb_build_object('img', 'img/smashit/steak.webp', 'w', 118, 'x', 142, 'y', -92, 'r', 10),
        jsonb_build_object('img', 'img/smashit/pickles.webp', 'w', 80, 'x', -146, 'y', 64, 'r', 10, 'front', 1, 'off', 'pickle'),
        jsonb_build_object('img', 'img/smashit/oignon.webp', 'w', 86, 'x', 142, 'y', 70, 'r', -12, 'front', 1, 'off', 'onion'),
        jsonb_build_object('img', 'img/smashit/aioli.webp', 'w', 74, 'x', -20, 'y', 136, 'r', 0, 'front', 1, 'add', 'ddefcc91-f66e-4145-a01a-f871fcbc9d05'))),
    jsonb_build_object('product', '66879ca1-d5e0-4ad6-b529-eec7163ea6dd', 'img', 'img/smashit/onion-rings.webp', 'bg', '#E2552B', 'w', 220,
      'tags', jsonb_build_object('fr', jsonb_build_array('Extra croustillant', 'Tempura'), 'he', jsonb_build_array('קריספי במיוחד', 'טמפורה')),
      'ing', jsonb_build_array(
        jsonb_build_object('img', 'img/smashit/oignon.webp', 'w', 96, 'x', -146, 'y', -92, 'r', -16),
        jsonb_build_object('img', 'img/smashit/aioli.webp', 'w', 92, 'x', 146, 'y', -80, 'r', 0, 'add', 'ddefcc91-f66e-4145-a01a-f871fcbc9d05'),
        jsonb_build_object('img', 'img/smashit/chili.webp', 'w', 86, 'x', 136, 'y', 100, 'r', 0, 'front', 1, 'add', '4d870593-1c9c-4341-a688-3b380b302882'))),
    jsonb_build_object('product', '5456f3d1-86ce-446c-b853-3f5b7f33f998', 'img', 'img/smashit/frites.webp', 'bg', '#3E8E5A', 'w', 230,
      'tags', jsonb_build_object('fr', jsonb_build_array('Coupées épaisses', 'Crispy'), 'he', jsonb_build_array('חתוך עבה', 'קריספי')),
      'ing', jsonb_build_array(
        jsonb_build_object('img', 'img/smashit/aioli.webp', 'w', 94, 'x', -146, 'y', -88, 'r', 0, 'add', 'ddefcc91-f66e-4145-a01a-f871fcbc9d05'),
        jsonb_build_object('img', 'img/smashit/chili.webp', 'w', 90, 'x', 146, 'y', -82, 'r', 0, 'add', '4d870593-1c9c-4341-a688-3b380b302882'))),
    jsonb_build_object('product', '13ca48aa-34dd-4d53-b2af-ec317e986fc9', 'img', 'img/smashit/wings.webp', 'bg', '#7A3E1D', 'w', 240,
      'tags', jsonb_build_object('fr', jsonb_build_array('10 pièces', 'Croustillant'), 'he', jsonb_build_array('10 יחידות', 'קריספי')),
      'ing', jsonb_build_array(
        jsonb_build_object('img', 'img/smashit/chili.webp', 'w', 94, 'x', -146, 'y', -86, 'r', 0, 'add', '4d870593-1c9c-4341-a688-3b380b302882'),
        jsonb_build_object('img', 'img/smashit/aioli.webp', 'w', 90, 'x', 146, 'y', -82, 'r', 0, 'add', 'ddefcc91-f66e-4145-a01a-f871fcbc9d05')))
  )), true
from public.shops s where s.code = 'SMASHIT'
on conflict (shop_id) do nothing;
