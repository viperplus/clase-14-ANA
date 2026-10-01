# Guardiana de las Plantas

Juego educativo para aprender cómo crece y se cuida una planta.
Pensado para que una niña de 8 años (Ana María) pueda usarlo sola.

## Cómo se juega

1. Abrí `index.html` con doble clic.
2. La pantalla de bienvenida se narra sola: tocá **ESCUCHAR** para volver a oírla.
3. Tocá **COMENZAR** y seguí las indicaciones.
4. En cada pantalla, la burbuja de texto es la consigna. Se puede tocar para
   volver a escucharla.
5. Una planta necesita tres cosas: **agua**, **sol** y **tierra limpia**.
6. Al final se responden cuatro preguntas y se tilda una lista para la casa.

## Audio

Todas las frases tienen su audio grabado en español argentino
(`audio/*.mp3`, 122 archivos), para que la voz suene siempre igual en
cualquier navegador y en cualquier máquina.

Si un MP3 no estuviera o fallara, el juego cae automáticamente a la voz del
navegador: nunca se queda mudo.

### Cómo se regeneran los audios

Los audios se generaron con un servicio público de Google Translate
(`generar-mp3-ar.js`, `es-AR`). Es un método no documentado, así que puede
dejar de funcionar o cambiar sin aviso. Para uso personal está bien; si alguna
vez hay que regenerarlos:

```powershell
node generar-frases.js script.js FRASES-PARA-AUDIO.txt
node generar-mp3-ar.js .
node generar-mapa.js .
```

- `generar-frases.js` extrae todas las frases del juego y agrega un listado
  adicional.
- `generar-mp3-ar.js` las baja y arma los MP3.
- `generar-mapa.js` escribe `audio/mapa-audio.js`, que es el índice
  texto → archivo que usa el juego para encontrar cada audio.

Para que funcione hacen falta esos tres archivos de Node y
`FRASES-PARA-AUDIO.txt`, que también están en el repositorio.

## Accesibilidad

- Tipografía grande, que se ajusta según el tamaño de la ventana.
- Todo se puede tocar con el teclado: Enter o Espacio activan la consigna y los
  botones.
- Las 20 pantallas entran completas sin barra de scroll en ventanas de
  1024x768 para arriba. En ventanas muy angostas (menos de 660 px) puede
  aparecer scroll, porque la consigna mantiene su altura mínima para que se
  lea bien.
- 18 estrellas como máximo. El contador suma una sola vez cada actividad.

## Archivos

- `index.html`: la estructura de las 20 pantallas y los textos.
- `script.js`: la lógica del juego, el audio, el teclado y el puntaje.
- `style.css`: la apariencia y el responsive.
- `img/`: 19 imágenes de plantas y objetos.
- `audio/`: los MP3 y el índice `mapa-audio.js`.
## Pruebas

En `test/` hay un comprobador del juego. Con Node.js y Google Chrome
instalados:

```
node test\todo.js "C:\ruta\del\proyecto"
```

Revisa los textos y su sincronía con el HTML, la pedagogía (que las
consignas pidan lo que corresponde, el orden de las etapas, los tres
cuidados y el repaso), que cada frase tenga su MP3, la accesibilidad por
teclado, y juega el juego entero de principio a fin en 9 tamaños de ventana
y en 3 escenarios de audio, sin dejar pasar un solo scroll.

Está explicado en detalle en `test/README.md`. Las pruebas no forman parte
del juego ni afectan cómo se juega.
