// Genera los 75 audios en MP3 con voz ARGENTINA (es-AR) usando el TTS de
// Google Translate. No necesita instalar nada ni permisos de administrador.
// Uso: node generar-mp3-ar.js
const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

const PROYECTO = process.argv[2] || '.';
const ORIGEN = path.join(PROYECTO, 'FRASES-PARA-AUDIO.txt');
const DESTINO = path.join(PROYECTO, 'audio');
const TL = 'es-AR';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const MAX = 190;          // Google corta pasado esto
const PAUSA = 420;        // ms entre pedidos, para no ser bloqueado

function limpiar(t) {
  return t
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .replace(/[\p{So}\p{Cf}\p{Cs}]/gu, '')
    .replace(/[\u2700-\u27BF]/g, '')
    .replace(/[\u2B00-\u2BFF]/g, '')
    .replace(/[🌿🌱🌰🌸🌳💧🍬🧱☀️🌙🧹🏆🪴]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// parte por oraciones, sin pasarse del limite
function partes(texto, max) {
  if (texto.length <= max) return [texto];
  const oraciones = texto.match(/[^.!?]+[.!?]*\s*/g) || [texto];
  const out = [];
  let actual = '';
  for (const o of oraciones) {
    if ((actual + o).trim().length > max && actual) {
      out.push(actual.trim());
      actual = o;
    } else {
      actual += o;
    }
  }
  if (actual.trim()) out.push(actual.trim());
  // si alguna parte sigue siendo larga, cortar por palabras
  return out.flatMap(p => {
    if (p.length <= max) return [p];
    const palabras = p.split(' ');
    const r = []; let acc = '';
    for (const w of palabras) {
      if ((acc + ' ' + w).trim().length > max && acc) { r.push(acc.trim()); acc = w; }
      else acc += ' ' + w;
    }
    if (acc.trim()) r.push(acc.trim());
    return r;
  });
}

function pedir(texto, intentos) {
  return new Promise(resolve => {
    const url = new URL('https://translate.google.com/translate_tts');
    url.searchParams.set('ie', 'UTF-8');
    url.searchParams.set('client', 'tw-ob');
    url.searchParams.set('tl', TL);
    url.searchParams.set('q', texto);
    const req = https.get(url, { headers: { 'User-Agent': UA, 'Referer': 'https://translate.google.com/' } }, res => {
      if (res.statusCode !== 200) {
        res.resume();
        return resolve({ ok: false, status: res.statusCode });
      }
      const trozos = [];
      res.on('data', d => trozos.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(trozos);
        // un MP3 empieza con 'ID3' o con el sync 0xFF
        const esMp3 = (buf[0] === 0x49 && buf[1] === 0x44) || buf[0] === 0xFF;
        resolve(esMp3 ? { ok: true, buf } : { ok: false, status: 'no-mp3' });
      });
    });
    req.on('error', e => resolve({ ok: false, status: e.message }));
    req.setTimeout(25000, () => { req.destroy(); resolve({ ok: false, status: 'timeout' }); });
  });
}

const dormir = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  if (!fs.existsSync(ORIGEN)) { console.error('No existe ' + ORIGEN); process.exit(1); }
  fs.mkdirSync(DESTINO, { recursive: true });

  const lineas = fs.readFileSync(ORIGEN, 'utf8').split(/\r?\n/);
  const frases = [];
  for (const l of lineas) {
    if (!l || l.startsWith('#')) continue;
    const p = l.split('|');
    if (p.length < 4) continue;
    const texto = limpiar(p[3]);
    if (!texto) continue;
    frases.push({ num: p[0].trim(), clave: p[1].trim(), tipo: p[2].trim(), texto });
  }
  console.log('frases a generar: ' + frases.length);

  const vistos = new Set();
  const indice = ['# AUDIOS MP3 - Google Translate TTS, es-AR (argentina)', ''];
  let ok = 0, mal = 0;

  for (const f of frases) {
    let nombre = f.clave;
    if (vistos.has(nombre)) {
      let n = 2;
      while (vistos.has(f.clave + '_' + n)) n++;
      nombre = f.clave + '_' + n;
    }
    vistos.add(nombre);

    const trozos = partes(f.texto, MAX);
    const buffers = [];
    let fallo = null;
    for (const t of trozos) {
      let r = null;
      for (let intento = 1; intento <= 3; intento++) {
        r = await pedir(t);
        if (r.ok) break;
        await dormir(900 * intento);
      }
      if (r && r.ok) buffers.push(r.buf);
      else { fallo = r ? r.status : 'desconocido'; break; }
      await dormir(PAUSA);
    }

    if (fallo) {
      mal++;
      indice.push(String(f.num).padStart(3, ' ') + '  ' + nombre.padEnd(34) + ' FALLO: ' + fallo);
      console.log('  FALLO ' + nombre + ' (' + fallo + ')');
      continue;
    }
    fs.writeFileSync(path.join(DESTINO, nombre + '.mp3'), Buffer.concat(buffers));
    ok++;
    indice.push(String(f.num).padStart(3, ' ') + '  ' + nombre.padEnd(34) + ' ' + f.tipo.padEnd(16) + ' ' + f.texto);
  }

  indice.push('');
  indice.push('# generados: ' + ok + '   fallos: ' + mal);
  fs.writeFileSync(path.join(DESTINO, '_INDICE.txt'), indice.join('\n'), 'utf8');
  console.log('');
  console.log('generados: ' + ok + '   fallos: ' + mal);
  console.log('carpeta: ' + DESTINO);
})();
