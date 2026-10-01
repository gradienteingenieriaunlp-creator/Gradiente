-- Gradiente · cuentas opcionales (Fase B)
-- Dos tablas, una fila por persona. Cada uno solo puede ver y tocar lo suyo (RLS).

-- ---------- perfil: nombre, foto, datos de alumno y colores ----------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text check (char_length(name) <= 60),
  photo       text check (char_length(photo) <= 61440),          -- dataURL de 192 px (≤ 60 KB)
  legajo      text check (char_length(legajo) <= 12),
  dni         text check (char_length(dni) <= 10),
  mail        text check (char_length(mail) <= 120),
  palette     text check (char_length(palette) <= 40),
  updated_at  timestamptz not null default now()
);

-- ---------- plan: carrera, progreso, optativas propias, AFC y vista ----------
create table public.plan_state (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  career      text check (char_length(career) <= 40),
  prog        jsonb not null default '{}'::jsonb,
  xo          jsonb not null default '{}'::jsonb,
  afc         jsonb not null default '{}'::jsonb,
  tv          text check (char_length(tv) <= 10),
  rv          text check (char_length(rv) <= 10),
  sh          int  not null default 0,
  updated_at  timestamptz not null default now(),
  constraint plan_state_size check (pg_column_size(prog) + pg_column_size(xo) + pg_column_size(afc) <= 524288)
);

alter table public.profiles   enable row level security;
alter table public.plan_state enable row level security;

create policy "perfil: ver el propio"      on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "perfil: crear el propio"    on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "perfil: editar el propio"   on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "perfil: borrar el propio"   on public.profiles for delete to authenticated using ((select auth.uid()) = id);

create policy "plan: ver el propio"        on public.plan_state for select to authenticated using ((select auth.uid()) = user_id);
create policy "plan: crear el propio"      on public.plan_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "plan: editar el propio"     on public.plan_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "plan: borrar el propio"     on public.plan_state for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- al crear la cuenta: perfil con el nombre de Google (si lo hay) ----------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, mail)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 60),
    left(new.email, 120)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- borrar mi cuenta (se lleva perfil y plan por el on delete cascade) ----------
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'sin sesión';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
