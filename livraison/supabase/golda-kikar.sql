-- ============================================================================
-- « Golda · Kikar HaAtsmaout » (GOLDAKIKAR, patron, 15/11/2026) : comme McDonald's, le patron commande à emporter chez Golda
-- (הרצל 7, נתניה, tél. 09-977-7551) et le livreur récupère. Menu et prix : captures de l'appli de commande de Golda Netanya Kikar.
-- Photos : fichiers de l'appli (img/golda/*.webp) ; la base garde une petite marque par produit, reliée au fichier (shop_photo_files).
-- Parfums de glace : choix dans la fiche (client.js, SHOP_CHOICES.GOLDAKIKAR).
-- ============================================================================
insert into public.shops (code, status, name, kind, city, address, lat, lon, contact_name, phone, whatsapp, lang, plan_until, client_pays, cash_ok, kosher,
  featured, showcase, rank, tagline, tagline_he, about, about_he, admin_note, hours, logo, cover)
select 'GOLDAKIKAR', 'suspendu', 'Golda · Kikar HaAtsmaout · גולדה · כיכר העצמאות', 'restaurant', 'netanya', 'הרצל 7, כיכר העצמאות, נתניה', 32.3297, 34.8565,
  'HOP!', '0527790361', '972527790361', 'fr', '2099-12-31', true, true, false, true, true, 3,
  '🍨 Les glaces Golda livrées chez vous', '🍨 הגלידות של גולדה עד הבית',
  'Kilos de glace, glace au yaourt, gaufres, crêpes et cookies de Golda, Kikar HaAtsmaout. On commande pour vous et on vous livre au plus vite.',
  'קילו גלידה, גלידה בטעם יוגורט, ופלים, קרפים ועוגיות של גולדה, כיכר העצמאות. אנחנו מזמינים בשבילכם ומביאים הכי מהר.',
  'Catalogue HOP! : le patron commande à emporter chez Golda Kikar (הרצל 7, tél. 09-977-7551), le livreur récupère. Prix de l''appli Golda. Pas partenaire officiel.',
  '[{"d": 0, "h": "08:00-23:30"}, {"d": 1, "h": "08:00-23:30"}, {"d": 2, "h": "08:00-23:30"}, {"d": 3, "h": "08:00-23:30"}, {"d": 4, "h": "08:00-23:59"}, {"d": 5, "h": "08:00-14:30"}, {"d": 6, "h": "18:30-23:45"}]'::jsonb,
  'data:image/webp;base64,UklGRpQEAABXRUJQVlA4IIgEAAAQHACdASp4AHgAPt1oqFAopiimqZNr6RAbiUAZr57yuSjHpI5W3p53pUPy4ZtGcjRR4RrmdnWegC9J+U8Zqq8RAmdxPd+D3JItLfPxSSAWgzIG4g+2u+i/aqnGN8veS/K0y7zeUWTY+4jvGuhGBoA6LZzkqYeTm2k/8eVGs9RXiGXI36YSEKGe0AgvnNjBqGz7/B3K+akyvsRRPcHBjBnWHmsr7nTPs+GiMHLr6EyDGXZ26wdU2XfgrDom4E2Fw+mzsQKmJaBHDQzfLEDJuGAqJTk82VDbKrdYyHykXGhaIU7T4mMDg22OoAD+7rzQsvMg2jxdw/H2o6WBFK469MRFiPEHfiwBjLFD0LyQAffkkfrIZEXtwttfWB4uACXfC20TNIKUS3/GNNefRrhrvD+q84QN3ziLqyfyzt4BYbBdCA/12/ImiJM6b6xWhArx+E5s7Gd1N0wnaJTofVZRovMRr6yaWDddUt5XUB5LqppKuJCp8BrwjV+K1nsSF2H1TzmKU+Nnc2wA4moR3PPFDoldWxiGBDVDKeD8xJnuRP6P7JvJDvIixKVS4sAypdOkn1ltGi2doPXngLKtIgmkEHXXZoA2mjBkR9knx473vFw3PDnr5JIRJ6GJZKYJzhm8vCI/M2wkgu5XrIagvu0aiGt1JryXYk9vAmcE2omIE78vZSUJXxicapI8u9wvJRoztJ90E4EKHgPyV3FMtq5OYaQNp7WtJet1ayjymOeZOEfUxO1ialirXBWauls8bddMiXa59pd8UNjGe8MuJeWBfzEN7ZSz9VLkjFLU8i7GsVzR7fv+6hUODbY3hBrr3wLktkgbiDylJymKuS8dp1x/n+58HnuUaX/+0S7hapasN0HlXRTtISAw1MqrZFwnA/W5ppi3PI8Fymr4/X4k4bZOjLBY/Tq8bzSVpGWhMm09bqvrdJBckPYXAVis0z3lBijLm74yu+WCe4KEZp8EuqDjQdX/s4kHC8e0TpVMGyRGhgiSbQ47jkbr8aHoPso0PGsJMf7sujhL3LKj266EECOh/DjZFivPsQB+QS66fWO0r1aMi0nKpT17BZrnhwOoEKbtQwbOYwqEd8gSFHaUkwaAl6VdU8W41h6YvAWgynMCpFEwsPpx1iar7FqZqyEMHwZs+2dXiRy5tc2/daV+6JsYMRj0OzQaB1+qjbXbkhX+sNccntmwWDKB93Q9kgiflcUAbxp/TlJ3/yrZCaqneEwJVaDkrv1QNUYKf1nNMEbFNzBtYtvE4LPU1S2mS+x0rShedpAUMn6OXAqaAWgb3jr7/RzGEren7fp747Ygl6emdi5eLJvD8CrY5hc5XQObwn1mTMEcW4SW1DHW8kdG/OPegBHnexVoTt9k353DJNujKiF9B0tzJB9een/jPuT2N1WHrrZ0QNRHOOG6CWZDgiN3hVvBPXT703QXpck3e2maRaickTRUXxX0pGDIvd9MDqPpBCneHBGQ7BrgKtU1ndQ43UbJqY0I1cO0BDMLUg+5QcwtLOLw0vP8/NkWf+Rv2G6ilheK2XRUF6AAAA==', 'data:image/webp;base64,UklGRp4IAABXRUJQVlA4IJIIAAAQQQCdASpoAZYAPwF+tlWrKDY2o9OZytAgCWVu3V6f2myIxH6En7Xq52nX+39x06A90KnRXylaDV1eliyUAsMBHJkhhxnrFMKQpCsD9UYUDA5JP+JvFr4IPFAeK+2xFIl4DGCbDqhr1sSWed1mRC41FH171+yqaHme9qk3QV+RxHSz+z5GpTtIN2PdAT5TsjvI29h62OpH5+O+zla2oLRTCHe+BGrb8o6XvV3O0GugmskHf3cP0CYRkaP3Hd4KSa7O3Nd65bUWS/8+H7D57JDxX9rCrqTGeoa38kUynz4gFwRBTSoL9ZmkPqeUJxZSszH+hpZRIhCDU0i4IF3zC/EiRPDqjvHkBEYd0IfH11Rll+BIe9K0W2UBrw3oaa9NLPzAyu7Fe3VbOKr7vfmkRghLJNvyytht1J+cL0DFUcHKWao/6UGA94AAjH7AaOBnQ2qHvj53wgfY1xKoRioJM/F4wipQyyvEmHHG/JWCUazFKiJnMxfjKJM44IJ7nZlDBoI+6YObBZ4BivbZ8w7ZAwGnYIIrZn8lhDDtLQUKtXMgksZCr1nSpOJ8TZ1dguLP7N08uBbOQs7n2r/gpVhUn3/M8uEuQeQk9VLRpe5Vw692sU0WmYDmAjSq9nkX43cE0XALkRBhHpPQRjM8nGGZqGi0DFMjiopEfkirr9x0sEwuvyv4ffbdJcByZeu2WAF03EwAAP7vaz/UWuD5paqa/qWY5z8yfzOa7VJ+a6a3jKRdzXINdFLrbsKbhpOpBKiTqW8zFsK1ZBTaWNrgArtZVyFnkGltpJiUMEonPv7MURtV2E73I5BqRxo/hyO3fbPpa7L+/brLdqTJd7WB3vfma3RJPO6ny95BOQr2ovFhMcwT1G2dlFINWWC8vCTDWZ4480Q/zQEnoAiwPYECU29bcwW09CLIaf34arEpAtFycN0sLc2vPrbq+lF0a99OF9JWF8fjUBQUMUAxh0WEvLwmLi3bExJw9cPha/52m49bFx5L3XUCj8iGaYLC9Y0hgB6ppyGht1qAZsvHhHUE4+aYwzMWcxat75AQK83I6mnZurf5DpuhW5eihtvTsciKaQLnPBv6Iku9h1CrmLGSmodNHoaQ52kmWmuB3mvY2mZCHp6d76qbTsRWOzfhPoTNJkmmFWvdpQ9i/zgGU00ZENujaJ7PbN/wVGb0q8JhWRSUoCOWZx32D6Tms9odMcug4oSBMrJw1lC3p69SABOs0i9kmn95IkY50vZZZ5BVGWoggKcCLn+jXa3ELQPyRDcXTNBl5abe6qFkCMJu8iM4BRyP4RGYRK155jr11OnaUCSYmcMMq24SsnhAAYm4RfS/aettkVYFEE/4X56PaTOFhya4YSPB26yQw4CuOwMOyU2CqxBmY45knX9EI8WfD1j5z7pSDoENFVHhIzlvywE9auX14CUo9NUoAfjsw1kkDN40g58zMsy/0puq4zJ0Yu0rfX8ashz0aLw58wgXu8decv0i11NnbGRmKS9NLjPIUFBJZy17nvXXBTLytd9zBGlgQkZGqCvbcxVBIYFSiOC4YfhStB90/S11ZAPwVl6SadEyGp9urKfOxcFLFJ9YxLohf9RMuj3Q+5FoNrl3SJMKdLS846U7TMx2jhOzNEiAU8nY5ENoVm0znLyGMzQssdNi1I9MSCWtVr2X/bt4BBFYzRTrwezDytjF3mUKd+f/lYBJ2GWf6ShFxju+wb7ERv8iBcMyYyqRhl/1gDJjSWoYZwagplwhl4YEtBDjti6QE6/QuCm0efJZQ7Xa5l9yDt4kFR+Fq8hUFGZaf5wHxDwTZHTUUkh8dzdPwjUQaDq889+GH+oeNnSuIUKmoND3YJp5NbX0Xag0fZQrQtOm7TmEmiX6+mjMvb/bd4ECJ160YglxszK3L0Y+1ijfEEad74TEGIfsZJTaZOY6FOYfxc6efpJXBw8MXaCBOZCGJO+Zd3CKF4DVHg86MotkwyC+OZrm2K5OmO7HgzPZW/XmvaNCVM4k5ZTUxt6fps5/44mxXb8rIeYKIENQuLmskoRzbUEqEZrRxJ23W5lHBjHwVD+3YSSEWdw4sURFWugBIfctElTrVRE2KiimXAL9OcyaOBXvaziCiE6QcEy43QPRJs1+R3r25A6tQDe/00cuTd1clnwLYknhK6Hr7esEoRH9xhnyDOR5+aJe0zT8v56NTk670YAsHxJqtBRD0v/4Tg+iYTThB7l7kRJ/iLrGYEbR0kIUixHI1VLpPAxSO9GwXISVNo4hjYY8SHojyA/V3JZVQvyoNBTbk0QVYcxrEv3RqhC49GTlDvmuIJchK632H2sF76De116zNHXqyVf7t9WD6V55yrF9pdLHZSDCbRz0UqJx87MNIGmU7IvZag9iq90vjTZ/necDEPzdhtijESImgTqrXGSxFaen3us9vvAycuMMIzzX43kMSx/tnLlQcAQ4TRAZ22BMch//y0TMncgTzUAOf+sy6iive8qJeF4isk9GzMFkXdw2fPP3RZwuxtNQdL14LWIni0KAygXGpOO946nrlpgxzlw/G71Z6tdgbicIryTOL2TnIppqAY/BLAZZJjdulZ3u7PTTVUKngWUfP5UXPsdWfFc423afIyQGLs7GL8p2xoTGy1f96MXH/PcH7joovHoosPSiKz/87BrGyd5VrBx5WIPYs9YCiQyQ6GgGxlA0I17/14MpP6KOYgxMhqlCppIHUZOEdr6IlQJMxr6x3uRvJrYkJJga3wc8ZBgOIgz9c8g1vgmc8VTzDl5TpVqhasbdFMAZ95O98pUKib4xVnCQ7EHb2VUyCo9ahX6xnklu7xNsc89bx7eBhcgBLShxLqITMVdzKPtzmp9SPekXJ0sQVfgNdNQYOaAPexJDVRhUlTGlbZwscmYTKNZ3Z+MwuDpAtHQvx/hJfgvXtCOShT8AAAAA'
where not exists (select 1 from public.shops where code = 'GOLDAKIKAR');
insert into public.shop_photo_files (h, path)
select md5(logo), 'img/golda/logo.webp' from public.shops where code = 'GOLDAKIKAR' and logo is not null
union all select md5(cover), 'img/golda/cover.webp' from public.shops where code = 'GOLDAKIKAR' and cover is not null
on conflict (h) do update set path = excluded.path;
insert into public.shop_categories (id, shop_id, name, position)
select md5('GOLDAKIKAR:cat:' || k)::uuid, (select id from public.shops where code = 'GOLDAKIKAR'), n, p from (values
  ('glace', '🍨 Glaces · גלידה', 1),
  ('yaourt', '🍦 Glace au yaourt · גלידה בטעם יוגורט', 2),
  ('desserts', '🧇 Desserts · קינוחים', 3),
  ('hanouka', '🍩 Hanoukka · חנוכה', 4),
  ('verres', '🥤 Verres dessert · כוסות קינוח', 5),
  ('cookies', '🍪 Cookies · עוגיות', 6),
  ('extras', '➕ Suppléments · תוספות', 7)) v(k, n, p)
on conflict (id) do nothing;
with m(k, cat, name, price, descr, pos) as (values
('demi','glace','Demi-kilo de glace · חצי קילו גלידה',75,'Vos parfums au choix · טעמים לבחירה',1),
('kilo','glace','Kilo de glace · קילו גלידה',119,'Vos parfums au choix · טעמים לבחירה',2),
('quart','glace','Quart de kilo de glace · רבע קילו גלידה',45,'Vos parfums au choix · טעמים לבחירה',3),
('demi-cookies','glace','Demi-kilo de glace + 2 cookies · חצי קילו + 2 עוגיות',109,'Vos parfums au choix · טעמים לבחירה',4),
('kilo-cookies','glace','Kilo de glace + 6 cookies · קילו גלידה + 6 עוגיות',215,'Vos parfums au choix · טעמים לבחירה',5),
('gift','glace','Gift Box · גיפט בוקס',199,'Kilo de glace et 6 garnitures au choix · קילו גלידה ו-6 תוספות לבחירה',6),
('bday','glace','Coffret anniversaire · מארז יום הולדת',230,'Kilo de glace avec 6 garnitures, belle boîte et accessoires de fête · קילו גלידה עם 6 תוספות, קופסה מהודרת',7),
('yaourt-kilo','yaourt','Kilo de glace au yaourt · קילו גלידה בטעם יוגורט',124,'Avec garnitures · עם תוספות',8),
('yaourt-demi','yaourt','Demi-kilo de glace au yaourt · חצי קילו גלידה בטעם יוגורט',80,'Avec garnitures · עם תוספות',9),
('yaourt-demi-cookies','yaourt','Demi-kilo au yaourt + 2 cookies · חצי קילו יוגורט + 2 עוגיות',114,'Avec garnitures · עם תוספות',10),
('yaourt-kilo-cookies','yaourt','Kilo au yaourt + 6 cookies · קילו יוגורט + 6 עוגיות',220,'Avec garnitures · עם תוספות',11),
('gaufre','desserts','Gaufre belge + quart de glace · ופל בלגי + רבע קילו גלידה',79,'Sirops et garnitures au choix (à côté) · סירופים ותוספות לבחירה',12),
('crepe','desserts','Crêpe + quart de glace · קרפ + רבע קילו גלידה',79,'Sirops et garnitures au choix (dedans) · סירופים ותוספות לבחירה',13),
('sufg-fraise','hanouka','Beignet confiture de fraise · סופגניה בטעם ריבת תות',8,null,14),
('sufg-lait','hanouka','Beignet confiture de lait · סופגניה בטעם ריבת חלב',8,null,15),
('sufg-choco','hanouka','Beignet chocolat · סופגניה בטעם שוקולד',15,null,16),
('sufg-fete','hanouka','Beignet de fête · סופגניית מסיבה',15,null,17),
('sufg-dubai','hanouka','Beignet Dubaï · סופגניית דובאי',15,null,18),
('sufg-bretzel','hanouka','Beignet bretzel · סופגניה בטעם בייגלה',15,null,19),
('diy','verres','Coffret DIY pour 2 · מארז DIY זוגי',80,'On compose à la maison le verre cookies-caramel · מרכיבים בבית את כוס עוגיות הקרמל',20),
('cookies6','cookies','Coffret 6 cookies · מארז 6 עוגיות',96,null,21),
('cookies2','cookies','Coffret 2 cookies · מארז 2 עוגיות',34,null,22),
('cornet','extras','Cornet · תוספת גביע',1,null,23),
('cornets3','extras','3 cornets · מארז גביעים 3 יח׳',3,null,24),
('cornet-sg','extras','Cornet sans gluten · גביע ללא גלוטן',1,null,25),
('disques','extras','5 gaufrettes Golda · מארז 5 דסקיות',2,null,26),
('chantilly-petit','extras','Verre de chantilly, petit · כוס קצפת קטן',7,null,27),
('chantilly','extras','Verre de chantilly · כוס קצפת',12,null,28)
)
insert into public.shop_products (id, shop_id, category_id, name, description, price, photo, available, position)
select md5('GOLDAKIKAR:' || m.k)::uuid, (select id from public.shops where code = 'GOLDAKIKAR'), md5('GOLDAKIKAR:cat:' || m.cat)::uuid,
  m.name, m.descr, m.price, 'data:image/webp;base64,' || encode(convert_to('golda/' || m.k, 'UTF8'), 'base64'), true, m.pos
from m
on conflict (id) do update set name = excluded.name, description = excluded.description, price = excluded.price, photo = excluded.photo, position = excluded.position;
insert into public.shop_photo_files (h, path)
select md5('data:image/webp;base64,' || encode(convert_to('golda/' || k, 'UTF8'), 'base64')), 'img/golda/' || k || '.webp'
from unnest(array['demi','kilo','quart','demi-cookies','kilo-cookies','gift','bday','yaourt-kilo','yaourt-demi','yaourt-demi-cookies','yaourt-kilo-cookies','gaufre','crepe','sufg-fraise','sufg-lait','sufg-choco','sufg-fete','sufg-dubai','sufg-bretzel','diy','cookies6','cookies2','cornet','cornets3','cornet-sg','disques','chantilly-petit','chantilly']) k
on conflict (h) do update set path = excluded.path;
-- Après la mise en ligne des photos (img/golda) : update public.shops set status = 'actif' where code = 'GOLDAKIKAR';

-- 15/11 (en ligne) : mise en ligne Vercel bloquée (crédit du jour) → photos copiées dans la base depuis GitHub (API, base64),
-- servies par shop_pic (liens ph:). Appliqué, puis boutique activée :
-- create table if not exists public.golda_pics (k text primary key, req bigint); alter table public.golda_pics enable row level security;
-- insert into golda_pics select k, net.http_get('https://api.github.com/repos/bellaichewilliam-svg/Agenda-contr-le-/contents/livraison/img/golda/' || k || '.webp?ref=claude/delivery-management-app-eccme5', ...) from unnest(array[…28 produits…, 'logo', 'cover']) k;
-- update shop_products p set photo = 'data:image/webp;base64,' || replace((r.content::jsonb)->>'content', E'\n', '') from golda_pics g join net._http_response r on r.id = g.req where p.id = md5('GOLDAKIKAR:' || g.k)::uuid;
-- update shops set logo = …, cover = … where code = 'GOLDAKIKAR'; update shops set status = 'actif' where code = 'GOLDAKIKAR';
