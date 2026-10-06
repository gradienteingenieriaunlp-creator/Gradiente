-- Gradiente · estadísticas para admins: solo totales, nada de nombres ni mails.
create function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'solo admins'; end if;
  select jsonb_build_object(
    'cuentas',      (select count(*) from auth.users),
    'nuevas_7d',    (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'activos_7d',   (select count(*) from auth.users u where greatest(u.last_sign_in_at, (select p.updated_at from public.plan_state p where p.user_id = u.id)) > now() - interval '7 days'),
    'con_plan',     (select count(*) from public.plan_state p where p.career is not null and jsonb_typeof(p.prog -> p.career) = 'object' and (p.prog -> p.career) <> '{}'::jsonb),
    'google',       (select count(*) from auth.users where raw_app_meta_data->>'provider' = 'google'),
    'mail',         (select count(*) from auth.users where coalesce(raw_app_meta_data->>'provider', 'email') = 'email'),
    'semanas',      (select coalesce(jsonb_agg(jsonb_build_object('desde', w::date, 'n', (select count(*) from auth.users where created_at >= w and created_at < w + interval '7 days')) order by w), '[]'::jsonb)
                     from generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') w),
    'carreras',     (select coalesce(jsonb_agg(jsonb_build_object('career', career, 'n', n) order by n desc), '[]'::jsonb)
                     from (select career, count(*) as n from public.plan_state where career is not null group by career) c)
  ) into r;
  return r;
end; $$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
