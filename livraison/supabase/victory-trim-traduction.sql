-- 20/11 (patron : « fais tous les points ») : Victory garde ses 220 meilleures promos (catalogue sous 150 Ko, les promos
-- sorties sont allégées) et les noms en hébreu sont traduits en français tout seuls (IA : seulement des noms de produits).
-- Migrations appliquées : victory_trim_et_traduction, victory_trim_allege. Tâches : hop-victory-ranger (3 h 58), hop-traductions (toutes les 5 min).
create or replace function public.victory_trim(p_keep int default 220) returns int
language plpgsql security definer set search_path = public as $f$
declare sid uuid; n int;
begin
  select id into sid from shops where code = 'HOPVICTORY';
  with r as (
    select p.id, row_number() over (order by case when v.old > v.price and v.old > 0 then 1 - v.price / v.old else 0.25 end desc, p.position) rk
      from shop_products p left join victory_items v on md5('HOPVICTORY:' || v.id)::uuid = p.id
     where p.shop_id = sid and p.available and not coalesce(p.hand_added, false))
  update shop_products p set available = false from r where r.id = p.id and r.rk > p_keep;
  get diagnostics n = row_count;
  update shop_products set description = null, photo_url = null
   where shop_id = sid and not available and not coalesce(hand_added, false) and (description is not null or photo_url is not null);
  return n;
end $f$;
revoke all on function public.victory_trim(int) from public, anon, authenticated;

create or replace function public.shop_translate_tick(p_code text default 'HOPVICTORY') returns json
language plpgsql security definer set search_path = public as $f$
declare sid uuid; j record; n_app int := 0; k int; items jsonb; jid uuid;
begin
  select id into sid from shops where code = p_code;
  if sid is null then return null; end if;
  for j in select * from ia_jobs where kind = 'traduire_produits' and status = 'fait' and input->>'shop' = p_code loop
    update shop_products p set name = left(btrim(x.fr) || ' · ' || p.name, 80)
      from (select (e->>'id')::uuid id, e->>'fr' fr from jsonb_array_elements(coalesce(j.output->'items', '[]'::jsonb)) e
             where length(btrim(coalesce(e->>'fr', ''))) between 3 and 60 and (e->>'id') ~ '^[0-9a-f]{8}-[0-9a-f-]{27}$' and (e->>'fr') !~ '[א-ת]') x
     where p.id = x.id and p.shop_id = sid and p.name !~ '^[^א-ת]*[A-Za-zÀ-ÿ]{3,}[^א-ת]* · ';
    get diagnostics k = row_count; n_app := n_app + k;
    update ia_jobs set status = 'applique' where id = j.id;
  end loop;
  if not exists (select 1 from ia_jobs where kind = 'traduire_produits' and input->>'shop' = p_code and status in ('attente', 'en_cours') and created_at > now() - interval '10 minutes')
     and (select count(*) from ia_jobs where kind = 'traduire_produits' and input->>'shop' = p_code and created_at > now() - interval '24 hours') < 15 then
    select jsonb_agg(jsonb_build_object('id', q.id, 'he', q.name)) into items
      from (select id, name from shop_products where shop_id = sid and available and name !~ '^[^א-ת]*[A-Za-zÀ-ÿ]{3,}[^א-ת]* · ' order by position limit 60) q;
    if items is not null then jid := ia_call('traduire_produits', jsonb_build_object('items', items, 'shop', p_code)); end if;
  end if;
  return json_build_object('appliques', n_app, 'lance', jid is not null);
end $f$;
revoke all on function public.shop_translate_tick(text) from public, anon, authenticated;
select cron.schedule('hop-victory-ranger', '58 3 * * *', 'select public.victory_categorize(); select public.victory_trim(220);');
select cron.schedule('hop-traductions', '*/5 * * * *', $c$select public.shop_translate_tick('HOPVICTORY')$c$);
