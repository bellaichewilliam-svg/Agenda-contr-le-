-- 19/11 (patron) : « dans Bébé il y a un seul article ». Les promos importées chaque nuit arrivaient toutes dans
-- « Promos de la semaine » (270) : on les range dans le bon rayon d'après leur nom (hébreu / français), chaque nuit
-- juste après l'import. Seulement les articles encore dans « Promos de la semaine » (un rangement à la main est gardé).
insert into public.shop_categories (id, shop_id, name, position)
select md5('HOPVICTORY:cat:' || k)::uuid, s.id, n, p from public.shops s, (values
  ('frais', '🐟 Frais & traiteur · מעדנייה', 5),
  ('pain', '🍞 Boulangerie · מאפייה', 2)) v(k, n, p)
where s.code = 'HOPVICTORY'
on conflict (id) do nothing;

create or replace function public.victory_categorize() returns json
language plpgsql security definer set search_path = public as $function$
declare sid uuid; promo uuid := md5('HOPVICTORY:cat:promo')::uuid; r record; k text; n int := 0;
begin
  select id into sid from shops where code = 'HOPVICTORY';
  -- Noms importés avec des codes à la place des signes (« צ&#x27;יפס ») : on remet les vrais signes
  update shop_products set name = replace(replace(replace(replace(name, '&#x27;', ''''), '&#39;', ''''), '&quot;', '"'), '&amp;', '&')
   where shop_id = sid and name ~ '&(#x27|#39|quot|amp);';
  for r in select id, name, category_id from shop_products where shop_id = sid and category_id in (promo, md5('HOPVICTORY:cat:bebe')::uuid) loop
    k := case
      when r.name ~* 'רמקול|מגהץ|מעבד מזון|מסחטת|בלנדר|קיטורית|מפצל|[0-9]{3,4} ?W\M|BOSS' then 'electro'
      when r.name ~* 'במבה|bamba' then 'snacks'
      when r.name ~* 'בייביסיטר|תינוק|החתלה|חיתול|bébé|couche' then 'bebe'
      when r.name ~* 'אולוויז|תחבושות|מגן תחתון|משחת שיניים|שטיפת פה|ליסטרין|קרם ידיים|קיסמי שיניים|בריחת שתן|דאודורנט|שמפו|סבון|צמר גפן' then 'hygiene'
      when r.name ~* 'ניקוי|רצפות|ספריי|כביסה|קולור קאצ|רייד|קוטל|איירוויק|ריחניים|וניש' then 'maison'
      when r.name ~* 'קפוא|גלידה|גלידת|מוקפא|surgel' then 'surgeles'
      when r.name ~* 'גבינ|יוגורט|שמנת|חמאה|טבורוג|מעדן|משקה סויה|אוטלי|SIMPLE|פרוטאין טופ|ממרח חמאה' then 'laitier'
      when r.name ~* 'הרינג|סלמון|מקרל|פורל|טונה|סטייק|נתח|שווארמה|קבב|נקניקי|בורגר|טופו|מינוט' then 'frais'
      when r.name ~* 'לחם|לחמית|מחמצת|פיתות|בצק|ארטיזנל' then 'pain'
      when r.name ~* 'משקה|פחית|סודה|לימונדה|\mXL\M|מנגו 1|גויאבה|ליטר|מ"ל' then 'boissons'
      when r.name ~* 'חטיף|ביסלי|צ.יפס|בייגלה|שוקולד|סוכרי|מסטיק|עוגי|עוגת|וופל|אפרופו|קרקר|גליליות|ממתק|חלוה|חלווה|פתי ?בר|פתיבר|פריכיות|גרנולה|Cookies' then 'snacks'
      else 'epicerie' end;
    if md5('HOPVICTORY:cat:' || k)::uuid is distinct from r.category_id then
      update shop_products set category_id = md5('HOPVICTORY:cat:' || k)::uuid where id = r.id; n := n + 1;
    end if;
  end loop;
  return json_build_object('ranges', n);
end $function$;
revoke all on function public.victory_categorize() from public, anon, authenticated;
select cron.schedule('hop-victory-ranger', '58 3 * * *', 'select public.victory_categorize()');
