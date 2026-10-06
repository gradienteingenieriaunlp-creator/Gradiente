-- Gradiente · reglas extra para que lo que carga el equipo no pueda meter links raros.
-- Página de cátedra: o un link https o el pedacito de ruta de la web de la Facultad.
alter table public.catedras add constraint catedras_page_ok check (page is null or page ~ '^(https://[^\s"<>]+|[A-Za-z0-9_./-]+)$');
-- Fotos de avisos y de la mesita: solo links https.
alter table public.avisos add constraint avisos_image_https check (image is null or image ~* '^https://[^\s"<>]+$');
alter table public.kiosco add constraint kiosco_image_https check (image is null or image ~* '^https://[^\s"<>]+$');
-- Botones de las preguntas frecuentes: cada uno con un texto; los links, solo web, mail o rutas de la página.
create function public.faq_links_ok(l jsonb) returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(l) = 'array' and not exists (
    select 1 from jsonb_array_elements(l) b
    where jsonb_typeof(b) <> 'object'
       or coalesce(b->>'label', '') = ''
       or (b ? 'url' and (b->>'url') !~* '^(https?://|mailto:)')
       or (b ? 'go' and (b->>'go') !~ '^(#/[A-Za-z0-9/?=&_.-]*|catedra|consulta|cal|about)$')
  );
$$;
alter table public.faq add constraint faq_links_ok check (public.faq_links_ok(links));
