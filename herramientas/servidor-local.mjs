// Servidor local mínimo, sin dependencias: sirve la carpeta del proyecto en http://localhost:8780
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PUERTO = Number(process.env.PORT) || 8780;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon' };

createServer(async (req, res) => {
  try {
    let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (ruta.endsWith('/')) ruta += 'index.html';
    const archivo = normalize(join(RAIZ, ruta));
    if (!archivo.startsWith(RAIZ + sep) && archivo !== RAIZ) throw Object.assign(new Error('fuera'), { code: 'ENOENT' });
    if (/[\/]\.|[\/]node_modules[\/]|[\/]herramientas[\/]/.test(archivo.slice(RAIZ.length))) throw Object.assign(new Error('oculto'), { code: 'ENOENT' });
    if (!(await stat(archivo)).isFile()) throw Object.assign(new Error('no'), { code: 'ENOENT' });
    res.writeHead(200, { 'content-type': TIPOS[extname(archivo).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(await readFile(archivo));
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('No encontrado');
  }
}).listen(PUERTO, '127.0.0.1', () => console.log(`Oficina virtual 3D en http://localhost:${PUERTO}`));
