-- Gradiente · 1) borrar para siempre es solo de admins (los organizadores ocultan)
--            · 2) registro de cambios: quién cambió qué y cuándo (lo ven solo los admins)

-- 1) borrar: solo admins
drop policy "avisos: el equipo borra" on public.avisos;
create policy "avisos: los admins borran" on public.avisos for delete to authenticated using ((select public.is_admin()));
drop policy "kiosco: el equipo borra" on public.kiosco;
create policy "kiosco: los admins borran" on public.kiosco for delete to authenticated using ((select public.is_admin()));
drop policy "links: el equipo borra" on public.links;
create policy "links: los admins borran" on public.links for delete to authenticated using ((select public.is_admin()));
drop policy "faq: el equipo borra" on public.faq;
create policy "faq: los admins borran" on public.faq for delete to authenticated using ((select public.is_admin()));
drop policy "catedras: el equipo borra" on public.catedras;
create policy "catedras: los admins borran" on public.catedras for delete to authenticated using ((select public.is_admin()));
drop policy "avisos fotos: el equipo borra" on storage.objects;
create policy "avisos fotos: los admins borran" on storage.objects for delete to authenticated using (bucket_id = 'avisos' and (select public.is_admin()));

-- 2) registro de cambios
create table public.cambios (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  who        uuid,
  who_email  text,
  tabla      text not null,
  accion     text not null check (accion in ('crear', 'editar', 'borrar')),
  fila       text,
  antes      jsonb,
  despues    jsonb
);
create index cambios_at on public.cambios (at desc);
alter table public.cambios enable row level security;
-- solo los admins lo leen; nadie lo escribe a mano (lo llena el disparador de abajo)
create policy "cambios: los admins ven" on public.cambios for select to authenticated using ((select public.is_admin()));
revoke all on public.cambios from anon, authenticated;
grant select on public.cambios to authenticated;

create function public.anotar_cambio() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  nombre text;
begin
  nombre := coalesce(r->>'title', r->>'name', r->>'q', r->>'label', r->>'code', r->>'id');
  if tg_table_name = 'user_roles' then nombre := (select email from auth.users where id = (r->>'user_id')::uuid) || ' · ' || coalesce(r->>'role', ''); end if;
  insert into public.cambios (who, who_email, tabla, accion, fila, antes, despues)
  values (
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    tg_table_name,
    case tg_op when 'INSERT' then 'crear' when 'UPDATE' then 'editar' else 'borrar' end,
    left(nombre, 120),
    case when tg_op = 'INSERT' then null else to_jsonb(old) - 'created_by' end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) - 'created_by' end
  );
  return null;
end; $$;
revoke all on function public.anotar_cambio() from public, anon, authenticated;

create trigger cambios_avisos     after insert or update or delete on public.avisos     for each row execute function public.anotar_cambio();
create trigger cambios_kiosco     after insert or update or delete on public.kiosco     for each row execute function public.anotar_cambio();
create trigger cambios_links      after insert or update or delete on public.links      for each row execute function public.anotar_cambio();
create trigger cambios_faq        after insert or update or delete on public.faq        for each row execute function public.anotar_cambio();
create trigger cambios_catedras   after insert or update or delete on public.catedras   for each row execute function public.anotar_cambio();
create trigger cambios_user_roles after insert or update or delete on public.user_roles for each row execute function public.anotar_cambio();
