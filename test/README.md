# PRUEBAS DEL JUEGO

Estas pruebas no forman parte del juego: se usan para comprobar que sigue
funcionando. Para jugar, abrir `index.html` en el navegador.

## Cómo se corren

```
node test\todo.js "C:\ruta\del\proyecto"
```

Con eso se ejecutan las tres suites en orden. Se necesita **Node.js** y
**Google Chrome** instalado. La suite del navegador copia el juego a una
carpeta temporal, la corre en Chrome sin ventana y borra todo al terminar:
no toca los archivos del juego.

## Qué revisa cada suite

### 1. `datos.js` — datos del juego
Saca los textos del juego de una página real del navegador y los guarda
comprimidos en `test\datos.b64.txt`. Así el test estático mira lo que el juego
realmente tiene cargado, y no una copia que se puede quedar vieja.

### 2. `pedagogico.js` — textos, pedagogía, audio y accesibilidad
Trabaja con esos datos, sin abrir el navegador. Comprueba:

- que las 20 pantallas existan y que los textos de `index.html` sean los
  mismos que los de `script.js` (las dos copias tienen que coincidir);
- que cada frase del juego tenga su MP3 y que no queden MP3 sin usar;
- que el texto esté en voseo argentino y sin tuteo;
- la coherencia del contenido: pedir TRES plantas y que haya tres, las cinco
  etapas en orden biológico, los tres cuidados iguales a la lista final, cada
  paso con su explicación, y el repaso preguntando por los tres cuidados;
- que el total de estrellas sea 18 y que ninguna actividad se puntúe dos
  veces;
- accesibilidad: foco visible, consignas activables con teclado, manejo del
  teclado y respeto a `prefers-reduced-motion`;
- que las cinco etapas quepan en una sola fila, con el mismo ancho y sin
  partir ninguna palabra.

### 3. `ejecutar.js` — recorrido completo en un navegador de verdad
Juega el juego entero de principio a fin y verifica, en cada corrida:

- que se recorran las 20 pantallas y se llegue a las 18 estrellas;
- que responder mal no avance de pregunta, y que el acierto sí;
- que la burbuja vuelva siempre a la consigna de la pantalla;
- que se pueda volver a jugar y el contador se reinicie;
- que no haya scroll en ninguna de las 20 pantallas;
- el audio: que todas las frases salgan de un MP3, que nunca suenen dos
  audios al mismo tiempo, y que el recorrido termine igual si los MP3 fallan.

Lo corre en 9 tamaños de ventana, de 1920×1080 a 620×500, y en cada uno en
tres escenarios de audio:

| escenario | qué simula |
|---|---|
| `tts` | el camino normal, con los MP3 argentinos |
| `notts` | un navegador sin voz de sistema: solo MP3 y los watchdog |
| `mp3roto` | los MP3 que no cargan: tiene que seguir con la voz del sistema |

Para correr un solo tamaño o un solo escenario:

```
node test\ejecutar.js "C:\ruta" 1280x720
node test\ejecutar.js "C:\ruta" --modo=mp3roto
node test\ejecutar.js "C:\ruta" 1280x720 --pasos
```

`--pasos` imprime cada paso del recorrido, además del resultado.

## Avisos que no son fallos

Un aviso informa de algo que se decidió a propósito, y no hace fallar la
suite. Hoy hay uno solo: en ventanas de menos de 560 px de alto el CSS achica
la consigna para que la página no se desplace. Se prioriza que todo se vea;
el costo es que la consigna queda más chica en ventanas bajas. Está
documentado en `test\navegador.js`, en el bloque de la consigna.

## Nota sobre las pruebas de audio

En un navegador sin salida de sonido un `<audio>` real puede no disparar
nunca su evento de fin y el recorrido se traba. `test\navegador.js` reemplaza
el elemento `Audio` por uno que se comporta igual pero termina rápido, y anota
qué archivos se pidieron. Que los MP3 existan de verdad lo comprueba la suite
estática, sobre el disco. Lo que no se puede verificar con una voz de sistema
falsa es el tiempo exacto que tarda el respaldo, y por eso esa parte se
acepta sin medir.
