-- (patron 26/11 : « comment je choisis l'ordre ? » → option 2 : réglage dans le panneau patron, et « pareil page restau »)
-- L'ordre est dans la colonne existante shops.rank (déjà renvoyée par shops_showcase, déjà modifiable par le patron).
-- Deux listes séparées dans le panneau : magasins (rang 1, 2, 3…) et restos (rang 501, 502…), pour que la page
-- « Tous » montre les magasins puis les restos. Aucune colonne ajoutée, rien d'effacé.
-- Ordre de départ = l'ordre que les clients voyaient (Supermarchés, Max Stock en 2e dans le carrousel de l'accueil), puis les autres.
with m(code, r) as (values
  ('HOPRAMILEVY',1),('HOPMAXSTOCK',2),('HOPCARREFOUR',3),('HOPOSHERAD',4),('HOPSHUFERSAL',5),('HOPVICTORY',6),
  ('HOPYOHANANOF',7),('HOPTIVTAAM',8),('HOPUNIVERSE',9),('HOPLAHAV',10),('HOPLALINE',11),('HOPBOOOM',12),
  ('MARCHEFR',13),('HOPROLADIN',14),('HOPPANZER',15),('MARYLOU',16),('BLOOVI',17),('EDMAR',18),
  ('MCDSHARON',501),('GOLDAKIKAR',502),('RENDEZVOUS',503),('HOPJUS',504),('NINASUSHI',505),('SHISO',506),
  ('PARISTEXAS',507),('PIZZACRUSH',508),('SMASHIT',509),('CBA007',510))
update shops s set rank = m.r from m where s.code = m.code;
