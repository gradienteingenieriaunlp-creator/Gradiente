-- Gradiente · mesita (kits y productos). Los lee cualquiera; los cargan y editan organizadores y admins.
-- Reemplaza a data/kiosco.json (que queda de respaldo si Supabase no responde).

create table public.kiosco (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'producto' check (kind in ('kit', 'producto')),
  name        text not null check (char_length(name) between 2 and 80),
  price       integer not null default 0 check (price >= 0 and price <= 10000000),
  category    text check (char_length(category) <= 40),
  description text check (char_length(description) <= 300),
  items       text[] not null default '{}' check (cardinality(items) <= 12),
  label       text check (char_length(label) <= 40),
  image       text check (image is null or char_length(image) <= 400),
  in_stock    boolean not null default true,
  active      boolean not null default true,
  priority    integer not null default 50,
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index kiosco_orden on public.kiosco (kind, priority);

alter table public.kiosco enable row level security;
-- cualquiera ve lo que está a la venta; el equipo ve también lo oculto
create policy "kiosco: ver"            on public.kiosco for select to anon, authenticated using (active or (select public.is_staff()));
create policy "kiosco: el equipo crea" on public.kiosco for insert to authenticated with check ((select public.is_staff()));
create policy "kiosco: el equipo edita" on public.kiosco for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "kiosco: el equipo borra" on public.kiosco for delete to authenticated using ((select public.is_staff()));
revoke all on public.kiosco from anon;
revoke select on public.kiosco from authenticated;
grant select (id, kind, name, price, category, description, items, label, image, in_stock, active, priority, updated_at) on public.kiosco to anon, authenticated;

create function public.kiosco_touch() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;
create trigger kiosco_touch before update on public.kiosco for each row execute function public.kiosco_touch();

-- lo que ya estaba en data/kiosco.json
insert into public.kiosco (kind, name, price, category, description, items, label, image, in_stock, active, priority) values
  ('kit', 'Kit 1 cuaderno', 6000, null, null, array['1 cuaderno A4','1 lápiz','1 lapicera','1 goma','1 regla']::text[], 'Kit Gradiente', null, true, true, 1),
  ('kit', 'Kit 2 cuadernos', 8000, null, null, array['2 cuadernos A4','1 lápiz','1 lapicera','1 organizador']::text[], 'Kit Gradiente', null, true, true, 2),
  ('kit', 'Kit 3 cuadernos', 10000, null, null, array['3 cuadernos A4','1 lápiz','1 lapicera','1 organizador']::text[], 'Kit Gradiente', null, true, true, 3),
  ('producto', 'Cuadernillo A4', 3500, 'Cuadernos', 'Llevando 2: $7.000', '{}'::text[], null, null, true, true, 1),
  ('producto', 'Lapicera', 800, 'Librería', 'Tinta azul o negra según disponibilidad.', '{}'::text[], null, null, true, true, 2),
  ('producto', 'Lápiz', 500, 'Librería', 'Lápiz negro para la cursada.', '{}'::text[], null, null, true, true, 3),
  ('producto', 'Minas', 800, 'Librería', 'Repuesto para portaminas.', '{}'::text[], null, null, true, true, 4),
  ('producto', 'Goma', 400, 'Librería', 'Goma de borrar.', '{}'::text[], null, null, true, true, 5),
  ('producto', 'Regla', 300, 'Librería', 'Regla para la cursada.', '{}'::text[], null, null, true, true, 6),
  ('producto', 'Resaltador', 1000, 'Librería', 'Color según disponibilidad.', '{}'::text[], null, null, true, true, 7),
  ('producto', 'Don Satur', 1200, 'Snacks', 'Bizcochos para la cursada.', '{}'::text[], null, null, true, false, 8)
;
