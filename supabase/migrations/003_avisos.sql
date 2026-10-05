-- Gradiente · avisos que cargan organizadores y admins (aparecen en Notificaciones)
-- Los lee cualquiera, aunque no tenga cuenta. Los escribe solo el equipo (is_staff()).
-- No se muestra quién lo puso: se ven con la marca de Gradiente.

create table public.avisos (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'aviso' check (kind in ('aviso', 'paro', 'evento', 'tramite')),
  title       text not null check (char_length(title) between 3 and 120),
  body        text check (char_length(body) <= 800),
  url         text check (url is null or (url ~* '^https?://' and char_length(url) <= 400)),
  image       text check (image is null or char_length(image) <= 400),
  starts_on   date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  ends_on     date,
  pinned      boolean not null default false,
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint avisos_fechas check (ends_on is null or ends_on >= starts_on)
);
create index avisos_vigentes on public.avisos (starts_on desc);

alter table public.avisos enable row level security;
-- cualquiera ve los que están vigentes (fecha de Argentina); el equipo ve todos (también los vencidos y los programados)
create policy "avisos: ver vigentes" on public.avisos for select to anon, authenticated
  using ((starts_on <= (now() at time zone 'America/Argentina/Buenos_Aires')::date and (ends_on is null or ends_on >= (now() at time zone 'America/Argentina/Buenos_Aires')::date)) or (select public.is_staff()));
create policy "avisos: el equipo crea"  on public.avisos for insert to authenticated with check ((select public.is_staff()));
create policy "avisos: el equipo edita" on public.avisos for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "avisos: el equipo borra" on public.avisos for delete to authenticated using ((select public.is_staff()));
-- quién lo puso (created_by) no se puede leer desde la página: solo estas columnas
revoke all on public.avisos from anon;
revoke select on public.avisos from authenticated;
grant select (id, kind, title, body, url, image, starts_on, ends_on, pinned, created_at, updated_at) on public.avisos to anon, authenticated;
-- la regla de lectura pregunta is_staff(); sin sesión da false
grant execute on function public.is_staff() to anon;

create function public.avisos_touch() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;
create trigger avisos_touch before update on public.avisos for each row execute function public.avisos_touch();

-- fotos de los avisos: públicas para ver, solo el equipo sube o borra
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avisos', 'avisos', true, 1572864, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy "avisos fotos: el equipo sube"  on storage.objects for insert to authenticated with check (bucket_id = 'avisos' and (select public.is_staff()));
create policy "avisos fotos: el equipo borra" on storage.objects for delete to authenticated using (bucket_id = 'avisos' and (select public.is_staff()));
-- para borrar una foto, Supabase primero la tiene que poder "ver" por la API
create policy "avisos fotos: el equipo lista" on storage.objects for select to authenticated using (bucket_id = 'avisos' and (select public.is_staff()));
