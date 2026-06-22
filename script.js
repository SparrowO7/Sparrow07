/* ==========================================================================
   SPARROW_07 — CINEMATIC ENGINE V4 (The "Wow" Update)
   ✦ Mouse Parallax ✦ Long Scroll ✦ Motion Blur ✦ Restart Logic
   ========================================================================== */
(function () {
  'use strict';

  const TOTAL = 240, DIR = 'frames/', EXT = '.jpg';

  const SCENES = [
    { id:'1',  from:0.00, to:0.08, num:1, name:'FIRST SPARK',  cam:{z0:1.0,z1:1.12,x0:0,x1:-20,y0:0,y1:-15}, flash:'warm', ambience:'morning' },
    { id:'1b', from:0.08, to:0.15, num:1, name:'FIRST SPARK',  cam:{z0:1.12,z1:1.16,x0:-20,x1:15,y0:-15,y1:8}, flash:'warm', ambience:'morning' },
    { id:'2',  from:0.15, to:0.28, num:2, name:'DISCOVERY',    cam:{z0:1.0,z1:1.15,x0:0,x1:0,y0:0,y1:-12}, flash:'cool', ambience:'room' },
    { id:'3',  from:0.28, to:0.42, num:3, name:'STORM',        cam:{z0:1.02,z1:1.20,x0:0,x1:-15,y0:0,y1:-8}, flash:'burn', ambience:'rain' },
    { id:'4',  from:0.42, to:0.56, num:4, name:'QUESTION',     cam:{z0:1.0,z1:1.10,x0:0,x1:12,y0:0,y1:0}, flash:'glitch', ambience:'drone' },
    { id:'5',  from:0.56, to:0.68, num:5, name:'ANSWER',       cam:{z0:1.0,z1:1.08,x0:0,x1:0,y0:0,y1:-8}, flash:'warm', ambience:'piano' },
    { id:'5b', from:0.68, to:0.76, num:5, name:'MEANING',      cam:{z0:1.0,z1:1.05,x0:0,x1:0,y0:0,y1:0}, flash:'', ambience:'piano' },
    { id:'6',  from:0.76, to:0.88, num:6, name:'DREAM',        cam:{z0:1.0,z1:1.12,x0:0,x1:-8,y0:0,y1:-8}, flash:'glitch', ambience:'piano' },
    { id:'7',  from:0.88, to:1.00, num:7, name:'OUTLOOK',      cam:{z0:1.0,z1:1.05,x0:0,x1:0,y0:0,y1:0}, flash:'warm', ambience:'morning' },
  ];

  const CRT = ['BOOT_SPARROW_07','','The beginning of...','','Curiosity.','Gaming.','Building.','Everything.'];

  const S = {
    frames: new Array(TOTAL).fill(null), readyShown: false,
    entered: false, progress: 0, target: 0, velocity: 0,
    sceneIdx: -1, prevSceneIdx: -1,
    crtLine:0, crtChar:0, crtBuf:'', crtRunning:false, crtDone:false,
    easterEgg: false, time: 0, lastScroll: 0,
    stars: [], dust: [],
    audioCtx: null, audioStarted: false, currentAmbience: ''
  };

  const cvs = document.getElementById('film-canvas');
  const ctx = cvs.getContext('2d');
  const $load = document.getElementById('loading-screen');
  const $bar = document.getElementById('loader-bar');
  const $pct = document.getElementById('loader-pct');
  const $enter = document.getElementById('enter-screen');
  const $btn = document.getElementById('enter-btn');
  const $hud = document.getElementById('scene-hud');
  const $hudNum = document.getElementById('hud-number');
  const $hudName = document.getElementById('hud-name');
  const $hudBar = document.getElementById('hud-bar-fill');
  const $hint = document.getElementById('scroll-hint');
  const $crt = document.getElementById('crt-typed');
  const $still = document.getElementById('still-building');
  const $texts = document.querySelectorAll('.scene-text');
  const $flash = document.getElementById('transition-flash');
  let dpr = 1, W = 1920, H = 1080;
  
  // Parallax tracking
  let mouseX = 0, mouseY = 0;

  // ══════════════ ROBUST HTML5 AUDIO SYSTEM ══════════════
  const AUDIO_FILES = {
    'morning': 'rural-village-courtyard-morning-atmosphere_062026.dat',
    'room': 'indoor-room-ambience-at-3_062026.dat',
    'rain': 'heavy-rain-hitting-a-tin_062026.dat',
    'drone': 'high-altitude-hilltop-atmosphere-at-night_062026.dat',
    'piano': 'minimalist-ambient-felt-piano-chords_062026.dat'
  };
  
  const VOLUMES = {
    'morning': 0.7, 'room': 0.5, 'rain': 0.35, 'drone': 0.8, 'piano': 1.0
  };

  const AUDIO_BUFFERS = {};
  let ac = null;
  let masterGain = null;
  let activeSceneNodes = [];
  let audioLoadedCount = 0;
  const totalAudio = Object.keys(AUDIO_FILES).length;

  function initAudio(onProgress) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      S.audioCtx = ac;
      S.audioStarted = true;
      masterGain = ac.createGain();
      masterGain.gain.value = 1.0;
      masterGain.connect(ac.destination);
    } catch(e) {}

    Object.entries(AUDIO_FILES).forEach(([key, url]) => {
      fetch(url)
        .then(res => res.arrayBuffer())
        .then(buffer => {
          if (!ac) throw new Error("No AudioContext");
          return ac.decodeAudioData(buffer);
        })
        .then(audioBuffer => {
          AUDIO_BUFFERS[key] = audioBuffer;
          audioLoadedCount++;
          if(onProgress) onProgress();
        })
        .catch(e => {
          audioLoadedCount++; 
          if(onProgress) onProgress();
        });
    });
  }

  function unlockAudio() {
    if (ac && ac.state === 'suspended') {
      ac.resume().catch(e => {});
    }
    if (ac) {
      try {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        gain.gain.value = 0;
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.01);
      } catch(e){}
    }
  }

  function fadeOutAndStop(nodes, fadeTime = 2) {
    nodes.forEach(item => {
      try {
        if (item.gainNode && ac.state === 'running') {
          item.gainNode.gain.cancelScheduledValues(ac.currentTime);
          item.gainNode.gain.linearRampToValueAtTime(0, ac.currentTime + fadeTime);
          setTimeout(() => { try { item.src.stop(); item.src.disconnect(); } catch(e){} }, fadeTime * 1000 + 100);
        } else if (item.src) {
           item.src.stop(); item.src.disconnect();
        }
      } catch(e){}
    });
  }

  function playAmbience(type) {
    if (!ac || S.currentAmbience === type) return;
    S.currentAmbience = type;
    
    fadeOutAndStop(activeSceneNodes, 2);
    activeSceneNodes = [];

    if (AUDIO_BUFFERS[type]) {
      try {
        const src = ac.createBufferSource();
        src.buffer = AUDIO_BUFFERS[type];
        src.loop = true;

        const g = ac.createGain();
        g.gain.value = VOLUMES[type] || 0.5;
        
        src.connect(g);
        g.connect(masterGain);
        src.start();
        
        activeSceneNodes.push({ src: src, gainNode: g });
      } catch(e) {}
    }
  }

  // ══════════════ CORE ENGINE ══════════════
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cvs.width = W * dpr; cvs.height = H * dpr;
    cvs.style.width = W + 'px'; cvs.style.height = H + 'px';
    initParticles();
  }

  function preload() {
    const key = []; for (let i = 0; i < TOTAL; i += 8) key.push(i);
    key.push(TOTAL - 1);
    const rest = []; for (let i = 0; i < TOTAL; i++) { if (!key.includes(i)) rest.push(i); }
    const order = [...key, ...rest];
    let idx = 0;

    function handleProgress() {
      const keyLoaded = key.filter(f => S.frames[f] !== null).length;
      const framePct = keyLoaded / key.length;
      const audioPct = audioLoadedCount / totalAudio;
      const pct = Math.round(((framePct + audioPct) / 2) * 100);
      
      $bar.style.width = pct + '%'; $pct.textContent = pct + '%';
      if (keyLoaded >= key.length && audioLoadedCount >= totalAudio && !S.readyShown) {
        S.readyShown = true;
        setTimeout(() => { $load.classList.add('done'); $enter.classList.remove('hidden'); }, 400);
      }
      if (idx < order.length) batch();
    }

    initAudio(handleProgress); 

    function batch() {
      const bs = 6;
      for (let b = 0; b < bs && idx < order.length; b++, idx++) {
        const n = order[idx], img = new Image();
        img.onload = () => { S.frames[n] = img; handleProgress(); };
        img.onerror = () => { handleProgress(); };
        img.src = DIR + String(n).padStart(4, '0') + EXT;
      }
    }

    batch();
  }

  function enter() {
    if (S.entered) return;
    unlockAudio(); 
    S.entered = true; S.progress = 0; S.target = 0;
    $enter.classList.add('fade-out');
    $hud.style.opacity = '1';
    $hint.style.opacity = '1';
    setTimeout(() => $hint.style.opacity = '0', 5000);
  }

  function ease(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function findScene(p) {
    for (let i = SCENES.length - 1; i >= 0; i--) if (p >= SCENES[i].from) return i;
    return 0;
  }
  function localP(p, s) { return Math.max(0, Math.min(1, (p - s.from) / (s.to - s.from))); }

  function setScene(idx) {
    if (idx === S.sceneIdx) return;
    S.prevSceneIdx = S.sceneIdx;
    S.sceneIdx = idx;
    const sc = SCENES[idx];
    $hudNum.textContent = String(sc.num).padStart(2, '0');
    $hudName.textContent = sc.name;

    if (S.prevSceneIdx >= 0 && sc.flash) {
      $flash.className = sc.flash;
      setTimeout(() => $flash.className = '', 350);
    }

    $texts.forEach(el => {
      if (el.dataset.scene === sc.id) { el.classList.add('active'); reveal(el); }
      else { el.classList.remove('active'); hide(el); }
    });
    if (sc.id === '1b' && !S.crtDone) startCrt();
    if (sc.id === '7' && !S.easterEgg) {
      S.easterEgg = true;
      setTimeout(() => { if (S.sceneIdx === idx) $still.classList.add('visible'); }, 3000);
    } else if (sc.id !== '7') { S.easterEgg = false; $still.classList.remove('visible'); }

    if (S.audioStarted && sc.ambience) playAmbience(sc.ambience);
  }

  function reveal(el) {
    el.querySelectorAll('.cinematic-line,.word-reveal,.be-the-reason,.outro-principle,.outro-brand,.outro-wip,.bp-node,.bp-line,.press-r-restart')
      .forEach(l => { const d = (parseInt(l.dataset.delay||'0'))*600; setTimeout(() => l.classList.add('visible'), d+300); });
  }
  function hide(el) {
    el.querySelectorAll('.cinematic-line,.word-reveal,.be-the-reason,.outro-principle,.outro-brand,.outro-wip,.bp-node,.bp-line,.press-r-restart')
      .forEach(l => l.classList.remove('visible'));
  }

  function startCrt() {
    if (S.crtRunning || S.crtDone) return;
    S.crtRunning = true; S.crtLine = 0; S.crtChar = 0; S.crtBuf = '';
    typeNext();
  }
  function typeNext() {
    if (!S.crtRunning) return;
    if (S.crtLine >= CRT.length) { S.crtDone = true; S.crtRunning = false; return; }
    const line = CRT[S.crtLine];
    if (line === '') { S.crtBuf += '\n'; S.crtLine++; S.crtChar = 0; $crt.innerHTML = S.crtBuf.replace(/\n/g,'<br>'); setTimeout(typeNext,250); return; }
    if (S.crtChar < line.length) { S.crtBuf += line[S.crtChar++]; $crt.innerHTML = S.crtBuf.replace(/\n/g,'<br>'); setTimeout(typeNext, 35+Math.random()*25); }
    else { S.crtBuf += '\n'; S.crtLine++; S.crtChar = 0; $crt.innerHTML = S.crtBuf.replace(/\n/g,'<br>'); setTimeout(typeNext,180); }
  }

  function initParticles() {
    S.stars = Array.from({length:100}, () => ({
      x:Math.random()*W, y:Math.random()*H*0.5, sz:Math.random()*1.5+0.3,
      ba:Math.random()*0.5+0.2, ts:Math.random()*3+1, ph:Math.random()*6.28
    }));
    S.dust = Array.from({length:60}, () => ({
      x:Math.random()*W, y:Math.random()*H, sz:Math.random()*2+0.5,
      vx:(Math.random()-0.5)*0.3, vy:-Math.random()*0.3-0.1,
      a:Math.random()*0.3+0.1, ph:Math.random()*6.28
    }));
  }

  function drawDust(alpha) {
    if (alpha <= 0) return;
    S.dust.forEach(d => {
      d.x += d.vx; d.y += d.vy;
      if (d.y < -10) { d.y = H+10; d.x = Math.random()*W; }
      if (d.x < -10) d.x = W+10; if (d.x > W+10) d.x = -10;
      const shimmer = Math.sin(S.time*2+d.ph)*0.3+0.7;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.sz, 0, 6.28);
      ctx.fillStyle = `rgba(255,240,200,${d.a*shimmer*alpha})`; ctx.fill();
    });
  }
  function drawStars(alpha) {
    if (alpha <= 0) return;
    S.stars.forEach(s => {
      const tw = Math.sin(S.time*s.ts+s.ph)*0.5+0.5;
      const al = s.ba*tw*alpha;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.sz, 0, 6.28);
      ctx.fillStyle = `rgba(220,230,255,${al})`; ctx.fill();
    });
  }

  function drawFrameWithCamera(img, cam, lp, isOutro) {
    if (!img) return;
    const t = ease(lp);
    const zoom = lerp(cam.z0, cam.z1, t);
    const panX = lerp(cam.x0, cam.x1, t);
    const panY = lerp(cam.y0, cam.y1, t);
    const ir = img.width / img.height, cr = W / H;
    let rw, rh;
    if (ir > cr) { rh = H * zoom; rw = rh * ir; }
    else { rw = W * zoom; rh = rw / ir; }
    
    // Depth of field / Motion blur effect based on velocity
    const speedBlur = Math.min(2, Math.abs(S.velocity) * 150);
    if (speedBlur > 0.5) ctx.filter = `blur(${speedBlur}px)`;
    else ctx.filter = 'none';

    // Mouse Parallax Offset
    const px = mouseX * 25;
    const py = mouseY * 25;

    const xo = (W - rw) / 2 + (panX * (W / 1920)) + px;
    const yo = (H - rh) / 2 + (panY * (H / 1080)) + py;
    ctx.drawImage(img, xo, yo, rw, rh);
    
    // Reset filter
    ctx.filter = 'none';
  }

  function getFrame(n) {
    if (S.frames[n]) return S.frames[n];
    for (let d = 1; d < 20; d++) {
      if (n+d < TOTAL && S.frames[n+d]) return S.frames[n+d];
      if (n-d >= 0 && S.frames[n-d]) return S.frames[n-d];
    }
    for (let i = 0; i < TOTAL; i++) if (S.frames[i]) return S.frames[i];
    return null;
  }

  function drawRewindGrain() {
    if (S.velocity >= 0) return;
    const strength = Math.min(1, Math.abs(S.velocity) * 50);
    if (strength < 0.05) return;
    ctx.save();
    ctx.globalAlpha = strength * 0.15;
    for (let y = 0; y < H; y += 3) {
      if (Math.random() > 0.7) { ctx.fillStyle = `rgba(255,255,255,${Math.random()*0.3})`; ctx.fillRect(0, y, W, 1); }
    }
    for (let i = 0; i < 20 * strength; i++) {
      ctx.fillStyle = `rgba(255,230,200,${Math.random()*0.4})`;
      ctx.fillRect(Math.random()*W, Math.random()*H, Math.random()*3+1, Math.random()*2+1);
    }
    ctx.restore();
  }

  function render(ts) {
    S.time = ts * 0.001;

    const d = S.target - S.progress;
    S.velocity = d * 0.1;
    S.progress = Math.abs(d) < 0.0003 ? S.target : S.progress + S.velocity;

    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = '#020202'; ctx.fillRect(0,0,W,H);

    if (!S.entered) {
      const f = getFrame(0);
      if (f) drawFrameWithCamera(f, {z0:1,z1:1.03,x0:0,x1:0,y0:0,y1:0}, (Math.sin(S.time*0.3)+1)/2);
      ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = '#000'; ctx.fillRect(0,0,W,H); ctx.restore();
      requestAnimationFrame(render); return;
    }

    const p = S.progress;
    const si = findScene(p);
    const sc = SCENES[si];
    const lp = localP(p, sc);
    $hudBar.style.width = (p*100)+'%';
    setScene(si);

    if (sc.id === '5b') {
      const g = ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,W*0.4);
      g.addColorStop(0,'rgba(15,10,5,1)'); g.addColorStop(1,'rgba(2,2,2,1)');
      ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    } else if (sc.id === '7') {
      const f = getFrame(TOTAL-1);
      if (f) drawFrameWithCamera(f, sc.cam, lp, true);
      ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = '#020208'; ctx.fillRect(0,0,W,H); ctx.restore();
      drawStars(Math.min(1, lp*2.5));
    } else {
      const videoP = Math.min(1, p / 0.88);
      const frameIdx = Math.min(TOTAL-1, Math.floor(videoP*(TOTAL-1)));
      const f = getFrame(frameIdx);
      if (f) drawFrameWithCamera(f, sc.cam, lp);
    }

    if (sc.id === '1' || sc.id === '1b') {
      drawDust(0.5);
      ctx.save(); ctx.globalAlpha = 0.06;
      const g = ctx.createRadialGradient(W*0.7,H*0.3,0,W*0.7,H*0.3,W*0.5);
      g.addColorStop(0,'rgba(255,185,84,1)'); g.addColorStop(1,'transparent');
      ctx.fillStyle = g; ctx.fillRect(0,0,W,H); ctx.restore();
    }
    if (sc.id === '3') {
      ctx.save(); ctx.globalAlpha = 0.08; ctx.fillStyle = '#001828'; ctx.fillRect(0,0,W,H); ctx.restore();
    }
    if (sc.id === '4') {
      ctx.save(); ctx.globalAlpha = 0.05;
      const g = ctx.createLinearGradient(0,H,0,H*0.5);
      g.addColorStop(0,'rgba(0,212,230,1)'); g.addColorStop(1,'transparent');
      ctx.fillStyle = g; ctx.fillRect(0,0,W,H); ctx.restore();
    }

    if (sc.id !== '5b' && sc.id !== '7' && lp > 0.15 && lp < 0.85) {
      ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = '#000'; ctx.fillRect(0,0,W,H); ctx.restore();
    }

    drawRewindGrain();
    requestAnimationFrame(render);
  }

  // ══════════════ EVENTS ══════════════
  window.addEventListener('resize', resize);
  $btn.addEventListener('click', enter);
  
  window.addEventListener('mousemove', e => {
    if (!S.entered) return;
    mouseX = (e.clientX / W) * 2 - 1;
    mouseY = (e.clientY / H) * 2 - 1;
  });

  document.addEventListener('keydown', e => {
    if (!S.entered) {
      if (e.key==='Enter'||e.key===' ') { e.preventDefault(); enter(); }
      return;
    }
    if (e.key==='ArrowDown'||e.key==='PageDown') { e.preventDefault(); S.target=Math.min(1,S.target+0.015); }
    if (e.key==='ArrowUp'||e.key==='PageUp') { e.preventDefault(); S.target=Math.max(0,S.target-0.015); }
    if (e.key.toLowerCase()==='r') restartJourney();
  });

  window.addEventListener('wheel', e => {
    if (!S.entered) return;
    e.preventDefault();
    let d = e.deltaY;
    if (e.deltaMode === 1) d *= 40;
    if (e.deltaMode === 2) d *= 800;
    S.target = Math.max(0, Math.min(1, S.target + d * 0.00007)); // SCROLL LENGTH INCREASED: Cinematic pacing
    S.lastScroll = S.time;
  }, { passive: false });

  let ty = 0;
  window.addEventListener('touchstart', e => { ty=e.touches[0].clientY; }, {passive:true});
  window.addEventListener('touchmove', e => {
    if (!S.entered) return; e.preventDefault();
    const d = (ty-e.touches[0].clientY)*0.0006; 
    ty=e.touches[0].clientY; // THIS WAS MISSING!
    S.target = Math.max(0, Math.min(1, S.target+d));
    S.lastScroll = S.time;
  }, {passive:false});

  function restartJourney() {
    S.target = 0; S.progress = 0; S.velocity = 0;
    S.easterEgg = false; $still.classList.remove('visible');
    $hint.style.opacity = '1'; setTimeout(() => $hint.style.opacity = '0', 5000);
  }

  const $restartBtn = document.querySelector('.press-r-restart');
  if ($restartBtn) $restartBtn.addEventListener('click', restartJourney);

  resize();
  preload();
  requestAnimationFrame(render);
})();
