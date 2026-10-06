-- Gradiente · lista de cuentas para admins (mail, nombre, carrera, rol, alta y último ingreso).
create function public.admin_cuentas()
returns table (email text, name text, via text, alta timestamptz, ultimo timestamptz, career text, rol text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'solo admins'; end if;
  return query
    select u.email::text, coalesce(pr.name, u.raw_user_meta_data->>'full_name', '')::text,
           coalesce(u.raw_app_meta_data->>'provider', 'email')::text, u.created_at, u.last_sign_in_at,
           p.career, coalesce(r.role::text, 'estudiante')
    from auth.users u
    left join public.profiles pr on pr.id = u.id
    left join public.plan_state p on p.user_id = u.id
    left join public.user_roles r on r.user_id = u.id
    order by u.created_at desc;
end; $$;
revoke all on function public.admin_cuentas() from public, anon;
grant execute on function public.admin_cuentas() to authenticated;
