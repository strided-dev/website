/* Take 7's demo carousel, now advancing by itself (two loops of each demo), with the backdrop code moved to site.js.
   Replace videoSrc with a local MP4/WebM path when a recording is ready.
   A configured video replaces the entire app preview, not a panel inside it. */
(() => {
  'use strict';
  const demos = [
    {
      key: 'papers', videoSrc: '', posterSrc: '',
      attachment: 'Attached papers-ml · 4 files',
      question: 'Summarize the papers in here.',
      activity: 'Reading papers', detail: 'Selecting relevant passages',
      title: 'Four papers, one request.',
      caption: 'Iris selects relevant passages and reads in parallel.'
    },
    {
      key: 'code', videoSrc: '', posterSrc: '',
      attachment: 'Code workflow · animated concept',
      question: 'Help me build a two-player Connect Four game.',
      activity: 'Working on the code', detail: 'Building a first pass',
      title: 'Start with an idea.',
      caption: 'Work through a coding task with Iris, on your computer.'
    },
    {
      key: 'email', videoSrc: '', posterSrc: '',
      attachment: 'Email workflow · animated concept',
      question: 'Help me draft an email to a friend.',
      activity: 'Preparing a draft', detail: 'Reviewing a first draft',
      title: 'A draft you can make your own.',
      caption: 'Find the words, then give them your own voice.'
    },
    {
      key: 'web', videoSrc: '', posterSrc: '',
      attachment: 'Web workflow · animated concept',
      question: 'Find an answer and show me the sources.',
      activity: 'Looking for sources', detail: 'Finding relevant information',
      title: 'An answer with somewhere to look.',
      caption: 'Research a question and follow the supporting sources.'
    }
  ];

  const root = document.getElementById('arkaya-site');
  if (!root) return;
  const viewport = document.scrollingElement || document.documentElement;
  const section = root.querySelector('.ark-demos');
  if (!section) return;
  const track = root.querySelector('.ark-track');
  const template = root.querySelector('#ark-demo-template');
  const caption = root.querySelector('.ark-caption');
  const motionButton = root.querySelector('.ark-motion-toggle');
  const note = root.querySelector('.ark-preview-note');
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  /* Each demo GIF loops in 2.88 s: let it play through once and a half, about 4 s, then glide on. Touching the carousel pauses it for a while;
     it then carries on by itself. Keyboard focus and the Pause motion button stop it outright. */
  const AUTO_ADVANCE_MS = 4200;
  const RESUME_MS = 6000;
  let resumeTimer = null;
  const failedVideos = new Set();
  let reduced = preference.matches;
  let paused = reduced;
  let inView = typeof IntersectionObserver === 'undefined';
  let currentSlot = 1;
  let manualInteraction = false;
  let hovering = false;
  let focused = false;
  let dragging = null;
  let autoTimer = null;
  let settleTimer = null;
  let scrollFrame = false;
  let lastWidth = 0;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const states = [];

  // End clones let either arrow cross the first/last boundary seamlessly.
  const order = [demos.length-1, ...demos.map((_,i)=>i), 0];
  order.forEach((index,slot) => {
    const demo = demos[index];
    const slide = document.createElement('div');
    slide.className = 'ark-slide';
    slide.setAttribute('role','group');
    slide.setAttribute('aria-roledescription','slide');
    slide.setAttribute('aria-label',demo.title);
    slide.setAttribute('aria-hidden','true');
    slide.inert = true;
    const stage = template.content.firstElementChild.cloneNode(true);
    slide.appendChild(stage);
    track.appendChild(slide);
    const state = {
      demo, index, slot, slide, stage,
      app:stage.querySelector('.ark-app'),
      image:stage.querySelector('.ark-demo-motion'),
      video:stage.querySelector('.ark-recording'),
      start:stage.querySelector('.ark-video-start')
    };
    for (const [selector,key] of [
      ['.ark-attachment','attachment'],['.ark-user-message','question'],
      ['.ark-activity-title','activity'],['.ark-activity-detail','detail']
    ]) stage.querySelector(selector).textContent=demo[key];
    state.image.alt='Illustrative '+demo.key+' workflow animation';
    state.image.src='assets/demos/'+demo.key+'-still.png';
    state.video.addEventListener('error',()=>{
      if (!state.video.hidden) {
        failedVideos.add(demo.key);
        updatePlayback();
      }
    });
    state.video.addEventListener('playing',()=>{state.start.hidden=true;});
    state.start.addEventListener('click',()=>{
      stopAutomatic(); paused=false; updatePlayback();
    });
    states.push(state);
  });

  /* The thin gold arc around the next arrow traces the time left on the current demo. */
  const timerRing = root.querySelector('.ark-next');
  if (timerRing) timerRing.style.setProperty('--ark-slide-ms', AUTO_ADVANCE_MS+'ms');
  function ring(on) {
    if (!timerRing) return;
    timerRing.classList.remove('timing');
    if (on) { void timerRing.offsetWidth; timerRing.classList.add('timing'); }
  }
  function clearAutomatic() {
    if (autoTimer!==null) clearTimeout(autoTimer);
    autoTimer=null;
    ring(false);
  }
  function stopAutomatic() {
    manualInteraction=true;
    clearAutomatic();
    clearTimeout(resumeTimer);
    resumeTimer=setTimeout(()=>{manualInteraction=false;scheduleAutomatic();},RESUME_MS);
  }
  function scheduleAutomatic() {
    clearAutomatic();
    if (manualInteraction || reduced || paused || !inView || document.hidden || hovering || focused || dragging) return;
    autoTimer=setTimeout(()=>{
      autoTimer=null;
      moveRelative(1,false);
    },AUTO_ADVANCE_MS);
    ring(true);
  }

  function updatePlayback() {
    const allow=!paused && inView && !document.hidden;
    states.forEach(state=>{
      const selected=state.slot===currentSlot;
            const src='assets/demos/'+state.demo.key+(allow && selected?'.gif':'-still.png');
      if (state.image.getAttribute('src')!==src) state.image.src=src;
      const useVideo=selected && state.demo.videoSrc && !failedVideos.has(state.demo.key);
      state.video.hidden=!useVideo;
      state.app.hidden=Boolean(useVideo);
      state.start.hidden=true;
      if (!useVideo || !allow) state.video.pause();
      if (useVideo) {
        if (state.video.getAttribute('src')!==state.demo.videoSrc) {
          state.video.src=state.demo.videoSrc;
          if (state.demo.posterSrc) state.video.poster=state.demo.posterSrc;
          state.video.load();
        }
        if (allow) {
          const promise=state.video.play();
          if (promise && promise.catch) promise.catch(()=>{
            if (currentSlot===state.slot && !state.video.hidden && !paused && inView && !document.hidden) state.start.hidden=false;
          });
        }
      }
    });
    const state=states[currentSlot];
    note.textContent=state.demo.videoSrc && !failedVideos.has(state.demo.key)?'Recorded demo':'Animated interface concept · recordings coming soon';
    if (motionButton) { motionButton.textContent=paused?'Play motion':'Pause motion'; motionButton.setAttribute('aria-pressed',String(paused)); }
  }

  function leftFor(slot) {
    const slide=states[slot].slide;
    return Math.max(0,slide.offsetLeft-(track.clientWidth-slide.offsetWidth)/2);
  }
  function nearestSlot() {
    let best=0, distance=Infinity;
    states.forEach(state=>{
      const d=Math.abs(track.scrollLeft-leftFor(state.slot));
      if (d<distance) {distance=d;best=state.slot;}
    });
    return best;
  }
  function paintSlides() {
    const box=track.getBoundingClientRect();
    const center=box.left+track.clientWidth/2;
    const distances=states.map(state=>{
      const rect=state.slide.getBoundingClientRect();
      return clamp(Math.abs(rect.left+rect.width/2-center)/Math.max(1,state.slide.offsetWidth),0,1);
    });
    states.forEach((state,i)=>{
      state.slide.style.opacity=String(1-.8*distances[i]);
      state.slide.style.transform=reduced?'none':'scale('+(1-.06*distances[i])+')';
    });
    scrollFrame=false;
  }
  function setCurrent(slot,announce=false) {
    currentSlot=slot;
    const state=states[slot];
    states.forEach(item=>{
      const selected=item.slot===slot;
      item.slide.classList.toggle('is-active',selected);
      item.slide.setAttribute('aria-hidden',String(!selected));
      item.slide.inert=!selected;
    });
    root.querySelectorAll('[data-demo]').forEach(button=>{
      button.setAttribute('aria-pressed',String(Number(button.dataset.demo)===state.index));
    });
    caption.setAttribute('aria-live',announce?'polite':'off');
    caption.querySelector('h3').textContent=state.demo.title;
    caption.querySelector('p').textContent=state.demo.caption;
    updatePlayback();
  }
  function canonicalSlot(slot) {
    return slot===0?demos.length:slot===states.length-1?1:slot;
  }
  function settle() {
    if (dragging) return;
    clearTimeout(settleTimer);
    let slot=nearestSlot();
    const canonical=canonicalSlot(slot);
    if (canonical!==slot) {
      track.scrollTo({left:leftFor(canonical),behavior:'auto'});
      slot=canonical;
    }
    if (currentSlot!==slot) setCurrent(slot,manualInteraction);
    paintSlides();
    scheduleAutomatic();
  }
  function goTo(slot,manual=false,animate=true) {
    if (manual) stopAutomatic();
    clearAutomatic();
    setCurrent(slot,manual);
    const left=leftFor(slot);
    track.scrollTo({left,behavior:animate&&!reduced?'smooth':'auto'});
    clearTimeout(settleTimer);
    // Also settle when the selected slide was already centered (no scroll event).
    settleTimer=setTimeout(settle,animate&&!reduced?650:0);
  }
  function moveRelative(delta,manual=true) {
    const canonical=canonicalSlot(currentSlot);
    if (canonical!==currentSlot) {
      track.scrollTo({left:leftFor(canonical),behavior:'auto'});
      setCurrent(canonical,false);
    }
    goTo(currentSlot+delta,manual);
  }

  root.querySelectorAll('[data-demo]').forEach(button=>{
    button.addEventListener('click',()=>goTo(Number(button.dataset.demo)+1,true));
  });
  root.querySelectorAll('[data-direction]').forEach(button=>{
    button.addEventListener('click',()=>moveRelative(Number(button.dataset.direction),true));
  });
  root.querySelectorAll('[data-jump]').forEach(button=>{
    button.addEventListener('click',()=>{
      const key=button.dataset.jump;
      const target=key==='top'?0:(root.querySelector('#ark-'+key)||document.body).getBoundingClientRect().top+viewport.scrollTop-92;
      window.scrollTo({top:Math.max(0,target),behavior:reduced?'auto':'smooth'});
    });
  });
  track.addEventListener('scroll',()=>{
    if (!scrollFrame) {scrollFrame=true;requestAnimationFrame(paintSlides);}
    clearTimeout(settleTimer);
    settleTimer=setTimeout(settle,160);
  },{passive:true});

  // keyboard focus holds the carousel still; a mouse click on an arrow (which also focuses it) does not
  section.addEventListener('focusin',event=>{
    focused=event.target.matches(':focus-visible');
    if (focused) clearAutomatic();
  });
  section.addEventListener('focusout',event=>{
    focused=Boolean(event.relatedTarget && section.contains(event.relatedTarget));
    scheduleAutomatic();
  });
  section.addEventListener('pointerdown',stopAutomatic,{passive:true});
  section.addEventListener('wheel',event=>{
    if (event.deltaX || event.shiftKey) stopAutomatic();   // a sideways swipe on the carousel; page scrolling is not
    // Horizontal trackpad/shift-wheel gestures remain native; vertical wheel
    // input continues scrolling the page normally.
    if (event.shiftKey && !event.deltaX && event.deltaY) {
      event.preventDefault();
      track.scrollBy({left:event.deltaY,behavior:'auto'});
    }
  },{passive:false});
  section.addEventListener('keydown',event=>{
    if (event.key==='Tab' || event.key==='Shift') return;
    if (event.key==='ArrowLeft' || event.key==='ArrowRight') {
      event.preventDefault();moveRelative(event.key==='ArrowLeft'?-1:1,true);
    }
  });

  // Touch uses native scrolling. Add desktop click-and-drag without hijacking
  // ordinary clicks on the playback button.
  track.addEventListener('pointerdown',event=>{
    if (event.pointerType!=='mouse' || event.button!==0 || event.target.closest('button,video')) return;
    stopAutomatic();
    dragging={id:event.pointerId,x:event.clientX,left:track.scrollLeft,moved:false};
  });
  track.addEventListener('pointermove',event=>{
    if (!dragging || event.pointerId!==dragging.id) return;
    const dx=event.clientX-dragging.x;
    if (!dragging.moved && Math.abs(dx)<6) return;
    if (!dragging.moved) {
      dragging.moved=true;track.classList.add('is-dragging');track.setPointerCapture(event.pointerId);
    }
    event.preventDefault();track.scrollLeft=dragging.left-dx;
  });
  function finishDrag(event) {
    if (!dragging || event.pointerId!==dragging.id) return;
    const moved=dragging.moved;
    dragging=null;track.classList.remove('is-dragging');
    if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
    if (moved) goTo(nearestSlot(),true);
    else settle();
  }
  track.addEventListener('pointerup',finishDrag);
  track.addEventListener('pointercancel',finishDrag);
  window.addEventListener('pointerup',finishDrag);
  window.addEventListener('pointercancel',finishDrag);
  track.addEventListener('dragstart',event=>event.preventDefault());
  if (motionButton) motionButton.addEventListener('click',()=>{
    paused=!paused;updatePlayback();scheduleAutomatic();
  });
  if (typeof IntersectionObserver!=='undefined') {
    new IntersectionObserver(entries=>{
      inView=entries[0].isIntersecting && entries[0].intersectionRatio>=.15;
      updatePlayback();scheduleAutomatic();
    },{threshold:[0,.15]}).observe(track);
  }
  if (preference.addEventListener) preference.addEventListener('change',event=>{
    reduced=event.matches;paused=reduced;updatePlayback();paintSlides();scheduleAutomatic();
  });
  document.addEventListener('visibilitychange',()=>{updatePlayback();scheduleAutomatic();});
  function recenter() {
    if (lastWidth!==track.clientWidth) {
      lastWidth=track.clientWidth;
      track.scrollTo({left:leftFor(currentSlot),behavior:'auto'});
      paintSlides();
    }
  }
  window.addEventListener('resize',recenter,{passive:true});
  if (typeof ResizeObserver!=='undefined') new ResizeObserver(recenter).observe(root);
  setCurrent(1,false);
  recenter();
  scheduleAutomatic();
})();
