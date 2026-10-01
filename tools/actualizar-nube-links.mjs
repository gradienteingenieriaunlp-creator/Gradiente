// Agrega a data/nube.json el id de la carpeta de Drive de cada materia ("d"),
// para que el buscador de la Nube lleve directo a esa carpeta.
// Lee la carpeta pública "Parciales" de la Nube (vista embebida de Drive, sin API key).
// Uso: node tools/actualizar-nube-links.mjs
import { readFile, writeFile } from "node:fs/promises";

const ROOT = "1nqMOCWnGQf4hijaALpiovu1L5c6PvUJb"; // carpeta raíz de la Nube (config.driveUrl)
const FILE = new URL("../data/nube.json", import.meta.url);

const unesc = (s) => s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
async function list(id) {
  const html = await (await fetch("https://drive.google.com/embeddedfolderview?id=" + id)).text();
  const re = /href="https:\/\/drive\.google\.com\/drive\/folders\/([\w-]+)"[\s\S]*?flip-entry-title">([^<]*)/g;
  const out = []; let m;
  while ((m = re.exec(html))) out.push({ id: m[1], name: unesc(m[2]) });
  return out;
}
const ROMAN = { i: "1", ii: "2", iii: "3", iv: "4", lll: "3" };
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/\(.*$/, "").replace(/[^a-z0-9]+/g, " ").trim()
  .split(" ").map((w) => ROMAN[w] || w).join(" ");
const codes = (s) => (s.toUpperCase().match(/[A-Z]\d{4}/g) || []);

const parciales = (await list(ROOT)).find((f) => /parciales/i.test(f.name));
if (!parciales) throw new Error("No encontré la carpeta Parciales en la Nube");
const folders = await list(parciales.id);
const nube = JSON.parse(await readFile(FILE, "utf8"));

let hit = 0; const miss = [];
for (const [code, v] of Object.entries(nube)) {
  const want = new Set(v.f.flatMap(codes));
  const names = new Set(v.f.map(norm));
  // Drive corta los nombres largos: si el nombre quedó cortado, alcanza con que empiece igual
  const byName = (f) => names.has(norm(f.name)) || (f.name.length >= 45 && [...names].some((n) => n.startsWith(norm(f.name))));
  // si la carpeta de Drive tiene código, manda el código; si no, el nombre
  const found = folders.filter((f) => codes(f.name).length ? codes(f.name).some((c) => want.has(c)) : byName(f));
  if (found.length) { v.d = found.map((f) => f.id); hit++; } else { delete v.d; miss.push(code + " " + v.f[0]); }
}
console.log("Carpeta Parciales: https://drive.google.com/drive/folders/" + parciales.id);
await writeFile(FILE, JSON.stringify(nube));
console.log(`${hit}/${Object.keys(nube).length} materias con carpeta directa en Drive.`);
if (miss.length) console.log("Sin carpeta (van a la carpeta Parciales):\n  " + miss.join("\n  "));
