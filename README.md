# Gradiente · Ingeniería UNLP

Rediseño completo del sitio. HTML/CSS/JS sin build, pensado primero para celular e instalable como app (PWA).

## Secciones

- `#/` Inicio: saludo, accesos rápidos (tarjetas de color), tu carrera desplegable (cursando ahora + acordeones «Podés cursar» / «Finales»), chat de preguntas frecuentes y «Quiénes somos».
- `#/plan` Mi plan: los 13 planes de Ingeniería UNLP con correlativas, vista **Lista** y **Árbol**.
- `#/recursos` Nube (con buscador de materia), links de `links.json` en bloques de color por categoría, buscador y barra de categorías que queda fija.
- **Consultas** (botón rojo arriba, o `#/consultas`): asistente «¿En qué te ayudamos?». Primero la nube; después temas (materia, trámites, becas, cuentas, Gradiente). En «materia» buscás la materia y te da el mail y la página de la cátedra.
- `#/mesita` Productos y promos de `kiosco.json`.

## Qué editar

| Qué | Dónde |
|---|---|
| Links, avisos (categoría `Avisos`) | `data/links.json` |
| Mesita | `data/kiosco.json` |
| Form de consultas, Drive, redes, accesos rápidos | `config.js` |
| Planes de estudio | `data/planes.json` |
| Preguntas frecuentes del chat (respuestas, palabras clave, links) | `data/faq.json` |
| Quiénes somos / historia / accesos rápidos (ícono y color) | `config.js` → `about`, `quickLinks` |
| Qué materias tienen material en la nube | `data/nube.json` |
| Categorías de Recursos (color, ícono, bajada) y temas de Consultas | `config.js` (`categories`, `help`) |
| Nombre lindo y bajada de cada link | `label` y `desc` en `data/links.json` (opcionales) |
| Mails y páginas de cátedras | `data/catedras.json` → se regenera con `node tools/actualizar-catedras.mjs` |
| Carpeta de Drive de cada materia (link directo del buscador de la Nube) | `d` en `data/nube.json` → `node tools/actualizar-nube-links.mjs` |
| Calendario del inicio | `data/fechas.json` → `oficial` se baja con `node tools/actualizar-fechas.mjs`; `extra` es a mano (ver abajo) |

## planes.json

Cada carrera tiene `courses` (plan troncal), `opt` (optativas) y `hum` (humanísticas). Por materia:

- `c` código · `n` nombre · `s` semestre (0 = nivelación, -1 = idioma)
- `r` correlativas (códigos) · `x` condición en texto · `min` materias aprobadas mínimas · `sem` tener aprobado hasta ese semestre
- `k`: `afc`, `lang` (inglés), `slot` (optativa/electiva a elección, con `pool`)
- `a`: 1 si es anual

Fuente: planes oficiales en www1.ing.unlp.edu.ar (septiembre 2026). Computación usa el plan 2024; el resto, 2018.

## catedras.json

Sale de la página pública de Cátedras de la Facultad (www1.ing.unlp.edu.ar/catedras). Por código de materia: `p` = id de la página de la cátedra, `m` = mail que la cátedra publica como «Contacto». Solo se toma ese mail, no los de cada docente. Conviene correr el script cada cuatrimestre.

## Reglas que aplica

- Para **cursar**: correlativas regulares o aprobadas (Inglés tiene que estar aprobado).
- Para **rendir final / promocionar**: correlativas aprobadas.
- También chequea "tener N materias aprobadas" y "7° semestre aprobado".

El progreso se guarda en `localStorage` del dispositivo; se puede pasar a otro con un link (menú ⋯ del plan).

## Estructura

```
index.html · config.js · manifest.webmanifest · sw.js
assets/   app.js, app.css, intro.js, íconos y logos
data/     todos los JSON (links, kiosco, planes, nube, faq, fechas, cátedras…)
tools/    scripts para regenerar datos (no se publican, ver .vercelignore)
v2/sw.js  solo da de baja la app vieja instalada desde /v2/ (borrar en 2027)
```

Los links viejos (`/parciales`, `/ingresantes`, `/mapa`, `/consultas`, `/mesa`, `/v2/`, `/?route=…`) redirigen a la sección nueva: ver `vercel.json` y el script del `<head>` de `index.html`. El sitio viejo quedó guardado en el tag git `sitio-viejo`.

Probar local: `python -m http.server 5174` en esta carpeta y abrir http://localhost:5174/.

## Cuentas (opcionales)

Login con Google o con mail + contraseña usando Supabase. Sin cuenta la app anda igual que siempre: todo queda en el `localStorage` del dispositivo.

- **Prender:** en `config.js` → `auth` poner `enabled: true`, `url` y `anonKey` (Supabase → Project Settings → API). La anonKey es pública; los datos los protegen las reglas RLS.
- **Base:** `supabase/migrations/001_cuentas.sql` crea `profiles` y `plan_state` (una fila por persona, cada uno solo ve la suya), el trigger que arma el perfil al registrarse y `delete_my_account()`.
- **Cliente:** `assets/auth.js` (expone `window.GAuth`). Usa el flujo PKCE porque el router va por hash: vuelve con `?code=`, se canjea y se limpia la URL antes de arrancar.
- **Sincronización** (en `assets/app.js`, bloque CUENTAS):
  - cada `save()` / `saveProfile()` / cambio de colores sube todo 1,5 s después; sin red queda `gradiente.dirty` y se reintenta al volver la conexión o la pestaña;
  - al abrir la app y al volver a la pestaña baja lo de la cuenta si es más nuevo;
  - el primer login en un dispositivo junta lo local con la cuenta materia por materia (gana `a > r > c > p`, con nota si empatan) y suma optativas propias y actividades de AFC.
- **Privacidad:** `#/privacidad` (Ley 25.326). Desde el perfil se puede cerrar sesión borrando el dispositivo y borrar la cuenta.

Configuración externa (una sola vez): Site URL y Redirect URLs en Supabase Auth (dominio, `www`, `http://localhost:5174/**` y previews de Vercel), proveedor Google (OAuth Client Web con redirect `https://<ref>.supabase.co/auth/v1/callback`), confirmación de mail y SMTP propio.

## Modo desarrollo

En `localhost` (o agregando `?dev` a la URL) aparece un botón amarillo **DEV** abajo a la izquierda:

- **Ver como primera vez**: borra carrera, progreso y tema.
- **Modo prueba**: nada de lo que toques se guarda; al recargar vuelve a lo guardado.
- **Cargar progreso de ejemplo** y **Borrar progreso**.

En el sitio publicado no aparece (salvo con `?dev`).

## fechas.json

`oficial` sale del [calendario académico de la Facultad](https://ing.unlp.edu.ar/institucional/calendario-ano-lectivo-completo/) (correr el script cuando lo actualicen). `extra` es lo que carga Gradiente a mano y el script no lo toca. Ejemplo:

```json
"extra": [
  { "d": "2026-10-01", "t": "Paro docente", "k": "paro", "n": "Sin clases en toda la Facultad" },
  { "d": "2026-10-05", "h": "2026-10-09", "t": "Semana de la Ingeniería", "k": "evento", "url": "https://..." }
]
```

`d` = desde, `h` = hasta (opcional), `k` = tipo: `paro`, `feriado`, `aviso`, `parciales`, `finales`, `inscripcion`, `clases`, `evento` (Gradiente) o `info`. `n` (nota) y `url` son opcionales.
