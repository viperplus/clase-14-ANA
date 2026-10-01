/* ============================================================
   TESTER PEDAGOGICO Y DE COHERENCIA  (analisis estatico)
   Revisa que el contenido sirve para aprender y que nada este roto:
   estructura, sincronia HTML/JS, audio, voseo argentino,
   coherencia pedagogica, puntaje y accesibilidad de texto.

   Uso:  node test/pedagogico.js <carpeta-del-juego>
   ============================================================ */
const fs = require('fs');
const path = require('path');

const PROY = process.argv[2] || '.';
const P = f => path.join(PROY, f);

let ok = 0;
const fallos = [];
const avisos = [];
const OK = () => { ok++; };
const MAL = (t, d) => { fallos.push(t + (d ? '  ->  ' + d : '')); };
const AVISO = (t, d) => { avisos.push(t + (d ? '  ->  ' + d : '')); };

const html = fs.readFileSync(P('index.html'), 'utf8');
const js = fs.readFileSync(P('script.js'), 'utf8');
const css = fs.readFileSync(P('style.css'), 'utf8');
const mapaSrc = fs.readFileSync(P('audio/mapa-audio.js'), 'utf8');

/* los datos vienen del navegador, codificados en base64 para no perder acentos */
const b64 = fs.readFileSync(path.join(__dirname, 'datos.b64.txt'), 'utf8').trim();
const D = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));

const mapa = JSON.parse(
  mapaSrc.replace(/^[\s\S]*?MAPA_AUDIO\s*=\s*/, '').replace(/;[\s\S]*$/, '')
);
const clavesMapa = new Set(Object.keys(mapa));
const norm = t => String(t == null ? '' : t)
  .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
  .replace(/[\p{So}\p{Cf}\p{Cs}]/gu, '')
  .replace(/[\u2700-\u27BF]/g, '')
  .replace(/[\u2B00-\u2BFF]/g, '')
  .replace(/\s+/g, ' ').trim().toLowerCase();
const tieneAudio = t => clavesMapa.has(norm(t));

const frases = [];
const reg = t => { if (typeof t === 'string' && t.trim()) frases.push(t); };

/* ---------- 1. ESTRUCTURA ---------- */
console.log('\n=== 1. ESTRUCTURA ===');
const pantallas = [...html.matchAll(/<section class="screen[^"]*" id="([^"]+)"/g)].map(m => m[1]);
if (pantallas.length === 20) { OK(); } else { MAL('cantidad de pantallas', 'hay ' + pantallas.length + ', se esperaban 20'); }
console.log('  pantallas: ' + pantallas.length);
if (new Set(pantallas).size === pantallas.length) { OK(); } else { MAL('hay ids de pantalla repetidos'); }

for (const k of Object.keys(D.CONSIGNAS)) {
  if (!pantallas.includes(k)) { MAL('CONSIGNAS apunta a una pantalla inexistente', k); }
  else { reg(D.CONSIGNAS[k]); }
}
for (const k of Object.keys(D.INTROS)) {
  if (!pantallas.includes(k)) { MAL('INTROS apunta a una pantalla inexistente', k); }
  else { reg(D.INTROS[k].text); }
}
for (const p of pantallas) {
  if (!D.CONSIGNAS[p] && !D.INTROS[p]) { AVISO('pantalla sin consigna ni intro', p); }
  else { OK(); }
}

/* ---------- 2. SINCRONIA HTML <-> JS ---------- */
console.log('=== 2. SINCRONIA HTML / JS ===');
const txtHtml = [...html.matchAll(/<span class="txt">([^<]*)</g)].map(m => m[1]);
let difieren = 0;
for (const [k, v] of Object.entries(D.CONSIGNAS)) {
  if (!html.includes('id="' + k + '"')) continue;
  const limpio = v.replace(/\s*$/, '');
  if (!txtHtml.some(t => norm(t) === norm(limpio))) {
    difieren++;
    AVISO('la consigna del HTML no es igual a la del JS', k + ' | JS: ' + limpio.slice(0, 46));
  }
}
if (difieren === 0) { console.log('  todas las consignas coinciden entre HTML y JS'); }
else { MAL(difieren + ' consignas difieren entre HTML y JS'); }
for (const [k, v] of Object.entries(D.DEFS)) {
  reg(v.narra); reg(v.titulo);
}
/* las 8Definiciones comparten UNA sola caja (#def-box) que se rellena al abrirla,
   asi que no hay un bloque por definicion: se verifica que exista la caja. */
if (/class="[^"]*def-box/.test(html) && html.includes('id="defTitle"') && html.includes('id="defText"')) { OK(); }
else { MAL('no se encuentra la caja de la definicion (.def-box / #defTitle / #defText)'); }
D.GROW_MSG && Object.values(D.GROW_MSG).forEach(reg);
Object.values(D.STAGE_INFO).forEach(s => reg(s.t));
D.QUIZ.forEach(q => { reg(q.q); (q.opts || []).forEach(reg); reg(q.fb); (q.mal || []).forEach(m => m && reg(m)); });
D.TRANSFER.forEach(t => { reg(t.t); reg(t.n); });

/* ---------- 3. AUDIO ---------- */
console.log('=== 3. AUDIO ===');
const unicas = [...new Set(frases)];
const sinAudio = unicas.filter(t => !tieneAudio(t));
console.log('  frases distintas revisadas: ' + unicas.length);
console.log('  frases con mp3: ' + (unicas.length - sinAudio.length));
if (sinAudio.length === 0) { OK(); } else { sinAudio.forEach(t => MAL('frase SIN mp3', t.slice(0, 66))); }

const rotos = Object.entries(mapa).filter(([, v]) => !fs.existsSync(path.join(PROY, v)));
if (rotos.length === 0) { OK(); } else { rotos.forEach(([k, v]) => MAL('el mapa apunta a un archivo que no existe', k + ' -> ' + v)); }

const usados = new Set(Object.values(mapa));
const huerfanos = fs.readdirSync(path.join(PROY, 'audio'))
  .filter(f => f.endsWith('.mp3') && !usados.has('audio/' + f));
if (huerfanos.length === 0) { OK(); } else { huerfanos.forEach(f => AVISO('mp3 que el mapa no usa', f)); }

if (/speechSynthesis\.cancel\(\)/.test(js) && /pararAudio\(\)/.test(js)) { OK(); }
else { MAL('no se ve el corte del audio anterior (se superponen)'); }

/* ---------- 4. VOSEO ARGENTINO ---------- */
console.log('=== 4. VOSEO ARGENTINO ===');
const TUTEOS = [
  [/\bpuedes\b/i, "puedes -> podés"],
  [/\bdebes\b/i, "debes -> debés"],
  [/\bquieres\b/i, "quieres -> querés"],
  [/\bnecesitas\b/i, "necesitas -> necesitás"],
  [/\btocas\b/i, "tocas -> tocás"],
  [/\bbuscas\b/i, "buscas -> buscás"],
  [/\bsiembra\b/i, "siembra -> sembrás"],
  [/\brevisa\b/i, "revisa -> revisá"],
  [/\bcuenta\b/i, "cuenta -> contá"],
  [/\bcome\b/i, "come -> comé"],
  [/\btenes\b/i, "tenes -> tenés"],
  [/\bhaces\b/i, "haces -> hacés"],
  [/\bpulsa\b/i, "pulsa -> tocá"],
  [/\bclica\b/i, "clica -> tocá"],
];
let tuteos = 0;
for (const [re, mal] of TUTEOS) {
  const hits = unicas.filter(t => re.test(t));
  if (hits.length) { tuteos += hits.length; hits.forEach(t => MAL('se cuela el tuteo: ' + mal, t.slice(0, 66))); }
}
const conVoseo = unicas.filter(t => {
  const x = t.toLowerCase();
  return ['tocá', 'tenés', 'buscá', 'hacés', 'pedí', 'elegí', 'mirá', 'entotá', 'comé', 'contá',
    'revisá', 'sembrás', 'podés', 'necesitás', 'querés', 'tocás', 'sacá', 'poné', 'dejá']
    .some(m => x.includes(m));
});
console.log('  frases con voseo: ' + conVoseo.length + ' de ' + unicas.length);
if (conVoseo.length >= 15) { OK(); } else { AVISO('pocas frases con voseo', String(conVoseo.length)); }
if (tuteos === 0) { console.log('  ningun tuteo'); } else { MAL(tuteos + ' frases con tuteo'); }

/* ---------- 5. COHERENCIA PEDAGOGICA ---------- */
console.log('=== 5. PEDAGOGIA ===');
const NUM = { UN: 1, UNA: 1, UNO: 1, DOS: 2, TRES: 3, CUATRO: 4, CINCO: 5, SEIS: 6, SIETE: 7 };
const cantidadDicha = t => {
  for (const w of Object.keys(NUM)) {
    if (new RegExp('\\b' + w + '\\b', 'i').test(t)) return { w, n: NUM[w] };
  }
  return null;
};
{
  const c = D.CONSIGNAS['scr1-pick'] || '';
  const p = cantidadDicha(c);
  const buenas = D.PICK_ITEMS.filter(i => i.good).length;
  if (!p) { MAL('la consigna de elegir plantas no dice cuantas son'); }
  else if (p.n !== buenas) { MAL('la consigna pide ' + p.w + ' pero hay ' + buenas + ' plantas correctas'); }
  else { console.log('  scr1-pick: pide ' + p.w + ' y hay ' + buenas + ' correctas  OK'); OK(); }
}
{
  const c = D.CONSIGNAS['scr2-theory'] || '';
  if (cantidadDicha(c) && cantidadDicha(c).n === D.STAGES.length) { console.log('  scr2-theory: pide ' + cantidadDicha(c).w + ' y hay ' + D.STAGES.length + ' etapas  OK'); OK(); }
  else { MAL('la consigna de las etapas no coincide con las ' + D.STAGES.length + ' etapas', c.slice(0, 52)); }
}
{
  const c = D.CONSIGNAS['scr2-order'] || '';
  if (D.GROW_SEQ.length === 5) { OK(); } else { MAL('la secuencia de crecimiento no tiene 5 etapas', String(D.GROW_SEQ.length)); }
  if (/imagen/i.test(c) && /casilla/i.test(c)) { console.log('  scr2-order: explica imagen + casilla  OK'); }
  else { AVISO('la consigna de ordenar no explica bien como se juega', c.slice(0, 60)); }
  const orden = D.STAGES.join('>');
  const bien = 'semilla>germinacion>brote>pequena>adulta';
  if (orden === bien) { console.log('  el orden de las etapas es el biologico correcto  OK'); OK(); }
  else { MAL('el orden de las etapas no es el correcto', orden + '  (se esperaba ' + bien + ')'); }
  const sinImg = D.STAGES.filter(s => !D.STAGE_INFO[s] || !D.STAGE_INFO[s].i);
  if (sinImg.length) { MAL('etapa sin imagen', sinImg.join(', ')); } else { OK(); }
  const sinMsg = D.STAGES.filter(s => !D.GROW_MSG[s]);
  if (sinMsg.length) { MAL('etapa sin mensaje al crecer', sinMsg.join(', ')); } else { console.log('  las 5 etapas tienen su mensaje  OK'); OK(); }
}
{
  const c = D.CONSIGNAS['scrFinal-play'] || '';
  for (const p of ['AGUA', 'LUZ', 'TIERRA']) {
    if (!c.includes(p)) { MAL('la consigna final no nombra ' + p, c.slice(0, 62)); } else { OK(); }
  }
  const t = D.TRANSFER.map(x => x.t).join(' | ').toLowerCase();
  const pares = [['agua', ['agua']], ['luz o sol', ['luz', 'sol']], ['tierra', ['tierra']]];
  for (const [nombre, opciones] of pares) {
    if (!opciones.some(p => t.includes(p))) { MAL('la lista para la casa no menciona ' + nombre, t.slice(0, 70)); }
    else { OK(); }
  }
  if (D.TRANSFER.length === 3) { console.log('  los 3 cuidados coinciden entre el juego y la lista  OK'); OK(); }
  else { MAL('la lista de la casa deberia tener 3 pasos', String(D.TRANSFER.length)); }
  const sinExplicacion = D.TRANSFER.filter(x => !x.n || x.n.length < 15);
  if (sinExplicacion.length) { MAL('un paso de la lista no explica por que'); } else { console.log('  cada paso de la lista explica el motivo  OK'); OK(); }
}
{
  const q = D.QUIZ.map(x => (x.q + ' ' + x.fb).toLowerCase()).join(' ');
  for (const p of ['agua', 'luz', 'tierra']) {
    if (!q.includes(p)) { AVISO('el repaso no pregunta sobre ' + p); } else { OK(); }
  }
  if (D.QUIZ.length === 4) { console.log('  el repaso tiene 4 preguntas (orden + los 3 cuidados)  OK'); OK(); }
  else { MAL('el repaso deberia tener 4 preguntas', String(D.QUIZ.length)); }
  for (const [i, x] of D.QUIZ.entries()) {
    if (!x.opts || x.opts.length < 3) { MAL('la pregunta ' + (i + 1) + ' tiene menos de 3 opciones', String(x.opts && x.opts.length)); }
    else { OK(); }
    if (typeof x.ok !== 'number' || x.ok < 0 || x.ok >= x.opts.length) { MAL('la pregunta ' + (i + 1) + ' no tiene marcada la respuesta correcta'); }
    else { OK(); }
    if (!x.mal || x.mal.length !== x.opts.length) { MAL('la pregunta ' + (i + 1) + ' no explica por que se equivoca cada opcion'); }
    else { OK(); }
    const flojas = (x.mal || []).filter((m, j) => j !== x.ok && (!m || m.length < 20));
    if (flojas.length) { AVISO('explicacion de error muy corta en la pregunta ' + (i + 1), String(flojas.length)); }
  }
}
{
  if (D.MAX_STARS === 18) { console.log('  tope de estrellas: 18  OK'); OK(); }
  else { MAL('el tope de estrellas no es 18', String(D.MAX_STARS)); }
  const f = js.match(/function addStar\(id\)\{[\s\S]{0,500}?\n\}/);
  if (f && /estrellasOtorgadas/.test(f[0])) { console.log('  el puntaje no cuenta dos veces la misma actividad  OK'); OK(); }
  else { MAL('addStar no parece evitar el doble conteo'); }
  const nAdd = (js.match(/addStar\(/g) || []).length;
  console.log('  llamadas a addStar en el codigo: ' + nAdd);
}

/* ---------- 6. ACCESIBILIDAD DE TEXTO ---------- */
console.log('=== 6. ACCESIBILIDAD ===');
const largas = [...new Set(unicas.flatMap(t => t.replace(/<[^>]+>/g, ' ').split(/\s+/))
  .map(w => w.replace(/[^\wáéíóúñÁÉÍÓÚÑ]/gi, '')))].filter(w => w.length > 13);
if (largas.length === 0) { OK(); } else { largas.forEach(w => AVISO('palabra larga, puede no entrar en una etiqueta', w)); }
/* las etiquetas cortas de etapa ("Semilla", "Brote") son ROTULOS, no frases:
   no hace falta que terminen en punto. */
const sinPunto = unicas.filter(t => t.length > 28 && !/[.!?…]$/.test(t.trim()));
sinPunto.forEach(t => AVISO('frase larga sin punto final', t.slice(0, 56)));
if (/:focus-visible/.test(css)) { console.log('  hay indicador de foco visible  OK'); OK(); }
else { MAL('no hay indicador de foco visible'); }
if (/role="button"/.test(html)) { console.log('  la consigna se declara como boton  OK'); OK(); }
else { MAL('la consigna no declara role="button"'); }
const tab = (html.match(/tabindex="0"/g) || []).length;
console.log('  elementos activables con teclado: ' + tab);
if (!/keydown/.test(js)) { MAL('no hay manejo de teclado'); } else { console.log('  hay manejo del teclado  OK'); OK(); }
if (/prefers-reduced-motion/.test(css)) { console.log('  respeta prefers-reduced-motion  OK'); } else { AVISO('no respeta prefers-reduced-motion'); }

/* ---------- 7. PROCESO DE LAS ETAPAS (lo que pidio) ---------- */
console.log('=== 7. PROCESO DE LAS ETAPAS ===');
const glCap = /\.gl-cap\{[^}]*white-space:nowrap/.test(css);
const glNoWrap = /\.growth-line\{[^}]*flex-wrap:nowrap/.test(css);
const glIguales = /\.gl-item\{[^}]*flex:1 1 0/.test(css);
if (glNoWrap) { console.log('  la fila de etapas no se parte  OK'); OK(); } else { MAL('la fila de etapas se puede partir en dos lineas'); }
if (glIguales) { console.log('  las 5 tarjetas miden lo mismo  OK'); OK(); } else { MAL('las tarjetas de etapa no tienen el mismo ancho'); }
if (glCap) { console.log('  las etiquetas no parten la palabra  OK'); OK(); } else { MAL('las etiquetas pueden partirse'); }

/* ---------- RESUMEN ---------- */
console.log('\n' + '='.repeat(62));
console.log('COMPROBACIONES OK : ' + ok);
console.log('FALLOS            : ' + fallos.length);
fallos.forEach(f => console.log('   X  ' + f));
console.log('AVISOS            : ' + avisos.length);
avisos.forEach(a => console.log('   -  ' + a));
console.log('='.repeat(62));
console.log(fallos.length ? 'RESULTADO: HAY FALLOS' : 'RESULTADO: TODO CORRECTO');
process.exit(fallos.length ? 1 : 0);
