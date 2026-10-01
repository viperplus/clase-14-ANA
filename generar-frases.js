// Genera FRASES-PARA-AUDIO.txt con TODO lo que dice el juego:
//  - los datos (CONSIGNAS, INTROS, DEFS, QUIZ, TRANSFER, etapas, crecimiento)
//  - las frases fijas que aparecen literales en speak()
//  - las variantes compuestas mas frecuentes (orden de etapas)
const fs = require('fs');
const path = require('path');

const SRC = process.argv[2];
const DEST = process.argv[3];
const s = fs.readFileSync(SRC, 'utf8');

function el() {
  const o = {
    style: {}, dataset: {}, classList: { add(){}, remove(){}, contains(){ return false; }, toggle(){} },
    children: [], childNodes: [],
    setAttribute(){}, removeAttribute(){}, appendChild(){}, removeChild(){},
    addEventListener(){}, removeEventListener(){},
    querySelector(){ return el(); }, querySelectorAll(){ return []; },
    getBoundingClientRect(){ return { width:0, height:0, top:0, left:0 }; },
    focus(){}, click(){}, scrollIntoView(){}, remove(){}
  };
  return new Proxy(o, { get(t,k){ return k in t ? t[k] : ''; }, set(t,k,v){ t[k]=v; return true; } });
}
const doc = {
  getElementById: () => el(), querySelector: () => el(), querySelectorAll: () => [],
  createElement: () => el(), addEventListener(){}, removeEventListener(){},
  body: el(), documentElement: el(), readyState: 'complete'
};
const storage = { getItem: () => null, setItem(){}, removeItem(){} };
const synth = { getVoices: () => [], speak(){}, cancel(){}, addEventListener(){} };
const UA = function(){};

const fn = new Function('window','document','localStorage','speechSynthesis','SpeechSynthesisUtterance',
  'navigator','setTimeout','clearTimeout','setInterval','clearInterval',
  s + '\n;return {INTROS,DEFS,QUIZ,CONSIGNAS,TRANSFER,STAGE_INFO,GROW_MSG,STAGES};');

let data;
try {
  data = fn({ addEventListener(){} }, doc, storage, synth, UA, { userAgent:'node' },
            () => 0, () => {}, () => 0, () => {});
} catch (e) { console.error('No se pudo leer: ' + e.message); process.exit(1); }

const filas = [];
const vistos = new Set();
function add(clave, tipo, texto) {
  if (!texto) return;
  const t = String(texto).replace(/\s+/g, ' ').trim();
  if (!t) return;
  if (vistos.has(t)) return;      // mismo texto = mismo archivo
  vistos.add(t);
  filas.push({ clave, tipo, texto: t });
}

for (const [k, v] of Object.entries(data.INTROS))   add(k, 'intro', v.text);
for (const [k, v] of Object.entries(data.CONSIGNAS)) add(k, 'consigna', v);
for (const [k, v] of Object.entries(data.DEFS)) {
  add(k, 'capsula-titulo', v.titulo);
  add(k, 'capsula-texto', v.narra);
}
data.QUIZ.forEach((q, i) => {
  const p = 'pregunta' + (i + 1);
  add(p, 'pregunta', q.q);
  q.opts.forEach((o, j) => add(p + '-opcion' + (j + 1), 'opcion', o));
  q.mal.forEach((m, j) => { if (m) add(p + '-error' + (j + 1), 'error', m); });
  add(p, 'feedback', q.fb);
});
data.TRANSFER.forEach((t, i) => {
  add('transfer' + (i + 1), 'item', t.t);
  add('transfer' + (i + 1), 'item-explicacion', t.n);
});
data.STAGES.forEach((s, i) => add('etapa' + (i + 1), 'etapa', data.STAGE_INFO[s].t));
for (const [k, v] of Object.entries(data.GROW_MSG)) add(k, 'crecimiento', v);

// --- frases fijas que el juego dice en el codigo ---
const FIJAS = [
  ['msg-bien',        'msg',   '¡Bien!'],
  ['msg-muybien',     'msg',   '¡Muy bien!'],
  ['msg-le-diste',    'msg',   '¡Le diste AGUA!'],
  ['msg-recibio-luz', 'msg',   '¡Recibió LUZ!'],
  ['msg-tierra-limpia','msg',  '¡TIERRA LIMPIA!'],
  ['msg-tu-planta',   'msg',   '¡Tu planta va a crecer! Mirá sus etapas.'],
  ['msg-adulta',      'msg',   '🌸 ¡Tu planta adulta es una Guardiana del jardín!'],
  ['msg-crecio',      'msg',   '🌸 ¡Tu planta creció y está feliz! Ahora vamos a repasar.'],
  ['msg-muybien2',    'msg',   '¡Muy bien! Una planta puede crecer.'],
  ['msg-perfecto',    'msg',   '¡Perfecto, Ana María! Ya sabés todo lo que necesita una planta.'],
  ['msg-tres-cosas',  'msg',   '¡Muy bien, Ana María! Si hacés estas tres cosas, tu planta va a crecer fuerte.'],
  // transiciones de pantalla (speakEntonces)
  ['fin-orden',       'msg',   '¡Muy bien! ¡Ordenaste cómo crece una planta!'],
  ['fin-agua',        'msg',   '⭐ LE DISTE AGUA Y AHORA ESTÁ FELIZ. SIN AGUA LA PLANTA TENÍA SED.'],
  ['fin-sol',         'msg',   '⭐ LE DISTE SOL Y VOLVIÓ A CRECER. EN LA OSCURIDAD NO PODÍA PREPARAR SU ALIMENTO.'],
  ['fin-basura',      'msg',   '⭐ LIMPIASTE LA TIERRA. SIN BASURA LA RAÍZ PUEDE CRECER.'],
  ['orden-primero',   'orden', 'Primero tocá una imagen.'],
  ['orden-ocupada',   'orden', 'Esa casilla ya tiene una imagen.'],
  ['orden-mal',       'orden', 'Esa no va ahí. Busquemos la que va justo antes.'],
  ['pick-no-planta',  'pick',  'Esta no es una planta. Busquemos la que tiene hojas y está en la tierra.'],
  ['pick-perros',     'pick',  'Los perros y los niños estudian. Las plantas no. Probemos otra vez.'],
  ['consigna-1',      'consigna', 'Tocá AGUA.'],
  ['consigna-luz',    'consigna', 'Tocá LUZ.'],
  ['consigna-tierra', 'consigna', 'Tocá TIERRA.'],
  // 4a pregunta del repaso: la tierra
  ['rep-tierra-q',    'repaso',   'La tierra tiene basura. ¿QUÉ TIENE QUE HACERSE?'],
  ['rep-tierra-o1',   'repaso',   'LIMPIAR LA TIERRA'],
  ['rep-tierra-o2',   'repaso',   'TAPARLA MÁS'],
  ['rep-tierra-o3',   'repaso',   'ECHAR PAN'],
  ['rep-tierra-m2',   'repaso',   'Taper la basura no ayuda: hay que quitarla para que la raíz esté libre.'],
  ['rep-tierra-m3',   'repaso',   'El pan no limpia la tierra.'],
  ['rep-tierra-fb',   'repaso',   'HAY QUE LIMPIAR LA TIERRA. Sin basura, la raíz puede crecer bien.'],
  ['rep-cuatro',      'repaso',   'Contestá las cuatro preguntas. Si te equivocás, lo intentás otra vez.']
];
for (const [k, t, x] of FIJAS) add(k, t, x);

// --- errores de opcion: "No, {distractor} no. ..." ---
const DESTRACTOR = {
  DULCE:    'El dulce es comida, y las plantas no comen como nosotros: toman agua.',
  OSCURIDAD:'Las plantas no crecen en la oscuridad. Necesitan la luz del sol.',
  HIELO:    'El hielo no ayuda a una planta a crecer.',
  PIEDRAS:  'Las piedras no ayudan a una planta a crecer.',
  PAN:      'El pan es comida, y las plantas no comen como nosotros: toman agua.'
};
for (const [k, v] of Object.entries(DESTRACTOR)) {
  add('error-' + k, 'error', 'No, ' + k.toLowerCase() + '. ' + v);
}

// --- variantes del orden de etapas (las compuestas) ---
const nombres = data.STAGES.map(s => data.STAGE_INFO[s].t);
for (let i = 0; i < nombres.length - 1; i++) {
  add('orden-facil-' + (i + 1), 'orden',
      '¡Bien! ' + nombres[i] + '. Ahora falta: ' + nombres[i + 1] + '. Tocá esa imagen.');
}
for (let i = 0; i < nombres.length; i++) {
  add('orden-casilla-' + (i + 1), 'orden', nombres[i] + '. Ahora tocá la casilla ' + (i + 1) + '.');
}
for (let i = 0; i < nombres.length; i++) {
  add('orden-bien-' + (i + 1), 'orden', '¡Bien! ' + nombres[i] + '.');
}

// --- escritura ---
const usados = new Map();
const L = [];
L.push('# GUARDIANA DE LAS PLANTAS - FRASES PARA GENERAR AUDIO ARGENTINO');
L.push('# formato:  NUMERO | CLAVE | TIPO | TEXTO');
L.push('# generar un MP3 por linea, nombrado con la clave.');
L.push('');
filas.forEach((f, i) => {
  let nombre = f.clave;
  if (usados.has(nombre)) {
    let n = 2;
    while (usados.has(f.clave + '_' + n)) n++;
    nombre = f.clave + '_' + n;
  }
  usados.set(nombre, 1);
  L.push(String(i + 1).padStart(3, ' ') + ' | ' + nombre + ' | ' + f.tipo + ' | ' + f.texto);
});
L.push('');
L.push('# TOTAL: ' + filas.length);
fs.writeFileSync(DEST, L.join('\n'), 'utf8');
console.log('frases: ' + filas.length);
