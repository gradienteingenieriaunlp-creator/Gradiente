-- Gradiente · los organizadores también pueden ver quién está en el equipo.
-- Cambiar roles (set_user_role) sigue siendo solo de admins.
create or replace function public.list_staff()
returns table (email text, name text, role text, granted_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then raise exception 'solo el equipo'; end if;
  return query
    select u.email::text, p.name, r.role::text, r.granted_at
    from public.user_roles r
    join auth.users u on u.id = r.user_id
    left join public.profiles p on p.id = r.user_id
    order by r.role desc, u.email;
end;
$$;
