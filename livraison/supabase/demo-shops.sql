-- Vitrines de démonstration HOP! (à rejouer sans risque : rien n'est effacé, les catalogues ne sont créés qu'une fois)
-- Liens : index.html?c=DEMO-RESTO, index.html?c=DEMO-BOULANGERIE, index.html?c=DEMO-BOUTIQUE
-- Images : img/demo/<code>-cover.jpg et -logo.jpg, affichées par l'appli (pas dans la base)
insert into public.shops (code, status, name, kind, city, address, lat, lon, phone, lang, plan_until, demo, tagline, about, hours, logo, cover, client_pays)
values ($q$DEMO-RESTO$q$, 'actif', $q$Le Bistrot · הביסטרו$q$, $q$restaurant$q$, 'netanya', 'כיכר העצמאות', 32.3290, 34.8565, '052-779-0361', 'fr', '2099-12-31', true,
        $q$Burgers · Pizzas · Sushis · Salades$q$, $q$Démonstration HOP! : voici à quoi ressemble la vitrine d'un restaurant sur HOP!. Vos plats en photo, vos prix, vos horaires ; vos clients commandent ici et un Hoper livre en quelques minutes.$q$, $q$[{"d": 0, "h": "08:00-23:00"}, {"d": 1, "h": "08:00-23:00"}, {"d": 2, "h": "08:00-23:00"}, {"d": 3, "h": "08:00-23:00"}, {"d": 4, "h": "08:00-23:00"}, {"d": 5, "h": "08:00-23:00"}, {"d": 6, "h": "08:00-23:00"}]$q$::jsonb, null, null, true)
on conflict (code) do update set demo = true, status = 'actif', plan_until = '2099-12-31', name = excluded.name, kind = excluded.kind, tagline = excluded.tagline,
  about = excluded.about, hours = excluded.hours, logo = coalesce(excluded.logo, shops.logo), cover = coalesce(excluded.cover, shops.cover);
do $d$
declare sid uuid; cid uuid;
begin
  select id into sid from shops where code = $q$DEMO-RESTO$q$;
  if exists (select 1 from shop_products where shop_id = sid) then return; end if;
  insert into shop_categories (shop_id, name, position) values (sid, $q$⭐ Les plus commandés · הכי מוזמנים$q$, 0) returning id into cid;
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Burger classique · המבורגר קלאסי$q$, $q$Bœuf 200 g, cheddar, oignons caramélisés, frites$q$, 52, 0);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Pizza margherita · פיצה מרגריטה$q$, $q$Tomate, mozzarella, basilic frais$q$, 48, 1);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Sushi mix 12 pièces · סושי מיקס 12 יח׳$q$, $q$Saumon, thon, avocat, concombre$q$, 64, 2);
  insert into shop_categories (shop_id, name, position) values (sid, $q$Entrées · ראשונות$q$, 1) returning id into cid;
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Salade César · סלט קיסר$q$, null, 42, 100);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Soupe du jour · מרק היום$q$, null, 28, 101);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Frites maison · צ׳יפס הבית$q$, null, 18, 102);
  insert into shop_categories (shop_id, name, position) values (sid, $q$Plats · עיקריות$q$, 2) returning id into cid;
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Schnitzel et frites · שניצל וצ׳יפס$q$, null, 58, 200);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Pâtes bolognaise · פסטה בולונז$q$, null, 49, 201);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Entrecôte grillée · אנטריקוט$q$, $q$300 g, purée ou frites$q$, 98, 202);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Wok de nouilles · ווק נודלס$q$, null, 54, 203);
  insert into shop_categories (shop_id, name, position) values (sid, $q$Street food · אוכל רחוב$q$, 3) returning id into cid;
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Falafel dans une pita · פלאפל בפיתה$q$, null, 26, 300);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Shawarma laffa · שווארמה בלאפה$q$, null, 42, 301);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Sandwich poulet · כריך עוף$q$, null, 38, 302);
  insert into shop_categories (shop_id, name, position) values (sid, $q$Desserts · קינוחים$q$, 4) returning id into cid;
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Gâteau au chocolat · עוגת שוקולד$q$, null, 32, 400);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Glace 2 boules · גלידה 2 כדורים$q$, null, 22, 401);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Crêpe Nutella · קרפ נוטלה$q$, null, 30, 402);
  insert into shop_categories (shop_id, name, position) values (sid, $q$Boissons · שתייה$q$, 5) returning id into cid;
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Jus d'orange pressé · מיץ תפוזים סחוט$q$, null, 16, 500);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Café latte · קפה הפוך$q$, null, 14, 501);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Smoothie fruits rouges · שייק פירות יער$q$, null, 22, 502);
end $d$;
insert into public.shops (code, status, name, kind, city, address, lat, lon, phone, lang, plan_until, demo, tagline, about, hours, logo, cover, client_pays)
values ($q$DEMO-BOULANGERIE$q$, 'actif', $q$La Boulangerie · המאפייה$q$, $q$restaurant$q$, 'netanya', 'כיכר העצמאות', 32.3290, 34.8565, '052-779-0361', 'fr', '2099-12-31', true,
        $q$Pains · Viennoiseries · Pâtisseries$q$, $q$Démonstration HOP! : la vitrine d'une boulangerie sur HOP!. Croissants du matin, pains, gâteaux d'anniversaire : vos clients commandent, un Hoper livre chaud.$q$, $q$[{"d": 0, "h": "08:00-23:00"}, {"d": 1, "h": "08:00-23:00"}, {"d": 2, "h": "08:00-23:00"}, {"d": 3, "h": "08:00-23:00"}, {"d": 4, "h": "08:00-23:00"}, {"d": 5, "h": "08:00-23:00"}, {"d": 6, "h": "08:00-23:00"}]$q$::jsonb, null, null, true)
on conflict (code) do update set demo = true, status = 'actif', plan_until = '2099-12-31', name = excluded.name, kind = excluded.kind, tagline = excluded.tagline,
  about = excluded.about, hours = excluded.hours, logo = coalesce(excluded.logo, shops.logo), cover = coalesce(excluded.cover, shops.cover);
do $d$
declare sid uuid; cid uuid;
begin
  select id into sid from shops where code = $q$DEMO-BOULANGERIE$q$;
  if exists (select 1 from shop_products where shop_id = sid) then return; end if;
  insert into shop_categories (shop_id, name, position) values (sid, $q$⭐ Le matin · בבוקר$q$, 0) returning id into cid;
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Croissant pur beurre · קרואסון חמאה$q$, null, 9, 0);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Pain au chocolat · שוקולטין$q$, null, 10, 1);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Café · קפה$q$, null, 12, 2);
  insert into shop_categories (shop_id, name, position) values (sid, $q$Pains · לחמים$q$, 1) returning id into cid;
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Baguette tradition · באגט$q$, null, 9, 100);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Pain de campagne · לחם כפרי$q$, null, 18, 101);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Challah · חלה$q$, $q$Le vendredi dès 7 h$q$, 16, 102);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Bagel sésame · בייגל שומשום$q$, null, 8, 103);
  insert into shop_categories (shop_id, name, position) values (sid, $q$Viennoiseries · מאפים$q$, 2) returning id into cid;
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Croissant aux amandes · קרואסון שקדים$q$, null, 13, 200);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Croissant fromage · קרואסון גבינה$q$, null, 12, 201);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Pancakes · פנקייק$q$, $q$3 pancakes, sirop d'érable$q$, 32, 202);
  insert into shop_categories (shop_id, name, position) values (sid, $q$Pâtisseries · עוגות$q$, 3) returning id into cid;
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Gâteau au fromage · עוגת גבינה$q$, $q$La part$q$, 25, 300);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Tarte aux fruits · טארט פירות$q$, $q$La part$q$, 28, 301);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Cupcake · קאפקייק$q$, null, 14, 302);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Beignet · סופגנייה$q$, null, 9, 303);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Cookies x3 · 3 עוגיות$q$, null, 15, 304);
  insert into shop_categories (shop_id, name, position) values (sid, $q$Anniversaire · יום הולדת$q$, 4) returning id into cid;
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Gâteau d'anniversaire 8 parts · עוגת יום הולדת$q$, $q$À commander la veille$q$, 140, 400);
  insert into shop_categories (shop_id, name, position) values (sid, $q$Boissons · שתייה$q$, 5) returning id into cid;
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Jus d'orange · מיץ תפוזים$q$, null, 15, 500);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Cappuccino · קפוצ׳ינו$q$, null, 14, 501);
end $d$;
insert into public.shops (code, status, name, kind, city, address, lat, lon, phone, lang, plan_until, demo, tagline, about, hours, logo, cover, client_pays)
values ($q$DEMO-BOUTIQUE$q$, 'actif', $q$La Boutique · הבוטיק$q$, $q$boutique$q$, 'netanya', 'כיכר העצמאות', 32.3290, 34.8565, '052-779-0361', 'fr', '2099-12-31', true,
        $q$Mode femme · homme · enfant$q$, $q$Démonstration HOP! : la vitrine d'une boutique de vêtements sur HOP!. Vos nouveautés en photo, vos tailles, vos prix ; vos clientes commandent et reçoivent dans l'heure.$q$, $q$[{"d": 0, "h": "08:00-23:00"}, {"d": 1, "h": "08:00-23:00"}, {"d": 2, "h": "08:00-23:00"}, {"d": 3, "h": "08:00-23:00"}, {"d": 4, "h": "08:00-23:00"}, {"d": 5, "h": "08:00-23:00"}, {"d": 6, "h": "08:00-23:00"}]$q$::jsonb, null, null, true)
on conflict (code) do update set demo = true, status = 'actif', plan_until = '2099-12-31', name = excluded.name, kind = excluded.kind, tagline = excluded.tagline,
  about = excluded.about, hours = excluded.hours, logo = coalesce(excluded.logo, shops.logo), cover = coalesce(excluded.cover, shops.cover);
do $d$
declare sid uuid; cid uuid;
begin
  select id into sid from shops where code = $q$DEMO-BOUTIQUE$q$;
  if exists (select 1 from shop_products where shop_id = sid) then return; end if;
  insert into shop_categories (shop_id, name, position) values (sid, $q$⭐ Nouveautés · חדש$q$, 0) returning id into cid;
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Robe d'été · שמלת קיץ$q$, $q$Tailles S à XL$q$, 189, 0);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Jean slim · ג׳ינס סלים$q$, null, 199, 1);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Veste légère · ז׳קט קל$q$, null, 299, 2);
  insert into shop_categories (shop_id, name, position) values (sid, $q$Femme · נשים$q$, 1) returning id into cid;
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Blouse fleurie · בלוזה פרחונית$q$, null, 119, 100);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Jupe plissée · חצאית קפלים$q$, null, 149, 101);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Robe de soirée · שמלת ערב$q$, null, 349, 102);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Écharpe · צעיף$q$, null, 79, 103);
  insert into shop_categories (shop_id, name, position) values (sid, $q$Homme · גברים$q$, 2) returning id into cid;
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$T-shirt coton · טישרט כותנה$q$, null, 69, 200);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Chemise lin · חולצת פשתן$q$, null, 159, 201);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Pantalon chino · מכנס צ׳ינו$q$, null, 179, 202);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Manteau · מעיל$q$, null, 399, 203);
  insert into shop_categories (shop_id, name, position) values (sid, $q$Enfant · ילדים$q$, 3) returning id into cid;
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Robe fille · שמלת ילדה$q$, null, 99, 300);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Jean enfant · ג׳ינס ילדים$q$, null, 89, 301);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$T-shirt enfant · טישרט ילדים$q$, null, 49, 302);
  insert into shop_categories (shop_id, name, position) values (sid, $q$Cadeaux · מתנות$q$, 4) returning id into cid;
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Carte cadeau 100 ₪ · כרטיס מתנה$q$, null, 100, 400);
  insert into shop_products (shop_id, category_id, name, description, price, position) values (sid, cid, $q$Coffret cadeau · מארז מתנה$q$, $q$Emballage offert$q$, 149, 401);
end $d$;

-- Textes en hébreu des vitrines de démonstration (affichés quand l'appli est en hébreu)
update public.shops set tagline_he = 'המבורגרים · פיצות · סושי · סלטים', about_he = 'הדגמה של HOP!: כך נראה חלון הראווה של מסעדה ב-HOP!. המנות בתמונות, המחירים, שעות הפתיחה; הלקוחות מזמינים כאן והופר מביא תוך דקות.' where code = 'DEMO-RESTO';
update public.shops set tagline_he = 'לחמים · מאפים · עוגות', about_he = 'הדגמה של HOP!: כך נראה חלון הראווה של מאפייה ב-HOP!. קרואסונים של הבוקר, לחמים, עוגות יום הולדת: הלקוחות מזמינים, והופר מביא חם.' where code = 'DEMO-BOULANGERIE';
update public.shops set tagline_he = 'אופנת נשים · גברים · ילדים', about_he = 'הדגמה של HOP!: כך נראה חלון הראווה של חנות בגדים ב-HOP!. החדש שלכם בתמונות, המידות, המחירים; הלקוחות מזמינים ומקבלים תוך שעה.' where code = 'DEMO-BOUTIQUE';
