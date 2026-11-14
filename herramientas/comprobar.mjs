// Comprobador: que la configuración cargue, que existan todos los modelos y archivos que pide el código.
import { readFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));
let fallos = 0;
const mal = (m) => { fallos++; console.log('✗ ' + m); }, bien = (m) => console.log('✓ ' + m);
const existe = (p) => access(join(RAIZ, p)).then(() => true, () => false);

// 1) configuración
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(await readFile(join(RAIZ, 'oficina.config.js'), 'utf8'), ctx);
const C = ctx.window.OFICINA;
if (!C) mal('oficina.config.js no define window.OFICINA');
else {
  const deps = C.departamentos || [];
  if (!deps.length) mal('No hay departamentos'); if (deps.length > 5) mal('Máximo 5 departamentos (hay ' + deps.length + ')');
  const ids = new Set();
  for (const d of deps) {
    if (!d.id || ids.has(d.id)) mal(`Departamento sin id o repetido: ${d.nombre}`); ids.add(d.id);
    for (const a of d.agentes || []) { if (a.id && ids.has(a.id)) mal(`Id repetido: ${a.id}`); if (a.id) ids.add(a.id); }
  }
  bien(`Configuración: «${C.empresa}», ${deps.length} departamentos, ${deps.reduce((n, d) => n + (d.agentes || []).length, 0)} agentes`);
}

// 2) archivos que pide el código
const js = await readFile(join(RAIZ, 'oficina3d.js'), 'utf8');
const M = JSON.parse(js.match(/const M = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
const pedidos = [...M.map((m) => `modelos/muebles/${m}.glb`), 'modelos/personas/xbot.glb', 'modelos/ciudad/Textures/colormap.png',
  ...'abcdefghijklmn'.split('').map((l) => `modelos/ciudad/building-${l}.glb`), ...'abcde'.split('').map((l) => `modelos/ciudad/building-skyscraper-${l}.glb`),
  'vendor/three.module.js', 'vendor/OrbitControls.js', 'vendor/GLTFLoader.js', 'vendor/SkeletonUtils.js', 'vendor/BufferGeometryUtils.js', 'oficina.config.js', 'oficina3d.js', 'index.html'];
const faltan = []; for (const p of pedidos) if (!(await existe(p))) faltan.push(p);
faltan.length ? faltan.forEach((p) => mal('Falta ' + p)) : bien(`${pedidos.length} archivos referenciados, todos presentes`);

// 3) nada de llamadas a servidor
if (/fetch\(|\/api\//.test(js)) mal('oficina3d.js llama a un servidor (fetch o /api/)'); else bien('Sin llamadas a servidor: es una web estática');

console.log(fallos ? `\n${fallos} problema(s)` : '\nTodo en orden.'); process.exit(fallos ? 1 : 0);
