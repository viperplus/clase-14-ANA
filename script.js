/* ============================================
   GUARDIANA DE LAS PLANTAS
   Juego para Ana María
   Lógica: audio, actividades, crecimiento
   ============================================ */

/* ====== IMÁGENES ====== */
/* Sin loading="lazy": la imagen es el contenido de la pantalla y con carga
   diferida aparecía un vacío si ella tocaba rápido. Son solo 19 PNG. */
function ic(n,alt){return '<img src="img/'+n+'.png" alt="'+(alt||'')+'">';}

/* ====== AUDIO ====== */
/* Busca el MP3 que corresponde a un texto. El mapa se genera con
   node generar-mapa.js y viene en audio/mapa-audio.js.
   Si el mapa no cargó (por ejemplo se abririo el HTML solo), devuelve null
   y el juego sigue usando la voz del navegador, como antes. */
function normalizarParaAudio(t){
  return String(t==null?'':t)
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g,'')
    .replace(/[\p{So}\p{Cf}\p{Cs}]/gu,'')
    .replace(/[\u2700-\u27BF]/g,'')
    .replace(/[\u2B00-\u2BFF]/g,'')
    .replace(/\s+/g,' ')
    .trim()
    .toLowerCase();
}
function buscarMP3(texto){
  const mapa=(typeof window!=='undefined'&&window.MAPA_AUDIO)||null;
  if(!mapa)return null;
  const clave=normalizarParaAudio(texto);
  if(!clave)return null;
  if(mapa[clave])return mapa[clave];
  /* a veces el texto viene con una coletilla (un numero de casilla, una
     exclamacion). Se busca la coincidencia mas larga que cubra el inicio. */
  let mejor=null,mejorLargo=0;
  for(const k in mapa){
    if(kla_longitud(k)>mejorLargo&&clave.indexOf(k)===0){mejor=mapa[k];mejorLargo=k.length;}
  }
  return mejor;
  function kla_longitud(k){return k.length;}
}
const IDIOMA='es';
let vozPreferida=null;
let listaVoces=[];
/* La calidad del audio depende ENTERA de qué voces tenga instaladas la
   máquina, y el navegador no avisa cuál suena bien. Antes el código fijaba
   es-AR y se quedaba con la primera voz cuyo nombre tuviera "natural",
   lo que en Firefox elegía a menudo una voz eSpeak (suena a robot) o una
   es-AR vieja aunque hubiera una es-MX buena disponible.
   Ahora se descartan los motores que suenan mal, se puntúan las demás y
   además hay un selector manual que se recuerda entre sesiones. */
const VOCES_MALAS=/espeak|eloquence|compact|robo|pcreader|\bzira\b|\bdavid\b|\bsam\b/i;
const VOCES_BIENAS=/natural|neural|online|premium|enhanced|desktop|\blaura\b|\bpablo\b|\bhelena\b|\bsergio\b|\bmonica\b|\bjuanita\b|\bpaulina\b|google/i;
function puntuarVoz(v){
  const n=v.name||'';
  let p=0;
  if(VOCES_MALAS.test(n))p-=100;
  if(VOCES_BIENAS.test(n))p+=40;
  if(/^es[-_]MX/i.test(v.lang||''))p+=12;
  if(/^es[-_]ES/i.test(v.lang||''))p+=8;
  if(/^es[-_]AR/i.test(v.lang||''))p+=4;
  if(v.default)p+=2;
  return p;
}
function seleccionarVoz(){
  if(typeof speechSynthesis==='undefined')return;
  const voces=speechSynthesis.getVoices()||[];
  if(!voces.length)return;
  listaVoces=voces.filter(v=>/^es\b/i.test(v.lang||''));
  if(!listaVoces.length){vozPreferida=null;return;}
  /* 1) si la persona ya eligió una voz a mano, esa manda */
  let elegida=null;
  try{
    const guardada=localStorage.getItem('ggVozElegida');
    if(guardada)elegida=listaVoces.find(v=>v.voiceURI===guardada||v.name===guardada)||null;
  }catch(e){}
  /* 2) si no, la mejor según el puntaje */
  if(!elegida){
    let mejor=-Infinity;
    for(const v of listaVoces){
      const p=puntuarVoz(v);
      if(p>mejor){mejor=p;elegida=v;}
    }
  }
  vozPreferida=elegida||listaVoces[0]||null;
  if(typeof hablarVozCambiada==='function')hablarVozCambiada();
}
/* La usa el <select> de la pantalla de inicio. */
function elegirVoz(uri){
  try{localStorage.setItem('ggVozElegida',uri||'');}catch(e){}
  const v=listaVoces.find(x=>x.voiceURI===uri);
  vozPreferida=v||null;
  if(v){
    try{
      const u=new SpeechSynthesisUtterance('Hola. Ahora leo con esta voz.');
      u.lang=v.lang;u.voice=v;u.rate=0.9;
      speechSynthesis.cancel();speechSynthesis.speak(u);
    }catch(e){}
  }
}
function hablarVozCambiada(){
  const s=document.getElementById('vozSel');
  if(!s)return;
  if(!s.options.length){
    const auto=document.createElement('option');
    auto.value='';auto.textContent='Automática (la mejor disponible)';
    s.appendChild(auto);
    for(const v of listaVoces){
      const o=document.createElement('option');
      o.value=v.voiceURI;
      o.textContent=v.name+' ('+v.lang+')'+(VOCES_MALAS.test(v.name||'')?' - suena a robot':'');
      s.appendChild(o);
    }
  }
  if(vozPreferida)s.value=vozPreferida.voiceURI;
}
/* Firefox tarda en llenar la lista de voces y a veces dispara voiceschanged
   antes de que exista. Se reintenta un rato para no quedarse mudo. */
if(typeof speechSynthesis!=='undefined'){
  speechSynthesis.onvoiceschanged=seleccionarVoz;
  seleccionarVoz();
  let intentos=0;
  const reintentar=setInterval(()=>{
    seleccionarVoz();
    if(listaVoces.length||++intentos>=20)clearInterval(reintentar);
  },300);
}

/* ============================================================
   CONSIGNA = UN SOLO TEXTO POR PANTALLA
   Es la transcripción de lo que se escucha. No desaparece nunca.
   Se ubica justo debajo del título, en el mismo lugar en todas
   las pantallas, y se puede volver a escuchar con un toque.
   ============================================================ */
let narracionesActuales='';
let textoHablado='';
let speakSeq=0, speakWatchdog=null;
/* MP3 que esta sonando ahora. Cada frase usa su propio elemento Audio y
   estos NO se detienen entre si: hay que guardarlos para poder frenarlos
   cuando llega la frase siguiente. Sin esto los audios se superponen. */
let audioActual=null;
function pararAudio(){
  const a=audioActual;
  if(!a)return;
  audioActual=null;
  try{a.onplaying=null;a.onended=null;a.onerror=null;a.pause();}catch(e){}
  try{a.currentTime=0;}catch(e){}
}
/* Continuación pendiente de la locución anterior: aunque se corte el audio,
   la acción que esperaba al final (mostrar un botón, avanzar de pantalla)
   se ejecuta igual. Nunca queda una pantalla bloqueada.
   Es UNA SOLA acción a propósito: si se encolaran varias, al terminar una
   locución se dispararían varias pantallas seguidas y el juego saltaría
   etapas. Gana la última. */
let pendiente=null;
/* Botón ocultado a la espera de que termine su locución. Se recuerda acá
   para poder devolverlo SIEMPRE, sin depender de que el motor de voz
   devuelva onend/onerror: hay navegadores que cancelan en silencio y, si no,
   el botón se quedaba oculto para siempre (la cápsula quedaba sin salida). */
let btnOculto=null;

function esc(t){
  return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
/* Quita emojis para el AUDIO y deja un índice por carácter DICHOS,
   para que el resaltado de palabra caiga en el lugar correcto
   aunque el texto visible tenga emojis. */
function limpiarTexto(t){
  return mapearTexto(t).dicho;
}
const RE_EMOJI=/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{1F1E6}-\u{1F1FF}\u{2190}-\u{21FF}\u{2705}\u{274C}]/u;
function mapearTexto(t){
  const src=String(t||'');
  let dicho='',mapa=[],i=0,espacioPrevio=false;
  for(const ch of src){
    /* ch.length = unidades UTF-16: necesario porque el texto visible
       se corta con slice(), que cuenta unidades, no caracteres */
    if(RE_EMOJI.test(ch)){i+=ch.length;continue;}
    if(/\s/.test(ch)||ch==='·'||ch==='•'){
      if(espacioPrevio){i+=ch.length;continue;}
      espacioPrevio=true;dicho+=' ';mapa.push(i);i+=ch.length;continue;
    }
    espacioPrevio=false;dicho+=ch;mapa.push(i);i+=ch.length;
  }
  /* recorta espacios de los bordes y ajusta el índice con ellos */
  while(dicho[0]===' '){dicho=dicho.slice(1);mapa.shift();}
  while(dicho[dicho.length-1]===' '){dicho=dicho.slice(0,-1);mapa.pop();}
  return {dicho:dicho,mapa:mapa};
}
/* Burbuja visible de la pantalla activa; si no hay, la de la cápsula */
function consignaEl(){
  return document.querySelector('.screen.on .consigna')||document.getElementById('defText');
}
/* BASE = consigna de la pantalla. No se pisa nunca con un feedback. */
function setConsigna(el,texto){
  if(!el)return;
  const t=String(texto||'');
  el.dataset.base=t;
  ajustarConsigna(el);
  const x=el.querySelector('.txt');
  if(x)x.textContent=t;
}
/* Consignas largas se aprietan un poco para que la pantalla entre completa */
function ajustarConsigna(el){
  if(!el)return;
  const n=(el.dataset.base||'').length;
  el.classList.toggle('largo',n>95&&n<=150);
  el.classList.toggle('muy-largo',n>150);
}
/* DICE = lo que se está leyendo ahora. Puede ser la consigna o un feedback. */
function narShow(texto){
  narracionesActuales=texto||narracionesActuales;
  const el=consignaEl();
  if(!el)return;
  /* si la pantalla todavía no fijó su consigna, la PRIMERA locución
     ES la consigna: así la burbuja nunca queda vacía */
  if(!el.dataset.base){el.dataset.base=narracionesActuales;ajustarConsigna(el);}
  el.dataset.dicho=narracionesActuales;
  const x=el.querySelector('.txt');
  if(x)x.textContent=narracionesActuales;
}
/* Al terminar: se saca el resaltado y se RESTAURA la consigna original.
   El feedback con la explicación nunca se queda pegado en la burbuja. */
function narHide(){
  const el=consignaEl();
  if(!el)return;
  const x=el.querySelector('.txt');
  if(x)x.innerHTML=esc(el.dataset.base||'');
}
/* Posición en la que arranca cada palabra, para el resaltado por reloj */
function indicesPalabra(texto){
  const out=[];const re=/\S+/g;let m;
  while((m=re.exec(texto)))out.push(m.index);
  return out;
}
function marcarPalabra(charIndex,esPrimera){
  const el=consignaEl();
  if(!el)return;
  /* se resalta sobre lo que está A LA VISTA (dataset.dicho), no sobre la
     consigna: cuando se narra un feedback, el karaoke tiene que caminar por
     el feedback, si no resalta palabras que no suenan. */
  const base=el.dataset.dicho||el.dataset.base||'';
  const x=el.querySelector('.txt');
  if(!x||!base)return;
  const mapa=el._mapa||[];
  const pos=(mapa[charIndex]!=null)?mapa[charIndex]:charIndex;
  if(pos<=0){
    /* Primer límite en 0: todavía no hay nada que traducir, pero se resalta la
       PRIMERA palabra (con su emoji y sus espacios) para que el karaoke
       arranque siempre en algún lado. */
    if(esPrimera){
      const m=/^\s*\S+\s*/.exec(base);
      const fin=m?m[0].length:0;
      if(fin>0){
        x.innerHTML='<span class="w on">'+esc(base.slice(0,fin))+'</span>'+esc(base.slice(fin));
        return;
      }
    }
    x.textContent=base;
    return;
  }
  x.innerHTML='<span class="w on">'+esc(base.slice(0,pos))+'</span>'+esc(base.slice(pos));
}
function speakConsigna(el){
  /* siempre repite la CONSIGNA, nunca el feedback que quedó a la vista */
  const base=(el&&el.dataset.base)||(el?limpiarTexto(el.textContent):narracionesActuales);
  const scr=el&&el.closest?el.closest('.screen'):null;
  const intro=scr?INTROS[scr.id]:null;
  const tit=scr?tituloDePantalla(scr):'';
  speak(base,intro&&intro.btn?intro.btn:null,null,faltaTitulo(tit,base)?tit:null);
}
window.speakConsigna=speakConsigna;
window.speakBubble=speakConsigna;

function restorBtn(btnId){
  const b=btnId&&document.getElementById(btnId);
  if(b){b.style.display='';b.classList.remove('speaking');}
  if(btnOculto===btnId)btnOculto=null;
}
/* Oculta el botón de una locución, devolviendo antes el que estuviera
   esperando: nunca puede quedar más de un botón oculto a la vez. */
function ocultarBtn(btnId){
  if(btnOculto&&btnOculto!==btnId)restorBtn(btnOculto);
  const b=document.getElementById(btnId);
  if(b)b.style.display='none';
  btnOculto=btnId;
}
/* Quita emojis y variaciones para poder decir el nombre del distractor
   que la persona tocó, sin que el motor lea los emojis. */
function sinEmoji(t){
  return String(t||'').replace(new RegExp(RE_EMOJI.source,'gu'),'')
    .replace(/\s+/g,' ').trim();
}
/* El título de la pantalla es parte del mensaje: si no se dice, falta
   información. Se narra ADEMÁS de la burbuja, salvo que la burbuja ya
   empiece por el título (ahí repetirlo sería decirlo dos veces). */
function tituloDePantalla(s){
  const h1=s&&s.querySelector('h1');
  return h1?limpiarTexto(h1.textContent):'';
}
  function faltaTitulo(titulo,consigna){
  if(!titulo||!consigna)return false;
  const n=t=>String(t).toLowerCase().replace(/[¿?¡!.,;:\s]+$/g,'').trim();
  const t=n(titulo),c=n(consigna);
  if(!t||!c)return false;
  /* si la burbuja ya empieza por el título, repetirlo sería decirlo dos veces */
  return c.indexOf(t)!==0&&t.indexOf(c)!==0;
}

function speak(texto,btnId,onEnd,soloVoz){
  const my=++speakSeq;
  /* Esta locución reemplaza a la anterior: si aquella estaba esperando con
     su botón oculto, se le devuelve YA. Su finish() va a salir por la vía
     rápida (ya no es la última) y no lo haría nunca. Sin esto, una
     cancelación en silencio dejaba el botón oculto para siempre. */
  if(btnOculto&&btnOculto!==btnId)restorBtn(btnOculto);
  if(speakWatchdog){clearTimeout(speakWatchdog);speakWatchdog=null;}
  /* lo que se VE incluye emojis; lo que se DICE los saca */
  const mostrar=String(texto||'');
  const prep=mapearTexto(mostrar);
  const base=prep.dicho||mostrar;
  /* soloVoz (el título de la pantalla) se DICE pero no se escribe en la
     burbuja. El texto dicho arranca con ese prefijo, así que los índices de
     onboundary hay que correrlos: mientras va por el título no se resalta
     nada (no hay nada visible que marcar) y después se marca sobre el
     índice real. */
  const prefijo=soloVoz?limpiarTexto(soloVoz).replace(/[.?!¡¿]+$/,'')+'. ':'';
  const dicho=prefijo?prefijo+base:base;
  const desvio=prefijo.length;
  const el=consignaEl();
  if(el)el._mapa=prep.mapa;
  narracionesActuales=mostrar;
  narShow(mostrar);
  textoHablado=dicho;
  /* Si esta locución trae acción de salida, PASA a ser la pendiente (gana la
     última: encolar varias haría saltar varias pantallas al terminar).
     Si solo repite (sin acción), se conserva la pendiente anterior: tocar la
     burbuja o ESCUCHAR nunca puede bloquear la pantalla. */
  if(btnId||onEnd){
    pendiente=()=>{restorBtn(btnId);if(onEnd)onEnd();};
    if(btnId)ocultarBtn(btnId);
  }
  let done=false;
  let primerLimite=true;
  let reloj=null;
  let arranco=false;
  const finish=()=>{
    if(done)return;
    done=true;
    if(reloj){clearTimeout(reloj);reloj=null;}
    /* El MP3 de ESTA locución se detiene al terminar (o al ser reemplazado),
       para que no siga sonando encima de la frase que sigue. */
    pararAudio();
    /* El botón propio se restaura SIEMPRE, aunque esta locución haya sido
       reemplazada por otra. Antes solo se restauraba dentro de la acción
       pendiente, y si la locución se cancelaba el botón quedaba oculto para
       siempre: la cápsula se trababa sin ESCUCHAR ni VAMOS A JUGAR. */
    if(btnId)restorBtn(btnId);
    if(my!==speakSeq)return;
    if(speakWatchdog){clearTimeout(speakWatchdog);speakWatchdog=null;}
    narHide();
    const acc=pendiente;pendiente=null;
    if(acc)acc();
  };
  const sinTTS=typeof speechSynthesis==='undefined'||typeof SpeechSynthesisUtterance==='undefined';
  /* sin TTS no hay nada que escuchar: la transcripción ya está en pantalla,
     alcanza con una pausa breve de lectura */
  const msFallback=sinTTS?Math.min(2600,dicho.length*55+1200):Math.min(5000,dicho.length*90+1500);
  if(sinTTS){
    speakWatchdog=setTimeout(finish,msFallback);
    return;
  }
  const msWatchdog=Math.min(30000,dicho.length*110+3500);
  speakWatchdog=setTimeout(finish,msWatchdog);
  /* ====== RESPALDO DEL KARAOKE =====
     Firefox (y varios navegadores) no disparan onboundary, así que con solo
     ese evento el resaltado nunca avanza. Si pasan 1.4 s de audio y todavía
     no llegó ningún límite, se arma un reloj que va marcando palabra por
     palabra al ritmo estimado de la locución. En el primer onboundary real
     el reloj se desarma y manda el evento de verdad. */
  const limites=indicesPalabra(mostrar);
  const msPalabra=Math.max(150,Math.min(520,Math.round(72000/Math.max(30,dicho.length))));
  function armarReloj(){
    if(reloj)return;
    setTimeout(function(){
      if(my!==speakSeq||done||!primerLimite)return;
      primerLimite=false;
      let paso=0;
      (function avanza(){
        if(my!==speakSeq||done)return;
        const el=consignaEl();
        if(!el||el.dataset.dicho!==mostrar)return;
        marcarPalabra(limites[paso]||0,paso===0);
        paso++;
        if(paso<=limites.length)reloj=setTimeout(avanza,msPalabra);
      })();
    },1400);
  }
  /* Si hay MP3 generado para esa frase, lo usa SIEMPRE. No toca el selector
     de voz: queremos la locución argentina grabada, nunca la del sistema. */
  const archivoMP3=buscarMP3(base)||buscarMP3(dicho);
  if(archivoMP3){
    if(typeof speechSynthesis!=='undefined'){try{speechSynthesis.cancel();}catch(e){}}
    if(reloj){clearTimeout(reloj);reloj=null;}
    /* CORTAR SIEMPRE el MP3 anterior. Cada frase crea su propio elemento
       Audio y estos NO se cancelan solos entre si: sin esto, al apilar
       toques rapidos, cada boton dejaba su audio sonando encima del
       siguiente y se escuchaban todos superpuestos. speechSynthesis.cancel()
       solo frena la voz del navegador, no estos archivos. */
    pararAudio();
    const a=new Audio(archivoMP3);
    audioActual=a;
    a.preload='auto';
    a.onplaying=()=>{
      if(my!==speakSeq)return;
      arranco=true;
      if(btnId){const b=document.getElementById(btnId);if(b)b.classList.add('speaking');}
      armarReloj();
    };
    a.onended=()=>{
      if(audioActual===a)audioActual=null;
      if(my===speakSeq)finish();
    };
    a.onerror=()=>{
      if(audioActual===a)audioActual=null;
      /* si el archivo no se pudo cargar, se vuelve al TTS. Solo si esta
         locucion sigue vigente: si ya la reemplazaron, no se reinicia nada */
      if(my!==speakSeq||done)return;
      hablarConTTS();
    };
    a.play().then(()=>{a._cargando=true;}).catch(()=>{
      if(audioActual===a)audioActual=null;
      /* autoplay bloqueado o archivo ilegible: reintento con TTS */
      if(my!==speakSeq||done)return;
      hablarConTTS();
    });
    /* El watchdog corto que se puso al entrar a speak() (3500 ms) sigue
       corriendo si no se limpia acá: se pisa la variable y queda un timer
       viejo con el plazo CORTO, que corta la locución antes de tiempo. */
    if(speakWatchdog){clearTimeout(speakWatchdog);speakWatchdog=null;}
    speakWatchdog=setTimeout(finish,Math.min(30000,dicho.length*110+6000));
    return;
  }
  hablarConTTS();

  /* la voz del sistema, con sus tres redes de seguridad */
  function hablarConTTS(){
  try{
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(dicho);
  u.lang=vozPreferida?vozPreferida.lang:'es';
  u.rate=0.85;
  u.pitch=1.0;
  /* Si el navegador rechaza la voz (puede pasar si getVoices todav�a no
     est� poblado) NO debe caerse toda la locuci�n: se habla igual, sin
     forzar la voz. Antes un TypeError ac� cortaba el audio entero. */
  if(vozPreferida){try{u.voice=vozPreferida;}catch(e){}}
    u.onstart=()=>{
      if(my!==speakSeq)return;
      arranco=true;
      if(btnId){const b=document.getElementById(btnId);if(b)b.classList.add('speaking');}
      armarReloj();
    };
    u.onboundary=ev=>{
      if(my!==speakSeq)return;
      if(ev.name&&ev.name!=='word')return;
      const el=consignaEl();
      if(!el||el.dataset.dicho!==mostrar)return;
      /* el índice viene del texto DICHO: si delante va el título (soloVoz),
         se corre para caer sobre el texto que se ve. Mientras va por el
         título no hay nada visible que resaltar, así que se espera. */
      const i=(ev.charIndex||0)-desvio;
      if(i<0)return;
      /* llegó el evento real: se desarma el reloj de respaldo */
      if(reloj){clearTimeout(reloj);reloj=null;}
      marcarPalabra(i,primerLimite);
      primerLimite=false;
    };
    u.onend=finish;
    u.onerror=finish;
    speechSynthesis.speak(u);
    /* Redes de seguridad para motores que se cuelgan o no existen.
       ANTES: a los 2,5 s se avanzaba la pantalla siempre que no hubiera audio
       en curso. Con una voz online eso cortaba la locución antes de que
       arrancara y el audio quedaba sonando sobre la pantalla siguiente.
       AHORA se distinguen tres casos:
         · 0,5 s -> el motor NO arrancó y NO tiene nada en cola: está muerto
                   (habrá que esperar 2,5 s a una voz lenta que se está
                   descargando, porque esa sí figura como pendiente).
         · 2,5 s -> la locución arrancó y se quedó muda a mitad de camino.
         · 7 s   -> sigue sin arrancar del todo. Antes esto solo lo cubría el
                   watchdog de 30 s y el juego parecía congelado. */
    setTimeout(()=>{
      if(my!==speakSeq||done||arranco)return;
      if(speechSynthesis.speaking||speechSynthesis.pending)return;
      finish();
    },500);
    setTimeout(()=>{
      if(my!==speakSeq||done)return;
      if(!arranco)return;
      if(!speechSynthesis.speaking&&!speechSynthesis.pending)finish();
    },2500);
    setTimeout(()=>{
      if(my!==speakSeq||done)return;
      if(arranco)return;
      if(!speechSynthesis.speaking&&!speechSynthesis.pending)finish();
    },7000);
  }catch(e){
    setTimeout(finish,msFallback);
  }
  }
}
/* Avanza recién cuando terminó el audio + tiempo para mirar la pantalla nueva.
   Guarda de contexto: si mientras se narraba cambió la pantalla visible (ella
   tocó otra cosa, o el audio se cortó y quedó otra locución pendiente), el
   salto ya no corresponde y se descarta. Sin esto se podía entrar a una
   pantalla que ya no era la que se estaba contando. */
function speakEntonces(texto,next,extra){
  const origen=document.querySelector('.screen.on');
  const idOrigen=origen?origen.id:'';
  speak(texto,'',()=>{
    setTimeout(()=>{
      const ahora=document.querySelector('.screen.on');
      if(!ahora||ahora.id!==idOrigen)return;
      goScreen(next);
    },extra||1500);
  });
}

/* Teclado: las consignas también se activan con Enter o Espacio */
document.addEventListener('keydown',ev=>{
  if(ev.key!=='Enter'&&ev.key!==' ')return;
  const t=ev.target;
  if(t&&t.matches&&t.matches('.consigna[role="button"]')){
    ev.preventDefault();
    speakConsigna(t);
  }
});

/* Todo lo que se toca con el mouse tiene que poder elegirse con el teclado:
   rol de botón, foco con Tab y activación con Enter o Espacio.
   Se dispara el mismo click, así no hay dos caminos de código distintos. */
function control(el){
  el.setAttribute('role','button');
  el.tabIndex=0;
  el.addEventListener('keydown',ev=>{
    if(ev.key!=='Enter'&&ev.key!==' ')return;
    ev.preventDefault();
    ev.stopPropagation();
    el.click();
  });
  /* Al pasar el mouse se lee la opción: sirve para quien ve bien y quiere
     que le lean todo, y de paso confirma con voz qué va a tocar. */
  el.addEventListener('mouseenter',()=>alTocarMouse(el));
  el.addEventListener('mouseleave',callarAlTocar);
  return el;
}

/* ====== LECTURA AL PASAR EL MOUSE ====== */
let hoverT=null;
function callarAlTocar(){clearTimeout(hoverT);hoverT=null;}
function textoDeOpcion(el){
  const t=(el.textContent||'').trim();
  if(t)return t;
  const img=el.querySelector('img[alt]');
  if(img)return (img.alt||'').trim();
  return (el.getAttribute('aria-label')||'').trim();
}
function alTocarMouse(el){
  callarAlTocar();
  /* no se lee nada si la opción ya está resuelta o bloqueada */
  if(el.classList.contains('locked')||el.classList.contains('done')||el.classList.contains('fixed'))return;
  const texto=textoDeOpcion(el);
  if(!texto)return;
  hoverT=setTimeout(()=>{
    /* Si el juego está hablando o tiene una acción pendiente, NO se corta:
       se espera. El mouse es un extra, nunca una interrupción. */
    if(pendiente)return;
    try{if(speechSynthesis.speaking||speechSynthesis.pending)return;}catch(e){}
    if(typeof SpeechSynthesisUtterance==='undefined')return;
    try{
      const u=new SpeechSynthesisUtterance(limpiarTexto(texto));
      u.lang=IDIOMA;u.rate=0.95;u.pitch=1.0;
      if(vozPreferida){try{u.voice=vozPreferida;}catch(e){}}
      const fin=()=>{el.classList.remove('leyendo');};
      u.onend=fin;u.onerror=fin;
      el.classList.add('leyendo');
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    }catch(e){el.classList.remove('leyendo');}
  },350);
}

/* ====== SONIDOS CORTOS ====== */
const SFX=(()=>{
  let ctx=null;
  function tone(freq,dur,type){
    try{
      if(!ctx)ctx=new (window.AudioContext||window.webkitAudioContext)();
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type=type||'sine';o.frequency.value=freq;
      g.gain.setValueAtTime(0.15,ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
      o.connect(g);g.connect(ctx.destination);
      o.start();o.stop(ctx.currentTime+dur);
    }catch(e){}
  }
  return {
    good(){tone(660,.15);setTimeout(()=>tone(880,.15),120);},
    star(){tone(880,.08);setTimeout(()=>tone(1320,.12),70);},
    /* nota neutra: nunca un tono grave "castigo" */
    bad(){tone(330,.18,'sine');},
    pop(){tone(520,.1,'square');}
  };
})();

/* ====== INTROS (pantallas con botón que espera audio) ====== */
const INTROS={
  'screen-start':{text:'¡Hola, Ana María! Bienvenida al juego Guardiana de las Plantas. Tocá Comenzar para jugar.',btn:''},
  'scr1-intro':{text:'Conozcamos a las plantas. Tocá Vamos a jugar para empezar.',btn:'btnScr1'},
  'scr2-intro':{text:'¿Cómo crece una planta? Tocá Vamos a jugar para empezar.',btn:'btnScr2'},
  'scr3-intro':{text:'¡Ahora vamos a cuidar nuestra planta! Tocá Vamos a jugar.',btn:'btnScr3'},
  'scrFinal-intro':{text:'¡Ayudá a tu planta a crecer! Tocá Vamos a jugar.',btn:'btnScrFinal'},
  'screen-finish':{text:'¡Lo lograste, Ana María! 🌸 Cuidá tu planta con AGUA, SOL y TIERRA limpia, y va a crecer fuerte.',btn:'btnScrFinal2'}
};

/* ====== CÁPSULAS DE TEORÍA (el texto visible ES lo que se escucha) ====== */
const DEFS={
  'scr1-pick':{
    titulo:'🌿 ¿Qué es una planta?',img:8,
    narra:'Las plantas son seres vivos. Nacen, crecen y se reproducen.'
  },
  'scr1-acciones':{
    titulo:'🌱 ¿Qué puede hacer una planta?',img:8,
    narra:'Una planta puede crecer, tener hojas y flores. Nace, crece y se reproduce.'
  },
  'scr2-theory':{
    titulo:'🌰 Las etapas de crecimiento de una planta',img:1,
    narra:'Una planta comienza su vida como una semilla. Con agua, la semilla comienza a germinar.'
  },
  'scr2-order':{
    titulo:'🗂️ Ordená las etapas',img:2,
    narra:'Primero aparece la raíz. Después crece el tallo y aparecen las hojas. La planta crece en etapas.'
  },
  'scr3-sed':{
    titulo:'💧 ¿Qué necesita?',img:5,
    narra:'Las plantas necesitan agua para vivir y crecer.'
  },
  'scr3-luz':{
    titulo:'☀️ ¿Qué necesita?',img:6,
    narra:'La luz ayuda a las plantas a fabricar su alimento. Las plantas necesitan luz para crecer.'
  },
  'scr3-tierra':{
    titulo:'🌱 ¿Qué necesita?',img:7,
    narra:'Las plantas necesitan agua, luz y tierra para crecer. Y la tierra tiene que estar limpia.'
  },
  'scr3-basura':{
    titulo:'🧹 Tierra sucia',img:7,
    narra:'La tierra tiene basura. Tocá la basura para limpiar la tierra y que la planta esté bien.'
  },
  'scrFinal-play':{
    titulo:'🏆 ¡Ayudá a tu planta a crecer!',img:1,
    narra:'Para que tu planta crezca necesita agua, luz y tierra. Tocá cada necesidad y mirá cómo crece.'
  }
};

/* ====== ETAPAS DE CRECIMIENTO ====== */
const STAGES=['semilla','germinacion','brote','pequena','adulta'];
const STAGE_INFO={
  semilla:{i:1,t:'Semilla'},
  germinacion:{i:19,t:'Germinación'},
  brote:{i:2,t:'Brote'},
  pequena:{i:3,t:'Planta pequeña'},
  adulta:{i:4,t:'Planta adulta'}
};
const GROW_SEQ=STAGES;
const GROW_MSG={
  semilla:'🌰 ¡Es una semilla!',
  germinacion:'💧 ¡Germinó! Nació la raíz',
  brote:'🌱 ¡Apareció un brote!',
  pequena:'🌿 ¡Crece con hojas!',
  adulta:'🌸 ¡Tu planta creció!'
};

/* ====== REPASO FINAL · TRES PREGUNTAS CON EVALUACIÓN FORMATIVA ======
   El error no avanza y explica la CAUSA, para que pueda reintentar.
   Las opciones se barajan para que no aprenda la posición. */
const QUIZ=[
  {
    q:'¿Cuál va PRIMERO en el crecimiento?',
    opts:['🌰 UNA SEMILLA','🌸 UNA FLOR GRANDE','🌳 UN ÁRBOL GIGANTE'],
    ok:0,
    mal:[
      '',
      'La flor y el árbol aparecen AL FINAL, cuando la planta ya creció mucho. ',
      'El árbol es una planta muy grande, pero tampoco es lo primero. '
    ],
    fb:'Primero es la SEMILLA. Con agua germina, después aparece el brote y al final la planta adulta.'
  },
  {
    q:'La planta está triste. ¿QUÉ LE FALTA?',
    opts:['💧 AGUA','🍬 DULCE','🧱 PIEDRAS'],
    ok:0,
    mal:[
      '',
      'El dulce es comida, y las plantas no comen como nosotros: toman agua. ',
      'Las piedras no ayudan a una planta a crecer. '
    ],
    fb:'LE FALTABA AGUA. Sin agua la planta no puede crecer y se pone triste.'
  },
  {
    q:'Esta planta está en la oscuridad. ¿QUÉ LE FALTA?',
    opts:['☀️ SOL','🌙 LUNA','🧱 PIEDRAS'],
    ok:0,
    mal:[
      '',
      'La luna no da luz para fabricar el alimento de la planta.',
      'Las piedras no le dan luz.'
    ],
    fb:'LE FALTA LUZ. Las plantas necesitan luz para crecer.'
  },
  {
    q:'La tierra tiene basura. ¿QUÉ TIENE QUE HACERSE?',
    opts:['🧹 LIMPIAR LA TIERRA','🧱 TAPARLA MÁS','🍞 ECHAR PAN'],
    ok:0,
    mal:[
      '',
      'Taper la basura no ayuda: hay que quitarla para que la raíz esté libre.',
      'El pan no limpia la tierra.'
    ],
    fb:'HAY QUE LIMPIAR LA TIERRA. Sin basura, la raíz puede crecer bien.'
  }
];

/* ====== TRANSFERENCIA A LA VIDA REAL ======
   Checklist: hay que marcar las tres acciones para poder terminar. */
const TRANSFER=[
  {t:'💧 REGARLA con agua',n:'Regá la planta con agua. Sin agua no puede crecer.'},
  {t:'☀️ PONERLA AL SOL',n:'Poné la planta al sol. La luz la ayuda a fabricar su alimento.'},
  {t:'🧹 DEJAR LA TIERRA LIMPIA',n:'Sacá la basura de la tierra para que la planta esté bien.'}
];

/* ====== ESTRELLAS (con marcador visible) =====
   Cada estrella se premia UNA sola vez por ID de actividad, así los
   clics rápidos o volver a una pantalla no inflan el total. */
const MAX_STARS=18;
let stars=0;
const estrellasOtorgadas=new Set();
function addStar(id){
  if(id){
    if(estrellasOtorgadas.has(id))return;
    estrellasOtorgadas.add(id);
  }
  if(stars>=MAX_STARS)return;
  stars++;
  const c=document.getElementById('starCount');
  const h=document.getElementById('hud');
  if(c)c.textContent=stars;
  if(h){h.classList.remove('pop');void h.offsetWidth;h.classList.add('pop');}
  SFX.star();
}

/* ====== CONSIGNAS DE CADA ACTIVIDAD ====== */
const CONSIGNAS={
  'scr1-pick':'Tocá las TRES plantas. Son las que están en la tierra y tienen hojas.',
  'scr1-acciones':'¿Qué puede hacer una planta? Tocá UNA sola respuesta.',
  'scr2-theory':'Estas son las CINCO etapas. Tocá cada imagen para escuchar su nombre.',
  'scr2-order':'¿Cuál va después? Tocá una imagen y después la casilla donde va.',
  'scr2-grow':'La semilla necesita AGUA y LUZ. Tocá los dos botones, uno por vez.',
  'scr3-sed':'Mirá la planta. Está triste. ¿QUÉ LE FALTA? Tocá una respuesta.',
  'scr3-falta':'¡Le falta AGUA! Tocá el botón de AGUA para ayudarla.',
  'scr3-luz':'Esta planta está en la oscuridad. ¿QUÉ LE FALTA? Tocá una respuesta.',
  'scr3-faltaluz':'¡No tiene LUZ! Tocá el botón del SOL para ayudarla.',
  'scr3-tierra':'Esta planta no tiene tierra buena. ¿QUÉ LE FALTA? Tocá una respuesta.',
  'scr3-basura':'La basura tapa la tierra. Tocá la escoba y mirá qué pasa.',
  'scrFinal-play':'Tocá AGUA, después LUZ, después TIERRA. Después mirá cómo crece.',
  'scrFinish-review':'Contestá las cuatro preguntas. Si te equivocás, lo intentás otra vez.',
  'scrTransfer':'Tocá las TRES cosas que tenés que hacer para cuidar una planta en tu casa.'
};

/* ====== PANTALLAS ====== */
let defTarget=null;
function goScreen(name){
  /* Object.hasOwn y no DEFS[name]: '__proto__', 'constructor', 'toString'...
     están en la cadena de prototipos y abrirían una cápsula inexistente,
     dejando el juego sin pantalla, sin audio y sin salida. */
  const esCapsula=Object.hasOwn(DEFS,name);
  const destino=esCapsula?null:document.getElementById(name);
  if(!esCapsula&&!destino){
    console.warn('Pantalla inexistente:',name);
    return;
  }
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on'));
  if(esCapsula){
    defTarget=name;
    openCapsule(name);
    return;
  }
  showScreen(name);
}
function showScreen(name){
  const s=document.getElementById(name);
  if(!s){
    console.warn('Pantalla inexistente:',name);
    return;
  }
  document.querySelectorAll('.screen').forEach(x=>x.classList.remove('on'));
  s.classList.add('on');
  /* cambio de pantalla: se corta cualquier MP3 de la pantalla anterior */
  pararAudio();
  /* la consigna de la pantalla es FIJA: el feedback no la reemplaza */
  const consigna=CONSIGNAS[name];
  if(consigna)setConsigna(s.querySelector('.consigna'),consigna);
  initScreen(name);
  /* el foco se quedaba en un elemento de la pantalla anterior, que ya no
     existe: al tabular desde ahí el teclado volvía al principio del
     documento. preventScroll evita que la pantalla salte. */
  const foco=s.querySelector('button,[tabindex="0"]');
  if(foco)foco.focus({preventScroll:true});
  if(consigna){
    const tit=tituloDePantalla(s);
    speak(consigna,'',null,faltaTitulo(tit,consigna)?tit:null);
  }
}
function initScreen(name){
  if(name==='scr1-pick')goScr1Pick();
  else if(name==='scr1-acciones')goScr1Acciones();
  else if(name==='scr2-theory')goScr2Theory();
  else if(name==='scr2-order')goScr2Order();
  else if(name==='scr2-grow')goScr2Grow();
  else if(name==='scr3-sed')goScr3Sed();
  else if(name==='scr3-falta')goScr3Falta();
  else if(name==='scr3-luz')goScr3Luz();
  else if(name==='scr3-faltaluz')goScr3Faltaluz();
  else if(name==='scr3-tierra')goScr3Tierra();
  else if(name==='scr3-basura')goScr3Basura();
  else if(name==='scrFinal-play')goFinalPlay();
  else if(name==='scrFinish-review')goQuiz();
  else if(name==='scrTransfer')buildTransfer();
  else if(INTROS[name]&&INTROS[name].btn){
    const btn=document.getElementById(INTROS[name].btn);
    if(btn){
     setConsigna(consignaEl(),INTROS[name].text);
     btn.style.display='none';
     const tit=tituloDePantalla(document.getElementById(name));
     speak(INTROS[name].text,INTROS[name].btn,()=>{btn.style.display='';},
       faltaTitulo(tit,INTROS[name].text)?tit:null);
    }
  }
  window.scrollTo({top:0,behavior:'smooth'});
}

/* ====== CÁPSULA ====== */
let defTimer=null,defWatchdog=null,defTituloActual='';
/* Repetir la cápsula debe decir el título como la primera vez: si no, la
   persona escucha solo la mitad de la información. */
function defEscuchar(){
  speak(narracionesActuales,null,null,
    faltaTitulo(defTituloActual,narracionesActuales)?limpiarTexto(defTituloActual):null);
}
window.defEscuchar=defEscuchar;
function defMostrarBotones(){
  const a=document.getElementById('defListen');
  const b=document.getElementById('defPlay');
  if(a)a.style.display='';
  if(b)b.style.display='';
  if(btnOculto==='defListen')btnOculto=null;
}
function openCapsule(name){
  const def=DEFS[name];
  if(!def)return;
  document.getElementById('defImg').innerHTML=ic(def.img);
  document.getElementById('defTitle').textContent=def.titulo;
  narracionesActuales=def.narra;
  defTituloActual=def.titulo;
  setConsigna(document.getElementById('defText'),def.narra);
  document.getElementById('defWindow').classList.add('on');
  /* Los botones se ocultan YA, no dentro de 200 ms: con la demora, un doble
     toque en JUGAR entra a la pantalla y arranca la locución de la cápsula
     encima de la consigna nueva. */
  document.getElementById('defListen').style.display='none';
  document.getElementById('defPlay').style.display='none';
  if(defTimer)clearTimeout(defTimer);
  if(defWatchdog){clearTimeout(defWatchdog);defWatchdog=null;}
  /* Red de seguridad INDEPENDIENTE de la locución: pase lo que pase con el
     audio, los botones vuelven a verse. Antes solo se mostraban en el
     callback de speak(), así que si la locución se reemplaza o falla la
     cápsula quedaba sin salida visible. */
  defWatchdog=setTimeout(()=>{
    defWatchdog=null;
    if(document.getElementById('defWindow').classList.contains('on'))defMostrarBotones();
  },2500);
  const seqAlAbrir=speakSeq;
  defTimer=setTimeout(()=>{
    defTimer=null;
    /* si ya se salió de la cápsula, no se narra nada */
    if(!document.getElementById('defWindow').classList.contains('on'))return;
    /* si la persona ya tocó la burbuja, no se le pisa lo que está escuchando */
    if(speakSeq!==seqAlAbrir)return;
    speak(def.narra,'defListen',()=>{
      if(defWatchdog){clearTimeout(defWatchdog);defWatchdog=null;}
      defMostrarBotones();
    },faltaTitulo(def.titulo,def.narra)?limpiarTexto(def.titulo):null);
  },200);
}
function defGo(){
  if(!defTarget)return;
  const t=defTarget;
  defTarget=null;
  if(defTimer){clearTimeout(defTimer);defTimer=null;}
  if(defWatchdog){clearTimeout(defWatchdog);defWatchdog=null;}
  defMostrarBotones();
  document.getElementById('defWindow').classList.remove('on');
  showScreen(t);
}
window.defGo=defGo;

/* ====== NIVEL 1 · ¿CUÁLES SON PLANTAS? ====== */
const PICK_ITEMS=[
  {i:8,t:'Planta',good:true},
  {i:9,t:'Árbol',good:true},
  {i:10,t:'Flor',good:true},
  {i:11,t:'Perro',good:false},
  {i:12,t:'Piedra',good:false},
  {i:13,t:'Gato',good:false}
];
let pickFound=0;
function goScr1Pick(){
  pickFound=0;
  PICK_ITEMS.forEach(it=>{it.picked=false;});
  buildGrid('pickGrid',PICK_ITEMS,scr1Click);
  const nxt=document.getElementById('pickNext');
  if(nxt)nxt.style.display='none';
}
function buildGrid(el,items,fn){
  const g=document.getElementById(el);
  g.innerHTML='';
  items.forEach((it,idx)=>{
    const d=document.createElement('div');
    d.className='opt';
    d.dataset.good=it.good?'true':'false';
    d.innerHTML=ic(it.i)+'<span>'+it.t+'</span>';
    d.onclick=()=>fn(d,it,idx);
    control(d);
    g.appendChild(d);
  });
}
function limpiarError(){
  document.querySelectorAll('.opt.incorrect,.order-slot.wrong').forEach(e=>e.classList.remove('incorrect','wrong'));
}
function scr1Click(d,it){
  const g=d.dataset.good==='true';
  if(it.picked)return;
  if(g){
    it.picked=true;pickFound++;
    d.classList.add('correct','fixed');
    SFX.good();addStar('pick-'+it.i);
    speak('¡Muy bien! '+it.t+' es una planta.','',null);
    if(pickFound===PICK_ITEMS.filter(x=>x.good).length){
      document.getElementById('pickNext').style.display='inline-block';
    }
  }else{
    d.classList.add('incorrect');
    SFX.bad();
    speak('Esta no es una planta. Busquemos la que tiene hojas y está en la tierra.','',null);
    setTimeout(limpiarError,1200);
  }
}
function goScr1Next(){goScreen('scr1-acciones');}
window.goScr1Next=goScr1Next;

/* ====== NIVEL 1 · ¿QUÉ PUEDE HACER UNA PLANTA? ====== */
const ACCIONES=[
  {t:'🌱 Crecer',good:true},
  {t:'🐶 Ladrar',good:false},
  {t:'📚 Estudiar',good:false}
];
function goScr1Acciones(){
  buildAcciones();
  const nxt=document.getElementById('accionesNext');
  if(nxt)nxt.style.display='none';
}
function buildAcciones(){
  const g=document.getElementById('accionesGrid');
  g.innerHTML='';
  ACCIONES.forEach((it)=>{
    const d=document.createElement('div');
    d.className='opt big';
    d.innerHTML='<span>'+it.t+'</span>';
    d.onclick=()=>{
      if(d.classList.contains('fixed'))return;
      if(it.good){
        d.classList.add('correct','fixed');
        SFX.good();addStar('accion');
        [...g.children].forEach(x=>{if(x.dataset.good==='false')x.classList.add('fixed')});
        speak('¡Muy bien! Una planta puede crecer.','',null);
        document.getElementById('accionesNext').style.display='inline-block';
      }else{
        d.classList.add('incorrect');
        SFX.bad();
        speak('Los perros y los niños estudian. Las plantas no. Probemos otra vez.','',null);
        setTimeout(limpiarError,1200);
      }
    };
    d.dataset.good=it.good?'true':'false';
    control(d);
    g.appendChild(d);
  });
}

/* ====== NIVEL 2 · TEORÍA INTERACTIVA ====== */
function buildLine(el,items){
  const g=document.getElementById(el);
  g.innerHTML='';
  items.forEach((it,idx)=>{
    const w=document.createElement('div');
    w.className='gl-item';
    w.innerHTML=ic(it.i)+'<div class="gl-cap">'+it.t+'</div>';
    w.onclick=()=>speak(it.n?it.t+', '+it.n:it.t,'',null);
    control(w);
    g.appendChild(w);
    if(idx<items.length-1){
      const a=document.createElement('div');
      a.className='gl-arrow';
      a.textContent='→';
      a.setAttribute('aria-hidden','true');
      g.appendChild(a);
    }
  });
}
function goScr2Theory(){
  buildLine('theoryLine',STAGES.map(s=>({i:STAGE_INFO[s].i,t:STAGE_INFO[s].t,n:(s==='semilla'?'una planta nace de una semilla.':s==='germinacion'?'la semilla con agua comienza a germinar.':s==='brote'?'aparece el tallo y las hojas.':s==='pequena'?'la planta crece pequeña.':'la planta creció y da flores.')})));
}

/* ====== NIVEL 2 · ORDENAR ETAPAS ====== */
let orderShuffle=[],orderPlaced=0,orderSel=null;
function goScr2Order(){
  const slots=document.getElementById('orderSlots');
  slots.innerHTML='';
  STAGES.forEach((s,idx)=>{
    const d=document.createElement('div');
    d.className='order-slot';
    d.dataset.pos=idx;
    /* la primera casilla dice QUÉ va ahí: es el paso más difícil y sola
       con un número no se entiende */
    d.innerHTML='<div class="ph" id="slotLbl'+idx+'">'
      +(idx===0?STAGE_INFO[s].t:(idx+1))+'</div>';
    d.onclick=()=>orderSlotClick(d,idx);
    control(d);
    slots.appendChild(d);
  });
  orderShuffle=STAGES.map((s,i)=>({s,i,n:Math.random()})).sort((a,b)=>a.n-b.n);
  const opt=document.getElementById('orderOption');
  opt.innerHTML='';
  orderShuffle.forEach((item)=>{
    const c=document.createElement('div');
    c.className='order-opt';
    c.dataset.key=item.s;
    c.innerHTML=ic(STAGE_INFO[item.s].i)+'<span class="order-cap">'+STAGE_INFO[item.s].t+'</span>';
    c.onclick=()=>orderOptClick(c,item);
    control(c);
    opt.appendChild(c);
  });
  orderPlaced=0;orderSel=null;
  marcarProximaCasilla();
  document.getElementById('orderFb').innerHTML='';
}
/* Marca cuál es la casilla que toca. Para Ana María era muy difícil
   recordar en cuál estaba: la casilla correcta se señala siempre, así que
   hay que pensar SOLO qué etapa viene después, que es lo que se aprende. */
function marcarProximaCasilla(){
  document.querySelectorAll('#orderSlots .order-slot').forEach(s=>s.classList.remove('next'));
  if(orderPlaced>=STAGES.length)return;
  const s=document.querySelector('#orderSlots .order-slot[data-pos="'+orderPlaced+'"]');
  if(s)s.classList.add('next');
}
function orderOptClick(c,item){
  /* una imagen ya colocada no se vuelve a elegir: el CSS la deja con
     pointer-events:none, pero desde el teclado igual llegaba el Enter */
  if(c.classList.contains('done'))return;
  orderSel={c,item};
  document.querySelectorAll('.order-opt').forEach(x=>x.classList.remove('sel'));
  c.classList.add('sel');
  SFX.pop();
  /* se dice en voz alta dónde va: no hace falta acordarse */
  speak(STAGE_INFO[item.s].t+'. Ahora tocá la casilla '+(orderPlaced+1)+'.','',null);
}
function orderSlotClick(d,idx){
  /* si la pantalla ya terminó, no se acepta más toques: el botón de
     seguir puede seguir visible y el doble toque reseteaba el nivel */
  if(orderPlaced>=STAGES.length)return;
  if(!orderSel){speak('Primero tocá una imagen.','',null);return;}
  if(d.classList.contains('filled')){
    speak('Esa casilla ya tiene una imagen.','',null);
    return;
  }
  const expected=STAGE_INFO[STAGES[orderPlaced]];
  if(orderSel.item.s===STAGES[orderPlaced]){
    d.classList.add('filled');
    d.innerHTML=ic(orderSel.item.s==='semilla'?1:STAGE_INFO[orderSel.item.s].i)+'<div class="ph">'+expected.t+'</div>';
    orderSel.c.classList.add('done');
    SFX.good();addStar('order-'+idx);
    orderSel=null;
    orderPlaced++;
    marcarProximaCasilla();
    if(orderPlaced===STAGES.length){
      document.getElementById('orderFb').innerHTML='<div class="fbmsg">⭐ ¡Muy bien! ¡Ordenaste el crecimiento!</div>';
      speakEntonces('¡Muy bien! ¡Ordenaste cómo crece una planta!','scr2-grow',1200);
    }else{
      const sig=STAGE_INFO[STAGES[orderPlaced]].t;
      speak('¡Bien! '+expected.t+'. Ahora falta: '+sig+'. Tocá esa imagen.','',null);
    }
  }else{
    d.classList.add('wrong');
    SFX.bad();
    /* el error señala la casilla correcta: la que estaba marcada */
    speak('Esa no va ahí. Busquemos la que va justo antes.','',null);
    setTimeout(limpiarError,1200);
  }
}

/* ====== NIVEL 2 · CRECER CON AGUA Y LUZ ====== */
let needs=[],growIdx=0,growTimer=null;
function goScr2Grow(){
  needs=[];growIdx=0;
  if(growTimer){clearTimeout(growTimer);growTimer=null;}
  document.getElementById('potStage').innerHTML=ic(1);
  document.getElementById('potDirt').classList.remove('wet');
  document.querySelectorAll('#scr2-grow .action-btn').forEach(b=>b.classList.remove('used'));
  document.getElementById('growFeedback').innerHTML='';
  document.getElementById('growNeedAgua').classList.remove('done');
  document.getElementById('growNeedLuz').classList.remove('done');
}
function giveNeed(tipo){
  if(tipo==='agua'){
    if(document.getElementById('btnGrowAgua').classList.contains('used'))return;
    document.getElementById('btnGrowAgua').classList.add('used');
    document.getElementById('growNeedAgua').classList.add('done');
    document.getElementById('potDirt').classList.add('wet');
    document.getElementById('growFeedback').innerHTML='<div class="fbmsg">💧 ¡Le diste agua!</div>';
    const anim=document.getElementById('potAnimWater');
    anim.classList.remove('on');void anim.offsetWidth;anim.classList.add('on');
    setTimeout(()=>anim.classList.remove('on'),2500);
    SFX.good();
    needs.push('agua');
    speak('¡Le diste AGUA!','',null);
  }else{
    if(document.getElementById('btnGrowLuz').classList.contains('used'))return;
    document.getElementById('btnGrowLuz').classList.add('used');
    document.getElementById('growNeedLuz').classList.add('done');
    document.getElementById('growFeedback').innerHTML='<div class="fbmsg warm">☀️ ¡Recibió luz!</div>';
    const anim=document.getElementById('potAnimSun');
    anim.classList.remove('on');void anim.offsetWidth;anim.classList.add('on');
    setTimeout(()=>anim.classList.remove('on'),2500);
    SFX.good();
    needs.push('sol');
    speak('¡Recibió LUZ!','',null);
  }
  if(needs.length===2){
    document.getElementById('growFeedback').innerHTML='<div class="fbmsg">🎉 ¡Tu planta va a crecer!</div>';
    growIdx=0;
    growAll();
  }
}
/* Las etapas se encadenan AL FINAL del audio: nunca se corta la voz */
function growAll(){
  document.querySelectorAll('#scr2-grow .action-btn').forEach(b=>b.classList.add('used'));
  const tick=()=>{
    const key=GROW_SEQ[growIdx];
    if(!key){
      speak('🌸 ¡Tu planta adulta es una Guardiana del jardín!','',()=>setTimeout(()=>goScreen('scr3-intro'),1500));
      return;
    }
    growIdx++;
    document.getElementById('potStage').innerHTML=ic(STAGE_INFO[key].i);
    document.getElementById('potStage').style.animation='none';
    void document.getElementById('potStage').offsetWidth;
    document.getElementById('potStage').style.animation='appear .6s';
    document.getElementById('growFeedback').innerHTML='<div class="fbmsg">'+GROW_MSG[key]+'</div>';
    speak(GROW_MSG[key],'',()=>{growTimer=setTimeout(tick,800);});
  };
  speak('¡Tu planta va a crecer! Mirá sus etapas.','',()=>setTimeout(tick,600));
}

/* ====== NIVEL 3 · ACTIVIDADES ====== */
/* Si noAud es una función, se le pasa la opción tocada: el mensaje dice
   SIEMPRE lo que ella eligió, no un distractor fijo. Antes, tocar "DULCE"
   respondía "No, el hielo no". */
function makeChoice(el,opts,correctI,next,okAud,noAud){
  const g=document.getElementById(el);
  g.innerHTML='';
  opts.forEach((op,i)=>{
    const d=document.createElement('div');
    d.className='opt big';
    d.dataset.good=(i===correctI)?'true':'false';
    d.innerHTML='<span>'+op+'</span>';
    d.onclick=()=>{
      if(g.classList.contains('locked'))return;
      if(d.dataset.good==='true'){
        g.classList.add('locked');
        [...g.children].forEach(x=>{if(x.dataset.good==='false')x.classList.add('fixed')});
        d.classList.add('correct','fixed');
        SFX.good();addStar(el);
        speakEntonces(okAud,next);
      }else{
        d.classList.add('incorrect');
        SFX.bad();
        const msg=typeof noAud==='function'?noAud(op):(noAud||'Casi. Probemos otra vez.');
        speak(msg,'',null);
        setTimeout(limpiarError,1200);
      }
    };
    control(d);
    g.appendChild(d);
  });
}
function goScr3Sed(){
  makeChoice('sedOptions',['💧 AGUA','🍬 DULCE','🍞 PAN'],0,'scr3-falta',
    '¡Muy bien! AGUA. Las plantas toman agua de la tierra.',
    t=>'No, '+sinEmoji(t).toLowerCase()+' no. Las plantas toman AGUA de la tierra.');
}
function goScr3Luz(){
  makeChoice('luzOptions',['☀️ LUZ','🌙 OSCURIDAD','🧊 HIELO'],0,'scr3-faltaluz',
    '¡Muy bien! LUZ. Con la luz la planta prepara su alimento.',
    t=>'No, '+sinEmoji(t).toLowerCase()+' no. La planta necesita LUZ para preparar su alimento.');
}
function goScr3Tierra(){
  makeChoice('tierraOptions',['🌱 TIERRA','🪨 PIEDRAS','🍬 DULCE'],0,'scr3-basura',
    '¡Muy bien! TIERRA. En la tierra están las raíces.',
    t=>'No, '+sinEmoji(t).toLowerCase()+' no. Las raíces crecen en la TIERRA.');
}

/* ====== NIVEL 3 · RECUPERACIONES (el texto explica la CAUSA) ====== */
let faltaDone=false;
function goScr3Falta(){
  faltaDone=false;
  document.getElementById('faltaPlant').innerHTML=ic(15);
}
function faltaRecover(){
  if(faltaDone)return;
  faltaDone=true;
  const p=document.getElementById('faltaPlant');
  p.innerHTML=ic(16);
  p.style.animation='appear .7s';
  SFX.good();
  addStar('recover-agua');
  speakEntonces('⭐ LE DISTE AGUA Y AHORA ESTÁ FELIZ. SIN AGUA LA PLANTA TENÍA SED.','scr3-luz',1500);
}
window.faltaRecover=faltaRecover;

let faltaluzDone=false;
function goScr3Faltaluz(){
  faltaluzDone=false;
  document.getElementById('faltaluzPlant').innerHTML=ic(17);
}
function faltaluzRecover(){
  if(faltaluzDone)return;
  faltaluzDone=true;
  const p=document.getElementById('faltaluzPlant');
  p.innerHTML=ic(18);
  p.style.animation='appear .7s';
  SFX.good();
  addStar('recover-luz');
    speakEntonces('⭐ LE DISTE SOL Y VOLVIÓ A CRECER. EN LA OSCURIDAD NO PODÍA PREPARAR SU ALIMENTO.','scr3-tierra',1500);
}
window.faltaluzRecover=faltaluzRecover;

let basuraDone=false;
function goScr3Basura(){
  basuraDone=false;
  document.getElementById('basuraPlant').innerHTML=ic(15);
}
function limpiarBasura(){
  if(basuraDone)return;
  basuraDone=true;
  const p=document.getElementById('basuraPlant');
  p.innerHTML=ic(16);
  p.style.animation='appear .7s';
  SFX.good();
  addStar('recover-basura');
  speakEntonces('⭐ LIMPIASTE LA TIERRA. SIN BASURA LA RAÍZ PUEDE CRECER.','scrFinal-intro',1500);
}
window.limpiarBasura=limpiarBasura;

/* ====== DESAFÍO FINAL ====== */
let finNeeds=[],finIdx=0,finTimer=null;
function goFinalPlay(){
  finNeeds=[];finIdx=0;
  if(finTimer){clearTimeout(finTimer);finTimer=null;}
  document.getElementById('finalStage').innerHTML=ic(1);
  document.getElementById('finalDirt').classList.remove('wet');
  document.querySelectorAll('#scrFinal-play .action-btn').forEach(b=>b.classList.remove('used'));
  document.getElementById('finalFeedback').innerHTML='';
  document.getElementById('finalNeedAgua').classList.remove('done');
  document.getElementById('finalNeedLuz').classList.remove('done');
  document.getElementById('finalNeedTierra').classList.remove('done');
}
function finalNeed(tipo){
  if(tipo==='agua'){
    if(document.getElementById('btnFinalAgua').classList.contains('used'))return;
    document.getElementById('btnFinalAgua').classList.add('used');
    document.getElementById('finalNeedAgua').classList.add('done');
    document.getElementById('finalDirt').classList.add('wet');
    document.getElementById('finalFeedback').innerHTML='<div class="fbmsg">💧 ¡Le diste agua!</div>';
    const anim=document.getElementById('finalAnimWater');
    anim.classList.remove('on');void anim.offsetWidth;anim.classList.add('on');
    setTimeout(()=>anim.classList.remove('on'),2500);
    SFX.good();addStar('final-agua');finNeeds.push('agua');
    speak('¡Le diste AGUA!','',null);
  }else if(tipo==='sol'){
    if(document.getElementById('btnFinalLuz').classList.contains('used'))return;
    document.getElementById('btnFinalLuz').classList.add('used');
    document.getElementById('finalNeedLuz').classList.add('done');
    document.getElementById('finalFeedback').innerHTML='<div class="fbmsg warm">☀️ ¡Recibió luz!</div>';
    const anim=document.getElementById('finalAnimSun');
    anim.classList.remove('on');void anim.offsetWidth;anim.classList.add('on');
    setTimeout(()=>anim.classList.remove('on'),2500);
    SFX.good();addStar('final-sol');finNeeds.push('sol');
    speak('¡Recibió LUZ!','',null);
  }else{
    if(document.getElementById('btnFinalTierra').classList.contains('used'))return;
    document.getElementById('btnFinalTierra').classList.add('used');
    document.getElementById('finalNeedTierra').classList.add('done');
    document.getElementById('finalFeedback').innerHTML='<div class="fbmsg">🌱 ¡Tierra limpia!</div>';
    SFX.good();addStar('final-tierra');finNeeds.push('tierra');
    speak('¡TIERRA LIMPIA!','',null);
  }
  if(finNeeds.length===3){
    document.getElementById('finalFeedback').innerHTML='<div class="fbmsg">🎉 ¡Tu planta creció!</div>';
    finIdx=0;
    finalGrowAll();
  }
}
function finalGrowAll(){
  document.querySelectorAll('#scrFinal-play .action-btn').forEach(b=>b.classList.add('used'));
  const tick=()=>{
    const key=GROW_SEQ[finIdx];
    if(!key){
      document.getElementById('finalFeedback').innerHTML='<div class="fbmsg">🌸 ¡Tu planta creció!</div>';
      speak('🌸 ¡Tu planta creció y está feliz! Ahora vamos a repasar.','',()=>setTimeout(()=>goScreen('scrFinish-review'),1500));
      return;
    }
    finIdx++;
    document.getElementById('finalStage').innerHTML=ic(STAGE_INFO[key].i);
    document.getElementById('finalStage').style.animation='none';
    void document.getElementById('finalStage').offsetWidth;
    document.getElementById('finalStage').style.animation='appear .6s';
    document.getElementById('finalFeedback').innerHTML='<div class="fbmsg">'+GROW_MSG[key]+'</div>';
    speak(GROW_MSG[key],'',()=>{finTimer=setTimeout(tick,800);});
  };
  speak('¡Tu planta va a crecer! Mirá sus etapas.','',()=>setTimeout(tick,600));
}

/* ====== REPASO FINAL · CUESTIONARIO ====== */
let quizIdx=0;
function barajar(arr){
  const a=arr.slice();
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
function goQuiz(){
  quizIdx=0;
  document.getElementById('btnReviewDone').style.display='none';
  document.getElementById('quizFb').innerHTML='';
  const dots=document.getElementById('quizDots');
  dots.innerHTML=QUIZ.map(()=>'<span class="dot"></span>').join('');
  pintarPregunta();
}
function pintarPregunta(){
  const it=QUIZ[quizIdx];
  document.getElementById('quizQ').textContent=(quizIdx+1)+'. '+it.q;
  const g=document.getElementById('quizOpts');
  g.innerHTML='';
  const pos=barajar(it.opts.map((t,k)=>({t,k,n:Math.random()}))).sort((a,b)=>a.n-b.n);
  pos.forEach(p=>{
    const b=document.createElement('div');
    b.className='opt big';
    b.textContent=p.t;
    b.onclick=()=>quizResponder(b,p.k,it);
    control(b);
    g.appendChild(b);
  });
  speak(it.q,'',null);
}
function marcarPunto(i,clase){
  const d=document.querySelectorAll('#quizDots .dot')[i];
  if(d)d.classList.add(clase);
}
function quizResponder(el,elegido,it){
  if(el.classList.contains('locked'))return;
  const fb=document.getElementById('quizFb');
  if(elegido!==it.ok){
    el.classList.add('incorrect');
    SFX.bad();
    /* cada opción equivocada tiene SU propia explicación */
    const msg='Casi. '+(it.mal[elegido]||'Eso no es lo que necesita una planta. ')+'Probá otra vez.';
    fb.textContent=msg;
    speak(msg,'',null);
    setTimeout(limpiarError,1400);
    return;
  }
  /* acierto: se bloquea, explica la causa y avanza al terminar el audio */
  document.querySelectorAll('#quizOpts .opt').forEach(x=>x.classList.add('locked'));
  el.classList.add('correct');
  SFX.good();
  marcarPunto(quizIdx,'ok');
  fb.textContent='⭐ '+it.fb;
  speak(it.fb,'',()=>{
    quizIdx++;
    if(quizIdx>=QUIZ.length){
      speak('¡Perfecto, Ana María! Ya sabés todo lo que necesita una planta.','',()=>{
        document.getElementById('btnReviewDone').style.display='';
      });
      return;
    }
    document.getElementById('quizFb').innerHTML='';
    pintarPregunta();
  });
}

/* ====== TRANSFERENCIA A LA VIDA REAL ====== */
let transferDone=0;
/* el botón TERMINAR del repaso entra acá; initScreen arma la pantalla */
function goTransfer(){
  goScreen('scrTransfer');
}
window.goTransfer=goTransfer;
function buildTransfer(){
  transferDone=0;
  const l=document.getElementById('transferList');
  l.innerHTML='';
  document.getElementById('transferFb').innerHTML='';
  document.getElementById('btnTransfer').style.display='none';
  TRANSFER.forEach((t,i)=>{
    const d=document.createElement('div');
    d.className='check-item';
    d.innerHTML='<span class="box">☐</span><span class="txt">'+t.t+'</span>';
    d.onclick=()=>marcarTransfer(d,t,i);
    control(d);
    l.appendChild(d);
  });
}
function marcarTransfer(d,t,i){
  if(d.classList.contains('done'))return;
  d.classList.add('done');
  d.querySelector('.box').textContent='✅';
  SFX.good();
  transferDone++;
  /* el checklist ACUMULA: marcar dos cosas rápido no borra la primera */
  const fb=document.getElementById('transferFb');
  const linea=document.createElement('div');
  linea.className='fbmsg';
  linea.textContent='✅ '+t.n;
  fb.appendChild(linea);
  speak(t.n,'',()=>{
    if(transferDone>=TRANSFER.length){
      const b=document.getElementById('btnTransfer');
      b.style.display='';
      speak('¡Muy bien, Ana María! Si hacés estas tres cosas, tu planta va a crecer fuerte.','',null);
    }
  });
}
window.goTransfer=goTransfer;

/* ====== FINAL ====== */
function goFinish(){
  const sub=document.querySelector('#screen-finish .sub');
  if(sub)sub.textContent='⭐ Estrellas: '+stars+' · Ya sos una Guardiana de las Plantas 🌸';
  goScreen('screen-finish');
}
window.goFinish=goFinish;

/* ====== NAVEGACIÓN ====== */
window.goScreen=goScreen;

/* ====== INIT ====== */
let startHablado=false,welcomeTimer=null;
function arrancarJuego(){
  if(!startHablado){
    startHablado=true;
    if(welcomeTimer){clearTimeout(welcomeTimer);welcomeTimer=null;}
  }
  stars=0;
  estrellasOtorgadas.clear();
  const c=document.getElementById('starCount');
  if(c)c.textContent=0;
  goScreen('scr1-intro');
}
window.arrancarJuego=arrancarJuego;

window.addEventListener('load',()=>{
  buildGrid('pickGrid',PICK_ITEMS,scr1Click);
  buildAcciones();
  const first=document.getElementById('screen-start');
  if(first)first.classList.add('on');
  startHablado=false;
  welcomeTimer=setTimeout(()=>{
    if(!startHablado)speak(INTROS['screen-start'].text,'',null);
  },400);
});
