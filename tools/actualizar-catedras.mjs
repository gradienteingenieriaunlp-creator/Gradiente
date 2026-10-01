// Actualiza data/catedras.json con el mail de contacto y la página de cada cátedra,
// tal como los publica la Facultad en https://www1.ing.unlp.edu.ar/catedras/
//
// Uso (desde la carpeta Gradiente, con Node 18+):
//   node tools/actualizar-catedras.mjs
//
// Solo toma el mail que la cátedra muestra como "Contacto:" en su página pública.
import { writeFile } from "node:fs/promises";

const BASE = "https://www1.ing.unlp.edu.ar/catedras/";
const DPTOS = "abcdefghijklmnopqrstuvwxyz".split("");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url) { const r = await fetch(url); if (!r.ok) throw new Error(url + " " + r.status); return r.json(); }
async function getText(url) { const r = await fetch(url); if (!r.ok) throw new Error(url + " " + r.status); return r.text(); }

const rows = [];
for (const d of DPTOS) {
  try {
    const j = await getJSON(`${BASE}api/?accion=getCatedras&dpto=${d}`);
    (j.aaData || []).forEach((r) => rows.push(r));
  } catch { /* departamento inexistente */ }
}
console.log(`${rows.length} cátedras`);

const out = {};
let withMail = 0;
for (let i = 0; i < rows.length; i += 8) {
  await Promise.all(rows.slice(i, i + 8).map(async (r) => {
    let mail = "";
    try {
      const html = await getText(BASE + r.id);
      const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      const m = text.match(/Contacto:\s*([\w.+-]*\w@[\w.-]+\.\w+)/);
      if (m) mail = m[1].toLowerCase();
    } catch (e) { console.warn("  sin página:", r.id); }
    if (mail) withMail++;
    const codes = [...new Set(String(r.catedra || "").match(/[A-Z]\d{4}/g) || [])];
    if (!codes.length) codes.push(r.id);
    for (const c of codes) {
      if (out[c] && out[c].m && !mail) continue;
      out[c] = mail ? { p: r.id, m: mail } : { p: r.id };
    }
  }));
  await sleep(300);
}
const today = new Date().toISOString().slice(0, 10);
const file = new URL("../data/catedras.json", import.meta.url);
await writeFile(file, JSON.stringify({ updated: today, source: BASE, base: BASE, c: out }));
console.log(`Listo: ${Object.keys(out).length} códigos, ${withMail} cátedras con mail → data/catedras.json`);
