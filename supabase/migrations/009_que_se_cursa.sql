-- Gradiente · qué se cursa: cuántos alumnos con cuenta cursan (o tienen para rendir) cada materia.
-- Organizadores: solo números (si hay menos de 3, no se muestra el número). Admins: números exactos y quiénes son.
-- Se cuenta solo la carrera actual de cada uno y a quien usó la página en los últimos 6 meses.

create function public.cursadas_resumen()
returns table (career text, code text, cursando integer, regulares integer)
language plpgsql stable security definer set search_path = '' as $$
declare adm boolean := public.is_admin();
begin
  if not public.is_staff() then raise exception 'solo el equipo'; end if;
  return query
    with m as (
      select p.career as car, e.key as cod, e.value->>'s' as st
      from public.plan_state p, jsonb_each(coalesce(p.prog -> p.career, '{}'::jsonb)) e
      where p.career is not null and p.updated_at > now() - interval '6 months' and jsonb_typeof(e.value) = 'object'
    ), c as (
      select car, cod, count(*) filter (where st = 'c')::int as cu, count(*) filter (where st = 'r')::int as re
      from m group by car, cod
    )
    select car, cod,
      case when adm or cu >= 3 then cu else case when cu > 0 then -1 else 0 end end,
      case when adm or re >= 3 then re else case when re > 0 then -1 else 0 end end
    from c where cu > 0 or re > 0;
end; $$;

create function public.cursadas_activos()
returns integer language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'solo el equipo'; end if;
  return (select count(*)::int from public.plan_state where career is not null and updated_at > now() - interval '6 months');
end; $$;

-- solo admins: quiénes cursan (estado 'c') o tienen para rendir (estado 'r') una materia
create function public.cursadas_quienes(materia text, estado text default 'c')
returns table (name text, email text, career text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'solo admins'; end if;
  if estado not in ('c', 'r') then raise exception 'estado inválido'; end if;
  return query
    select coalesce(pr.name, '')::text, u.email::text, p.career
    from public.plan_state p
    join auth.users u on u.id = p.user_id
    left join public.profiles pr on pr.id = p.user_id
    where p.career is not null and p.updated_at > now() - interval '6 months'
      and (p.prog -> p.career -> materia ->> 's') = estado
    order by pr.name nulls last, u.email;
end; $$;

revoke all on function public.cursadas_resumen(), public.cursadas_activos(), public.cursadas_quienes(text, text) from public, anon;
grant execute on function public.cursadas_resumen(), public.cursadas_activos(), public.cursadas_quienes(text, text) to authenticated;
