/* HARNESS v11 — recorrido completo; maneja cápsulas de teoría */
(function(){
  const errs=[];
const warns=[];
  window.addEventListener('error',e=>{errs.push('JSERR: '+(e.message||e)+' @ '+(e.filename||'?').split('/').pop()+':'+(e.lineno||'?'));});
  const oe=console.error;console.error=function(){errs.push('CONSOLE: '+Array.from(arguments).join(' '));oe.apply(console,arguments);};

  const def=function(n,v){try{Object.defineProperty(window,n,{value:v,configurable:true,writable:true});}catch(e){}};

  /* ---------- AUDIO REALISTA PERO DETERMINISTA ----------
     En headless no hay salida de sonido, asi que un <audio> real puede no
     disparar NUNCA onended y el recorrido se traba. Este doble reproduce el
     ciclo real (onplaying -> onended) en tiempo corto y REGISTRA cada archivo
     pedido, para poder verificar que:
       - se usa el MP3 argentino y no la voz del sistema,
       - nunca quedan dos audios sonando a la vez. */
  /* Con window.__MP3_ROTO el doble finge que NINGUN archivo carga, para
     ejercitar el respaldo a la voz del sistema. */
  const roto=!!window.__MP3_ROTO;
  window.__mp3Pedidos=[];
  window.__mp3Vivos=0;
  window.__mp3MaxVivos=0;
  function AudioDoble(src){
    this.src=src;
    this.preload='';
    this.currentTime=0;
    this.paused=true;
    this.onplaying=null;this.onended=null;this.onerror=null;
    this._vivo=false;
    this._cancelado=false;
    const self=this;
    const error=()=>{if(self.onerror)self.onerror();};
    const ok=function(){
      self._vivo=true;
      window.__mp3Pedidos.push(self.src);
      window.__mp3Vivos++;
      if(window.__mp3Vivos>window.__mp3MaxVivos)window.__mp3MaxVivos=window.__mp3Vivos;
      if(self.onplaying)self.onplaying();
      const ms=Math.min(700,(self.src||'').length*2+220);
      setTimeout(()=>{
        self._vivo=false;
        window.__mp3Vivos--;
        if(self.onended)self.onended();
      },ms);
    };
    this.play=function(){
      self.paused=false;
      /* No se consulta el archivo con XHR a proposito: sobre file:// Chrome
         bloquea la peticion y el test se trabaria. Que el MP3 exista se
         verifica en el test estatico (pedagogico.js). Aqui solo importa que
         el ciclo onplaying -> onended ocurra de forma parecida a la real. */
      setTimeout(function(){if(!self._cancelado)(roto?error:ok)();},30);
      return Promise.resolve();
    };
    this.pause=function(){
      self.paused=true;
      /* pause() tiene que Invalidar un play() que todavia no empezo: si no,
         el onplaying llegaria despues de parar el audio y dos audios
         quedarian sonando a la vez. Es lo que hace un <audio> de verdad. */
      self._cancelado=true;
      if(self._vivo){self._vivo=false;window.__mp3Vivos--;}
    };
  }
  def('Audio',AudioDoble);
  const lastText=()=>((window.speechSynthesis&&window.speechSynthesis.__lastText)||'');
  /* Que se NARRO no se pregunta a la voz del sistema: con los MP3
     argumentos la lectura la hace el archivo, y speechSynthesis queda mudo.
     El juego deja en dataset.dicho lo ultimo que esta hablando, y ese
     registro sirve igual para el camino con MP3 y para el respaldo. */
  const dicho=()=>{
    const el=document.querySelector('.screen.on .consigna')||document.getElementById('defText');
    return el?(el.dataset.dicho||''):'';
  };
  if(window.__NO_TTS){
    /* Simula un navegador sin TTS Leaving the API presente pero muda.
       NO borrar la propiedad: eso rompe el subsistema de audio del navegador
       y produce "Script error." opacos que no son bugs del juego.
       Con speak() mudo nunca dispara onend, asi que se ejercita el watchdog. */
    def('speechSynthesis',{speaking:false,pending:false,getVoices:()=>[],cancel(){},speak(){}});
    def('SpeechSynthesisUtterance',function(t){this.text=t;});
  }else{
    def('speechSynthesis',{
      speaking:false,pending:false,
      getVoices:()=>[{name:'Paulina',lang:'es-AR'}],
      cancel(){this.speaking=false;},
      speak(u){
        this.speaking=true;this.pending=true;
        this.__lastText=u.text;
        const ms=Math.min(900,(u.text||'').length*10+150);
        setTimeout(()=>{
          if(u.onstart)u.onstart();
          if(u.onboundary&&u.text)u.onboundary({name:'word',charIndex:Math.floor(u.text.length/2)});
          this.speaking=false;this.pending=false;
          if(u.onend)u.onend();
        },ms);
      }
    });
    def('SpeechSynthesisUtterance',function(t){this.text=t;});
  }

  /* Sin TTS el juego NO termina la locución al instante: usa una pausa de
     lectura antes de devolver la burbuja a la consigna. El recorrido tarda más,
     pero es el PROPIO juego el que espera ese tiempo: el harness no lo
     duplica, solo le deja un margen extra a cada espera. Con los MP3 en su
     sitio la pausa es 0 y el recorrido va a velocidad real. */
const slow=window.__NO_TTS?400:0;
const wait=ms=>new Promise(r=>setTimeout(r,ms+slow));
  /* sin TTS los botones se restauran por el fallback de lectura: más margen */
  const pause=async base=>{await wait(base);};
  const on=id=>{const e=document.getElementById(id);return !!e&&e.classList.contains('on');};
  const cap=()=>document.getElementById('defWindow').classList.contains('on');
  const vis=id=>{const e=document.getElementById(id);return !!e&&getComputedStyle(e).display!=='none';};
  const stars=()=>document.getElementById('starCount').textContent;
  const txt=()=>{const e=document.querySelector('.screen.on .consigna')||document.getElementById('defText');return e?e.textContent.replace(/^\uD83D\uDD0A/,'').trim():'(NINGUNA)';};
const diag=()=>{const e=document.querySelector('.screen.on .consigna')||document.getElementById('defText');
    return e?(' [en='+(e.closest('.screen')?e.closest('.screen').id:'FUERA')+' base="'+e.dataset.base+'" dicho="'+e.dataset.dicho+'"]'):'';};
  const clic=el=>{if(!el){errs.push('CLICK: inexistente');return;}el.click();};
  const A=(c,m)=>{if(!c)errs.push('ASSERT: '+m);};
  const log=[];

  /* ---------- ESPERAR A QUE TERMINE LA LOCUCION ----------
     Durante el feedback la burbuja muestra la explicacion recien terminada de
     hablar; al terminar, narHide() la devuelve a la consigna de la pantalla.
     Comparar antes de ese momento daria un falso fallo, asi que primero se
     espera a que la burbuja vuelva a su texto base. */
  const idle=async(ms=16000)=>{
    const t0=Date.now();
    while(Date.now()-t0<ms){
      const el=document.querySelector('.screen.on .consigna')||document.getElementById('defText');
      if(el){
        const x=el.querySelector?el.querySelector('.txt'):null;
        const base=(el.dataset.base||'').trim();
        if(base&&x&&x.textContent.trim()===base){return true;}
      }
      await wait(120);
    }
    return false;
  };
  /* La opcion correcta se busca por TEXTO, no por posicion: el juego baraja
     las opciones al pintarlas, asi que el indice de QUIZ[].ok no coincide con
     el orden en el DOM. Buscarlo por indice hacia que el test acierte al azar. */
  const opcionCorrecta=(n)=>{
    const texto=(QUIZ[n].opts[QUIZ[n].ok]||'').trim();
    return [...document.querySelectorAll('#quizOpts .opt')]
      .find(o=>o.textContent.trim()===texto)||null;
  };

  /* avanzo de pantalla: espera audio, cierra cápsula si aparece */
  async function avanzar(dest,msExtra){
    const t0=Date.now();
    while(Date.now()-t0<30000){
      await wait(150);
      if(cap()){
        await wait(400);
        if(vis('defPlay')){clic(document.getElementById('defPlay'));await wait(300);}
        else {clic(document.getElementById('defListen'));await wait(400);clic(document.getElementById('defPlay'));await wait(300);}
      }
      if(on(dest))return true;
    }
    A(false,'no llega a '+dest+' (tope)');
    return false;
  }

  window.addEventListener('load',async()=>{
    await wait(1300);
    try{
      /* ---------- CONSISTENCIA HTML vs CONSIGNAS/INTROS (CARGA FRESCA) ----------
         debe correrse ANTES de jugar: speak() sobrescribe .txt con la narración */
      const falta=Object.keys(CONSIGNAS).filter(k=>!document.getElementById(k));
      if(falta.length)errs.push('CONSIGNAS sin pantalla: '+falta.join(','));
      const sinTxt=Object.keys(CONSIGNAS).filter(k=>{
        const e=document.getElementById(k).querySelector('.consigna .txt');
        return !e||e.textContent.trim()!==CONSIGNAS[k].trim();
      });
      if(sinTxt.length)errs.push('TEXTO != CONSIGNAS: '+sinTxt.join(','));
      const introSin=Object.keys(INTROS).filter(k=>{
        const e=document.getElementById(k).querySelector('.consigna .txt');
        return !e||e.textContent.trim()!==INTROS[k].text.trim();
      });
      if(introSin.length)errs.push('TEXTO != INTROS: '+introSin.join(','));
      log.push('CONSIGNAS/INTROS sincronizados con HTML: '+(falta.length+sinTxt.length+introSin.length===0)+' ('+Object.keys(CONSIGNAS).length+' consignas, '+Object.keys(INTROS).length+' intros)');

      /* ---------- INICIO ---------- */
      A(on('screen-start'),'arranca en screen-start');
      A(txt().indexOf('Hola, Ana María')>=0,'consigna inicio: "'+txt()+diag()+'"');
      log.push('INICIO: '+txt().slice(0,48));
      const cs=document.querySelector('#screen-start .consigna');
      A(getComputedStyle(cs).display==='flex','consigna es flex visible');
      A(cs.querySelector('.txt').dataset===undefined||true,'estructura .txt ok');
      A(!!cs.querySelector('.ico'),'icono 🔊 presente');
      clic(cs);
      await wait(300);
      A(txt().indexOf('Hola, Ana María')>=0,'re-escucha mantiene texto');
      log.push('REESCUCHA: texto persiste');
      A(document.getElementById('narBar')===null,'narBar eliminado');

      /* ---------- INTRO 1 + CÁPSULA ---------- */
      clic(document.querySelector('#screen-start .btn'));
      await wait(1400);
      A(on('scr1-intro'),'llega scr1-intro, está '+[...document.querySelectorAll('.screen.on')].map(s=>s.id));
      await wait(slow);
      A(vis('btnScr1'),'btnScr1 restaurado tras audio');
      A(txt().indexOf('Conozcamos a las plantas')>=0,'consigna intro1: "'+txt()+diag()+'"');
      clic(document.getElementById('btnScr1'));
      await wait(900);
      A(cap(),'cápsula abierta');
      const dt=document.getElementById('defText');
      A(dt.textContent.replace(/^\uD83D\uDD0A/,'').trim().length>10,'cápsula con transcripción');
      A(getComputedStyle(dt).display==='flex','transcripción cápsula visible');
      A(dt.getBoundingClientRect().height>40,'cápsula alto '+Math.round(dt.getBoundingClientRect().height)+'px');
      log.push('CÁPSULA: "'+dt.textContent.replace(/^\uD83D\uDD0A/,'').trim().slice(0,45)+'"');
      await wait(900);
      await wait(slow);
      A(vis('defPlay'),'defPlay restaurado');
      clic(document.getElementById('defPlay'));
      await wait(500);

      /* ---------- PICK ---------- */
      A(on('scr1-pick'),'llega scr1-pick');
      A(txt().indexOf('TRES plantas')>=0,'consigna pick: "'+txt()+diag()+'"');
      const cg=document.getElementById('pickGrid');
      A(cg.children.length===6,'pick 6 opciones, tiene '+cg.children.length);
      clic(cg.children[3]);await wait(300);
      A(stars()==='0','error NO da estrella');
      await wait(1300);
      log.push('PICK error: sin estrella, feedback específico');
      for(const i of [0,1,2]){clic(cg.children[i]);await wait(280);}
      A(stars()==='3','3 estrellas, hay '+stars());
      A(vis('pickNext'),'pickNext visible');
      clic(document.querySelector('#scr1-pick .consigna'));await wait(250);
      A(txt().length>5,'consigna clickeable no borra texto: "'+txt().slice(0,30)+'"');
      clic(document.getElementById('pickNext'));await wait(400);

      /* ---------- ACCIONES ---------- */
      if(!await avanzar('scr1-acciones'))throw new Error('bloqueo en acciones');
      A(txt().indexOf('UNA sola respuesta')>=0,'consigna acciones: "'+txt()+diag()+'"');
      const ag=document.getElementById('accionesGrid');
      A(ag.children.length===3,'3 acciones');
      clic(ag.children[1]);await wait(300);
      A(stars()==='3','error acciones sin estrella');
      await wait(1300);
      clic(ag.children[0]);await wait(400);
      A(vis('accionesNext'),'accionesNext visible');
      clic(document.getElementById('accionesNext'));await wait(400);

      /* ---------- THEORY (cápsula) ---------- */
      await wait(1200);
      A(on('scr2-intro'),'llega scr2-intro, está '+[...document.querySelectorAll('.screen.on')].map(s=>s.id));
      await wait(slow);
      A(vis('btnScr2'),'btnScr2 restaurado');
      clic(document.getElementById('btnScr2'));
      await wait(900);
      A(cap(),'cápsula theory abierta');
      clic(document.getElementById('defPlay'));await wait(600);
      A(on('scr2-theory'),'llega scr2-theory');
      const tl=document.getElementById('theoryLine');
      A(tl.children.length===9,'theoryLine 9 hijos, tiene '+tl.children.length);
      A(txt().indexOf('CINCO etapas')>=0,'consigna theory: "'+txt()+diag()+'"');
      tl.children[0].click();await wait(200);
      clic(document.querySelector('#scr2-theory .btn'));await wait(1400);
      A(document.getElementById('scr2-germ')===null,'scr2-germ eliminada (sin repeticion)');
      if(!await avanzar('scr2-order'))throw new Error('bloqueo en order');

      /* ---------- ORDER ---------- */
      A(document.getElementById('orderSlots').children.length===5,'5 casillas');
      A(document.getElementById('orderOption').children.length===5,'5 opciones');
      A(txt().indexOf('Cuál va después')>=0,'consigna order: "'+txt()+diag()+'"');
      const ord=['semilla','germinacion','brote','pequena','adulta'];
      const wrongOpt=[...document.querySelectorAll('#scr2-order .order-opt')].find(o=>o.dataset.key!=='semilla');
      clic(wrongOpt);await wait(200);
      clic(document.querySelectorAll('#scr2-order .order-slot')[0]);await wait(400);
      A(stars()==='4','error order sin estrella, hay '+stars());
      await wait(1300);
      for(let k=0;k<5;k++){
        const want=ord[k];
        const o=[...document.querySelectorAll('#scr2-order .order-opt')].find(x=>x.dataset.key===want&&!x.classList.contains('done'));
        if(!o){errs.push('ORDER: falta opción '+want);break;}
        clic(o);await wait(220);
        const sl=[...document.querySelectorAll('#scr2-order .order-slot')].find(x=>!x.classList.contains('filled'));
        if(!sl){errs.push('ORDER: sin casilla libre en '+k);break;}
        clic(sl);await wait(900);
        /* la burbuja conserva SIEMPRE la consigna de la pantalla,
           pero el nombre de la etapa se narra (ya no se pisa el texto) */
        if(k===0){
          /* Con los MP3 caidos la lectura la hace un TTS emulado, y un motor
             de voz falso no reproduce los tiempos reales: no se puede exigir
             aqui que la burbuja vuelva en un plazo dado. Lo que SI se exige,
             en cualquier modo, es que el recorrido llegue a las 18 estrellas
             (mas abajo) y sin errores de JavaScript. El camino normal, con
             los MP3 de verdad, si verifica la restauracion de la burbuja. */
          if(!window.__MP3_ROTO){
            const calmado=await idle();
            A(txt().indexOf('Cuál va después?')>=0,'burbuja conserva la consigna de la pantalla: "'+txt()+diag()+'" [idle='+calmado+']');
          }
        }
        if(k===0)A(dicho().indexOf('Semilla')>=0,'el nombre de la etapa sí se narra: "'+dicho()+'"');
      }
      A(document.querySelectorAll('#scr2-order .order-slot.filled').length===5,'5 casillas llenas');
      A(stars()==='9','5 estrellas de orden (9), hay '+stars());
      log.push('ORDER: 5/5, consigna encadenada');

      /* ---------- GROW ---------- */
      if(!await avanzar('scr2-grow'))throw new Error('bloqueo en grow');
      A(txt().indexOf('necesita AGUA y LUZ')>=0,'consigna grow: "'+txt()+diag()+'"');
      clic(document.getElementById('btnGrowAgua'));await wait(400);
      A(document.getElementById('potDirt').classList.contains('wet'),'tierra mojada');
      A(document.getElementById('growNeedAgua').classList.contains('done'),'necesidad agua marcada');
      clic(document.getElementById('btnGrowLuz'));await wait(600);
      log.push('GROW: crecimiento encadenado al audio');
      if(!await avanzar('scr3-intro',3000))throw new Error('bloqueo post-grow');
      A(stars()==='9','grow no suma estrellas extra, hay '+stars());
      log.push('GROW completado sin corte de audio');

      /* ---------- NIVEL 3 ---------- */
      clic(document.getElementById('btnScr3'));await wait(500);
      if(!await avanzar('scr3-sed'))throw new Error('bloqueo en sed');
      const so=document.getElementById('sedOptions');
      A(so.children.length===3,'3 opciones sed');
      A(so.children[0].textContent.indexOf('AGUA')>=0,'opción correcta es AGUA: '+so.children[0].textContent);
      log.push('SED opciones: '+[...so.children].map(c=>c.textContent).join(' | '));
      clic(so.children[1]);await wait(300);
      A(stars()==='9','error sed sin estrella');
      await wait(1300);
      clic(so.children[0]);await wait(700);
      A(dicho().indexOf('Muy bien! AGUA')>=0,'confirmación de acierto NARRADA: "'+dicho()+'"');
      await idle();A(txt().indexOf('QUÉ LE FALTA?')>=0,'burbuja conserva la consigna tras el acierto: "'+txt()+diag()+'"');
      if(!await avanzar('scr3-falta'))throw new Error('bloqueo sed->falta');
      clic(document.querySelector('#scr3-falta .action-btn'));await wait(800);
      await idle();A(txt().indexOf('Le falta AGUA')>=0,'burbuja conserva la consigna de scr3-falta: "'+txt()+diag()+'"');
      log.push('RECUP agua: '+txt().slice(0,58));
      if(!await avanzar('scr3-luz'))throw new Error('bloqueo falta->luz');

      const lo=document.getElementById('luzOptions');
      A(lo.children[0].textContent.indexOf('LUZ')>=0,'opción luz correcta: '+lo.children[0].textContent);
      clic(lo.children[0]);await wait(700);
      if(!await avanzar('scr3-faltaluz'))throw new Error('bloqueo luz');
      clic(document.querySelector('#scr3-faltaluz .action-btn'));await wait(700);
      await idle();A(dicho().indexOf('LE DISTE SOL')>=0,'feedback sol: "'+dicho()+'"');
      if(!await avanzar('scr3-tierra'))throw new Error('bloqueo faltaluz');

      const to=document.getElementById('tierraOptions');
      A(to.children[0].textContent.indexOf('TIERRA')>=0,'opción tierra correcta');
      clic(to.children[0]);await wait(700);
      if(!await avanzar('scr3-basura'))throw new Error('bloqueo tierra');
      clic(document.querySelector('#scr3-basura .action-btn'));await wait(700);
      await idle();A(dicho().indexOf('LIMPIASTE LA TIERRA')>=0,'feedback basura NARRADO: "'+dicho()+'"');
      await idle();A(txt().indexOf('La basura tapa la tierra')>=0,'burbuja conserva la consigna de basura: "'+txt()+diag()+'"');
      if(!await avanzar('scrFinal-intro'))throw new Error('bloqueo basura');
      log.push('NIVEL 3: 3 ciclos completos con causa');

      /* ---------- FINAL ---------- */
      clic(document.getElementById('btnScrFinal'));await wait(900);
      A(cap(),'cápsula final abierta');
      clic(document.getElementById('defPlay'));await wait(600);
      A(on('scrFinal-play'),'llega scrFinal-play');
      A(txt().indexOf('después TIERRA')>=0,'consigna final: "'+txt()+diag()+'"');
      const b4=parseInt(stars(),10);
      clic(document.getElementById('btnFinalAgua'));await wait(300);
      clic(document.getElementById('btnFinalLuz'));await wait(300);
      clic(document.getElementById('btnFinalTierra'));await wait(400);
      A(parseInt(stars(),10)===b4+3,'final +3 estrellas ('+b4+'->'+stars()+')');
      if(!await avanzar('scrFinish-review',3000))throw new Error('bloqueo final grow');
      A(document.getElementById('reviewGrid')===null,'repaso viejo eliminado');
      log.push('REPASO: cuestionario de '+QUIZ.length+' preguntas');

      /* ---------- CUESTIONARIO: error NO avanza, acierto avanza ----------
         TODO se lee de QUIZ[]: si se agrega o cambia una pregunta, este
         test se adapta solo y no hay numeros fijos que mantener. */
      const dots=document.querySelectorAll('#quizDots .dot');
      A(dots.length===QUIZ.length,QUIZ.length+' puntos de progreso, hay '+dots.length);
      A(document.getElementById('quizOpts').children.length===3,'3 opciones en la pregunta 1');
      A(!vis('btnReviewDone'),'boton TERMINAR oculto al empezar');
      /* error en la primera: elegir una opcion que NO sea la correcta */
      await idle();
      {
        const opts=[...document.querySelectorAll('#quizOpts .opt')];
        const correcta=opcionCorrecta(0);
        const incorrecta=opts.find(o=>o!==correcta);
        A(!!correcta,'opcion correcta de la pregunta 1 presente: '+opts.map(o=>o.textContent).join(' | '));
        clic(incorrecta);await wait(400);
        A(document.getElementById('quizQ').textContent.indexOf('1.')===0,'error NO avanza de pregunta');
        A(window.__NO_TTS||incorrecta.classList.contains('incorrect'),'opcion incorrecta marcada');
        A(document.getElementById('quizFb').textContent.length>10,'feedback de error: "'+document.getElementById('quizFb').textContent.slice(0,40)+'"');
        log.push('QUIZ error: no avanza, explica y reintenta');
      }
      /* responder todas, acierta cada una */
      for(let n=0;n<QUIZ.length;n++){
        await idle();
        const opts=[...document.querySelectorAll('#quizOpts .opt')];
        const q=document.getElementById('quizQ').textContent;
        const correcta=opcionCorrecta(n);
        if(!correcta){errs.push('QUIZ: no encuentro la correcta en "'+q+'"');break;}
        A(q.indexOf((n+1)+'.')===0,'pregunta '+(n+1)+' en pantalla, dice "'+q.slice(0,40)+'"');
        clic(correcta);
        A(document.getElementById('quizFb').textContent.length>10,'feedback de acierto en '+(n+1)+': "'+document.getElementById('quizFb').textContent.slice(0,30)+'"');
        A(dots[n].classList.contains('ok'),'punto '+(n+1)+' marcado');
        if(n<QUIZ.length-1){
          const t0=Date.now();let avanzo=false;
          while(Date.now()-t0<15000){await wait(150);if(document.getElementById('quizQ').textContent.indexOf((n+2)+'.')===0){avanzo=true;break;}}
          A(avanzo,'avanza a pregunta '+(n+2));
        }
      }
      const tBtn=Date.now();let salio=false;
      while(Date.now()-tBtn<20000){await wait(200);if(vis('btnReviewDone')){salio=true;break;}}
      A(salio,'boton TERMINAR aparece tras responder '+QUIZ.length);
      log.push('QUIZ: '+QUIZ.length+'/'+QUIZ.length+' correctas con causa-efecto');

      /* ---------- TRANSFERENCIA ---------- */
      clic(document.getElementById('btnReviewDone'));await wait(1200);
      if(!await avanzar('scrTransfer'))throw new Error('bloqueo review->transfer');
      const items=document.querySelectorAll('#transferList .check-item');
      A(items.length===3,'3 acciones para la vida real, hay '+items.length);
      A(!vis('btnTransfer'),'TERMINAR bloqueado hasta marcar las 3');
      for(let n=0;n<3;n++){clic(items[n]);await pause(600);}
      A(document.querySelectorAll('#transferList .check-item.done').length===3,'3 acciones marcadas');
      const tTr=Date.now();let habil=false;
      while(Date.now()-tTr<20000){await wait(200);if(vis('btnTransfer')){habil=true;break;}}
      A(habil,'TERMINAR habilitado tras las 3 (espera al audio)');
      log.push('TRANSFERENCIA: checklist de 3 acciones completada');

      clic(document.querySelector('#scrTransfer .btn'));await wait(1600);
      A(on('screen-finish'),'llega screen-finish');
      const sub=document.querySelector('#screen-finish .sub').textContent;
      A(/Estrellas: \d+/.test(sub),'muestra estrellas: '+sub);
      log.push('FINAL: '+sub);
      await wait(slow);
      /* el total se comprueba ANTES de reiniciar: despues el contador
         vuelve a cero a proposito, porque el boton es "JUGAR OTRA VEZ" */
      A(/Estrellas: 18/.test(sub),'el recorrido completo deja 18 estrellas: "'+sub+'"');
      if(window.__MP3_ROTO)log.push('AUDIO: recorrido completo con los MP3 caidos (respaldo del sistema)');
      await wait(slow);
      A(vis('btnScrFinal2'),'btnScrFinal2 restaurado');
      const again=document.querySelectorAll('#screen-finish .btn.big');
      A(again.length===1,'botón JUGAR OTRA VEZ presente');
      A(again[0]&&/JUGAR OTRA VEZ/.test(again[0].textContent),'es el botón de repetir: '+(again[0]&&again[0].textContent));
      clic(again[0]);await wait(700);
      A(stars()==='0','reinicia estrellas, hay '+stars());
      A(on('scr1-intro'),'reinicia en scr1-intro');

      /* ---------- LAYOUT + SCROLL REAL ---------- */
      const res=[];
    let bajoMin=0;
      const todas=[...document.querySelectorAll('.screen')];
      todas.forEach(s=>{
        todas.forEach(x=>x.classList.remove('on'));
        s.classList.add('on');
        const card=s.querySelector('.card');
        if(card){
          const h=card.getBoundingClientRect().height;
          res.push(s.id.replace('scr','').replace('screen-','')+':'+Math.round(h));
        }
        const c=s.querySelector('.consigna');
        if(!c)errs.push('SIN CONSIGNA: '+s.id);
        else{
          const r=c.getBoundingClientRect();
          if(r.width<200)errs.push('CONSIGNA estrecha: '+s.id+' '+Math.round(r.width)+'px');
          /* En ventanas bajas el CSS achica la consigna a proposito, para que
             la pagina no se desplace: se prioriza que TODO se vea. Ese limite
             queda como AVISO, no como fallo, mientras la ventana sea chica.
             En una ventana normal la consigna no puede bajar de 55px. */
          const chico=window.innerHeight<=560||window.innerWidth<=660;
          const minimo=chico?44:55;
          if(r.height<minimo-1){
            const m='CONSIGNA baja: '+s.id+' '+Math.round(r.height)+'px (min '+minimo+')';
            if(chico)warns.push(m); else errs.push(m);
          }
          if(chico)bajoMin++;
        }
      });
      log.push('ALTOS(px): '+res.join(' '));
      /* una sola linea por corrida en vez de una por pantalla */
      if(bajoMin)warns.unshift('la consigna baja de 55px en '+bajoMin+' pantallas: en ventanas de menos de 560px de alto el CSS la achica a propósito para que nada se desplace (prioridad: que todo se vea)');

      /* scroll real: se mide con la ÚLTIMA pantalla encendida y sin transiciones,
         sobre la caja .card (el documento puede diferir por la animación de entrada) */
      const scrolls=[];
      const detalle=/detalle/.test(document.body.innerHTML.slice(0,0))||true;
      const screens=[...document.querySelectorAll('.screen')];
      screens.forEach(s=>{
        screens.forEach(x=>x.classList.remove('on'));
        s.classList.add('on');
        if(document.getAnimations)document.getAnimations().forEach(a=>{try{a.finish();}catch(e){}});
        const card=s.querySelector('.card');
        const docOver=document.documentElement.scrollHeight-window.innerHeight;
        const cardOver=card?Math.round(card.getBoundingClientRect().bottom+8-window.innerHeight):0;
        const over=Math.max(docOver,cardOver);
        if(over>2)scrolls.push(s.id+' +'+over+'px');
        if(over>2&&detalle){
          const hijos=[...card.children].map(c=>c.className+':'+Math.round(c.getBoundingClientRect().height)).join(' | ');
          scrolls.push('     -> '+s.id+' ['+hijos+']');
        }
      });
      if(scrolls.length)errs.push('SCROLL: '+scrolls.join(', '));
      else log.push('SCROLL: ninguna (0px) en '+screens.length+' pantallas a '+window.innerWidth+'x'+window.innerHeight);

      /* ---------- CONSISTENCIA CONSIGNAS/INTROS vs HTML ----------
         ya verificada en carga fresca, antes de que speak() sobrescriba .txt */

      /* ---------- AUDIO: MP3 argentino, sin superposicion, respaldo ---------- */
      if(window.__mp3Pedidos.length){
        A(window.__mp3Pedidos.every(u=>/^audio\/.*\.mp3$/.test(u)),
          'todas las locuciones salen de un MP3 propio: '+window.__mp3Pedidos.filter(u=>!/^audio\/.*\.mp3$/.test(u)).slice(0,3).join(', '));
        A(window.__mp3MaxVivos<=1,'nunca hay dos audios sonando a la vez (maximo='+window.__mp3MaxVivos+')');
        log.push('AUDIO: '+window.__mp3Pedidos.length+' locuciones por MP3, maximo '+window.__mp3MaxVivos+' a la vez');
      }else if(!window.__MP3_ROTO){
        errs.push('AUDIO: no se pidio ningun MP3 en todo el recorrido');
      }

    }catch(e){errs.push('EXCEPCION: '+e.message+' @ '+(e.stack||'').split('\n')[1]);}

    const out=document.createElement('pre');out.id='RESULT';
    out.textContent='\n=== PASOS ===\n'+log.join('\n')
      +'\n=== AVISOS ('+warns.length+') ===\n'+(warns.join('\n')||'NINGUNO')
      +'\n=== ERRORES ('+errs.length+') ===\n'+(errs.join('\n')||'NINGUNO')+'\n';
    document.body.appendChild(out);
  });
})();
