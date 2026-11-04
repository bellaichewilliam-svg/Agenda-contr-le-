-- ============================================================================
-- Réparer HOP! chez Carrefour / HOP! chez BOOOM SANS mise en ligne Vercel (04/11/2026)
-- À coller tel quel dans Supabase → SQL Editor → Run. Rien n'est effacé.
--  1) les vraies photos des produits (Carrefour, BOOOM) sont gardées dans la base, servies par shop_pic (lien ph:…),
--     que l'appli en ligne sait déjà afficher ; une tâche (toutes les minutes) les va chercher par paquets de 40,
--     puis reste en veille et prend les nouveaux produits (imports Carrefour, BOOOM) tout seuls
--  2) les logos et couvertures des deux boutiques, pris dans le dépôt GitHub de l'appli
-- ============================================================================
create extension if not exists http with schema extensions;
alter table public.shop_products add column if not exists photo_src text;

-- Une photo : téléchargée depuis le site du magasin, gardée en base (jamais plus de 220 Ko)
create or replace function public.shop_photo_fetch(p_id uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare u text; st int; ct text; b bytea;
begin
  select photo_url into u from shop_products where id = p_id;
  if not ext_photo_ok(u) then return 'no_url'; end if;
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '15');
  select r.status, r.content_type, textsend(r.content) into st, ct, b from extensions.http_get(u) r;
  if st <> 200 or coalesce(ct, '') !~* '^image/' or b is null or octet_length(b) < 500 or octet_length(b) > 220000 then
    update shop_products set photo_src = u where id = p_id;   -- ne pas réessayer sans fin ; le pictogramme reste
    return 'bad:' || coalesce(st::text, '?') || ':' || coalesce(ct, '?') || ':' || coalesce(octet_length(b)::text, '0');
  end if;
  update shop_products set photo = 'data:' || case when ct ~* 'png' then 'image/png' when ct ~* 'webp' then 'image/webp' else 'image/jpeg' end
      || ';base64,' || replace(encode(b, 'base64'), E'\n', ''), photo_src = u
   where id = p_id;
  return 'ok';
exception when others then
  return 'err:' || sqlerrm;
end $$;

-- Un paquet de photos à aller chercher (celles dont le lien a changé ou jamais prises)
create or replace function public.shop_photos_sync(p_max int default 40) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from shop_products where ext_photo_ok(photo_url) and photo_src is distinct from photo_url
           order by available desc, created_at limit greatest(1, least(p_max, 200)) loop
    perform public.shop_photo_fetch(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.shop_photo_fetch(uuid), public.shop_photos_sync(int) from public, anon, authenticated;

-- Catalogue : la photo gardée en base d'abord (lien ph:…), sinon le lien du magasin
create or replace function public.shop_catalog(p_code text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'categories', coalesce((select json_agg(json_build_object('id', c.id, 'name', c.name) order by c.position, c.created_at)
                              from shop_categories c where c.shop_id = s.id), '[]'::json),
    'products', coalesce((select json_agg(json_build_object('id', p.id, 'category_id', p.category_id, 'name', p.name,
                              'description', p.description, 'price', p.price,
                              'photo', case when p.photo_h is not null
                                              then coalesce((select f.path from shop_photo_files f where f.h = p.photo_h), 'ph:' || p.id || ':' || left(p.photo_h, 12))
                                            when ext_photo_ok(p.photo_url) then p.photo_url end,
                              'available', p.available)
                              order by p.position, p.created_at)
                            from shop_products p where p.shop_id = s.id), '[]'::json))
    from shops s
   where s.code = upper(trim(p_code)) and s.status in ('actif', 'en_attente') and s.plan_until >= current_date;
$$;

-- Les recopies automatiques (rayons → HOP! chez Carrefour, site BOOOM) gardent la photo déjà prise si le lien n'a pas changé
create or replace function public.shop_photo_keep() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.photo_src is not null and new.photo_url is not distinct from old.photo_src
     and new.photo is distinct from old.photo and old.photo is not null then
    new.photo := old.photo;
  end if;
  return new;
end $$;
create or replace trigger shop_products_photo_keep before update on public.shop_products
  for each row execute function public.shop_photo_keep();

-- Logos et couvertures des deux boutiques (fichiers img/market du dépôt), servis par shop_pic
do $$
declare k text; f text; v_code text; st int; ct text; b bytea;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '15');
  foreach k in array array['carrefour', 'booom'] loop
    v_code := case k when 'carrefour' then 'HOPCARREFOUR' else 'HOPBOOOM' end;
    foreach f in array array['logo', 'cover'] loop
      begin
        select r.status, r.content_type, textsend(r.content) into st, ct, b
          from extensions.http_get('https://raw.githubusercontent.com/bellaichewilliam-svg/Agenda-contr-le-/claude/delivery-management-app-eccme5/livraison/img/market/' || k || '-' || f || '.webp') r;
        if st = 200 and octet_length(b) between 500 and 110000 then
          if f = 'logo' then
            update shops set logo = 'data:image/webp;base64,' || replace(encode(b, 'base64'), E'\n', '') where shops.code = v_code;
          else
            update shops set cover = 'data:image/webp;base64,' || replace(encode(b, 'base64'), E'\n', '') where shops.code = v_code;
          end if;
        else
          raise notice '% % : % (%)', k, f, st, octet_length(b);
        end if;
      exception when others then raise notice '% % : %', k, f, sqlerrm;
      end;
    end loop;
  end loop;
end $$;

-- Les photos : un premier paquet tout de suite, puis toutes les minutes jusqu'à la fin (et ensuite les nouveaux produits)
select public.shop_photos_sync(40);
select cron.schedule('hop-shop-photos', '* * * * *', 'select public.shop_photos_sync(40)');

-- Vérification : photos prises / à prendre, logos
select s.code, count(*) filter (where p.photo_src = p.photo_url) as photos_prises,
       count(*) filter (where ext_photo_ok(p.photo_url) and p.photo_src is distinct from p.photo_url) as a_prendre,
       img_ref(s.id, s.logo, '1') as logo
  from shops s join shop_products p on p.shop_id = s.id
 where s.code in ('HOPCARREFOUR', 'HOPBOOOM') group by s.code, s.id, s.logo;
