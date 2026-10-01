/* ============================================================
   ORQUESTADOR DE PRUEBAS DEL JUEGO
   Uso:  node test\ejecutar.js "C:\ruta\del\proyecto" [tamaño]
   Sin tamaño ejecuta la matriz completa.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const RAIZ = process.argv[2] || process.cwd();
const TAM = (process.argv[3] && /^\d+x\d+$/.test(process.argv[3])) ? process.argv[3] : null;
const VER_PASOS = process.argv.includes('--pasos');
const TMP = path.join(os.tmpdir(), 'opencode-test-' + process.pid);

/* ---------- 1. localizar Chrome ---------- */
function chrome() {
  const c = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
  ];
  for (const p of c) if (p && fs.existsSync(p)) return p;
  throw new Error('No se encontro Google Chrome');
}

/* ---------- 2. preparar la copia temporal ---------- */
function preparar() {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  for (const f of ['index.html', 'style.css', 'script.js']) {
    fs.copyFileSync(path.join(RAIZ, f), path.join(TMP, f));
  }
  for (const d of ['img', 'audio']) {
    const o = path.join(RAIZ, d);
    if (fs.existsSync(o)) fs.cpSync(o, path.join(TMP, d), { recursive: true });
  }
  fs.copyFileSync(path.join(RAIZ, 'test', 'navegador.js'), path.join(TMP, 'run.js'));

  /* inyecta el motor de pruebas antes de </body> */
  let h = fs.readFileSync(path.join(TMP, 'index.html'), 'utf8');
  const flag = '<script>var q=location.search;' +
    'window.__NO_TTS=q.indexOf("notts")>=0;' +
    'window.__MP3_ROTO=q.indexOf("mp3roto")>=0;</script>\n';
  h = h.replace('</body>', flag + '<script src="run.js"></script>\n</body>');
  fs.writeFileSync(path.join(TMP, 'index.html'), h, 'utf8');
}

/* ---------- 3. correr un tamaño ----------
   modo: 'tts' | 'notts' | 'mp3roto' */
function correr(ancho, alto, modo) {
  const perfil = path.join(TMP, 'perfil');
  const ETIQUETA = { tts: 'con MP3', notts: 'sin TTS', mp3roto: 'MP3 caidos' };
  const consulta = modo === 'tts' ? '' : (modo === 'notts' ? '?notts' : '?mp3roto');
  const args = [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--mute-audio',
    '--autoplay-policy=no-user-gesture-required',
    '--user-data-dir=' + perfil,
    '--window-size=' + ancho + ',' + alto,
    /* sin voz de sistema el juego usa pausas de lectura y el recorrido tarda
       bastante mas: necesita un presupuesto mayor para llegar al final */
    '--virtual-time-budget=' + (modo === 'notts' ? 600000 : 180000),
    '--dump-dom',
    'file:///' + path.join(TMP, 'index.html').replace(/\\/g, '/') + consulta
  ];
  let dom = '';
  try {
    dom = execFileSync(chrome(), args, {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'], timeout: 240000
    });
  } catch (e) {
    return { ancho, alto, modo: ETIQUETA[modo], pasos: 0, errores: ['no se pudo ejecutar Chrome: ' + (e.message || e).split('\n')[0]] };
  }
  const m = dom.match(/<pre id="RESULT"[^>]*>([\s\S]*?)<\/pre>/);
  if (!m) return { ancho, alto, modo: ETIQUETA[modo], pasos: 0, errores: ['sin resultado: el recorrido no llegó a terminar'] };

  const txt = m[1]
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

  const seccionErr = txt.split('=== ERRORES');
  const cuerpo = (seccionErr[0].split('=== PASOS')[1] || '');
  const lineas = cuerpo.split('\n').map(s => s.trim()).filter(Boolean)
    .filter(s => s !== '=== AVISOS (' + (txt.match(/=== AVISOS \((\d+)\)/) || [, '0'])[1] + ') ===');
  const secAvisos = (txt.split('=== AVISOS')[1] || '').split('===')[0] || '';
  const avisos = secAvisos.split('\n').slice(1).map(s => s.trim())
    .filter(s => s && s !== 'NINGUNO');
  const lineaErr = (seccionErr[1] || '').split('\n').slice(1)
    .map(s => s.trim()).filter(s => s && s !== 'NINGUNO');
  return { ancho, alto, modo: ETIQUETA[modo], pasos: lineas.length, lineas, avisos, errores: lineaErr };
}

/* ---------- 4. correr todo ----------
   En cada tamaño se prueban tres scenarios de audio:
     con MP3   -> el camino normal, el que usa la niñа
     sin TTS   -> navegador sin voz de sistema: solo MP3 +.watchdog
     MP3 caídos-> los archivos fallan: tiene que seguir con la voz del sistema */
const MATRIZ = [
  [1920, 1080], [1366, 768], [1280, 720],
  [1024, 768], [900, 700], [800, 600],
  [700, 760], [660, 560], [620, 500]
];

console.log('preparando copia temporal...');
preparar();
const medidas = TAM ? [[+TAM.split('x')[0], +TAM.split('x')[1]]] : MATRIZ;
const SOLO_MODO = (process.argv.find(a => a.startsWith('--modo=')) || '').split('=')[1];
const modos = SOLO_MODO ? [SOLO_MODO] : (TAM ? ['tts'] : ['tts', 'notts', 'mp3roto']);

let totErr = 0;
for (const [w, h] of medidas) {
  for (const modo of modos) {
    process.stdout.write('  ' + (w + 'x' + h).padEnd(10) + modo.padEnd(9) + ' ... ');
    const r = correr(w, h, modo);
    totErr += r.errores.length;
    console.log(r.errores.length === 0
      ? 'OK  (' + r.pasos + ' pasos)'
      : 'FALLOS ' + r.errores.length + '  (' + r.pasos + ' pasos)');
    for (const e of r.errores) console.log('        - ' + e);
    for (const a of r.avisos) console.log('        ~ ' + a);
    if (VER_PASOS) for (const s of r.lineas) console.log('        . ' + s);
  }
}

console.log('');
console.log('==============================================');
console.log('TOTAL DE ERRORES DE NAVEGADOR: ' + totErr);
console.log(totErr === 0 ? 'NAVEGADOR: TODO CORRECTO' : 'NAVEGADOR: HAY FALLOS');
console.log('==============================================');

fs.rmSync(TMP, { recursive: true, force: true });
process.exit(totErr === 0 ? 0 : 1);
