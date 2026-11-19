-- 19/11 (patron) : les appareils (Müller, friteuse Boss) ne vont pas dans « Maison » avec les produits d'entretien → rubrique à part.
-- Le chauffage parasol perd « SP3000L » du nom (l'appli y lisait « 3000 L » et un prix au litre) ; le modèle passe dans la description.
insert into public.shop_categories (id, shop_id, name, position)
select md5('HOPVICTORY:cat:electro')::uuid, id, '🔌 Électroménager & chauffage · מוצרי חשמל וחימום', 9 from public.shops where code = 'HOPVICTORY'
on conflict (id) do nothing;
update public.shop_products set category_id = md5('HOPVICTORY:cat:electro')::uuid
 where id in (md5('HOPVICTORY:muller-hy907')::uuid, md5('HOPVICTORY:muller-nd180ma')::uuid, md5('HOPVICTORY:muller-sp3000l')::uuid, 'c7ff4f76-524e-3479-3b4b-58e32af7d8cb'::uuid);
update public.shop_products set name = 'Müller · Chauffage d''extérieur parasol · פטריית חימום עמוד',
  description = 'Modèle SP3000L · Prix choc Victory · 1 par client, selon stock · דגם SP3000L · מחיר מבצע ויקטורי, יחידה אחת ללקוח'
 where id = md5('HOPVICTORY:muller-sp3000l')::uuid;
-- Photos détourées sur fond blanc (sans le fond « éclairs » du prospectus), nouveau nom de fichier pour ne pas garder l'ancienne en mémoire
update public.shop_photo_files set path = replace(path, '.webp', '-blanc.webp')
 where path in ('img/victory/muller-gaufrier-hy907.webp', 'img/victory/muller-cheminee-nd180ma.webp', 'img/victory/muller-parasol-sp3000l.webp');
