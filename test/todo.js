/* ============================================================
   CORRE TODAS LAS PRUEBAS DEL JUEGO
   Uso:  node test\ todo.js "C:\ruta\del\proyecto"

   1) refresh de los datos del juego desde el navegador
   2) test estatico: textos, pedagogia, audio y accesibilidad
   3) test en navegador: recorrido completo en 9 tamanos de ventana
      y en 3 escenarios de audio
   ============================================================ */
const { execFileSync } = require('child_process');
const path = require('path');

const RAIZ = process.argv[2] || path.join(__dirname, '..');
const test = f => path.join(__dirname, f);
let fallos = 0;

function paso(nombre, archivo, argumentos) {
  console.log('');
  console.log('###############################################');
  console.log('# ' + nombre);
  console.log('###############################################');
  try {
    const salida = execFileSync(process.execPath, [test(archivo), RAIZ].concat(argumentos || []),
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] });
    process.stdout.write(salida);
    if (/HAY FALLOS|FALLOS\s+[1-9]/.test(salida)) { fallos++; }
  } catch (e) {
    if (e.status !== 0) fallos++;
    if (e.stdout) process.stdout.write(e.stdout);
  }
}

paso('1/3  DATOS DEL JUEGO', 'datos.js', []);
paso('2/3  TEXTO, PEDAGOGIA, AUDIO Y ACCESIBILIDAD', 'pedagogico.js', []);
paso('3/3  RECORRIDO EN NAVEGADOR', 'ejecutar.js', []);

console.log('');
console.log('==============================================');
console.log(fallos === 0 ? 'PRUEBAS: TODO CORRECTO' : 'PRUEBAS: HAY FALLOS (' + fallos + ' suite/s con fallo)');
console.log('==============================================');
process.exit(fallos === 0 ? 0 : 1);
