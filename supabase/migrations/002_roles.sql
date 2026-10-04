-- Gradiente · roles
-- Sin fila en user_roles = estudiante (lo normal). organizador = va a poder editar contenido
-- (avisos, calendario…) desde la página. admin = todo, incluido dar y sacar roles.
-- Nadie se puede poner un rol solo: la tabla no se escribe desde la app, solo con set_user_role (admins).

create type public.app_role as enum ('organizador', 'admin');

create table public.user_roles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  role        public.app_role not null,
  granted_by  uuid references auth.users (id) on delete set null,
  granted_at  timestamptz not null default now()
);

alter table public.user_roles enable row level security;
create policy "roles: ver el propio" on public.user_roles for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.user_roles from anon;
revoke insert, update, delete, truncate on public.user_roles from authenticated;

-- ---------- ayudas para las reglas (RLS) de lo que venga: avisos, calendario… ----------
create function public.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select role::text from public.user_roles where user_id = (select auth.uid())), 'estudiante');
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'admin');
$$;

create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.user_roles where user_id = (select auth.uid()));
$$;

-- ---------- admins: ver el equipo y dar o sacar roles por mail ----------
create function public.list_staff()
returns table (email text, name text, role text, granted_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'solo admins'; end if;
  return query
    select u.email::text, p.name, r.role::text, r.granted_at
    from public.user_roles r
    join auth.users u on u.id = r.user_id
    left join public.profiles p on p.id = r.user_id
    order by r.role desc, u.email;
end;
$$;

-- new_role: 'admin', 'organizador' o 'estudiante' (= sacarle el rol)
create function public.set_user_role(target_email text, new_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if not public.is_admin() then raise exception 'solo admins'; end if;
  if new_role not in ('admin', 'organizador', 'estudiante') then raise exception 'rol inválido'; end if;
  select id into target from auth.users where lower(email) = lower(trim(target_email));
  if target is null then raise exception 'no hay cuenta con ese mail'; end if;
  -- que nunca quede la página sin admins
  if target = (select auth.uid()) and new_role <> 'admin'
     and (select count(*) from public.user_roles where role = 'admin') <= 1 then
    raise exception 'sos el único admin';
  end if;
  if new_role = 'estudiante' then
    delete from public.user_roles where user_id = target;
  else
    insert into public.user_roles (user_id, role, granted_by) values (target, new_role::public.app_role, (select auth.uid()))
    on conflict (user_id) do update set role = excluded.role, granted_by = excluded.granted_by, granted_at = now();
  end if;
end;
$$;

revoke all on function public.my_role(), public.is_admin(), public.is_staff(), public.list_staff(), public.set_user_role(text, text) from public, anon;
grant execute on function public.my_role(), public.is_admin(), public.is_staff(), public.list_staff(), public.set_user_role(text, text) to authenticated;

-- El primer admin se pone a mano (SQL editor), después de que entre una vez:
-- insert into public.user_roles (user_id, role) select id, 'admin' from auth.users where email = 'MAIL';
