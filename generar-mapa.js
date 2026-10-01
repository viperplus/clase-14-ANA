// Crea audio/mapa-audio.js: relaciona el texto que dice el juego con su MP3.
// El juego lo carga antes que script.js y lo consulta en speak().
const fs = require('fs');
const path = require('path');

const PROYECTO = process.argv[2];
const FRASES = path.join(PROYECTO, 'FRASES-PARA-AUDIO.txt');
const AUDIO = path.join(PROYECTO, 'audio');
const SALIDA = path.join(AUDIO, 'mapa-audio.js');

const norm = t => String(t)
  .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
  .replace(/[\p{So}\p{Cf}\p{Cs}]/gu, '')
  .replace(/[\u2700-\u27BF]/g, '')
  .replace(/[\u2B00-\u2BFF]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const mapa = {};
let n = 0, faltantes = 0;
for (const linea of fs.readFileSync(FRASES, 'utf8').split(/\r?\n/)) {
  if (!linea || linea.startsWith('#')) continue;
  const p = linea.split('|');
  if (p.length < 4) continue;
  const clave = p[1].trim();
  const texto = p[3].trim();
  const archivo = clave + '.mp3';
  if (!fs.existsSync(path.join(AUDIO, archivo))) { faltantes++; continue; }
  const k = norm(texto);
  // si dos textos distintos comparten clave normalizada, el primero gana
  if (!mapa[k]) mapa[k] = 'audio/' + archivo;
  n++;
}

const js =
`/* GENERADO AUTOMATICAMENTE - no editar a mano.
   Relaciona el texto que el juego narra con su MP3 argentino.
   Generado con: node generar-mapa.js
   ${n} frases mapeadas${faltantes ? ', ' + faltantes + ' sin archivo' : ''}. */
var MAPA_AUDIO = ${JSON.stringify(mapa, null, 0)};
if (typeof window !== 'undefined') window.MAPA_AUDIO = MAPA_AUDIO;
`;

fs.writeFileSync(SALIDA, js, 'utf8');
console.log('mapeadas: ' + n + '   sin archivo: ' + faltantes);
console.log('escrito: ' + SALIDA);
