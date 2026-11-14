// OFICINA VIRTUAL 3D · por Profitia (https://profitia.digital)
// Una oficina futurista en 3D: cada departamento es un edificio con un puesto por agente.
// Los agentes (Xbot) trabajan en su mesa, consultan a compañeros, entregan a su responsable y descansan en la zona de ocio.
// Todo sale de oficina.config.js (datos de ejemplo) y la actividad es una simulación: no hay servidor ni base de datos.
// Muebles y ciudad: Kenney (CC0). Cámara libre: arrastrar gira, clic derecho/Shift desplaza, rueda acerca, WASD mueve.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import * as SkeletonUtils from './vendor/SkeletonUtils.js';

const CFG = window.OFICINA || { empresa: 'Mi Empresa', departamentos: [] };
const raiz = document.getElementById('mundo');
const capa = document.getElementById('etiquetas');

// ---------- motor (con modo PS1: baja resolución y píxel duro) ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.82;
renderer.outputColorSpace = THREE.SRGBColorSpace;
raiz.appendChild(renderer.domElement);
let ps1 = new URLSearchParams(location.search).has('ps1');   // ?ps1 en la dirección: estilo consola de 1998
const escena = new THREE.Scene();
escena.background = new THREE.Color('#eef2f8');
escena.fog = new THREE.Fog('#eef2f8', 90, 210);
// entorno claro para que el suelo y los trajes brillen (reflejos suaves, sin archivos externos)
{
  const pm = new THREE.PMREMGenerator(renderer), e = new THREE.Scene();
  const g = new THREE.SphereGeometry(50, 32, 16), col = [], pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) { const k = (pos.getY(i) / 50 + 1) / 2; const c = new THREE.Color('#c9d3e2').lerp(new THREE.Color('#ffffff'), Math.min(1, k * 1.5)); col.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  e.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  escena.environment = pm.fromScene(e).texture; escena.environmentIntensity = 0.4; pm.dispose();
}
const camara = new THREE.PerspectiveCamera(30, 1, 0.1, 600);          // lente larga, como la cámara de televisión
const controles = new OrbitControls(camara, renderer.domElement);
controles.enableDamping = true; controles.dampingFactor = 0.08;
controles.maxPolarAngle = 1.38; controles.minDistance = 4; controles.maxDistance = 120;
controles.screenSpacePanning = false;
// ---------- efecto PlayStation 1 (todo el mundo) ----------
// 1) se pinta a 240 líneas en una textura sin suavizar; 2) colores de 15 bits con trama Bayer 4×4 como la consola;
// 3) los vértices se ajustan a una rejilla de pantalla baja (el «temblor» de la PS1); 4) texturas sin filtrar.
const PS1_LINEAS = 240;
let rt = null;
const SNAP = { uSnap: { value: new THREE.Vector2(160, 120) }, uSnapOn: { value: 1 } };
const camPost = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const escenaPost = new THREE.Scene();
const matPost = new THREE.ShaderMaterial({
  uniforms: { t: { value: null }, res: { value: new THREE.Vector2(320, 240) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: `uniform sampler2D t; uniform vec2 res; varying vec2 vUv;
    float bayer(vec2 p){ int i = int(mod(p.x,4.)) + int(mod(p.y,4.))*4;
      float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.); return m[i]/16. - .5; }
    void main(){
      vec3 c = texture2D(t, vUv).rgb;
      c = pow(max(c, 0.), vec3(1./2.2));                       // a sRGB
      c += bayer(floor(vUv*res)) / 46.;                        // trama
      c = floor(c*31. + .5) / 31.;                             // 5 bits por canal
      gl_FragColor = vec4(clamp(c, 0., 1.), 1.);
    }`,
  depthTest: false, depthWrite: false,
});
escenaPost.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), matPost));
const conPs1 = new WeakSet();
function ps1izar(raiz = escena) {
  raiz.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m || conPs1.has(m)) continue; conPs1.add(m);
      if (m.map) conMapa.add(m.map);
      m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, SNAP);
        sh.vertexShader = 'uniform vec2 uSnap; uniform float uSnapOn;\n' + sh.vertexShader.replace('#include <project_vertex>',
          '#include <project_vertex>\nif (uSnapOn > .5) { vec4 sp = gl_Position; sp.xy = floor(sp.xy / sp.w * uSnap + .5) / uSnap * sp.w; gl_Position = sp; }');
      };
      m.customProgramCacheKey = () => 'ps1';
      m.needsUpdate = true;
    }
  });
}
const conMapa = new Set();
function filtros() {
  for (const t of conMapa) { t.magFilter = ps1 ? THREE.NearestFilter : THREE.LinearFilter; t.minFilter = ps1 ? THREE.NearestFilter : THREE.LinearMipmapLinearFilter; t.generateMipmaps = !ps1; t.anisotropy = ps1 ? 1 : 8; t.needsUpdate = true; }
}
function ajustar() {
  const r = raiz.getBoundingClientRect();
  renderer.setPixelRatio(ps1 ? 1 : Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(r.width, r.height);
  const asp = r.width / Math.max(r.height, 1);
  camara.aspect = asp; camara.updateProjectionMatrix();
  const w = Math.round(PS1_LINEAS * asp);
  if (!rt) rt = new THREE.WebGLRenderTarget(w, PS1_LINEAS, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
  rt.setSize(w, PS1_LINEAS);
  matPost.uniforms.res.value.set(w, PS1_LINEAS);
  SNAP.uSnap.value.set(w / 2, PS1_LINEAS / 2);
  SNAP.uSnapOn.value = ps1 ? 1 : 0;
}
function pintar() {
  if (!ps1) { renderer.setRenderTarget(null); renderer.render(escena, camara); return; }
  renderer.setRenderTarget(rt); renderer.render(escena, camara);
  renderer.setRenderTarget(null); matPost.uniforms.t.value = rt.texture; renderer.render(escenaPost, camPost);
}
addEventListener('resize', ajustar);

escena.add(new THREE.HemisphereLight('#ffffff', '#aab4c4', 0.6));
const sol = new THREE.DirectionalLight('#ffffff', 2.0);
sol.position.set(-46, 32, 26);          // sol bajo: sombras largas de estadio sol.castShadow = true;
sol.shadow.mapSize.set(4096, 4096);
Object.assign(sol.shadow.camera, { left: -62, right: 62, top: 62, bottom: -62, near: 1, far: 200 });
sol.shadow.bias = -0.0005;
escena.add(sol);

const cacheMat = new Map();
const mat = (c, r = 0.85, extra = {}) => { const k = c + r + JSON.stringify(extra); if (!cacheMat.has(k)) cacheMat.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: r, ...extra })); return cacheMat.get(k); };
const plano = (c) => mat(c, 0.9, { flatShading: true });
function caja(w, h, d, c, x, y, z, padre = escena, sombra = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof c === 'string' ? mat(c) : c);
  m.position.set(x, y, z); m.castShadow = sombra; m.receiveShadow = true; padre.add(m); return m;
}
function textura(ancho, alto, dibujar, nitida = false) {
  const cv = document.createElement('canvas'); cv.width = ancho; cv.height = alto;
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  if (nitida) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; } else t.anisotropy = 4;
  t.redibujar = () => { dibujar(cv.getContext('2d'), cv); t.needsUpdate = true; };
  t.redibujar(); return t;
}
function letrero(texto, color, ancho = 1024, alto = 128, fondo = '#ffffff', tinta = '#1d2433', px = 64) {
  return textura(ancho, alto, (c, cv) => {
    c.fillStyle = fondo; c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = color; c.fillRect(0, cv.height - Math.round(alto / 9), cv.width, Math.round(alto / 9));
    c.fillStyle = tinta; c.font = `700 ${px}px system-ui, Segoe UI, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(texto, cv.width / 2, cv.height * 0.45);
  });
}
const clicables = [];

// ---------- modelos Kenney ----------
const cargador = new GLTFLoader();
const MODELOS = {};
async function cargar(nombre, ruta) {
  const g = await cargador.loadAsync(ruta);
  const BL = new THREE.Color('#ffffff'), vistos = new Set();
  g.scene.traverse((o) => {
    if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m || vistos.has(m)) continue; vistos.add(m);
      if (m.color) { const hsl = {}; m.color.getHSL(hsl); const oscuro = hsl.l < 0.22; m.color.setHSL(0.6, 0.06 + hsl.s * 0.08, oscuro ? 0.16 : 0.5 + hsl.l * 0.34); }
      if ('roughness' in m) { m.roughness = 0.38; m.metalness = 0.05; }
      if (m.map) { m.map = null; m.needsUpdate = true; } if (m.vertexColors) { m.vertexColors = false; m.needsUpdate = true; }
    }
  });
  if (/^table/i.test(nombre)) { const blanco = new THREE.MeshStandardMaterial({ color: '#f1f4f8', roughness: 0.25, metalness: 0.1 }); g.scene.traverse((o) => { if (o.isMesh) o.material = blanco; }); }   // mesas blancas (traían madera)
  MODELOS[nombre] = g.scene;
}
// Copia un modelo con la base en el suelo, centrado, y escalado a un ancho (x) o alto (y) dado.
function modelo(nombre, { ancho, alto, x = 0, y = 0, z = 0, rot = 0, padre = escena } = {}) {
  const base = MODELOS[nombre]; if (!base) return null;
  const m = base.clone(true);
  const b = new THREE.Box3().setFromObject(m), s = new THREE.Vector3(); b.getSize(s);
  const k = ancho ? ancho / s.x : alto ? alto / s.y : 1;
  const c = new THREE.Vector3(); b.getCenter(c);
  const piv = new THREE.Group(); m.position.set(-c.x, -b.min.y, -c.z); piv.add(m);
  piv.scale.setScalar(k); piv.position.set(x, y, z); piv.rotation.y = rot; padre.add(piv);
  return piv;
}

// ---------- suelo, calles y plaza ----------
const suelo = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat('#d9dee7', 0.9)); suelo.rotation.x = -Math.PI / 2; suelo.receiveShadow = true; escena.add(suelo);
function losa(x, z, w, d, c, y = 0.01) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(c, 0.95)); p.rotation.x = -Math.PI / 2; p.position.set(x, y, z); p.receiveShadow = true; escena.add(p); return p; }
// EL SUELO: losas claras con rejilla y un círculo central
const CAMPO = { x: 0, z: 6, w: 100, d: 88 };
{
  const tx = textura(2000, 1760, (c) => {
    for (let i = 0; i < 20; i++) { c.fillStyle = '#e4e8ef'; c.fillRect(i * 100, 0, 100, 1760); }
    c.strokeStyle = '#d2d9e4'; c.lineWidth = 2; for (let x = 0; x <= 2000; x += 50) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 1760); c.stroke(); } for (let y = 0; y <= 1760; y += 50) { c.beginPath(); c.moveTo(0, y); c.lineTo(2000, y); c.stroke(); }
    
    c.strokeStyle = '#b9c4d6'; c.lineWidth = 5;
    const L = (x1, y1, x2, y2) => { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };
    c.strokeRect(60, 60, 1880, 1640);
    c.beginPath(); c.arc(1000, 880, 183, 0, Math.PI * 2); c.stroke();
    for (const lado of []) {
      const x0 = lado ? 1940 : 60, s = lado ? -1 : 1;
      c.strokeRect(Math.min(x0, x0 + s * 330), 880 - 403, 330, 806);
      c.strokeRect(Math.min(x0, x0 + s * 110), 880 - 184, 110, 368);
      c.beginPath(); c.arc(x0 + s * 220, 880, 6, 0, 7); c.fill();
      c.beginPath(); c.arc(x0 + s * 220, 880, 183, lado ? Math.PI * 0.705 : -Math.PI * 0.295, lado ? Math.PI * 1.295 : Math.PI * 0.295); c.stroke();
    }
    for (const [x, y, a] of [[60, 60, 0], [1940, 60, Math.PI / 2], [1940, 1700, Math.PI], [60, 1700, -Math.PI / 2]]) { c.beginPath(); c.arc(x, y, 20, a, a + Math.PI / 2); c.stroke(); }
  });
  const campo = new THREE.Mesh(new THREE.PlaneGeometry(CAMPO.w, CAMPO.d), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.22, metalness: 0.05 }));
  campo.rotation.x = -Math.PI / 2; campo.position.set(CAMPO.x, 0.012, CAMPO.z); campo.receiveShadow = true; escena.add(campo);
}
for (const z of [-52, 56]) { losa(0, z, 160, 8, '#dde3ec', 0.015); }
for (const x of [-64, 64]) { losa(x, 2, 8, 116, '#dde3ec', 0.015); }

function arbol(x, z, s = 1) {
  caja(0.3 * s, 1.3 * s, 0.3 * s, plano('#7a5a3c'), x, 0.65 * s, z);
  const copa = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0 * s, 0), plano('#6ea37a')); copa.position.set(x, 1.9 * s, z); copa.castShadow = true; escena.add(copa);
}

// ---------- núcleo central y tu oficina ----------
const centro = new THREE.Group(); centro.position.set(0, 0, 6); escena.add(centro);
caja(3, 0.5, 3, '#ffffff', 0, 0.25, 0, centro); caja(1.8, 0.3, 1.8, '#e8e4f7', 0, 0.65, 0, centro);
const COLOR_CENTRO = CFG.colorCentral || '#8b6cf0';
const nucleoMat = new THREE.MeshStandardMaterial({ color: COLOR_CENTRO, emissive: COLOR_CENTRO, emissiveIntensity: 0.8, roughness: 0.3, flatShading: true });
const nucleo = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 0), nucleoMat); nucleo.position.y = 2.5; nucleo.castShadow = true; centro.add(nucleo);
const luzCentro = new THREE.PointLight(COLOR_CENTRO, 10, 16); luzCentro.position.y = 2.5; centro.add(luzCentro);
const cCentro = new THREE.Sprite(new THREE.SpriteMaterial({ map: letrero(String(CFG.empresa || 'Mi Empresa').toUpperCase(), COLOR_CENTRO, 512, 96, '#2a2150', '#e6dcff', 44) })); cCentro.scale.set(3.4, 0.64, 1); cCentro.position.y = 4.0; centro.add(cCentro);

const OF = { x: 0, z: 24 };
const of = new THREE.Group(); of.position.set(OF.x, 0, OF.z); escena.add(of);
caja(10, 0.3, 7, '#f7f8fa', 0, 0.15, 0, of, false);
caja(10, 2.8, 0.25, '#ffffff', 0, 1.7, -3.4, of); caja(10, 0.12, 0.27, '#f0b43c', 0, 3.1, -3.4, of);
const cOf = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.75), new THREE.MeshBasicMaterial({ map: letrero('TU OFICINA', '#f0b43c', 512, 128) })); cOf.position.set(-2, 2.55, -3.26); of.add(cOf);
const papeles = [], notas = [];
const RECEP = { x: 0, z: 13 };
function montarRecepcion() {
  const g = new THREE.Group(); g.position.set(RECEP.x, 0, RECEP.z); escena.add(g);
  caja(6, 0.2, 4, '#f7f8fa', 0, 0.1, 0, g, false);
  caja(3.2, 1.05, 0.7, mat('#ffffff', 0.5), 0, 0.72, 0.6, g); caja(3.3, 0.08, 0.85, mat('#f0b43c', 0.4), 0, 1.28, 0.6, g);
  const c = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5), new THREE.MeshBasicMaterial({ map: letrero('RECEPCIÓN', '#f0b43c', 512, 100, '#ffffff', '#1d2433', 52) })); c.position.set(0, 0.75, 0.96); g.add(c);
  modelo('chairDesk', { ancho: 0.7, x: 0, z: -0.2, rot: 0, padre: g, y: 0.2 });
  modelo('computerScreen', { ancho: 0.7, x: 0.7, z: 0.55, y: 1.32, rot: Math.PI, padre: g });
  modelo('pottedPlant', { alto: 1.2, x: -2.6, z: -1.4, padre: g, y: 0.2 }); modelo('pottedPlant', { alto: 1.2, x: 2.6, z: -1.4, padre: g, y: 0.2 });
  const z = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 2.5), new THREE.MeshBasicMaterial({ visible: false })); z.position.set(RECEP.x, 1, RECEP.z); z.userData = { tipo: 'recepcion' }; escena.add(z); clicables.push(z);
}
function montarOficina() {
  modelo('desk', { ancho: 1.9, x: -2, z: -1.2, padre: of, y: 0.3 });
  modelo('chairDesk', { ancho: 0.7, x: -2, z: -2.1, rot: 0, padre: of, y: 0.3 });
  for (let i = 0; i < 8; i++) { const p = caja(0.3, 0.02, 0.4, '#fffdf3', -2.6 + (i % 4) * 0.4, 1.12, -1.35 + Math.floor(i / 4) * 0.45, of, false); p.visible = false; papeles.push(p); }
  caja(3, 1.8, 0.08, plano('#8a6440'), 2.6, 1.7, -3.22, of);
  const NC = ['#ffe27a', '#ffb3a1', '#a8e6b8', '#a9cbff'];
  for (let i = 0; i < 12; i++) { const n = caja(0.4, 0.4, 0.02, NC[i % 4], 1.5 + (i % 4) * 0.72, 2.25 - Math.floor(i / 4) * 0.55, -3.16, of, false); n.visible = false; notas.push(n); }
  modelo('pottedPlant', { alto: 1.2, x: 4.3, z: 2.6, padre: of, y: 0.3 }); modelo('pottedPlant', { alto: 1.2, x: -4.3, z: 2.6, padre: of, y: 0.3 });
  papeles.forEach((p, i) => (p.visible = i < 3)); notas.forEach((n, i) => (n.visible = i < 6));   // papeles y notas de ejemplo
}

// ---------- un edificio por departamento (oficina.config.js) ----------
const COLOR = {}, TITULO = {}, SITIO = {};
const HUECOS = [{ x: 0, z: -21 }, { x: -25, z: 7 }, { x: 25, z: 7 }, { x: -25, z: -21 }, { x: 25, z: -21 }];   // dónde va cada edificio (hasta 5)
(CFG.departamentos || []).slice(0, HUECOS.length).forEach((dp, i) => { COLOR[dp.id] = dp.color || '#7c5ce6'; TITULO[dp.id] = String(dp.nombre || dp.id).toUpperCase(); SITIO[dp.id] = HUECOS[i]; });
const ESTADO = {
  funciona: ['En marcha', '#3fae6a'], a_medias: ['A medias', '#e0a12f'], no_existe: ['Por crear', '#9aa3b3'],
};
const CELDA = { w: 4.6, d: 4.2 };
const EDIF = {};
function pantalla() {
  const est = { lineas: [] };
  const t = textura(160, 100, (c, cv) => {
    c.fillStyle = est.lineas.length ? '#0f2e22' : '#1c2333'; c.fillRect(0, 0, cv.width, cv.height);
    c.font = '10px Consolas, monospace';
    if (!est.lineas.length) { c.fillStyle = '#3b4560'; c.fillText('— en espera —', 40, 54); return; }
    c.fillStyle = '#7cf2b0'; est.lineas.slice(-6).forEach((l, i) => c.fillText('> ' + l.slice(0, 24), 5, 14 + i * 15));
  }, true);
  t.est = est; return t;
}
const PLACAS = [];
// En el suelo solo el color del estado (a 240 líneas el texto no se lee); el nombre va en una etiqueta nítida encima.
function placa(padre, x, z, nombre, estado) {
  const [txt, col] = ESTADO[estado] || [estado, '#9aa3b3'];
  const p = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.3), mat(col, 1)); p.position.set(x, 0.02, z); p.rotation.x = -Math.PI / 2; padre.add(p);
  const w = new THREE.Vector3(); padre.updateWorldMatrix(true, false); p.updateWorldMatrix(true, false); p.getWorldPosition(w);
  const el = document.createElement('div'); el.className = 'placa'; el.innerHTML = `<b></b><i></i>`;
  el.querySelector('b').textContent = nombre; const ch = el.querySelector('i'); ch.textContent = txt; ch.style.background = col;
  capa.appendChild(el); PLACAS.push({ el, pos: w });
}
// ---------- OFICINAS: cada departamento con lo que necesita para su trabajo ----------
// No hay dos iguales: el tipo de oficina sale del campo «oficina» de cada agente en oficina.config.js.
// El agente ve SU trabajo en su ordenador. Algunas oficinas tienen además una pantalla de pared (con cifras de demo).
const OF_W = 3.9, OF_D = 4.6, ZONA_HUECO = 0.5;
const PANTALLAS = [];
function mezclar(a, b, k) { return '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString(); }
function texZona(nombre, color) {
  return textura(1024, 160, (c) => { c.clearRect(0, 0, 1024, 160); c.fillStyle = color; c.globalAlpha = 0.85; c.font = '900 84px Arial Black, Arial'; c.textAlign = 'center'; c.fillText(nombre.toUpperCase(), 512, 110); });
}
// Pantallas de pared: cifras INVENTADAS de demostración (se ven «demo» en el título). Cámbialas o conéctalas a tus datos.
function datosPared(tipo) {
  if (tipo === 'finanzas') return { titulo: 'Caja · demo', barras: [['Entra', 42], ['Sale', 27], ['Queda', 15]] };
  if (tipo === 'direccion') return { titulo: 'Objetivo semanal · demo', barras: [['Lun', 6], ['Mar', 9], ['Mié', 7], ['Jue', 12], ['Vie', 10]], meta: 10 };
  if (tipo === 'captacion') return { titulo: 'Embudo · demo', progreso: [3, 5], nota: 'Datos de ejemplo' };
  if (tipo === 'ventas') return { titulo: 'Propuestas · demo', kanban: [['Propuesta', [{ cliente: 'Cliente demo A', tipo: 'Web', precio: 'demo' }, { cliente: 'Cliente demo B', tipo: 'Tienda', precio: 'demo' }]], ['En curso', [{ cliente: 'Cliente demo C', tipo: 'Campaña', precio: 'demo' }]]] };
  if (tipo === 'entrega') return { titulo: 'Entregas · demo', lista: ['Pedido demo #101', 'Pedido demo #102', 'Pedido demo #103'] };
  if (tipo === 'academia') return { titulo: 'Formación · demo', cifra: '24', sub: 'alumnos de ejemplo' };
  if (tipo === 'analitica') return { titulo: 'Redes · demo', cifra: '1.2k', sub: 'visitas de ejemplo' };
  return null;
}
function pantallaPared(padre, x, z, ancho, info) {
  const t = textura(768, 432, () => {});
  const marco = caja(ancho + 0.12, ancho * 0.5625 + 0.12, 0.08, mat('#15181f', 0.4), x, 2.0, z, padre);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, ancho * 0.5625), new THREE.MeshBasicMaterial({ map: t })); m.position.set(x, 2.0, z + 0.045); padre.add(m);
  caja(0.1, 1.6, 0.1, mat('#8d929c', 0.5), x, 0.8, z - 0.02, padre);
  m.userData = marco.userData = { tipo: 'dep', ...info }; clicables.push(m);
  const p = { t, info, firma: '' }; PANTALLAS.push(p); return p;
}
function dibujarPared(p, d) {
  const datos = datosPared(p.info.tipoOf); const firma = JSON.stringify(datos);
  if (firma === p.firma) return; p.firma = firma;
  const c = p.t.image.getContext('2d'), W = 768, H = 432, col = p.info.color;
  c.fillStyle = '#0e1320'; c.fillRect(0, 0, W, H);
  c.fillStyle = col; c.fillRect(0, 0, W, 8);
  c.fillStyle = '#ffffff'; c.font = '800 34px system-ui'; c.textAlign = 'left'; c.fillText(datos?.titulo || p.info.nombre, 24, 56);
  c.fillStyle = '#8fa0bf'; c.font = '600 20px system-ui'; c.fillText(p.info.nombre, 24, 86);
  let y = 120;
  if (!datos) return void (p.t.needsUpdate = true);
  if (datos.barras && datos.barras.length) {
    const max = Math.max(1, ...datos.barras.map((b) => b[1]), datos.meta || 0), bw = Math.min(150, (W - 80) / datos.barras.length - 24), alto = 200;
    datos.barras.forEach(([n, v], i) => { const x = 40 + i * (bw + 24), h = (v / max) * alto; c.fillStyle = mezclar(col, '#ffffff', i * 0.22); c.fillRect(x, y + 20 + alto - h, bw, h); c.fillStyle = '#ffffff'; c.font = '800 26px system-ui'; c.fillText(`${v.toLocaleString('es-ES')}`, x, y + 12 + alto - h); c.fillStyle = '#8fa0bf'; c.font = '600 20px system-ui'; c.fillText(n, x, y + alto + 50); });
    if (datos.meta) { const ym = y + 20 + alto - (datos.meta / max) * alto; c.strokeStyle = '#ff4d6a'; c.lineWidth = 3; c.setLineDash([10, 8]); c.beginPath(); c.moveTo(24, ym); c.lineTo(W - 24, ym); c.stroke(); c.setLineDash([]); c.fillStyle = '#ff4d6a'; c.font = '700 18px system-ui'; c.fillText('meta', W - 80, ym - 8); }
  } else if (datos.barras) { c.fillStyle = '#8fa0bf'; c.font = 'italic 600 26px system-ui'; c.fillText(datos.vacio, 24, y + 40); }
  if (datos.progreso) {
    const [v, m] = datos.progreso, emb = [['Visitas', 1], ['Interesados', 0.78], ['Contactos', 0.56], ['Citas', 0.36]];
    emb.forEach(([n, k], i) => { const w = (W - 120) * k, x = (W - w) / 2, yy = y + i * 52; c.fillStyle = mezclar(col, '#0e1320', i * 0.18); c.fillRect(x, yy, w, 42); c.fillStyle = '#fff'; c.font = '700 20px system-ui'; c.textAlign = 'center'; c.fillText(i === 3 ? `Citas: ${v} de ${m}` : n, W / 2, yy + 28); c.textAlign = 'left'; });
    y += 4 * 52 + 10;
  }
  if (datos.kanban) {
    const cw = (W - 72) / datos.kanban.length;
    datos.kanban.forEach(([n, ts], i) => { const x = 24 + i * (cw + 24); c.fillStyle = '#8fa0bf'; c.font = '800 20px system-ui'; c.fillText(`${n.toUpperCase()} (${ts.length})`, x, y);
      ts.slice(0, 4).forEach((t, k) => { const yy = y + 14 + k * 64; c.fillStyle = '#1b2336'; c.fillRect(x, yy, cw, 56); c.fillStyle = col; c.fillRect(x, yy, 6, 56); c.fillStyle = '#fff'; c.font = '700 20px system-ui'; c.fillText(t.cliente.slice(0, 22), x + 16, yy + 24); c.fillStyle = '#8fa0bf'; c.font = '600 17px system-ui'; c.fillText(`${t.tipo} · ${t.precio}`.slice(0, 32), x + 16, yy + 47); }); });
  }
  if (datos.lista) { if (!datos.lista.length) { c.fillStyle = '#8fa0bf'; c.font = 'italic 600 26px system-ui'; c.fillText(datos.vacio, 24, y + 30); } datos.lista.slice(0, 5).forEach((l, i) => { c.fillStyle = '#1b2336'; c.fillRect(24, y + i * 56, W - 48, 48); c.fillStyle = col; c.fillRect(24, y + i * 56, 6, 48); c.fillStyle = '#fff'; c.font = '700 22px system-ui'; c.fillText(l.slice(0, 48), 42, y + i * 56 + 32); }); }
  if (datos.cifra != null) { c.fillStyle = '#ffffff'; c.font = '900 120px system-ui'; c.fillText(datos.cifra, 24, y + 120); c.fillStyle = '#8fa0bf'; c.font = '700 26px system-ui'; c.fillText(datos.sub || '', 24, y + 160); }
  if (datos.nota) { c.fillStyle = '#c5d0e6'; c.font = '600 20px system-ui'; c.fillText(datos.nota.slice(0, 60), 24, H - 24); }
  p.t.needsUpdate = true;
}
// --- piezas para montar oficinas ---
function puestoPC(int, x, z, monitores = 1, ancho = 1.8) {
  modelo('desk', { ancho, x, z, rot: Math.PI, padre: int });
  modelo('chairDesk', { ancho: 0.7, x, z: z + 0.95, rot: Math.PI, padre: int });
  const tx = pantalla(); const sep = 0.62;
  for (let i = 0; i < monitores; i++) {
    const mx = x + (i - (monitores - 1) / 2) * sep, giro = (i - (monitores - 1) / 2) * -0.35;
    const mon = modelo('computerScreen', { ancho: monitores > 1 ? 0.6 : 0.85, x: mx, z: z - 0.15, y: 0.78, rot: Math.PI + giro, padre: int });
    if (i === Math.floor((monitores - 1) / 2)) { const pm = new THREE.Mesh(new THREE.PlaneGeometry(monitores > 1 ? 0.52 : 0.74, monitores > 1 ? 0.32 : 0.46), new THREE.MeshBasicMaterial({ map: tx })); pm.position.set(mx, monitores > 1 ? 1.02 : 1.1, z - 0.08); pm.rotation.y = giro; int.add(pm); }
    else { const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.32), mat(['#13304a', '#1e1438'][i % 2], 0.4, { emissive: ['#1b4a75', '#2d1f5a'][i % 2], emissiveIntensity: 0.6 })); pm.position.set(mx, 1.02, z - 0.08); pm.rotation.y = giro; int.add(pm); }
  }
  modelo('computerKeyboard', { ancho: 0.45, x, z: z + 0.12, y: 0.78, rot: Math.PI, padre: int });
  return { asiento: { x, z: z + 0.95 }, tx };
}
function pizarraBlanca(int, x, z, ancho, dibujo) {
  const t = textura(512, 300, (c) => { c.fillStyle = '#fbfbfd'; c.fillRect(0, 0, 512, 300); c.lineWidth = 4; dibujo(c); });
  caja(ancho + 0.1, ancho * 0.58 + 0.1, 0.05, mat('#c9ced8', 0.4), x, 1.75, z, int);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, ancho * 0.58), new THREE.MeshBasicMaterial({ map: t })); m.position.set(x, 1.75, z + 0.03); int.add(m);
  caja(0.06, 1.0, 0.06, mat('#8d929c', 0.5), x - ancho / 2 + 0.1, 0.5, z, int); caja(0.06, 1.0, 0.06, mat('#8d929c', 0.5), x + ancho / 2 - 0.1, 0.5, z, int);
}
const DIBUJO = {
  diagrama: (c) => { c.strokeStyle = '#2b5fd9'; [[40, 40], [200, 40], [360, 40], [200, 180]].forEach(([x, y]) => c.strokeRect(x, y, 110, 60)); c.strokeStyle = '#d9472b'; [[150, 70, 200, 70], [310, 70, 360, 70], [255, 100, 255, 180]].forEach(([a, b, e, f]) => { c.beginPath(); c.moveTo(a, b); c.lineTo(e, f); c.stroke(); }); c.fillStyle = '#1d2433'; c.font = '700 20px system-ui'; c.fillText('Problema → Solución → Medida', 40, 280); },
  plan: (c) => { c.fillStyle = '#1d2433'; c.font = '800 30px system-ui'; c.fillText('PLAN', 30, 50); c.font = '600 22px system-ui'; ['1. Tema y mensaje', '2. Público', '3. Calendario'].forEach((t, i) => c.fillText(t, 30, 100 + i * 40)); ['#ffe27a', '#ffb3a1', '#a8e6b8'].forEach((col, i) => { c.fillStyle = col; c.fillRect(330 + (i % 2) * 80, 60 + i * 60, 70, 55); }); },
  wireframe: (c) => { c.strokeStyle = '#1d2433'; c.strokeRect(40, 30, 160, 240); c.strokeRect(60, 60, 120, 40); c.strokeRect(60, 120, 120, 120); c.strokeRect(260, 30, 200, 120); c.strokeStyle = '#2aa6a0'; c.beginPath(); c.moveTo(200, 80); c.lineTo(260, 80); c.stroke(); c.fillStyle = '#ffe27a'; c.fillRect(280, 180, 70, 60); c.fillStyle = '#a9cbff'; c.fillRect(370, 180, 70, 60); },
  clase: (c) => { c.fillStyle = '#1d2433'; c.font = '800 28px system-ui'; c.fillText('Lección del día', 30, 50); c.strokeStyle = '#d98a2b'; c.beginPath(); c.moveTo(30, 70); c.lineTo(470, 70); c.stroke(); c.font = '600 22px system-ui'; ['• Aprender la herramienta', '• Practicar con un caso', '• Medir el resultado'].forEach((t, i) => c.fillText(t, 30, 120 + i * 44)); },
};
function tablonFuentes(int, x, z) {
  caja(1.6, 1.1, 0.05, mat('#9b7448', 0.9), x, 1.7, z, int);
  const cols = ['#fff6c8', '#ffffff', '#ffd9cf', '#d6ecff', '#fff6c8'], pts = [];
  for (let i = 0; i < 6; i++) { const px = x - 0.55 + (i % 3) * 0.55, py = 1.95 - Math.floor(i / 3) * 0.48; caja(0.32, 0.24, 0.01, mat(cols[i % 5], 1), px, py, z + 0.03, int, false); caja(0.04, 0.04, 0.02, mat('#c0102a', 0.5), px, py + 0.1, z + 0.04, int, false); pts.push(new THREE.Vector3(px, py + 0.1, z + 0.05)); }
  const hilo = new THREE.Line(new THREE.BufferGeometry().setFromPoints([pts[0], pts[4], pts[2], pts[3], pts[5]]), new THREE.LineBasicMaterial({ color: '#c0102a' })); int.add(hilo);
}
function rack(int, x, z, estado) {
  caja(0.6, 2.0, 0.8, mat('#1c2029', 0.5), x, 1.0, z, int);
  const led = estado === 'funciona' ? '#38e07b' : estado === 'no_existe' ? '#556' : '#ffb020';
  for (let i = 0; i < 8; i++) { caja(0.5, 0.16, 0.02, mat('#2b313d', 0.5), x, 0.3 + i * 0.22, z + 0.41, int, false); caja(0.04, 0.04, 0.02, mat(led, 0.3, { emissive: led, emissiveIntensity: 1.4 }), x + 0.18, 0.3 + i * 0.22, z + 0.42, int, false); }
}
function porCrear(int, x, z, w, d) {
  // obra: cinta amarilla y negra alrededor, cajas sin abrir y un cartel. Así se ve que el departamento aún no existe.
  const t = textura(256, 32, (c) => { for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#141414' : '#f5c400'; c.beginPath(); c.moveTo(i * 16, 32); c.lineTo(i * 16 + 16, 0); c.lineTo(i * 16 + 32, 0); c.lineTo(i * 16 + 16, 32); c.fill(); } });
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(4, 1);
  const cinta = new THREE.MeshBasicMaterial({ map: t });
  for (const [cx, cz, cw, rot] of [[x, z - d / 2, w, 0], [x, z + d / 2, w, 0], [x - w / 2, z, d, Math.PI / 2], [x + w / 2, z, d, Math.PI / 2]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.08, 0.02), cinta); b.position.set(cx, 0.85, cz); b.rotation.y = rot; int.add(b);
    caja(0.06, 0.9, 0.06, mat('#f5c400', 0.6), cx + (rot ? 0 : -cw / 2), 0.45, cz + (rot ? -cw / 2 : 0), int);
  }
  modelo('cardboardBoxClosed', { ancho: 0.6, x: x - 0.6, z: z + 0.3, padre: int }); modelo('cardboardBoxClosed', { ancho: 0.5, x: x - 0.55, z: z + 0.3, y: 0.42, rot: 0.4, padre: int }); modelo('cardboardBoxOpen', { ancho: 0.6, x: x + 0.6, z: z - 0.4, padre: int });
}
// Monta la oficina de un departamento según su tipo. Devuelve dónde se sienta el trabajador y su ordenador.
function oficina(int, tipo, x, z, dep, info) {
  const fondo = z - 1.3, frente = z + 1.2;
  const con = (p) => p;
  switch (tipo) {
    case 'investigacion': { const p = puestoPC(int, x - 0.3, z - 0.1, 2); modelo('bookcaseClosedWide', { ancho: 1.3, x: x + 1.15, z: fondo + 0.65, padre: int }); tablonFuentes(int, x - 0.6, fondo + 0.0); modelo('books', { ancho: 0.3, x: x + 0.45, z: z - 0.25, y: 0.78, padre: int }); return p; }
    case 'captacion': { const p = puestoPC(int, x - 0.6, z + 0.1, 1); pantallaPared(int, x + 0.55, fondo + 0.05, 1.9, info); modelo('speakerSmall', { alto: 0.5, x: x + 1.5, z: z + 0.6, padre: int }); return p; }
    case 'ventas': { const p = puestoPC(int, x - 0.8, z + 0.2, 1, 1.5); pantallaPared(int, x + 0.5, fondo + 0.05, 1.9, info); modelo('tableRound', { ancho: 0.9, x: x + 1.0, z: frente, padre: int }); modelo('chair', { ancho: 0.45, x: x + 0.45, z: frente + 0.3, rot: Math.PI * 0.75, padre: int }); modelo('chair', { ancho: 0.45, x: x + 1.55, z: frente + 0.3, rot: -Math.PI * 0.75, padre: int }); return p; }
    case 'contenido': {
      const p = puestoPC(int, x - 0.9, z + 0.4, 2, 1.5);
      caja(1.7, 1.9, 0.06, mat('#23262e', 1), x + 0.9, 1.0, fondo + 0.2, int);                                     // fondo de grabación
      modelo('stoolBar', { alto: 0.75, x: x + 0.9, z: fondo + 0.6, padre: int });
      const tri = new THREE.Group(); tri.position.set(x + 0.9, 0, z + 0.9); int.add(tri);
      for (const a of [0, 2.1, 4.2]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.35, 6), mat('#222', 0.5)); l.position.set(Math.sin(a) * 0.18, 0.62, Math.cos(a) * 0.18); l.rotation.set(Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25); tri.add(l); }
      caja(0.22, 0.14, 0.18, mat('#111', 0.3), 0, 1.3, 0, tri); const obj = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 12), mat('#333', 0.2)); obj.rotation.x = Math.PI / 2; obj.position.set(0, 1.3, -0.12); tri.add(obj);
      const aro = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 8, 32), mat('#ffffff', 0.3, { emissive: '#fff6e0', emissiveIntensity: 1.2 })); aro.position.set(x + 0.9, 1.45, z + 0.55); int.add(aro);
      caja(0.03, 1.4, 0.03, mat('#222', 0.5), x + 0.9, 0.7, z + 0.55, int);
      return p;
    }
    case 'finanzas': { const p = puestoPC(int, x - 0.6, z + 0.1, 1, 1.5); pantallaPared(int, x + 0.6, fondo + 0.05, 1.7, info); modelo('sideTableDrawers', { ancho: 0.6, x: x + 1.45, z: z + 0.6, padre: int }); modelo('sideTableDrawers', { ancho: 0.6, x: x + 1.45, z: z - 0.1, padre: int }); return p; }
    case 'direccion': { modelo('deskCorner', { ancho: 1.9, x: x - 0.3, z: z + 0.05, rot: Math.PI, padre: int }); const p = puestoPC(int, x - 0.3, z, 1, 0.01); pantallaPared(int, x + 0.4, fondo + 0.05, 2.3, info); modelo('pottedPlant', { alto: 1.1, x: x + 1.5, z: z + 0.9, padre: int }); return p; }
    case 'desarrollo': { const p = puestoPC(int, x - 0.4, z, 3, 2.0); rack(int, x + 1.45, fondo + 0.2, dep.estado); return p; }
    case 'entrega': { const p = puestoPC(int, x - 0.9, z + 0.3, 1, 1.4); pantallaPared(int, x + 0.6, fondo + 0.05, 1.8, info); modelo('table', { ancho: 1.3, x: x + 0.8, z: frente, padre: int }); modelo('cardboardBoxClosed', { ancho: 0.45, x: x + 0.55, z: frente, y: 0.75, padre: int }); modelo('cardboardBoxOpen', { ancho: 0.45, x: x + 1.05, z: frente, y: 0.75, padre: int }); return p; }
    case 'atencion': { const p = puestoPC(int, x, z, 1, 1.6); modelo('radio', { ancho: 0.35, x: x + 0.6, z: z - 0.15, y: 0.78, padre: int }); modelo('plantSmall1', { alto: 0.4, x: x - 0.7, z: z - 0.2, y: 0.78, padre: int }); modelo('loungeChair', { ancho: 0.8, x: x + 1.2, z: frente + 0.2, rot: -Math.PI / 4, padre: int }); return p; }
    case 'pizarra': { pizarraBlanca(int, x - 0.3, fondo + 0.05, 2.2, DIBUJO[info.dibujo] || DIBUJO.diagrama); modelo('table', { ancho: 1.4, x: x - 0.3, z: z + 0.6, padre: int }); const p = { asiento: { x: x - 0.3, z: z + 1.45 }, tx: null }; modelo('laptop', { ancho: 0.4, x: x - 0.3, z: z + 0.7, y: 0.75, rot: Math.PI, padre: int }); modelo('stoolBar', { alto: 0.75, x: x + 1.2, z: z + 0.6, padre: int }); return p; }
    case 'servidores': { for (let i = 0; i < 3; i++) rack(int, x - 1.0 + i * 0.75, fondo + 0.35, dep.estado); const p = puestoPC(int, x, z + 0.9, 1, 1.4); return p; }
    case 'seguridad': { rack(int, x - 1.1, fondo + 0.35, dep.estado); caja(0.8, 0.9, 0.7, mat('#5b6270', 0.4, { metalness: 0.6 }), x + 1.1, 0.45, fondo + 0.35, int); const rueda = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 8, 20), mat('#c9ced8', 0.3, { metalness: 0.8 })); rueda.position.set(x + 1.1, 0.5, fondo + 0.71); int.add(rueda); const p = puestoPC(int, x, z + 0.5, 2, 1.6); return p; }
    case 'laboratorio': {
      caja(2.4, 0.9, 0.7, mat('#e8ecf2', 0.5), x, 0.45, fondo + 0.35, int); caja(2.5, 0.05, 0.75, mat('#2b313d', 0.4), x, 0.92, fondo + 0.35, int);
      ['#38e07b', '#4aa3ff', '#ff7a59', '#ffd23f'].forEach((col, i) => { const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.11, 0.28, 12), mat(col, 0.1, { transparent: true, opacity: 0.75, emissive: col, emissiveIntensity: 0.3 })); fl.position.set(x - 0.8 + i * 0.5, 1.09, fondo + 0.35); int.add(fl); });
      modelo('stoolBar', { alto: 0.75, x: x - 0.4, z: fondo + 1.2, padre: int }); const p = puestoPC(int, x, z + 0.9, 1, 1.4); return p;
    }
    case 'comunidad': { modelo('tableRound', { ancho: 1.5, x, z, padre: int }); for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; modelo('chairCushion', { ancho: 0.5, x: x + Math.sin(a) * 1.15, z: z + Math.cos(a) * 1.15, rot: a + Math.PI, padre: int }); } modelo('pottedPlant', { alto: 1.2, x: x + 1.6, z: fondo + 0.2, padre: int }); return { asiento: { x, z: z + 1.15 }, tx: null }; }
    case 'academia': { const p = puestoPC(int, x - 0.6, z + 0.2, 1, 1.5); pantallaPared(int, x + 0.6, fondo + 0.05, 1.8, info); modelo('books', { ancho: 0.3, x: x - 0.1, z: z, y: 0.78, padre: int }); return p; }
    case 'analitica': { const p = puestoPC(int, x, z + 0.4, 2, 1.8); pantallaPared(int, x, fondo + 0.05, 2.4, info); return p; }
    case 'formacion': { modelo('bookcaseOpen', { ancho: 1.1, x: x - 1.2, z: fondo + 0.2, padre: int }); pizarraBlanca(int, x + 0.6, fondo + 0.05, 1.7, DIBUJO.clase); modelo('loungeChair', { ancho: 0.85, x: x - 0.2, z: z + 0.6, rot: Math.PI * 0.85, padre: int }); modelo('lampRoundFloor', { alto: 1.6, x: x - 1.2, z: z + 0.8, padre: int }); return { asiento: { x: x - 0.2, z: z + 0.6 }, tx: null }; }
    default: return puestoPC(int, x, z, 1);
  }
}

function montarEdificios(casa, d) {
  for (const emp of casa.empresas) {
    const id = emp.id, deps = emp.departamentos, s = SITIO[id]; if (!s) continue;
    const color = COLOR[id];
    // zonas de 4 puestos como máximo (2 columnas × 2 filas); el edificio tiene un ancho mínimo para que quepa el frente
    const zonas = []; for (let k = 0; k < Math.max(1, deps.length); k += 4) zonas.push({ nombre: emp.zona || 'Equipo', color, lista: deps.slice(k, k + 4) });
    const zw = 2 * OF_W, filas = Math.max(...zonas.map((z) => Math.ceil(z.lista.length / 2)), 1);
    const anchoZonas = zonas.length * zw + (zonas.length - 1) * ZONA_HUECO;
    const w = Math.max(anchoZonas + 1.4, 18), fondo = filas * OF_D + 0.6, dd = fondo + 7;
    const g = new THREE.Group(); g.position.set(s.x, 0, s.z); escena.add(g);
    caja(w, 0.3, dd, '#eceff4', 0, 0.15, 0, g, false);
    const pared = new THREE.MeshStandardMaterial({ color: '#e8f1fb', roughness: 0.06, metalness: 0.25, transparent: true, opacity: 0.3 });   // cristal
    caja(w, 3.6, 0.3, pared, 0, 2.1, -dd / 2 + 0.15, g); caja(0.3, 1.2, dd, pared, -w / 2 + 0.15, 0.9, 0, g); caja(0.3, 1.2, dd, pared, w / 2 - 0.15, 0.9, 0, g);
    { const luz = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.3, roughness: 0.3 });   // cantos de luz del color de la empresa
      caja(w, 0.08, 0.34, luz, 0, 3.95, -dd / 2 + 0.15, g, false); caja(0.34, 0.06, dd, luz, -w / 2 + 0.15, 1.53, 0, g, false); caja(0.34, 0.06, dd, luz, w / 2 - 0.15, 1.53, 0, g, false);
      caja(w, 0.05, 0.34, luz, 0, 0.33, -dd / 2 + 0.15, g, false); caja(0.34, 0.05, dd, luz, -w / 2 + 0.15, 0.33, 0, g, false); caja(0.34, 0.05, dd, luz, w / 2 - 0.15, 0.33, 0, g, false); }
    const cart = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w - 4, 8), 0.72), new THREE.MeshBasicMaterial({ map: letrero(TITULO[id], color) })); cart.position.set(0, 3.42, -dd / 2 + 0.31); g.add(cart);
    const int = new THREE.Group(); int.position.y = 0.3; g.add(int);
    // el nombre del departamento pintado en el suelo, delante de la entrada
    { const ancho = Math.min(w - 3, 9), tx = letrero(TITULO[id], color, 1024, 128, 'rgba(0,0,0,0)', color, 70);
      const suelo = new THREE.Mesh(new THREE.PlaneGeometry(ancho, ancho / 8), new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false }));
      suelo.rotation.x = -Math.PI / 2; suelo.position.set(0, 0.035, dd / 2 + 1.9); suelo.renderOrder = 2; g.add(suelo); }
    const zClic = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, dd), new THREE.MeshBasicMaterial({ visible: false })); zClic.position.set(s.x, 0.25, s.z); zClic.userData = { tipo: 'edificio', empresa: id }; escena.add(zClic); clicables.push(zClic);
    EDIF[id] = { g, int, w, d: dd, x: s.x, z: s.z, puestos: {}, deps };
    const vidrio = mat('#cfe6ff', 0.1, { transparent: true, opacity: 0.22, metalness: 0.2 });
    zonas.forEach((zona, zi) => {
      const x0 = -anchoZonas / 2 + zi * (zw + ZONA_HUECO), cx = x0 + zw / 2, z0 = -dd / 2 + 0.3;
      const suelo = new THREE.Mesh(new THREE.PlaneGeometry(zw, fondo), mat(mezclar(zona.color, '#ffffff', 0.86), 1)); suelo.rotation.x = -Math.PI / 2; suelo.position.set(cx, 0.01, z0 + fondo / 2); suelo.receiveShadow = true; int.add(suelo);
      const raya = new THREE.Mesh(new THREE.PlaneGeometry(zw, 0.14), mat(zona.color, 1)); raya.rotation.x = -Math.PI / 2; raya.position.set(cx, 0.015, z0 + fondo); int.add(raya);
      const rot = new THREE.Mesh(new THREE.PlaneGeometry(zw * 0.8, 0.5), new THREE.MeshBasicMaterial({ map: letrero(zona.nombre.toUpperCase(), zona.color, 1024, 128, '#ffffff', zona.color, 62) })); rot.position.set(cx, 2.55, -dd / 2 + 0.33); int.add(rot);   // cartel de la zona en la pared del fondo
      zona.lista.forEach((dep, k) => {
        const lx = x0 + OF_W / 2 + (k % 2) * OF_W, lz = z0 + 1.55 + Math.floor(k / 2) * OF_D;
        const fantasma = dep.estado === 'no_existe';
        const agente = !fantasma && d.agentes.find((a) => a.empresa === id && a.departamento === dep.id);
        const tipoOf = dep.tipo || 'desarrollo';
        const info = { empresa: id, dep: dep.id, nombre: dep.nombre || dep.id, estado: dep.estado, agente: agente?.id, color: zona.color, tipoOf, dibujo: dep.dibujo };
        let puesto = { asiento: { x: lx, z: lz + 0.95 }, tx: null };
        if (fantasma && !agente) porCrear(int, lx, lz + 0.1, OF_W - 0.7, OF_D - 1.0);
        else puesto = oficina(int, tipoOf, lx, lz + 0.1, dep, info);
        const clic = new THREE.Mesh(new THREE.BoxGeometry(OF_W - 0.3, 1.2, OF_D - 0.6), new THREE.MeshBasicMaterial({ visible: false })); clic.position.set(lx, 0.6, lz + 0.1); clic.userData = { tipo: 'dep', ...info }; int.add(clic); clicables.push(clic);
        placa(int, lx, lz + 2.2, dep.nombre || dep.id, dep.estado);
        const tx = puesto.tx;
        EDIF[id].puestos[dep.id] = { x: s.x + puesto.asiento.x, z: s.z + puesto.asiento.z, pantalla: tx };
      });
    });
    // frente: despacho del gerente (izquierda), mesa de reuniones (centro) y descanso con café (derecha)
    const fz = dd / 2 - 3.2;
    const gx = -w / 2 + 3.3, gz = fz;
    modelo('desk', { ancho: 2.0, x: gx, z: gz + 0.95, rot: 0, padre: int });
    modelo('chairDesk', { ancho: 0.75, x: gx, z: gz, rot: 0, padre: int });
    modelo('bookcaseOpen', { ancho: 1.1, x: gx - 1.6, z: gz - 1.3, padre: int });
    EDIF[id].gerente = { x: s.x + gx, z: s.z + gz };
    const mesaR = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.07, 48), mat('#f4f6f9', 0.2)); mesaR.position.set(0, 0.76, fz + 0.4); mesaR.castShadow = true; int.add(mesaR);
    { const aroM = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.018, 8, 64), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.3 })); aroM.rotation.x = Math.PI / 2; aroM.position.set(0, 0.8, fz + 0.4); int.add(aroM); }
    caja(0.12, 0.74, 0.12, mat('#8d929c', 0.5), 0, 0.37, fz + 0.4, int);
    for (const a of [0, 1, 2, 3]) { const ang = a * Math.PI / 2 + Math.PI / 4; modelo('chairDesk', { ancho: 0.6, x: Math.sin(ang) * 1.45, z: fz + 0.4 + Math.cos(ang) * 1.45, rot: ang + Math.PI, padre: int }); }
    const lx = w / 2 - 4.2, lz = fz + 0.6;
    const nEq = d.agentes.filter((x) => x.empresa === id).length, nS = Math.min(3, Math.max(1, Math.ceil(nEq / 2)));
    for (let k = 0; k < nS; k++) modelo('loungeSofa', { ancho: 1.9, x: lx + (k - (nS - 1) / 2) * 2.0, z: lz, rot: 0, padre: int });
    modelo('tableCoffee', { ancho: 1.4, x: lx, z: lz + 1.3, padre: int });
    modelo('kitchenCoffeeMachine', { ancho: 0.5, x: w / 2 - 0.9, z: lz - 1.2, padre: int });
    modelo('pottedPlant', { alto: 1.3, x: w / 2 - 0.9, z: -dd / 2 + 0.9, padre: int }); modelo('pottedPlant', { alto: 1.3, x: -w / 2 + 0.9, z: -dd / 2 + 0.9, padre: int });
    EDIF[id].descanso = { x: s.x + lx, z: s.z + lz + 0.05 };
    EDIF[id].cafe = { x: s.x + w / 2 - 0.9, z: s.z + lz - 0.45, rot: Math.PI };
    EDIF[id].charla = { x: s.x, z: s.z + fz + 2.2 };
    EDIF[id].campo = { x: s.x, z: s.z + dd / 2 + 5 };
    // tejado: se ve desde el aire y desaparece al acercarte
    const matTejado = new THREE.MeshStandardMaterial({ color: '#f4f5f8', roughness: 0.8, transparent: true, opacity: 1 });
    const matLogo = new THREE.MeshBasicMaterial({ map: letrero(TITULO[id], color, 1024, 160, '#ffffff', '#1d2433', 84), transparent: true, opacity: 1 });
    const tejado = new THREE.Group(); tejado.position.set(s.x, 0, s.z); escena.add(tejado);
    const losaT = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.35, dd + 0.4), matTejado); losaT.position.y = 4.2; losaT.castShadow = true; tejado.add(losaT);
    const bordeT = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.12, dd + 0.6), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 1 })); bordeT.position.y = 4.4; tejado.add(bordeT);
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w - 2, 14), Math.min(w - 2, 14) * 0.156), matLogo); logo.rotation.x = -Math.PI / 2; logo.position.y = 4.39; tejado.add(logo);
    EDIF[id].tejado = { grupo: tejado, mats: [matTejado, matLogo, bordeT.material] };
    const tarjeta = document.createElement('div'); tarjeta.className = 'resumen'; capa.appendChild(tarjeta); EDIF[id].tarjeta = tarjeta;
  }
}

function montarCiudad() {
  const tipos = 'abcdefghijklmn'.split('').map((l) => 'building-' + l), altos = 'abcde'.split('').map((l) => 'building-skyscraper-' + l);
  let n = 0;
  const poner = (x, z, rot) => { const alto = n % 5 === 2; modelo(alto ? altos[n % altos.length] : tipos[(n * 7) % tipos.length], { ancho: alto ? 9 : 10, x, z, rot }); n++; };
  for (let x = -60; x <= 60; x += 13) { poner(x, -64, 0); poner(x, 68, Math.PI); }
  for (let z = -40; z <= 46; z += 13) { poner(-76, z, Math.PI / 2); poner(76, z, -Math.PI / 2); }
  [[-52, -40], [52, -40], [-52, 42], [52, 42], [-14, 40], [14, 40], [-46, -6], [46, -6], [-18, -42], [18, -42], [0, 44]].forEach(([x, z], i) => arbol(x, z, 1 + (i % 3) * 0.2));
}

// ---------- personas ----------
// Cuerpo de pocos polígonos (cilindros de 6-8 lados que se estrechan, como los modelos de 1998) con texturas
// pixeladas: cara pintada, pelo de la época, camiseta con el dorsal en la espalda, pantalón y medias.
const PIEL = ['#e2ad84', '#b9805a', '#f0c8a2', '#7d4f33', '#d39b70', '#5e3b26'];
const PELO = ['#1e140e', '#4a2e18', '#0f0f0f', '#d8b04a', '#2f2118', '#0f0f0f'];
const PEINADO = ['corto', 'rizado', 'rapado', 'rubio', 'coleta', 'melena'];
function texCamiseta(u, gerente, color) {
  return textura(256, 256, (c) => { c.scale(4, 4);
    if (gerente) { c.fillStyle = '#272c3d'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#f2f2f2'; c.fillRect(27, 0, 10, 26); c.fillStyle = color; c.fillRect(30, 2, 4, 30); c.fillStyle = '#1b1f2c'; c.fillRect(24, 0, 2, 40); c.fillRect(38, 0, 2, 40); return; }
    c.fillStyle = u.camiseta; c.fillRect(0, 0, 64, 64);
    c.fillStyle = u.detalle; c.fillRect(0, 0, 64, 5); c.fillRect(28, 5, 8, 4);
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(14, 8, 2, 50); c.fillRect(48, 8, 2, 50);
    const claro = ['#ffffff', '#f4f4f4', '#f7d417', '#7ec3ee'].includes(u.camiseta);
    c.fillStyle = claro ? (u.camiseta === '#f7d417' ? '#1c3d8c' : '#151515') : '#ffffff';
    c.font = 'bold 22px Arial'; c.textAlign = 'center'; c.fillText(String(u.dorsal), 32, 40);
  });
}
function texCara(piel, pelo, peinado) {
  return textura(128, 128, (c) => { c.scale(4, 4);
    c.fillStyle = piel; c.fillRect(0, 0, 32, 32);
    c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(0, 18, 32, 14);
    c.fillStyle = pelo; c.fillRect(0, 0, 32, peinado === 'rapado' ? 6 : 10);
    if (peinado === 'melena' || peinado === 'coleta' || peinado === 'rizado') c.fillRect(16, 0, 16, 20);
    c.fillRect(4, 11, 3, 1); c.fillRect(9, 11, 3, 1);
    c.fillStyle = '#ffffff'; c.fillRect(4, 13, 3, 2); c.fillRect(9, 13, 3, 2);
    c.fillStyle = '#20140c'; c.fillRect(5, 13, 2, 2); c.fillRect(10, 13, 2, 2);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(7, 15, 2, 3);
    c.fillStyle = '#8a4b3a'; c.fillRect(6, 19, 5, 1);
  });
}
function cilindro(rArriba, rAbajo, largo, material, padre, y, lados = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rArriba, rAbajo, largo, lados, 1), material);
  m.position.y = y; m.castShadow = true; padre.add(m); return m;
}
function pieza(w, h, d, material, padre, y = 0, z = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); m.position.set(0, y, z); m.castShadow = true; padre.add(m); return m; }
const lambert = (o) => new THREE.MeshStandardMaterial({ roughness: 0.75, ...o });
// Personas con ESQUELETO y animación grabada (caminar, estar de pie); sentarse y teclear se componen sobre el esqueleto.
// Modelo: Xbot (ejemplos de three.js). Traje oscuro con las juntas del color de su departamento; el responsable, de blanco.
let XBOT = null;
const POSE = window.POSE = { baja: 0.44, muslo: [-1.5, 0, 0], rodilla: [1.55, 0, 0], brazo: 0.95, ante: 0.35, espalda: 0.1 };
function personaReal(a, i, gerente) {
  const root = new THREE.Group(), modelo = SkeletonUtils.clone(XBOT.scene); root.add(modelo);
  const color = COLOR[a.empresa] || a.color || '#8a93a6', H = {};
  modelo.traverse((o) => {
    if (o.isBone) H[o.name.replace('mixamorig', '')] = o;
    if (!o.isMesh) return;
    o.castShadow = true; o.frustumCulled = false; o.userData = { tipo: gerente ? 'gerente' : 'agente', id: a.id };
    const junta = /Joints/i.test(o.material.name);
    o.material = new THREE.MeshStandardMaterial(junta
      ? { color, roughness: 0.35, metalness: 0.3, emissive: color, emissiveIntensity: 0.9 }
      : { color: gerente ? '#f4f6f9' : '#2c3342', roughness: 0.3, metalness: 0.15 });
    o.material.name = junta ? 'juntas' : 'traje';
  });
  const mixer = new THREE.AnimationMixer(modelo), clip = (n) => XBOT.animations.find((c) => c.name === n);
  const idle = mixer.clipAction(clip('idle')), walk = mixer.clipAction(clip('walk'));
  idle.play(); walk.play(); walk.setEffectiveWeight(0); idle.time = (i * 0.37) % 3; walk.time = (i * 0.21) % 1;
  root.scale.setScalar((a.genero === 'f' ? 0.94 : 1) * (0.97 + (i % 5) * 0.012));
  escena.add(root);
  const nada = { visible: false, rotation: new THREE.Euler() };
  return { root, real: true, modelo, mixer, idle, walk, H, w: 0, s: 0, papel: nada, taza: nada, cabeza: nada };
}
function posturaReal(p, modo, t, fase) {
  const dt = Math.min(0.1, Math.max(0, t - (p.t0 ?? t))); p.t0 = t;
  const anda = modo === 'andar' || modo === 'llevar', sentado = !anda && !['pie', 'chutar', 'cafe', 'charla'].includes(modo);
  p.w += ((anda ? 1 : 0) - p.w) * Math.min(1, dt * 9); p.s += ((sentado ? 1 : 0) - p.s) * Math.min(1, dt * 5);
  p.walk.setEffectiveWeight(p.w); p.idle.setEffectiveWeight(1 - p.w); p.walk.timeScale = 1.12;
  p.mixer.update(dt);
  p.modelo.position.y = -POSE.baja * p.s;
  if (p.s < 0.01) return;
  const k = p.s, H = p.H, gira = (h, r, m = 1) => { if (h) { h.rotateX(r[0] * k * m); h.rotateY(r[1] * k * m); h.rotateZ(r[2] * k * m); } };
  gira(H.LeftUpLeg, POSE.muslo); gira(H.RightUpLeg, POSE.muslo); gira(H.LeftLeg, POSE.rodilla); gira(H.RightLeg, POSE.rodilla);
  if (H.Spine) H.Spine.rotateX(POSE.espalda * k);
  if (modo === 'teclear') {
    const d1 = Math.sin(t * 13 + fase) * 0.05, d2 = Math.sin(t * 13 + fase + 1.7) * 0.05;
    gira(H.LeftArm, [0, 0, POSE.brazo]); gira(H.RightArm, [0, 0, -POSE.brazo]);
    gira(H.LeftForeArm, [0, 0, POSE.ante + d1]); gira(H.RightForeArm, [0, 0, -POSE.ante - d2]);
    if (H.Head) H.Head.rotateX(0.12 + Math.sin(t * 0.8 + fase) * 0.04);
  } else if (H.Head) H.Head.rotateY(Math.sin(t * 0.4 + fase) * 0.35 * k);
}
function persona(a, i, gerente) { return XBOT ? personaReal(a, i, gerente) : personaBloques(a, i, gerente); }
function personaBloques(a, i, gerente) {
  const u = a.uniforme || { camiseta: '#272c3d', pantalon: '#272c3d', medias: '#151515', detalle: a.color, dorsal: '', seleccion: '' };
  const root = new THREE.Group(); const cuerpo = new THREE.Group(); root.add(cuerpo);
  const cPiel = PIEL[i % PIEL.length], cPelo = PELO[(i * 5) % PELO.length], peinado = a.peinado || (gerente ? 'corto' : (a.genero === 'f' ? 'melena' : ['corto', 'rapado', 'rubio', 'rizado'][i % 4]));
  const piel = lambert({ color: cPiel });
  const camis = lambert({ map: texCamiseta(u, gerente, a.color) });
  const manga = lambert({ color: gerente ? '#272c3d' : u.camiseta });
  const pantalon = lambert({ color: gerente ? '#272c3d' : u.pantalon });
  const medias = lambert({ color: gerente ? '#16181f' : u.medias });
  const bota = lambert({ color: gerente ? '#120d0a' : '#111111' });
  const pierna = (lado) => {
    const cadera = new THREE.Group(); cadera.position.set(0.1 * lado, 0.93, 0); cuerpo.add(cadera);
    if (gerente) cilindro(0.085, 0.07, 0.46, pantalon, cadera, -0.23);
    else { cilindro(0.1, 0.095, 0.2, pantalon, cadera, -0.08); cilindro(0.075, 0.062, 0.26, piel, cadera, -0.3); }
    const rodilla = new THREE.Group(); rodilla.position.y = -0.46; cadera.add(rodilla);
    cilindro(0.062, 0.045, 0.4, medias, rodilla, -0.2);
    pieza(0.09, 0.07, 0.24, bota, rodilla, -0.43, 0.05);
    return { cadera, rodilla };
  };
  const brazo = (lado) => {
    const hombro = new THREE.Group(); hombro.position.set(0.24 * lado, 1.42, 0); cuerpo.add(hombro);
    cilindro(0.06, 0.055, 0.16, manga, hombro, -0.07);
    cilindro(0.048, 0.042, 0.16, gerente ? manga : piel, hombro, -0.22);
    const codo = new THREE.Group(); codo.position.y = -0.3; hombro.add(codo);
    cilindro(0.042, 0.035, 0.24, gerente ? manga : piel, codo, -0.12);
    const mano = cilindro(0.04, 0.035, 0.08, piel, codo, -0.28, 8);
    return { hombro, codo, mano };
  };
  const pi = pierna(-1), pd = pierna(1), bi = brazo(-1), bd = brazo(1);
  // torso: tronco de cono de 8 lados (hombros anchos, cintura estrecha). En el cilindro, u=0.5 cae en la espalda (−z): ahí va el dorsal.
  const torso = cilindro(0.23, 0.17, 0.52, camis, cuerpo, 1.19, 16); torso.scale.z = 0.62;
  cilindro(0.06, 0.065, 0.1, piel, cuerpo, 1.5, 6);
  const cabeza = new THREE.Group(); cabeza.position.y = 1.64; cuerpo.add(cabeza);
  const cara = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 14), lambert({ map: texCara(cPiel, cPelo, peinado) }));
  cara.scale.set(0.92, 1.12, 1); cara.rotation.y = -Math.PI / 2; cara.castShadow = true; cabeza.add(cara);
  const mPelo = lambert({ color: cPelo });
  if (peinado === 'rizado') { const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 2), mPelo); r.position.set(0, 0.05, -0.02); r.scale.set(1.05, 0.9, 1.05); cabeza.add(r); }
  else if (peinado === 'melena') { const r = new THREE.Mesh(new THREE.SphereGeometry(0.128, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), mPelo); r.position.set(0, 0.03, -0.015); cabeza.add(r); pieza(0.24, 0.3, 0.09, mPelo, cabeza, -0.14, -0.1); pieza(0.07, 0.26, 0.08, mPelo, cabeza, -0.1, 0.02).position.x = -0.13; pieza(0.07, 0.26, 0.08, mPelo, cabeza, -0.1, 0.02).position.x = 0.13; }
  else if (peinado === 'coleta') { const r = new THREE.Mesh(new THREE.SphereGeometry(0.125, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), mPelo); r.position.y = 0.03; cabeza.add(r); const c = pieza(0.06, 0.3, 0.06, mPelo, cabeza, -0.1, -0.15); c.rotation.x = 0.35; }
  else if (peinado !== 'rapado') { const r = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), mPelo); r.position.y = 0.035; cabeza.add(r); }
  const papel = pieza(0.22, 0.02, 0.3, lambert({ color: '#fff6c8' }), bd.mano, 0, 0.12); papel.visible = false;
  const taza = pieza(0.08, 0.1, 0.08, lambert({ color: '#f2f2f2' }), bi.mano, -0.02, 0.05); taza.visible = false;
  root.traverse((o) => { if (o.isMesh) o.userData = { tipo: gerente ? 'gerente' : 'agente', id: a.id }; });
  root.scale.setScalar(1.05);
  escena.add(root);
  return { root, cuerpo, pi, pd, bi, bd, cabeza, papel, taza };
}
function postura(p, modo, t, fase) {
  if (p.real) return posturaReal(p, window.FORZAR_MODO || modo, t, fase);
  const s = Math.sin(t * 8 + fase);
  for (const x of [p.pi.cadera, p.pd.cadera, p.pi.rodilla, p.pd.rodilla, p.bi.hombro, p.bd.hombro, p.bi.codo, p.bd.codo]) x.rotation.set(0, 0, 0);
  p.cuerpo.position.y = 0; p.cuerpo.rotation.set(0, 0, 0); p.cabeza.rotation.set(0, 0, 0);
  p.papel.visible = modo === 'llevar'; p.taza.visible = modo === 'descanso' || modo === 'cafe';
  if (modo === 'andar' || modo === 'llevar') {
    p.pi.cadera.rotation.x = s * 0.6; p.pd.cadera.rotation.x = -s * 0.6;
    p.pi.rodilla.rotation.x = Math.max(0, -s) * 0.9; p.pd.rodilla.rotation.x = Math.max(0, s) * 0.9;
    p.bi.hombro.rotation.x = -s * 0.5; p.bi.codo.rotation.x = -0.4;
    if (modo === 'llevar') { p.bd.hombro.rotation.x = -1.0; p.bd.codo.rotation.x = -0.6; } else { p.bd.hombro.rotation.x = s * 0.5; p.bd.codo.rotation.x = -0.4; }
    p.cuerpo.position.y = Math.abs(s) * 0.035; p.cuerpo.rotation.x = 0.06;
    return;
  }
  if (modo === 'pie') { p.cuerpo.position.y = Math.sin(t * 1.6 + fase) * 0.008; return; }
  if (modo === 'chutar') { p.pd.cadera.rotation.x = -0.9; p.pd.rodilla.rotation.x = 0.2; p.bi.hombro.rotation.z = 0.5; p.bd.hombro.rotation.z = -0.3; p.cuerpo.rotation.x = -0.08; return; }
  if (modo === 'cafe') { const b = (Math.sin(t * 0.8 + fase) + 1) / 2; p.bi.hombro.rotation.x = -0.5 - b * 0.8; p.bi.codo.rotation.x = -1.3 - b * 0.5; p.cabeza.rotation.y = Math.sin(t * 0.4 + fase) * 0.3; return; }
  if (modo === 'charla') { p.bd.hombro.rotation.x = -0.6 + Math.sin(t * 3 + fase) * 0.35; p.bd.codo.rotation.x = -0.9; p.bd.hombro.rotation.z = -0.2; p.cabeza.rotation.x = Math.sin(t * 2.2 + fase) * 0.08; p.cuerpo.rotation.y = Math.sin(t * 0.7 + fase) * 0.08; return; }
  p.cuerpo.position.y = -0.42;
  for (const l of [p.pi, p.pd]) { l.cadera.rotation.x = -Math.PI / 2; l.rodilla.rotation.x = Math.PI / 2; }
  if (modo === 'teclear') {
    p.cuerpo.rotation.x = 0.08;
    p.bi.hombro.rotation.x = -0.95 + Math.sin(t * 14 + fase) * 0.06; p.bd.hombro.rotation.x = -0.95 + Math.sin(t * 14 + fase + 1.7) * 0.06;
    p.bi.codo.rotation.x = -0.75; p.bd.codo.rotation.x = -0.75;
    p.cabeza.rotation.x = 0.12 + Math.sin(t * 0.8 + fase) * 0.04;
  } else if (modo === 'descanso') {
    p.cuerpo.rotation.x = -0.12;
    const b = (Math.sin(t * 0.6 + fase) + 1) / 2;
    p.bi.hombro.rotation.x = -0.4 - b * 0.9; p.bi.codo.rotation.x = -1.2 - b * 0.6;
    p.bd.hombro.rotation.x = -0.25; p.bd.codo.rotation.x = -0.5;
    p.cabeza.rotation.y = Math.sin(t * 0.3 + fase) * 0.4;
  } else if (modo === 'esperar') {
    p.cuerpo.rotation.x = -0.15;
    p.bi.hombro.rotation.set(-0.7, 0, 0.5); p.bd.hombro.rotation.set(-0.7, 0, -0.5); p.bi.codo.rotation.x = -1.4; p.bd.codo.rotation.x = -1.4;
    p.cabeza.rotation.y = Math.sin(t * 0.5 + fase) * 0.5;
  } else { p.bi.hombro.rotation.x = -0.3; p.bd.hombro.rotation.x = -0.3; p.bi.codo.rotation.x = -0.6; p.bd.codo.rotation.x = -0.6; }
}

// Holograma de trabajo: solo aparece con un encargo real en marcha y cambia con el paso real del agente.
function holoDe(gx) {
  if (gx.holo) return gx.holo;
  const c = COLOR[gx.a.empresa] || '#8a93a6', g = new THREE.Group();
  const luz = (o = 0.9) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, side: THREE.DoubleSide });
  const aro = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.7, 48), luz(0.85)); aro.rotation.x = -Math.PI / 2; aro.position.y = 0.33; g.add(aro);
  const web = new THREE.Group(); web.add(new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), new THREE.MeshBasicMaterial({ color: c, wireframe: true, transparent: true, opacity: 0.9 })));
  const orb = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.01, 6, 40), luz(0.8)); orb.rotation.x = 1.2; web.add(orb);
  const doc = new THREE.Group(); for (let i = 0; i < 3; i++) { const h = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.48), luz(0.28)); h.position.set(i * 0.05, i * 0.03, -i * 0.06); doc.add(h); for (let k = 0; k < 5; k++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.26 - (k % 2) * 0.08, 0.018), luz(0.95)); l.position.set(i * 0.05 - (k % 2) * 0.04, i * 0.03 + 0.17 - k * 0.075, -i * 0.06 + 0.002); l.userData.linea = k; doc.add(l); } }
  const esc = new THREE.Group(); for (let k = 0; k < 6; k++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.03), luz(0.95)); l.position.y = 0.2 - k * 0.075; l.userData.k = k; esc.add(l); }
  for (const x of [web, doc, esc]) { x.position.y = 2.05; g.add(x); }
  escena.add(g); return (gx.holo = { g, aro, web, doc, esc });
}
function holograma(gx, t, sentado) {
  const trabaja = sentado && gx.modo === 'teclear' && !!gx.texto;
  if (!trabaja) { if (gx.holo) gx.holo.g.visible = false; return; }
  const h = holoDe(gx), txt = gx.texto || '';
  const tipo = /internet|Busca en|página|web/i.test(txt) ? 'web' : /^Lee|Busca archivos|Busca «/i.test(txt) ? 'doc' : 'esc';
  h.g.visible = true; h.g.position.set(gx.x, 0, gx.z + (gx.gerente || gx.recepcion ? 0.9 : -0.9));
  h.web.visible = tipo === 'web'; h.doc.visible = tipo === 'doc'; h.esc.visible = tipo === 'esc';
  h.aro.position.z = gx.z - h.g.position.z; h.aro.scale.setScalar(1 + Math.sin(t * 3 + gx.fase) * 0.06); h.aro.material.opacity = 0.55 + Math.sin(t * 3 + gx.fase) * 0.3;
  if (tipo === 'web') { h.web.rotation.y = t * 1.3; h.web.children[1].rotation.z = t * 2; }
  else if (tipo === 'doc') { h.doc.rotation.y = Math.sin(t * 0.6) * 0.35; for (const l of h.doc.children) if (l.userData.linea != null) l.material.opacity = ((t * 4 + gx.fase) % 5 | 0) === l.userData.linea ? 1 : 0.35; }
  else { h.esc.rotation.y = Math.sin(t * 0.5) * 0.25; for (const l of h.esc.children) { const k = ((t * 2.2 + gx.fase) % 6); l.scale.x = l.userData.k < (k | 0) ? 1 : l.userData.k === (k | 0) ? k % 1 : 0.02; l.position.x = -0.25 * (1 - l.scale.x); } }
}

// ---------- datos de ejemplo: salen de oficina.config.js ----------
function datosDesdeConfig() {
  const deps = (CFG.departamentos || []).filter((dp) => SITIO[dp.id]);
  const agentes = deps.flatMap((dp) => (dp.agentes || []).map((a, i) => ({ id: a.id || `${dp.id}-${i + 1}`, nombre: a.nombre || 'Agente', puesto: a.puesto || '', oficina: a.oficina, estado: a.estado || 'funciona', tareas: a.tareas || [], empresa: dp.id, departamento: a.id || `${dp.id}-${i + 1}`, genero: a.genero })));
  const gerentes = deps.filter((dp) => dp.responsable !== false).map((dp) => ({ id: `${dp.id}-responsable`, nombre: dp.responsable?.nombre || `Responsable de ${dp.nombre}`, puesto: 'Responsable', tareas: dp.responsable?.tareas || [], empresa: dp.id }));
  const recepcion = CFG.recepcion === false ? null : { id: 'recepcion', nombre: CFG.recepcion?.nombre || 'Recepción', puesto: 'Recepción', tareas: CFG.recepcion?.tareas || [], empresa: null };
  return { agentes: agentes.filter((a) => a.estado !== 'no_existe'), todos: agentes, gerentes, recepcion };
}
function casaDesdeConfig() {
  return { empresas: (CFG.departamentos || []).filter((dp) => SITIO[dp.id]).map((dp) => ({ id: dp.id, nombre: dp.nombre, zona: dp.zona,
    departamentos: datos.todos.filter((a) => a.empresa === dp.id).map((a) => ({ id: a.departamento, nombre: a.puesto || a.nombre, estado: a.estado, tipo: a.oficina, dibujo: a.dibujo })) })) };
}
const datos = datosDesdeConfig();

// ---------- montar con los datos ----------
const gente = {}, lineas = [];
let montado = false, cargando = false;
async function montar(d) {
  cargando = true;
  const M = ['desk', 'chairDesk', 'computerScreen', 'loungeSofa', 'tableCoffee', 'pottedPlant', 'kitchenCoffeeMachine', 'bookcaseOpen', 'bookcaseClosedWide', 'books', 'cardboardBoxClosed', 'cardboardBoxOpen', 'laptop', 'lampRoundFloor', 'tableRound', 'chair', 'chairCushion', 'speakerSmall', 'radio', 'sideTableDrawers', 'stoolBar', 'table', 'loungeChair', 'computerKeyboard', 'deskCorner', 'plantSmall1'];
  const C = [...'abcdefghijklmn'.split('').map((l) => 'building-' + l), ...'abcde'.split('').map((l) => 'building-skyscraper-' + l)];
  const [casa] = await Promise.all([
    Promise.resolve(casaDesdeConfig()),
    new GLTFLoader().loadAsync('./modelos/personas/xbot.glb').then((g) => { XBOT = g; }).catch((e) => console.warn('personas', e)),
    ...M.map((m) => cargar(m, `/modelos/muebles/${m}.glb`).catch((e) => console.warn(m, e))),
    ...C.map((m) => cargar(m, `/modelos/ciudad/${m}.glb`).catch((e) => console.warn(m, e))),
  ]);
  montarEdificios(casa, d); montarCiudad(); montarOficina(); montarRecepcion();
  for (const [id, e] of Object.entries(EDIF)) {   // ocio de los agentes: barra de chips (se recargan) y mesa de hologramas (juegan en pareja)
    const rotulo = (txt, pt, y) => { if (!pt) return; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: letrero(txt, COLOR[id], 512, 110, '#ffffff', COLOR[id], 50) })); sp.scale.set(2.3, 0.5, 1); sp.position.set(pt.x, y, pt.z); escena.add(sp); };
    rotulo('BARRA DE CHIPS', e.cafe, 2.7); rotulo('HOLOJUEGOS', e.campo, 2.9);
    if (e.campo) { const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.5, 32), mat('#f4f6f9', 0.25)); base.position.set(e.campo.x, 0.25, e.campo.z); base.castShadow = true; escena.add(base);
      const aro = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.035, 10, 48), new THREE.MeshStandardMaterial({ color: COLOR[id], emissive: COLOR[id], emissiveIntensity: 1.4 })); aro.rotation.x = Math.PI / 2; aro.position.set(e.campo.x, 0.52, e.campo.z); escena.add(aro); }
  }
  window.OFICINA3D = { camara, controles, gente, EDIF };   // para depurar desde la consola
  let n = 0;
  for (const a of d.agentes) {
    const e = EDIF[a.empresa]; const pu = e?.puestos[a.departamento]; if (!pu) continue;
    const eq = d.agentes.filter((x) => x.empresa === a.empresa), i = eq.indexOf(a);
    const porFila = 6, fila = Math.floor(i / porFila), col = i % porFila, enFila = Math.min(porFila, eq.length - fila * porFila);
    const desc = { x: e.descanso.x + (col - (enFila - 1) / 2) * 0.8, z: e.descanso.z + fila * 1.1, rot: 0 };
    gente[a.id] = { p: persona(a, n++, false), a, asiento: { x: pu.x, z: pu.z, rot: Math.PI }, descanso: desc, pantalla: pu.pantalla, x: desc.x, z: desc.z, fase: n * 1.3 };
  }
  if (d.recepcion) { const as = { x: RECEP.x, z: RECEP.z - 0.2, rot: 0 }; gente[d.recepcion.id] = { p: persona(d.recepcion, n++, false), a: d.recepcion, recepcion: true, asiento: as, descanso: as, x: as.x, z: as.z, fase: 0.7 }; }
  for (const g of d.gerentes) {
    const e = EDIF[g.empresa]; if (!e) continue;
    const as = { x: e.gerente.x, z: e.gerente.z, rot: 0 };
    gente[g.id] = { p: persona(g, n++, true), a: g, gerente: true, asiento: as, descanso: as, x: as.x, z: as.z, fase: n * 1.7 };
    for (const a of d.agentes.filter((x) => x.empresa === g.empresa)) {
      const b = gente[a.id]; if (!b) continue;
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(as.x, 1.8, as.z), new THREE.Vector3(b.asiento.x, 2.2, b.asiento.z - 1)]), new THREE.LineBasicMaterial({ color: COLOR[g.empresa], transparent: true, opacity: 0 }));
      escena.add(l); lineas.push({ l, g: g.id, a: a.id });
    }
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 2.5, 6), new THREE.Vector3(as.x, 2, as.z)]), new THREE.LineBasicMaterial({ color: COLOR[g.empresa], transparent: true, opacity: 0.15 }));
    escena.add(l); lineas.push({ l, g: g.id, centro: true });
  }
  for (const gx of Object.values(gente)) {
    const el = document.createElement('div'); el.className = 'et'; el.innerHTML = '<span class="bur" hidden></span><span class="nom"></span>';
    capa.appendChild(el); gx.el = el; gx.bur = el.querySelector('.bur'); gx.nom = el.querySelector('.nom');
    const nombreEt = gx.a.nombre;
    gx.nom.textContent = nombreEt;
    gx.el.title = gx.gerente ? '' : `${gx.a.nombre} · ${gx.a.puesto}`;
    gx.p.root.position.set(gx.x, 0.3, gx.z);
  }
  ps1izar(escena); filtros();
  montado = true;
  if (VISTAS[location.hash.slice(1)]) ir(location.hash.slice(1));
}

// ---------- comportamiento (simulado) ----------
const entregados = new Set();
// Zona de ocio: cada uno elige qué hacer (sofá, café, charlar con un compañero o jugar en la mesa de hologramas).
// Es ambiente y se distingue del trabajo: sin bocadillo, sin pantalla encendida.
const balones = [];
function nuevoBalon() { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), new THREE.MeshStandardMaterial({ color: '#7fd6ff', emissive: '#3aa8ff', emissiveIntensity: 1.6, wireframe: true })); b.castShadow = true; b.visible = false; escena.add(b); balones.push(b); return b; }
function libre(o) { return !o.gerente && !o.recepcion && !o.lleva && !o.vida?.par && ['trabaja', 'ocio'].includes(o.demo?.fase); }
function elegirVida(gx) {
  const e = EDIF[gx.a.empresa]; if (!e) return;
  const ahora = performance.now() / 1000, dura = 25 + Math.random() * 30;
  const companeros = Object.values(gente).filter((o) => o !== gx && o.a.empresa === gx.a.empresa && libre(o));
  const r = Math.random();
  if (companeros.length && r > 0.45) {
    const o = companeros[(Math.random() * companeros.length) | 0];
    const balon = r > 0.72;
    const ocupadas = new Set(Object.values(gente).filter((x) => x.a.empresa === gx.a.empresa && x.vida?.par && x.vida.hasta > ahora).map((x) => x.vida.par)).size;   // cada pareja en su sitio: no se amontonan
    const c0 = balon ? e.campo : e.charla, c = { x: c0.x + (ocupadas % 3 - (balon ? 0 : 1)) * (balon ? 3.6 : 2.2) * (ocupadas ? 1 : 0), z: c0.z + (balon ? 0 : Math.floor(ocupadas / 3) * 1.6) }, sep = balon ? 1.15 : 0.55;
    if (!(balon && ocupadas)) {   // una sola mesa de hologramas por edificio
      const v = { tipo: balon ? 'balon' : 'charla', hasta: ahora + dura, miembros: [gx, o], t0: ahora };
      if (o.vida) soltarVida(o);
      gx.vida = { ...v, punto: { x: c.x - sep, z: c.z, rot: Math.PI / 2 }, rol: 0, par: v };
      o.vida = { ...v, punto: { x: c.x + sep, z: c.z, rot: -Math.PI / 2 }, rol: 1, par: v };
      o.demo.fase = 'ocio'; o.demo.hasta = v.hasta; o.texto = '';
      if (balon) v.bola = balones.find((b) => !b.visible && !b.ocupado) || nuevoBalon(), v.bola.ocupado = true;
      return;
    }
  }
  gx.vida = r < 0.3 ? { tipo: 'cafe', hasta: ahora + 12 + Math.random() * 10, punto: e.cafe } : { tipo: 'sofa', hasta: ahora + dura, punto: gx.descanso };
}
function soltarVida(gx) {
  const v = gx.vida?.par; if (v) { for (const m of v.miembros) if (m.vida?.par === v) m.vida.hasta = 0; if (v.bola) { v.bola.visible = false; v.bola.ocupado = false; v.bola = null; } }
  gx.vida = null;
}
// SIMULACIÓN: cada agente sigue su jornada (trabaja en su mesa → consulta a un compañero → entrega a su responsable →
// recibe otro encargo → zona de ocio) y a veces lleva un recado a otro departamento. Es solo visual: no hay datos reales.
const TAREAS_JEFE = ['Reparte los encargos del día', 'Revisa lo que entregó su equipo', 'Escribe el resumen del día', 'Mira los números de la semana'];
const TAREAS_AGENTE = ['Trabaja en su encargo', 'Revisa lo que ha hecho', 'Escribe el informe'];
const ACTIVIDAD = [];
function anotar(gx, texto) {
  if (!texto) return;
  ACTIVIDAD.unshift({ t: new Date(), quien: gx.a.nombre, color: COLOR[gx.a.empresa] || COLOR_CENTRO, texto });
  ACTIVIDAD.length = Math.min(ACTIVIDAD.length, 8);
  window.dispatchEvent(new CustomEvent('oficina:actividad', { detail: ACTIVIDAD }));
}
function decidir() {
  const ahora = performance.now() / 1000, todos = Object.values(gente);
  const jefeDe = (e) => todos.find((x) => x.gerente && x.a.empresa === e);
  for (const gx of todos) {
    const dm = (gx.demo ||= { fase: 'trabaja', hasta: ahora + 2 + Math.random() * 14, n: (Math.random() * 7) | 0, cambio: 0 });
    const guion = gx.a.tareas?.length ? gx.a.tareas : gx.gerente ? TAREAS_JEFE : TAREAS_AGENTE;
    const antes = gx.texto;
    if (gx.recepcion) { if (ahora > dm.cambio) { dm.n++; dm.cambio = ahora + 7 + Math.random() * 6; } gx.objetivo = gx.asiento; gx.modo = 'teclear'; gx.texto = guion[dm.n % guion.length] || 'Atiende a quien llega'; if (gx.texto !== antes) anotar(gx, gx.texto); continue; }
    if (gx.gerente) { if (ahora > dm.cambio) { dm.n++; dm.cambio = ahora + 6 + Math.random() * 5; } gx.objetivo = gx.asiento; gx.modo = 'teclear'; gx.texto = guion[dm.n % guion.length]; continue; }
    const emp = gx.a.empresa;
    if (ahora > dm.hasta) {   // siguiente paso de su jornada
      const r = Math.random(), g = jefeDe(emp);
      const sig = { trabaja: r < 0.28 ? 'consulta' : r < 0.52 ? 'entrega' : r < 0.62 ? 'recado' : r < 0.84 ? 'ocio' : 'trabaja', consulta: 'trabaja', entrega: g ? 'recibe' : 'trabaja', recibe: 'trabaja', recado: 'trabaja', ocio: 'trabaja' }[dm.fase] || 'trabaja';
      if (dm.fase === 'ocio' && sig !== 'ocio') soltarVida(gx);
      dm.fase = sig; dm.n++;
      dm.hasta = ahora + { trabaja: 10 + Math.random() * 14, consulta: 9, entrega: 9, recibe: 8, recado: 40, ocio: 30 }[sig];
      if (sig === 'consulta') { const cs = todos.filter((x) => x !== gx && !x.gerente && !x.recepcion && x.a.empresa === emp); dm.con = cs[(Math.random() * cs.length) | 0]; if (!dm.con) dm.fase = 'trabaja'; }
      if (sig === 'recado') { const otras = Object.keys(EDIF).filter((e) => e !== emp && jefeDe(e)); dm.a = jefeDe(otras[(Math.random() * otras.length) | 0]); if (!dm.a) dm.fase = 'trabaja'; }
      if (sig === 'entrega' && !g) dm.fase = 'trabaja';
      if (dm.fase === 'ocio') { soltarVida(gx); elegirVida(gx); if (gx.vida) dm.hasta = gx.vida.hasta; }
      dm.g = g;
    }
    gx.lleva = false;
    if (dm.fase === 'trabaja') { if (ahora > dm.cambio) { dm.n++; dm.cambio = ahora + 5 + Math.random() * 5; } gx.objetivo = gx.asiento; gx.modo = 'teclear'; gx.texto = guion[dm.n % guion.length]; }
    else if (dm.fase === 'consulta' && dm.con) { gx.objetivo = { x: dm.con.asiento.x + 0.95, z: dm.con.asiento.z + 0.25, rot: -Math.PI / 2 }; gx.modo = 'charla'; gx.texto = `Le pasa datos a ${dm.con.a.nombre}`; }
    else if (dm.fase === 'entrega' && dm.g) { gx.objetivo = { x: dm.g.asiento.x + 1.2 + (gx.fase % 3) * 0.45, z: dm.g.asiento.z + 1.9, rot: Math.PI }; gx.modo = 'pie'; gx.lleva = true; gx.texto = 'Entrega su trabajo al responsable'; }
    else if (dm.fase === 'recibe' && dm.g) { gx.objetivo = { x: dm.g.asiento.x - 1.3 + (gx.fase % 3) * 0.45, z: dm.g.asiento.z + 1.9, rot: Math.PI }; gx.modo = 'charla'; gx.texto = 'Recibe el siguiente encargo'; }
    else if (dm.fase === 'recado' && dm.a) { gx.objetivo = { x: dm.a.asiento.x + 1.6, z: dm.a.asiento.z + 2.3, rot: Math.PI }; gx.modo = 'charla'; gx.lleva = true; gx.texto = `Lleva un encargo a ${dm.a.a.nombre}`; }
    else {   // zona de ocio
      if (!gx.vida || gx.vida.hasta < ahora) { if (gx.vida) soltarVida(gx); elegirVida(gx); }
      const v = gx.vida || { tipo: 'sofa', punto: gx.descanso };
      gx.objetivo = { rot: 0, ...v.punto }; gx.modo = { sofa: 'descanso', cafe: 'cafe', charla: 'charla', balon: 'charla' }[v.tipo]; gx.texto = '';
    }
    if (gx.texto && gx.texto !== antes) anotar(gx, gx.texto);
    const lin = dm.fase === 'trabaja' ? [gx.texto.slice(0, 24), gx.texto.slice(24, 48), '…'] : [];
    const firma = lin.join('|'); if (gx.pantalla && gx.firma !== firma) { gx.firma = firma; gx.pantalla.est.lineas = lin; gx.pantalla.redibujar(); }
  }
  for (const { l, a, centro: nn } of lineas) { const x = a && gente[a]; l.material.opacity = nn ? 0.85 : x && ['entrega', 'recibe'].includes(x.demo?.fase) ? 0.95 : 0.12; }
  for (const pz of PANTALLAS) dibujarPared(pz);
  nucleoMat.emissiveIntensity = 1.6;
}
const v3 = new THREE.Vector3(), tmp = new THREE.Vector3();
function mover(dt, t) {
  for (const gx of Object.values(gente)) {
    const o = gx.objetivo; if (!o) continue;
    const dx = o.x - gx.x, dz = o.z - gx.z, dist = Math.hypot(dx, dz);
    let modo;
    if (dist > 0.05 && gx.p.real && gx.p.s > 0.2) { postura(gx.p, 'pie', t, gx.fase); continue; }   // primero se levanta de la silla; hasta entonces no se mueve del sitio
    if (dist > 0.05) {
      const v = Math.min(1.9 * dt, dist); gx.x += (dx / dist) * v; gx.z += (dz / dist) * v;
      // nadie pasa por encima de nadie: si hay alguien cerca, se aparta y lo rodea
      if (dist > 1.0) for (const o of Object.values(gente)) {
        if (o === gx) continue;
        const ox = gx.x - o.x, oz = gx.z - o.z, od = Math.hypot(ox, oz);
        if (od > 0.001 && od < 0.55) { const k = (0.55 - od) * 0.35; gx.x += (ox / od) * k; gx.z += (oz / od) * k; }   // solo se separa, nunca gira alrededor
      }
      let dr = Math.atan2(dx, dz) - gx.p.root.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); gx.p.root.rotation.y += dr * Math.min(1, dt * 10);
      modo = gx.lleva ? 'llevar' : 'andar';
    } else {
      let dr = o.rot - gx.p.root.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); gx.p.root.rotation.y += dr * Math.min(1, dt * 8);
      modo = gx.modo; if (o.entrega) { entregados.add(o.entrega); gx.lleva = false; }
    }
    gx.p.root.position.set(gx.x, gx.vida?.tipo === 'balon' || gx.recepcion ? (gx.recepcion ? 0.2 : 0) : 0.3, gx.z);
    const v = gx.vida?.par;
    if (v?.bola && gx.vida.rol === 0 && dist <= 0.05) {
      const [a, b] = v.miembros, listos = [a, b].every((m) => Math.hypot(m.x - m.vida?.punto.x, m.z - m.vida?.punto.z) < 0.1);
      v.bola.visible = listos;
      if (listos) {
        const per = 1.4, k = ((t - v.t0) % (per * 2)) / per, ida = k < 1, f = ida ? k : k - 1;
        const de = ida ? a : b, a2 = ida ? b : a;
        v.bola.position.set((a.x + b.x) / 2, 1.35 + Math.sin(t * 1.4) * 0.08, (a.z + b.z) / 2);   // holograma del juego, flotando entre los dos
        v.bola.rotation.y += dt * (ida ? 1.6 : -1.6); v.bola.rotation.x += dt * 0.7; v.bola.scale.setScalar(1 + Math.sin(f * Math.PI) * 0.25);
        a.chuta = b.chuta = false;
      }
    }
    postura(gx.p, modo, t, gx.fase);
    holograma(gx, t, dist <= 0.05);
  }
}
// Desde el aire: una tarjeta de resumen por departamento. Al acercarte: el interior.
function resumenes(d) {
  const ids = Object.keys(EDIF).sort((a, b) => EDIF[a].x - EDIF[b].x || EDIF[a].z - EDIF[b].z);   // tarjetas de izquierda a derecha, como los edificios
  for (const [id, e] of Object.entries(EDIF)) {
    if (!e.tarjeta) continue;
    const dist = camara.position.distanceTo(tmp.set(e.x, 0, e.z));
    const aire = THREE.MathUtils.smoothstep(dist, 52, 66);          // 0 = dentro, 1 = desde el aire
    e.tejado.grupo.visible = false;   // sin tejado: desde el aire se ve el interior
    v3.set(e.x, 9, e.z - e.d / 2).project(camara);
    const ver = !aPie && camara.position.y > 38 && v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1;   // solo en la vista desde arriba
    e.tarjeta.style.display = ver ? '' : 'none'; if (!ver) continue;
    const r = renderer.domElement.getBoundingClientRect();
    const slot = (ids.indexOf(id) + 0.5) / ids.length;   // las tarjetas en fila fija bajo la barra
    e.tarjeta.style.transform = `translate(${slot * r.width}px, 140px) translate(-50%, 0)`;
    e.tarjeta.style.opacity = aire;
    const cuenta = (est) => e.deps.filter((x) => x.estado === est).length;
    const ok = cuenta('funciona'), medias = cuenta('a_medias'), no = cuenta('no_existe');
    const equipo = d.agentes.filter((a) => a.empresa === id);
    const trabajando = equipo.filter((a) => ['trabaja', 'consulta', 'entrega', 'recibe', 'recado'].includes(gente[a.id]?.demo?.fase)).length;
    const ocio = equipo.filter((a) => gente[a.id]?.demo?.fase === 'ocio').length;
    const firma = [ok, medias, no, trabajando, ocio, equipo.length].join('·');
    if (e.firma === firma) continue; e.firma = firma;
    const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    e.tarjeta.style.setProperty('--c', COLOR[id]);
    e.tarjeta.innerHTML = `<b>${esc(TITULO[id])}</b>
      <div class="fila"><span>${trabajando}/${equipo.length} trabajando</span><span>${ocio} en la zona de ocio</span></div>
      <div class="deps"><i style="--n:${ok};background:#3fae6a"></i><i style="--n:${medias};background:#e0a12f"></i><i style="--n:${no};background:#9aa3b3"></i></div>
      <div class="ley">${ok} en marcha · ${medias} a medias · ${no} por crear</div>`;
  }
}
function etiquetas() {
  resumenes(datos);
  const r = renderer.domElement.getBoundingClientRect();
  for (const pl of PLACAS) {
    v3.copy(pl.pos).project(camara);
    const dist = camara.position.distanceTo(pl.pos);
    const ver = v3.z < 1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05 && dist < 30;
    pl.el.style.display = ver ? '' : 'none'; if (!ver) continue;
    pl.el.style.transform = `translate(${((v3.x + 1) / 2) * r.width}px, ${((1 - v3.y) / 2) * r.height}px) translate(-50%, -50%)`;
  }
  for (const gx of Object.values(gente)) {
    v3.set(gx.x, 2.35, gx.z).project(camara);
    const visible = v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1;
    gx.el.style.display = visible ? '' : 'none'; if (!visible) continue;
    gx.el.style.transform = `translate(${((v3.x + 1) / 2) * r.width}px, ${((1 - v3.y) / 2) * r.height}px) translate(-50%, -100%)`;
    const dist = camara.position.distanceTo(tmp.set(gx.x, 1, gx.z));
    gx.el.style.opacity = dist > 95 ? 0 : 1;
    gx.bur.hidden = !gx.texto || dist > 85; if (gx.texto) gx.bur.textContent = gx.texto.length > 48 ? gx.texto.slice(0, 46) + '…' : gx.texto;
    gx.bur.className = 'bur' + (gx.gerente ? ' g' : '');
    gx.nom.hidden = dist > 52 && !gx.texto;
  }
}

// ---------- vistas y desplazamiento ----------
const VISTAS = {
  general: { pos: [0, 50, 80], obj: [0, 0, -4] },
  oficina: { pos: [0, 13, 46], obj: [0, 1, 18] },
};
for (const [id, s] of Object.entries(SITIO)) VISTAS[id] = { pos: [s.x, 25, s.z + 35], obj: [s.x, 0, s.z] };
{   // un botón por departamento en la barra de vistas
  const nav = document.getElementById('vistas'), ref = nav?.querySelector('[data-v="oficina"]');
  for (const id of Object.keys(SITIO)) { const b = document.createElement('button'); b.dataset.v = id; b.setAttribute('aria-pressed', 'false'); b.textContent = (CFG.departamentos.find((x) => x.id === id)?.nombre) || id; nav?.insertBefore(b, ref); }
}
let vuelo = null;
function ir(nombre) {
  const v = VISTAS[nombre]; if (!v) return;
  if (aPie) modoPie(false);
  vuelo = { t0: performance.now(), de: camara.position.clone(), a: new THREE.Vector3(...v.pos), od: controles.target.clone(), oa: new THREE.Vector3(...v.obj) };
  document.querySelectorAll('#vistas button[data-v]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === nombre)));
}
function irA(x, z) {
  const off = camara.position.clone().sub(controles.target).setLength(11);
  vuelo = { t0: performance.now(), de: camara.position.clone(), a: new THREE.Vector3(x, 0, z).add(off), od: controles.target.clone(), oa: new THREE.Vector3(x, 1, z) };
}
document.querySelectorAll('#vistas button[data-v]').forEach((b) => b.addEventListener('click', () => ir(b.dataset.v)));
addEventListener('hashchange', () => ir(location.hash.slice(1)));
const teclas = new Set();
addEventListener('keydown', (e) => { if (e.target.closest('input,textarea,select')) return; teclas.add(e.key.toLowerCase()); });
addEventListener('keyup', (e) => teclas.delete(e.key.toLowerCase()));
addEventListener('blur', () => teclas.clear());
function teclado(dt) {
  const f = new THREE.Vector3(); camara.getWorldDirection(f); f.y = 0; f.normalize();
  const dd = new THREE.Vector3(-f.z, 0, f.x), m = new THREE.Vector3();
  if (teclas.has('w') || teclas.has('arrowup')) m.add(f); if (teclas.has('s') || teclas.has('arrowdown')) m.sub(f);
  if (teclas.has('d') || teclas.has('arrowright')) m.add(dd); if (teclas.has('a') || teclas.has('arrowleft')) m.sub(dd);
  if (m.lengthSq()) { m.setLength(22 * dt); camara.position.add(m); controles.target.add(m); vuelo = null; }
}
// MODO A PIE (botón «Caminar») — recorrer el mundo por dentro, a la altura de los ojos. Arrastrar = mirar; WASD/flechas = andar (Mayús = rápido).
let aPie = false, guinada = 0, cabeceo = 0, arrastre = null;
const botonPie = document.getElementById('caminar'), botonAvanza = document.getElementById('avanza'), ayuda = document.getElementById('ayuda');
function modoPie(si) {
  aPie = si; vuelo = null; controles.enabled = !si;
  botonPie?.setAttribute('aria-pressed', String(si)); if (botonAvanza) botonAvanza.hidden = !si;
  if (si) {
    const f = new THREE.Vector3(); camara.getWorldDirection(f); guinada = Math.atan2(-f.x, -f.z); cabeceo = -0.08;
    const en = controles.target; camara.position.set(en.x, 2.0, en.z + 0.01); camara.fov = 62;
    if (ayuda) ayuda.textContent = 'A pie: arrastra para mirar · WASD o flechas para andar · Mayús para ir rápido · «Caminar» otra vez para volver a la vista aérea';
  } else {
    const f = new THREE.Vector3(); camara.getWorldDirection(f); controles.target.copy(camara.position).addScaledVector(f, 8).setY(1);
    camara.position.y = 9; camara.fov = 30;
    if (ayuda) ayuda.textContent = 'Arrastra para girar · clic derecho o Shift para desplazarte · rueda para acercar · WASD para moverte · clic en una persona o edificio';
  }
  camara.updateProjectionMatrix();
}
botonPie?.addEventListener('click', () => modoPie(!aPie));
if (botonAvanza) { const on = (e) => { e.preventDefault(); teclas.add('w'); }, off = () => teclas.delete('w'); botonAvanza.addEventListener('pointerdown', on); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) botonAvanza.addEventListener(ev, off); }
renderer.domElement.addEventListener('pointerdown', (e) => { if (aPie) arrastre = { x: e.clientX, y: e.clientY }; });
addEventListener('pointermove', (e) => { if (!aPie || !arrastre) return; guinada -= (e.clientX - arrastre.x) * 0.0042; cabeceo = Math.max(-1.1, Math.min(1.1, cabeceo - (e.clientY - arrastre.y) * 0.0036)); arrastre = { x: e.clientX, y: e.clientY }; });
addEventListener('pointerup', () => { arrastre = null; });
function andarAPie(dt) {
  const f = new THREE.Vector3(-Math.sin(guinada), 0, -Math.cos(guinada)), dd = new THREE.Vector3(-f.z, 0, f.x), m = new THREE.Vector3();
  if (teclas.has('w') || teclas.has('arrowup')) m.add(f); if (teclas.has('s') || teclas.has('arrowdown')) m.sub(f);
  if (teclas.has('d')) m.add(dd); if (teclas.has('a')) m.sub(dd);
  if (teclas.has('arrowright')) guinada -= dt * 1.6; if (teclas.has('arrowleft')) guinada += dt * 1.6;
  if (m.lengthSq()) { m.setLength((teclas.has('shift') ? 11 : 4.2) * dt); camara.position.add(m); camara.position.y = 2.0 + Math.sin(performance.now() / 110) * 0.025; }
  camara.rotation.set(cabeceo, guinada, 0, 'YXZ');
}
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
function tocar(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, camara);
  return ray.intersectObjects([...clicables, ...Object.values(gente).map((g) => g.p.root)], true).find((h) => h.object.userData?.tipo);
}
// Ficha de solo lectura: quién es, en qué departamento está y qué hace ahora.
const ficha = document.getElementById('ficha');
const FASE = { trabaja: 'Trabajando en su mesa', consulta: 'Consultando a un compañero', entrega: 'Entregando su trabajo', recibe: 'Recibiendo un encargo', recado: 'Llevando un recado', ocio: 'En la zona de ocio' };
function verFicha(gx) {
  if (!ficha) return;
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const col = COLOR[gx.a.empresa] || COLOR_CENTRO, dep = TITULO[gx.a.empresa] || 'RECEPCIÓN';
  const estado = gx.gerente ? 'Responsable del departamento' : gx.recepcion ? 'Atiende la entrada' : FASE[gx.demo?.fase] || '';
  ficha.innerHTML = `<button class="cerrar" aria-label="Cerrar">×</button><span class="dep" style="background:${col}">${esc(dep)}</span>
    <b>${esc(gx.a.nombre)}</b>${gx.a.puesto ? `<span class="puesto">${esc(gx.a.puesto)}</span>` : ''}
    <span class="estado">${esc(estado)}</span>${gx.texto ? `<span class="ahora">▶ ${esc(gx.texto)}</span>` : ''}
    ${gx.a.tareas?.length ? `<span class="sub">Sus tareas</span><ul>${gx.a.tareas.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}`;
  ficha.hidden = false; ficha.querySelector('.cerrar').onclick = () => (ficha.hidden = true);
}
addEventListener('keydown', (e) => { if (e.key === 'Escape' && ficha) ficha.hidden = true; });
let abajo = null;
renderer.domElement.addEventListener('pointerdown', (e) => (abajo = [e.clientX, e.clientY]));
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!abajo || Math.hypot(e.clientX - abajo[0], e.clientY - abajo[1]) > 5) return;
  const hit = tocar(e); if (!hit) return;
  const u = hit.object.userData;
  if (u.tipo === 'agente' || u.tipo === 'gerente') { const g = gente[u.id]; if (!g) return; if (!aPie) irA(g.x, g.z); verFicha(g); }
  else if (u.tipo === 'edificio') { if (!aPie) ir(u.empresa); }
  else if (u.tipo === 'dep') { if (!aPie) irA(hit.point.x, hit.point.z + 2); const g = u.agente && gente[u.agente]; if (g) verFicha(g); }
  else if (u.tipo === 'recepcion') { if (!aPie) irA(RECEP.x, RECEP.z); const g = gente.recepcion; if (g) verFicha(g); }
});
let ultimoHover = 0;
renderer.domElement.addEventListener('pointermove', (e) => {
  if (performance.now() - ultimoHover < 80) return; ultimoHover = performance.now();
  renderer.domElement.style.cursor = tocar(e) ? 'pointer' : 'grab';
});

// ---------- bucle ----------
{ const h = location.hash.slice(1), num = h.split(',').map(Number);   // también vale #x,y,z,ox,oy,oz para ir a un punto exacto
  const v = VISTAS[h] || (num.length === 6 && num.every(Number.isFinite) ? { pos: num.slice(0, 3), obj: num.slice(3) } : VISTAS.general);
  camara.position.set(...v.pos); controles.target.set(...v.obj); }
ajustar();
const reloj = new THREE.Clock();
let ultimaDecision = 0;
function cuadro() {
  const dt = Math.min(reloj.getDelta(), 0.05), t = reloj.elapsedTime, d = datos;
  if (!montado && !cargando) montar(d).then(() => dispatchEvent(new Event('oficina:lista'))).catch((e) => { console.error(e); dispatchEvent(new CustomEvent('oficina:error', { detail: String(e) })); });
  if (montado && t - ultimaDecision > 0.25) { decidir(); ultimaDecision = t; }
  if (montado) mover(dt, t);
  nucleo.rotation.y += dt * 0.5; nucleo.position.y = 2.5 + Math.sin(t * 1.2) * 0.12;
  if (vuelo) {
    const k = Math.min(1, (performance.now() - vuelo.t0) / 1100), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    camara.position.lerpVectors(vuelo.de, vuelo.a, e); controles.target.lerpVectors(vuelo.od, vuelo.oa, e);
    if (k >= 1) vuelo = null;
  }
  if (aPie) andarAPie(dt); else { teclado(dt); controles.update(); }
  pintar();
  if (montado) etiquetas();
  requestAnimationFrame(cuadro);
}
requestAnimationFrame(cuadro);
