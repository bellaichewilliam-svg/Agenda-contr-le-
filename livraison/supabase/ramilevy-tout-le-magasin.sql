
-- ============================================================================
-- Recherche « dans tout le magasin Rami Lévy » (patron, 10/11/2026 : « rien ne doit manquer », ex. le couscous).
-- Tout le magasin (13 748 produits, prix officiel du magasin 037 Netanya Nord, sans alcool ni tabac) dans rami_items,
-- cherché côté serveur (jamais envoyé en entier au téléphone). Français → hébreu : dictionnaire des courses (rl_dict)
-- + search_synonyms_all(). Un produit trouvé s'ajoute à la commande comme ligne « à prendre » (le livreur l'achète,
-- prix ≈ affiché) ; photo Rami Lévy par lien (code-barres).
-- Données : livraison/data/ramilevy-prix.json → rami_items_fetch() puis rami_items_import().
-- ============================================================================
create table if not exists public.rami_items (code text primary key, he text not null, price numeric not null, weighted boolean not null default false,
  updated_at timestamptz not null default now());
alter table public.rami_items enable row level security;
create table if not exists public.rl_dict (fr text primary key, he text[] not null);
alter table public.rl_dict enable row level security;
insert into public.rl_dict (fr, he) values
  ('couscous', array['קוסקוס']),
  ('semoule', array['סולת']),
  ('farine', array['קמח']),
  ('lentilles', array['עדשים']),
  ('pois chiches', array['חומוס','גרגרי חומוס']),
  ('houmous', array['חומוס']),
  ('haricots', array['שעועית']),
  ('petits pois', array['אפונה']),
  ('thon', array['טונה']),
  ('sardines', array['סרדינים']),
  ('saumon', array['סלמון']),
  ('poisson', array['דג','דגים']),
  ('poulet', array['עוף','פרגית']),
  ('dinde', array['הודו']),
  ('boeuf', array['בקר']),
  ('viande', array['בשר']),
  ('viande hachee', array['בשר טחון','טחון']),
  ('saucisses', array['נקניקיות']),
  ('saucisson', array['נקניק','סלמי']),
  ('schnitzel', array['שניצל']),
  ('oeufs', array['ביצים']),
  ('lait', array['חלב']),
  ('creme', array['שמנת']),
  ('fromage', array['גבינה','גבינת']),
  ('fromage blanc', array['גבינה לבנה']),
  ('cottage', array['קוטג']),
  ('yaourt', array['יוגורט']),
  ('beurre', array['חמאה']),
  ('margarine', array['מרגרינה']),
  ('pain', array['לחם']),
  ('pita', array['פיתה','פיתות']),
  ('baguette', array['באגט']),
  ('hallah', array['חלה']),
  ('challah', array['חלה']),
  ('riz', array['אורז']),
  ('pates', array['פסטה','ספגטי','אטריות']),
  ('spaghetti', array['ספגטי']),
  ('nouilles', array['אטריות','נודלס']),
  ('ptitim', array['פתיתים']),
  ('quinoa', array['קינואה']),
  ('boulgour', array['בורגול']),
  ('flocons d''avoine', array['שיבולת שועל']),
  ('cereales', array['דגני בוקר','קורנפלקס']),
  ('sucre', array['סוכר']),
  ('sel', array['מלח']),
  ('poivre', array['פלפל שחור']),
  ('huile', array['שמן']),
  ('huile d''olive', array['שמן זית']),
  ('vinaigre', array['חומץ']),
  ('moutarde', array['חרדל']),
  ('ketchup', array['קטשופ']),
  ('mayonnaise', array['מיונז']),
  ('tahina', array['טחינה']),
  ('tehina', array['טחינה']),
  ('confiture', array['ריבה']),
  ('miel', array['דבש']),
  ('pate a tartiner', array['ממרח']),
  ('nutella', array['נוטלה']),
  ('chocolat', array['שוקולד']),
  ('biscuits', array['עוגיות','ביסקוויט']),
  ('gateau', array['עוגה']),
  ('bonbons', array['סוכריות']),
  ('chips', array['צ''יפס','תפוצ''יפס']),
  ('bamba', array['במבה']),
  ('bissli', array['ביסלי']),
  ('cafe', array['קפה']),
  ('the', array['תה']),
  ('cacao', array['קקאו','שוקו']),
  ('jus', array['מיץ']),
  ('eau', array['מים']),
  ('soda', array['סודה','משקה']),
  ('coca', array['קוקה קולה','קולה']),
  ('tomate', array['עגבני']),
  ('tomates', array['עגבניות']),
  ('concentre de tomates', array['רסק עגבניות']),
  ('sauce tomate', array['רוטב עגבניות']),
  ('concombre', array['מלפפון']),
  ('cornichons', array['מלפפונים חמוצים','חמוצים']),
  ('olives', array['זיתים']),
  ('mais', array['תירס']),
  ('champignons', array['פטריות']),
  ('oignon', array['בצל']),
  ('ail', array['שום']),
  ('pomme de terre', array['תפוח אדמה','תפו"א']),
  ('pommes', array['תפוח','תפוחים']),
  ('bananes', array['בננה','בננות']),
  ('oranges', array['תפוז','תפוזים']),
  ('citron', array['לימון']),
  ('avocat', array['אבוקדו']),
  ('carottes', array['גזר']),
  ('salade', array['חסה','סלט']),
  ('poivron', array['פלפל']),
  ('courgette', array['קישוא']),
  ('aubergine', array['חציל']),
  ('fruits', array['פירות']),
  ('legumes', array['ירקות']),
  ('surgele', array['קפוא','קפואה','קפואים']),
  ('glace', array['גלידה']),
  ('pizza', array['פיצה']),
  ('bourekas', array['בורקס']),
  ('levure', array['שמרים']),
  ('bicarbonate', array['סודה לשתייה']),
  ('epices', array['תבלין','תבלינים']),
  ('paprika', array['פפריקה']),
  ('cumin', array['כמון']),
  ('curcuma', array['כורכום']),
  ('cannelle', array['קינמון']),
  ('vanille', array['וניל']),
  ('soupe', array['מרק']),
  ('bouillon', array['מרק','אבקת מרק']),
  ('couches', array['חיתולים']),
  ('lingettes', array['מגבונים']),
  ('papier toilette', array['נייר טואלט']),
  ('essuie-tout', array['מגבות נייר']),
  ('mouchoirs', array['ממחטות','טישו']),
  ('lessive', array['כביסה','אבקת כביסה','ג''ל כביסה']),
  ('assouplissant', array['מרכך כביסה']),
  ('liquide vaisselle', array['נוזל כלים','סבון כלים']),
  ('javel', array['אקונומיקה']),
  ('shampooing', array['שמפו']),
  ('savon', array['סבון']),
  ('gel douche', array['תחליב רחצה','אל סבון']),
  ('dentifrice', array['משחת שיניים']),
  ('brosse a dents', array['מברשת שיניים']),
  ('deodorant', array['דאודורנט','דאו']),
  ('sacs poubelle', array['שקיות אשפה']),
  ('aluminium', array['נייר כסף','רדיד']),
  ('piles', array['סוללות']),
  ('croquettes', array['מזון לחתולים','מזון לכלבים']),
  ('chat', array['חתולים']),
  ('chien', array['כלבים']),
  ('halva', array['חלבה']),
  ('dattes', array['תמרים']),
  ('noix', array['אגוזים']),
  ('amandes', array['שקדים']),
  ('cacahuetes', array['בוטנים']),
  ('raisins secs', array['צימוקים'])
on conflict (fr) do nothing;

create or replace function public.rami_items_fetch() returns bigint
language plpgsql security definer set search_path = public, net as $$
declare r bigint;
begin
  r := net.http_get(url := 'https://hop-livraison.vercel.app/data/ramilevy-prix.json?t=' || extract(epoch from now())::bigint,
    headers := jsonb_build_object('Accept', 'application/json'), timeout_milliseconds := 60000);
  insert into ramilevy_sync (req) values (r);
  return r;
end $$;

-- Charge la liste complète (ajoute / met à jour ; un produit absent n'est jamais effacé)
create or replace function public.rami_items_import(p_req bigint) returns json
language plpgsql security definer set search_path = public, net as $$
declare body json; n int;
begin
  select h.content::json into body from net._http_response h where h.id = p_req and h.status_code = 200;
  if body is null or json_typeof(body->'items') <> 'array' then return json_build_object('error', 'no_response', 'req', p_req); end if;
  insert into rami_items (code, he, price, weighted, updated_at)
  select x->>0, x->>1, (x->>2)::numeric, coalesce((x->>3)::int, 0) = 1, now() from json_array_elements(body->'items') x
  on conflict (code) do update set he = excluded.he, price = excluded.price, weighted = excluded.weighted, updated_at = now();
  get diagnostics n = row_count;
  return json_build_object('req', p_req, 'items', n);
end $$;
revoke all on function public.rami_items_fetch(), public.rami_items_import(bigint) from public, anon, authenticated;

-- Cherche dans tout le magasin : chaque mot tapé (français ou hébreu) doit se trouver dans le nom hébreu.
-- Les noms qui COMMENCENT par le mot passent devant, puis les plus courts, puis les moins chers.
create or replace function public.rl_find(p_q text, p_limit int default 12)
returns json language plpgsql stable security definer set search_path = public as $$
declare q text; ws text[]; w text; alts jsonb := '[]'::jsonb; syn json; res json; n int;
begin
  q := translate(lower(trim(coalesce(p_q, ''))), 'àâäéèêëîïôöùûüç''', 'aaaeeeeiioouuuc ');
  ws := array(select x from unnest(regexp_split_to_array(q, '\s+')) x where length(x) >= 2);
  n := coalesce(array_length(ws, 1), 0);
  if n = 0 then return '[]'::json; end if;
  begin syn := search_synonyms_all()::json; exception when others then syn := '[]'::json; end;
  for k in 1 .. n loop
    w := ws[k];
    alts := alts || jsonb_build_array(to_jsonb(array(select distinct a from (
        select w as a
        union all select h from rl_dict d, unnest(d.he) h where d.fr like w || '%' or d.fr = q
        union all select t from json_array_elements(syn) g, json_array_elements_text(g) t
                  where t ~ '[א-ת]' and exists (select 1 from json_array_elements_text(g) z
                    where translate(lower(z), 'àâäéèêëîïôöùûüç', 'aaaeeeeiioouuuc') like w || '%')) x where length(a) >= 2)));
  end loop;
  select coalesce(json_agg(json_build_object('c', r.code, 'n', r.he, 'p', r.price, 'w', r.weighted,
           'ph', 'https://img.rami-levy.co.il/product/' || r.code || '/small.jpg') order by r.sc, length(r.he), r.price), '[]'::json) into res
    from (select i.code, i.he, i.price, i.weighted,
                 case when exists (select 1 from jsonb_array_elements_text(alts -> 0) a where i.he like a || '%') then 0 else 1 end as sc
            from rami_items i
           where not exists (select 1 from generate_series(0, n - 1) k
                              where not exists (select 1 from jsonb_array_elements_text(alts -> k) a where i.he ilike '%' || a || '%'))
           order by sc, length(i.he), i.price
           limit greatest(1, least(coalesce(p_limit, 12), 40))) r;
  return res;
end $$;
grant execute on function public.rl_find(text, int) to anon, authenticated;
