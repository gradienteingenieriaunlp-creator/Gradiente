// Baja el calendario académico oficial de la Facultad a data/fechas.json (almanaque del inicio).
// Reescribe solo "oficial"; lo que cargue Gradiente a mano en "extra" (paros, asuetos, eventos) se conserva.
// Uso: node tools/actualizar-fechas.mjs
import { readFile, writeFile } from "node:fs/promises";

const URL_CAL = "https://ing.unlp.edu.ar/institucional/calendario-ano-lectivo-completo/";
const FILE = new URL("../data/fechas.json", import.meta.url);

const html = await (await fetch(URL_CAL)).text();
const text = html.replace(/<(script|style)[\s\S]*?<\/\1>/g, "").replace(/<[^>]+>/g, "\n")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#8211;/g, "–").replace(/&#8220;|&#8221;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
  .split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);

const iso = (d) => { const [dd, mm, yy] = d.split("/"); return `${yy}-${mm}-${dd}`; };
// tipo según el texto: define el color en el almanaque
function kind(t) {
  if (/^(F\.N\.[IT]|N\.L)\b|feriado|no laborable|cerrada|asueto|receso/i.test(t)) return "feriado";
  if (/^inscripci[oó]n|^per[ií]odo de inscripci[oó]n|baja de inscripciones/i.test(t)) return "inscripcion";
  if (/mesas? de/i.test(t)) return "finales";
  if (/parciales|evaluaciones/i.test(t)) return "parciales";
  if (/comienzo de clases|inicio de|fin de actividades|finaliza el ciclo/i.test(t)) return "clases";
  return "info";
}

const oficial = [];
for (let i = 0; i < text.length; i++) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(text[i])) continue;
  const ev = { d: iso(text[i]) };
  let j = i + 1;
  const h = /^hasta el (\d{2}\/\d{2}\/\d{4})$/.exec(text[j] || "");
  if (h) { ev.h = iso(h[1]); j++; }
  if (!text[j] || /^\d{2}\/\d{2}\/\d{4}$/.test(text[j])) continue;
  ev.t = text[j].replace(/\s*\.$/, "");
  ev.k = kind(ev.t);
  oficial.push(ev);
  i = j;
}
if (!oficial.length) throw new Error("No pude leer fechas del calendario (¿cambió la página?)");

let prev = {};
try { prev = JSON.parse(await readFile(FILE, "utf8")); } catch (e) {}
const out = { fuente: URL_CAL, actualizado: new Date().toISOString().slice(0, 10), extra: prev.extra || [], oficial };
await writeFile(FILE, JSON.stringify(out, null, 1) + "\n");
console.log(`${oficial.length} fechas oficiales guardadas (${out.extra.length} extra conservadas).`);
