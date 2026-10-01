/* ============================================================
   REGENERA test\datos.b64.txt
   Los datos del juego (textos, preguntas, etapas) se sacan de la pagina
   REAL en un navegador: asi el test estatico verifica lo que el juego
   tiene cargado, y no lo que hay escrito en un archivo.

   Uso:  node test\datos.js "C:\ruta\del\proyecto"
   ============================================================ */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const RAIZ = process.argv[2] || process.cwd();
const TMP = path.join(os.tmpdir(), 'opencode-datos-' + process.pid);

function chrome() {
  const c = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
  ];
  for (const p of c) if (p && fs.existsSync(p)) return p;
  throw new Error('No se encontro Google Chrome');
}

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
for (const f of ['index.html', 'style.css', 'script.js']) {
  fs.copyFileSync(path.join(RAIZ, f), path.join(TMP, f));
}
fs.copyFileSync(path.join(RAIZ, 'audio', 'mapa-audio.js'), path.join(TMP, 'mapa.js'));

const volcado = `
<pre id="SALIDA" style="display:none"></pre>
<script>
window.addEventListener('error',function(e){
  document.getElementById('SALIDA').textContent='ERROR:'+e.message;
});
setTimeout(function(){
  try{
    var datos={
      CONSIGNAS:CONSIGNAS, INTROS:INTROS, DEFS:DEFS, QUIZ:QUIZ,
      TRANSFER:TRANSFER, STAGES:STAGES, STAGE_INFO:STAGE_INFO,
      GROW_SEQ:GROW_SEQ, GROW_MSG:GROW_MSG, MAX_STARS:MAX_STARS,
      PICK_ITEMS:PICK_ITEMS, mapaTotal:Object.keys(MAPA_AUDIO).length
    };
    document.getElementById('SALIDA').textContent=
      btoa(unescape(encodeURIComponent(JSON.stringify(datos))));
  }catch(err){ document.getElementById('SALIDA').textContent='ERROR:'+err.message; }
},1500);
<\/script>`;

let h = fs.readFileSync(path.join(TMP, 'index.html'), 'utf8');
h = h.replace('audio/mapa-audio.js', 'mapa.js');
h = h.replace('</body>', volcado + '\n</body>');
fs.writeFileSync(path.join(TMP, 'index.html'), h, 'utf8');

const dom = execFileSync(chrome(), [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  '--user-data-dir=' + path.join(TMP, 'perfil'),
  '--virtual-time-budget=20000',
  '--dump-dom',
  'file:///' + path.join(TMP, 'index.html').replace(/\\/g, '/')
], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 120000 });

const m = dom.match(/<pre id="SALIDA"[^>]*>([\s\S]*?)<\/pre>/);
if (!m) { console.error('no se encontro el bloque de salida'); process.exit(1); }
if (m[1].indexOf('ERROR:') === 0) { console.error(m[1]); process.exit(1); }

const destino = path.join(RAIZ, 'test', 'datos.b64.txt');
fs.writeFileSync(destino, m[1], 'utf8');
const d = JSON.parse(Buffer.from(m[1], 'base64').toString('utf8'));
console.log('datos actualizados: ' + destino);
console.log('  consignas: ' + Object.keys(d.CONSIGNAS).length +
            ' | preguntas: ' + d.QUIZ.length +
            ' | etapas: ' + d.STAGES.length +
            ' | mapa: ' + d.mapaTotal);

fs.rmSync(TMP, { recursive: true, force: true });
