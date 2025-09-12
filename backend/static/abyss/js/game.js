// ================= Angry Whales — Abyss Run (game.js) =====================
// Difficulté progressive (mines groupées "portes" avec couloir sûr), Fog + rapide,
// séparation Desktop/Mobile maintenue, Safari ok.
// ==========================================================================

(function () {
  "use strict";

  // ---------- Détection plateforme (séparation Desktop / Mobile) ----------
  const IS_MOBILE =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "") ||
    (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches);

  // ---------- Identité joueur ----------
  function getParam(name){ return new URLSearchParams(window.location.search).get(name); }
  function saveIdentity(pid, handle){
    if (pid)    localStorage.setItem('player_id', pid);
    if (handle) localStorage.setItem('handle', decodeURIComponent(handle));
  }
  function getIdentity(){
    return {
      player_id: localStorage.getItem('player_id') || null,
      handle:    localStorage.getItem('handle') || null
    };
  }
  (function initIdentityFromQuery(){
    const pid = getParam('player_id');
    const handle = getParam('handle');
    if (pid || handle){
      saveIdentity(pid, handle);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  })();

  // ---------- Canvas responsive ----------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  const TARGET_ASPECT = 16 / 9;

  function fitCanvas() {
    const frame = canvas.parentElement || document.body;
    const cssW = Math.max(320, Math.floor(frame.clientWidth));
    const cssH = Math.floor(cssW / TARGET_ASPECT);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = cssW;
    canvas.height = cssH;
  }
  fitCanvas();
  addEventListener("resize", fitCanvas);
  addEventListener("orientationchange", () => setTimeout(fitCanvas, 90));

  const W = () => canvas.width;
  const H = () => canvas.height;

  // ---------- Utils ----------
  function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^a>>>15,1|a);t=(t+Math.imul(t^t>>>7,61|t))^t;return((t^t>>>14)>>>0)/4294967296;};}
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

  async function postJSON(url, payload){
    const res = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`POST ${url} → ${res.status}`);
    return res.json();
  }

  // ---------- State ----------
  const state = {
    running: false,
    score: 0,
    lives: 4,
    elapsed: 0,
    baseSpeed: 240,
    rng: mulberry32(Date.now() & 0xffffffff),

    // timers
    orbTimer: 0.6,
    mineTimer: 0.9,
    orcaTimer: 2.8,
    heartTimer: 120.0,
    nextHeartAt: 120.0,

    // cooldown portes de mines
    gateCooldown: 0
  };

  function difficulty() {
    // 0 → ~0.6 entre 0 et 2000 XP, puis jusqu’à ~1.0 vers 5000+
    const s = state.score;
    const a = clamp(s / 2000, 0, 1) * 0.6;     // montée rapide
    const b = clamp((s-2000)/3000, 0, 1) * 0.4; // finition douce
    return clamp(a + b, 0, 1);
  }

  function worldSpeed(){
    const scale = W() / 820;
    const d = difficulty();
    // Légère montée de la vitesse globale avec la difficulté
    const speedMul = 1 + d * 0.18;
    return state.baseSpeed * speedMul * scale * (player.boost ? 1.6 : 1.0);
  }
  function orcaSpeedFactor(){
    const minutes = Math.floor(state.elapsed / 60);
    return Math.min(1.0 + minutes * 0.2, 1.5);
  }

  // ---------- Player ----------
  const player = {
    x: () => W() * 0.20,
    y:  H() * 0.50,
    vy: 0,
    radius: 18,
    accelY: 900,
    maxVy: 520,
    damping: 5.0,
    jumpImpulse: 360,
    boost: false,
    bubbleTimer: 0,
    tilt: 0
  };

  // ---------- Sprites (✅ chemins relatifs) ----------
  function loadSprite(paths){
    const img=new Image(); let ready=false, i=0;
    function next(){ if(i>=paths.length) return; img.src=paths[i++]; img.onload=()=>ready=true; img.onerror=next; }
    next();
    return {img, get ready(){return ready;}}; }

  const sprites = {
    whale: loadSprite(["static/abyss/img/whale.png"]),
    orca : loadSprite(["static/abyss/img/orca.png"]),
    orb  : loadSprite(["static/abyss/img/orb.png"]),
    mine : loadSprite(["static/abyss/img/mine.png"]),
    heart: loadSprite(["static/abyss/img/heart.png"])
  };

  // ---------- Audio (✅ chemins relatifs) ----------
  function loadAudio(candidates, {loop=false, volume=1.0} = {}){
    const a = new Audio();
    a.preload = "auto";
    a.loop = loop;
    a.volume = volume;
    for (const url of candidates){ a.src = url; break; }
    return a;
  }
  const audio = {
    bgm: loadAudio([
      "static/abyss/sfx/music.mp3",
      "static/abyss/sfx/music.ogg",
      "static/abyss/sfx/music.wav",
    ], {loop:true, volume:0.6}),
    orb: loadAudio([
      "static/abyss/sfx/orb.wav",
      "static/abyss/sfx/orb.mp3",
    ], {volume:0.7}),
    explosion: loadAudio([
      "static/abyss/sfx/explosion.mp3",
      "static/abyss/sfx/explosion.wav",
    ], {volume:0.85}),
    heart: loadAudio([
      "static/abyss/sfx/HEARTZEMI.mp3",
      "static/abyss/sfx/heart.mp3",
      "static/abyss/sfx/heart.wav",
    ], {volume:0.9}),
  };
  window.audio = audio;

  let musicEnabled = true;
  let sfxEnabled   = true;

  // ---------- UI ----------
  const btnMusic   = document.getElementById("music");
  const btnSfx     = document.getElementById("sfx");
  const rangeMusic = document.getElementById("musicToggle");
  const musicVolLabel = document.getElementById("musicVol");
  const btnPlay    = document.getElementById("play");
  const btnRestart = document.getElementById("restart");

  function updateMusicButton(){
    if(!btnMusic) return;
    btnMusic.setAttribute("aria-pressed", String(musicEnabled));
    btnMusic.textContent = musicEnabled ? "🎵 Music: On" : "🎵 Music: Off";
  }
  function updateSfxButton(){
    if(!btnSfx) return;
    btnSfx.setAttribute("aria-pressed", String(sfxEnabled));
    btnSfx.textContent = sfxEnabled ? "🔊 SFX: On" : "🔊 SFX: Off";
  }
  function setMusicVolumeFromSlider(){
    if(!rangeMusic) return;
    const val = Number(rangeMusic.value||"100");
    const volume = clamp(val/100, 0, 1);
    audio.bgm.volume = volume;
    if (musicVolLabel) musicVolLabel.textContent = Math.round(volume*100) + "%";
  }
  updateMusicButton();
  updateSfxButton();
  setMusicVolumeFromSlider();

  btnMusic && btnMusic.addEventListener("click", () => {
    musicEnabled = !musicEnabled;
    updateMusicButton();
    try { musicEnabled && state.running ? audio.bgm.play() : audio.bgm.pause(); } catch {}
  });
  btnSfx && btnSfx.addEventListener("click", () => {
    sfxEnabled = !sfxEnabled;
    updateSfxButton();
  });
  rangeMusic && rangeMusic.addEventListener("input", setMusicVolumeFromSlider);

  btnPlay && btnPlay.addEventListener("click", () => {
    if (!state.running) startRun();
  });
  btnRestart && btnRestart.addEventListener("click", () => {
    hideGameOverOverlay();
    resetGame();
  });

  function startRun(){
    state.running = true;
    try { if (musicEnabled) audio.bgm.play(); } catch {}
  }
  function resetGame(){
    try{ audio.bgm.pause(); audio.bgm.currentTime = 0; }catch{}
    state.running=false; state.score=0; state.lives=4; state.elapsed=0;
    orbs.length=0; mines.length=0; orcas.length=0; hearts.length=0;
    explosions.length=0; flashes.length=0;
    fogSprites.length=0; fogSpawnBucket=0; fogSeqIndex=0;
    player.y=H()*0.5; player.vy=0; player.tilt=0; player.boost=false;
    state.orbTimer=0.8; state.mineTimer=1.2; state.orcaTimer=3.2;
    state.heartTimer=120.0; state.nextHeartAt=120.0;
    state.gateCooldown = 0;
    waterU=0;
  }

  function playSfx(sample, volMul=1.0){
    if (!sfxEnabled || !sample) return;
    const a = sample.cloneNode(true);
    a.volume = clamp((sample.volume||1)*volMul, 0, 1);
    try{ a.play(); }catch{}
  }

  // ---------- Soumission du score ----------
  let lastSubmitted = { score: 0, xp: 0, level: 1 };
  async function submitBestRun() {
    const { player_id } = getIdentity();
    if (!player_id) return;
    const payload = {
      player_id,
      score: Math.max(0, Math.floor(state.score)),
      xp:    Math.max(0, Math.floor(state.score)),
      level: Math.max(1, Math.floor(1 + state.score / 200))
    };
    if (payload.score <= lastSubmitted.score && payload.xp <= lastSubmitted.xp) return;
    try { await postJSON('api/submit-score', payload); lastSubmitted = payload; }
    catch(e){ console.warn('submit-score failed:', e); }
  }

  // ---------- Input (séparé Desktop / Mobile) ----------
  const keys=new Set();
  let mobUp=false, mobDown=false;

  if (!IS_MOBILE) {
    addEventListener("keydown",e=>{
      const k=e.key.toLowerCase();
      if (["arrowup","arrowdown","w","s"," ","r","shift"].includes(k)) e.preventDefault();
      if (k==="r") { hideGameOverOverlay(); resetGame(); }
      if (k==="shift") player.boost=true;
      if (k===" ") doJump();
      keys.add(k);
    }, {passive:false});

    addEventListener("keyup",e=>{
      const k=e.key.toLowerCase();
      if (k==="shift") player.boost=false;
      keys.delete(k);
    });
  }

  function doJump(){ player.vy = Math.max(player.vy - player.jumpImpulse, -player.maxVy); }

  // Mobile : drag + double-tap boost
  const mobileCtrl = {
    active: false,
    lastTap: 0,
    boostTouchId: null,
    targetY: null
  };

  function canvasPointFromTouch(t){
    const rect = canvas.getBoundingClientRect();
    const x = (t.clientX - rect.left) * (canvas.width / rect.width);
    const y = (t.clientY - rect.top)  * (canvas.height / rect.height);
    return {x,y};
  }

  function onTouchStart(e){
    if (!e.changedTouches || e.changedTouches.length===0) return;
    const t = e.changedTouches[0];
    const now = performance.now();
    const dtTap = now - mobileCtrl.lastTap;

    const p = canvasPointFromTouch(t);
    mobileCtrl.active = true;
    mobileCtrl.targetY = p.y;

    if (dtTap < 300){
      player.boost = true;
      mobileCtrl.boostTouchId = t.identifier;
    }
    mobileCtrl.lastTap = now;
    e.preventDefault();
  }
  function onTouchMove(e){
    if (!mobileCtrl.active) return;
    const t = e.changedTouches[0];
    const p = canvasPointFromTouch(t);
    mobileCtrl.targetY = p.y;
    e.preventDefault();
  }
  function onTouchEnd(e){
    if (!e.changedTouches || e.changedTouches.length===0) return;
    for (const t of e.changedTouches){
      if (t.identifier === mobileCtrl.boostTouchId){
        player.boost = false;
        mobileCtrl.boostTouchId = null;
      }
    }
    if (e.touches.length === 0){
      mobileCtrl.active = false;
      mobileCtrl.targetY = null;
      player.boost = false;
      mobileCtrl.boostTouchId = null;
    }
    e.preventDefault();
  }

  if (IS_MOBILE) {
    canvas.addEventListener("touchstart", onTouchStart, {passive:false});
    canvas.addEventListener("touchmove",  onTouchMove,  {passive:false});
    canvas.addEventListener("touchend",   onTouchEnd,   {passive:false});
    canvas.addEventListener("touchcancel",onTouchEnd,   {passive:false});

    document.addEventListener('touch:up:down',   ()=>{ mobUp=true; },  false);
    document.addEventListener('touch:up:up',     ()=>{ mobUp=false; }, false);
    document.addEventListener('touch:down:down', ()=>{ mobDown=true;}, false);
    document.addEventListener('touch:down:up',   ()=>{ mobDown=false;},false);
    document.addEventListener('boost:start',     ()=>{
      player.boost = true;
      setTimeout(()=>{ if (!mobileCtrl.active) player.boost=false; }, 1200);
    }, false);
  }

  // ---------- Visibility ----------
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      try{ audio.bgm.pause(); }catch{}
    } else {
      try{ if (musicEnabled && state.running) audio.bgm.play(); }catch{}
    }
  });

  // ---------- Water (strip miroir offscreen) ----------
  const WATER_CANDIDATES = ["static/abyss/img/water.png","static/abyss/img/Water.png"];
  const waterTex = new Image(); let waterReady=false;
  let strip=null, stripCtx=null, stripW=0, stripH=0, waterU=0;

  (function loadWater(){
    let i=0;
    const next=()=>{ if(i>=WATER_CANDIDATES.length) return; waterTex.src=WATER_CANDIDATES[i++]; waterTex.onload=()=>{waterReady=true; buildStrip();}; waterTex.onerror=next; };
    next();
  })();

  function buildStrip(){
    const iw = waterTex.width, ih = waterTex.height;
    stripW = iw * 2; stripH = ih;
    strip = document.createElement("canvas"); strip.width=stripW; strip.height=stripH;
    stripCtx = strip.getContext("2d");
    stripCtx.drawImage(waterTex, 0, 0, iw, ih);
    stripCtx.save(); stripCtx.translate(iw*2, 0); stripCtx.scale(-1, 1);
    stripCtx.drawImage(waterTex, 0, 0, iw, ih); stripCtx.restore();
  }

  const VIEW_FRACTION = 0.5;
  const SOURCE_Y_ANCHOR = 0.20;

  function drawWater(dt){
    const cw=W(), ch=H();

    if (!waterReady || !strip){
      const g = ctx.createLinearGradient(0,0,0,ch);
      g.addColorStop(0,"#39d5d2"); g.addColorStop(1,"#0a7390");
      ctx.fillStyle=g; ctx.fillRect(0,0,cw,ch);
      return;
    }

    const iw=waterTex.width, ih=waterTex.height;
    const targetAspect = cw/ch;
    const sw0 = iw*VIEW_FRACTION, sh0 = ih*VIEW_FRACTION;
    let sw=sw0, sh=sh0;
    if (sw/sh > targetAspect) sw = sh*targetAspect; else sh = sw/targetAspect;

    const syMax = ih - sh;
    let sy = clamp(ih*SOURCE_Y_ANCHOR - sh*0.5, 0, syMax);

    const destScale = cw / sw;
    const bgFollow  = 0.95;
    const pxPerSecInSource = (worldSpeed() * bgFollow) / destScale;
    waterU = (waterU + (state.running ? pxPerSecInSource * dt : 0)) % stripW;

    let u = waterU; if (u < 0) u += stripW;
    const needSplit = (u + sw) > stripW;
    const dh = ch, dw = cw, dy = 0;

    if (!needSplit) {
      ctx.drawImage(strip, u,   sy, sw, sh, 0,   dy, dw, dh);
    } else {
      const w1 = stripW - u;
      const w2 = sw - w1;
      const dw1 = (w1 / sw) * dw;
      ctx.drawImage(strip, u,   sy, w1, sh, 0,   dy, dw1, dh);
      ctx.drawImage(strip, 0.0, sy, w2, sh, dw1, dy, dw-dw1, dh);
    }
  }

  // ---------- Entities ----------
  const orbs=[];     // {x,y,r,phase}
  const mines=[];    // {x,y,w,h, explosive?, blinking?, blinkCount, blinkTimer, exploded?}
  const orcas=[];    // {x,y,w,h,vy,phase}
  const hearts=[];   // {x,y,s}

  const rand=(a,b)=>a+(b-a)*state.rng();

  function spawnOrb(){
    const s = 14 * (W()/820);
    orbs.push({x:W()+40, y:rand(60,H()-60), r:s, phase: rand(0,Math.PI*2)});
  }

  function explosiveChance(){
    if (state.score < 500) return 0;
    const t = clamp((state.score-500)/1000, 0, 1);
    return 0.18 + t*(0.50-0.18);
  }

  // ---- Mines : simples OU “porte” (cluster avec couloir sûr) ----
  function gateChance(){
    // commence vers 800 XP → ~18% à 2000 → ~28% à 3500+
    const s = state.score;
    if (s < 800) return 0;
    if (s > 3500) return 0.28;
    if (s > 2000) return 0.18 + (s-2000)*(0.10/1500);
    // entre 800 et 2000
    return (s-800)*(0.18/1200);
  }

  function spawnMine(){
    // respecte un cooldown pour les portes
    if (state.gateCooldown <= 0 && state.rng() < gateChance()){
      spawnMineGate();
      // cooldown 3.5s → 6.5s variable
      state.gateCooldown = 3.5 + state.rng()*3.0;
      return;
    }

    const s = rand(22,30)*(W()/820);
    const m = {
      x: W()+60, y: rand(60,H()-60), w: s, h: s,
      explosive: state.rng() < explosiveChance(),
      blinking: false,
      blinkCount: 0,
      blinkTimer: 0,
      exploded: false
    };
    mines.push(m);
  }

  function spawnMineGate(){
    const h = H();
    const w = W();

    // taille et pas verticaux
    const baseSize = 24*(W()/820);
    const rowStep = 64*(h/720); // écart régulier
    const margin = 48*(h/720);

    // couloir sûr (hauteur du passage)
    const minGap = 120*(h/720);
    const gapGrow = 60*(1 - difficulty())*(h/720); // un peu plus serré quand c’est dur
    const gap = Math.max(minGap, minGap + gapGrow);

    // centre du couloir près de la baleine ± aléa
    const gapCenter = clamp(player.y + rand(-80,80), margin+gap*0.5, h-margin-gap*0.5);
    const gapTop = gapCenter - gap*0.5;
    const gapBottom = gapCenter + gap*0.5;

    // nombre de mines verticales
    const rows = Math.floor((h - margin*2) / rowStep);
    const xStart = w + 70;
    const xJitter = 22*(W()/820); // léger décalage horizontal

    for (let i=0;i<=rows;i++){
      const y = margin + i*rowStep + rand(-6,6);
      // saute si à l’intérieur du couloir
      if (y > gapTop && y < gapBottom) continue;

      const s = rand(baseSize*0.9, baseSize*1.25);
      const jitter = rand(-xJitter, xJitter);
      const explosive = state.rng() < (explosiveChance() * 0.65); // un peu moins d’explosives dans les portes

      mines.push({
        x: xStart + jitter,
        y,
        w: s,
        h: s,
        explosive,
        blinking:false,
        blinkCount:0,
        blinkTimer:0,
        exploded:false
      });
    }
  }

  function spawnOrca(){ const s=64*(W()/820); orcas.push({x:W()+90,y:rand(70,H()-70),w:s,h:s,vy:rand(-40,40),phase:rand(0,Math.PI*2)}); }
  function spawnHeart(){ const s=34*(W()/820); hearts.push({x:W()+70,y:rand(60,H()-60),s}); }

  // ---------- Explosions ----------
  const explosions=[];  // {x,y,vx,vy,r,a,life,hue}
  const flashes=[];     // {x,y,r,life}
  function spawnExplosion(x, y, size = 36){
    const count = 16 + Math.floor(size * 0.6);
    for (let i=0;i<count;i++){
      const ang = rand(0, Math.PI*2);
      const spd = rand(120, 260);
      explosions.push({
        x, y, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd - rand(0,50),
        r: rand(2.2,4.6), a:1, life:rand(0.28,0.55), hue:rand(12,28)
      });
    }
    flashes.push({x,y,r:size*1.8, life:0.22});
    playSfx(audio.explosion, 0.9);
  }
  function updateExplosions(dt){
    for (let i=explosions.length-1;i>=0;i--){
      const p=explosions[i]; p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt; p.a=Math.max(0,p.life*1.2);
      if(p.life<=0) explosions.splice(i,1);
    }
    for (let i=flashes.length-1;i>=0;i--){ const f=flashes[i]; f.life-=dt; if(f.life<=0) flashes.splice(i,1); }
  }
  function drawExplosions(){
    if (flashes.length){
      ctx.save(); ctx.globalCompositeOperation="screen";
      for (const f of flashes){
        const a=Math.max(0,f.life/0.22);
        const g=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,f.r);
        g.addColorStop(0,`rgba(255,180,60,${0.45*a})`); g.addColorStop(1,"rgba(255,80,0,0)");
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(f.x,f.y,f.r,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }
    if (!explosions.length) return;
    ctx.save(); ctx.globalCompositeOperation="lighter";
    for (const p of explosions){
      const grad=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*2.2);
      grad.addColorStop(0,`hsla(${p.hue},95%,62%,0.85)`); grad.addColorStop(1,`hsla(${p.hue},95%,42%,0)`);
      ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(p.x,p.y,p.r*2.2,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- Bulles ----------
  const bubbles=[];
  function spawnBubbles(dt){
    const rate = player.boost? 120 : 60;
    player.bubbleTimer += dt*rate;
    const n=Math.floor(player.bubbleTimer); player.bubbleTimer-=n;
    for(let i=0;i<n;i++){
      const base = player.boost? 1.4 : 1.0;
      bubbles.push({
        x:player.x()-8+rand(-3,3),
        y:player.y+rand(-6,6),
        vx:-80*base + rand(-10,10),
        vy:rand(-18,18),
        a:0.9, r:rand(1.5,3.5)*base, life:0.9
      });
    }
  }
  function updateBubbles(dt){
    for(let i=bubbles.length-1;i>=0;i--){
      const b=bubbles[i]; b.x+=b.vx*dt; b.y+=b.vy*dt; b.vy-=12*dt; b.life-=dt; b.a=Math.max(0,b.life);
      if(b.life<=0) bubbles.splice(i,1);
    }
  }
  function drawBubbles(){
    ctx.save(); ctx.globalCompositeOperation="screen";
    for(const b of bubbles){ ctx.fillStyle=`rgba(255,255,255,${0.35*b.a})`; ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill(); }
    ctx.restore();
  }

  const orcaBubbles=[];
  function spawnOrcaBubbles(o, dt){
    const rate = 18;
    if (state.rng() < rate*dt){
      orcaBubbles.push({
        x:o.x + o.w*0.1, y:o.y + o.h*0.6,
        vx:-90 + rand(-20,10), vy:rand(-10,10),
        a:0.8, r:rand(1.2,2.2), life:0.8
      });
    }
  }
  function updateOrcaBubbles(dt){
    for(let i=orcaBubbles.length-1;i>=0;i--){
      const b=orcaBubbles[i]; b.x+=b.vx*dt; b.y+=b.vy*dt; b.vy-=8*dt; b.life-=dt; b.a=Math.max(0,b.life);
      if(b.life<=0) orcaBubbles.splice(i,1);
    }
  }
  function drawOrcaBubbles(){
    ctx.save(); ctx.globalCompositeOperation="screen";
    for(const b of orcaBubbles){ ctx.fillStyle=`rgba(255,255,255,${0.28*b.a})`; ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill(); }
    ctx.restore();
  }

  // ---------- BRUME PNG ----------
  const FOG_PATH = "static/abyss/img/";
  const FOG_FILES = ["Fog1.png","Fog2.png","Fog3.png","Fog4.png","FogDark1.png","FogDark2.png"];
  const fogTextures = [];
  (function loadFogTextures(){
    for (const name of FOG_FILES){
      const img = new Image();
      img.src = FOG_PATH + name;
      fogTextures.push(img);
    }
  })();

  const fogSprites = [];
  let fogSpawnBucket = 0;
  const FOG_CAP = 10; // anti-surcharge

  // Séquence phase 1
  const fogSeq = [0,1,2,3];
  let fogSeqIndex = 0;

  // Fog plus tôt et plus vite : 1000 → 2500 XP
  function fogMixLevel(){
    const start = 1000, end = 2500;
    return clamp((state.score - start)/(end - start), 0, 1);
  }

  function spawnFogPhase1IfNeeded(){
    if (fogSprites.length > 0) return;

    const scale = W()/820;
    const texIndex = fogSeq[fogSeqIndex % fogSeq.length];
    fogSeqIndex++;

    const tex = fogTextures[texIndex];
    const r = 220 * scale;
    const w = r*2.0, h = r*2.0;

    const vx = -worldSpeed() * 0.26; // + rapide qu’avant (0.22)
    const vy = (Math.random()*10 - 5);
    const y  = Math.min(H()-60, Math.max(60, Math.random()*(H()-120)+60));
    const life = 8.5 + Math.random()*1.5; // moins longtemps

    fogSprites.push({
      x: W()+w*0.5, y,
      w, h, vx, vy,
      tex,
      life: 0,
      maxLife: life,
      alphaMul: 0.14,
      twist: Math.random()*Math.PI*2
    });
  }

  function spawnFogPhase2(dt){
    const lvl = fogMixLevel();
    if (lvl <= 0) return;

    const rate = 0.8 + 6.0*lvl;
    fogSpawnBucket += dt * rate;

    const scale = W()/820;
    const darkWeight = 0.15 + 0.70*lvl;

    while (fogSpawnBucket >= 1){
      fogSpawnBucket -= 1;

      if (fogSprites.length >= FOG_CAP) break;

      let texIndex;
      if (Math.random() < darkWeight){
        texIndex = 4 + Math.floor(Math.random()*2);   // Dark1..2
      } else {
        texIndex = Math.floor(Math.random()*4);       // Fog1..4
      }
      const tex = fogTextures[texIndex];

      const base = (texIndex>=4 ? 260 : 200);
      const r = (base + 180*lvl) * scale;
      const w = r*2.0, h = r*2.0;

      const vx = -worldSpeed() * (0.26 + 0.22*lvl) + (Math.random()*24 - 12); // + rapide
      const vy = (Math.random()*16 - 8);
      const y  = Math.min(H()-40, Math.max(40, Math.random()*(H()-80)+40));
      const life = 7.5 + 6*lvl + (Math.random()*1.5-0.75); // moins long

      fogSprites.push({
        x: W()+w*0.5, y,
        w, h, vx, vy,
        tex,
        life: 0,
        maxLife: life,
        alphaMul: 0.16 + 0.22*lvl,
        twist: Math.random()*Math.PI*2
      });
    }
  }

  function updateFog(dt){
    for (let i=fogSprites.length-1;i>=0;i--){
      const f = fogSprites[i];
      f.life += dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt + Math.sin(state.elapsed*0.5 + f.twist) * 3.0 * dt;
      if (f.life > f.maxLife || f.x < -f.w-40) fogSprites.splice(i,1);
    }
  }

  function drawFog(){
    if (!fogSprites.length) return;
    ctx.save();
    for (const f of fogSprites){
      const t = clamp(f.life / f.maxLife, 0, 1);
      const a = Math.sin(Math.PI * t);
      const alpha = f.alphaMul * a;

      if (f.tex && f.tex.complete){
        ctx.globalAlpha = alpha;
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(Math.sin((f.twist + state.elapsed)*0.15) * 0.08);
        ctx.drawImage(f.tex, -f.w/2, -f.h/2, f.w, f.h);
        ctx.restore();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ---------- Update ----------
  function update(dt){
    state.elapsed += dt;

    // cooldown “porte” mines
    if (state.gateCooldown > 0) state.gateCooldown -= dt;

    // mouvements
    const kUp   = keys.has("arrowup")   || keys.has("w");
    const kDown = keys.has("arrowdown") || keys.has("s");
    const tUp = mobUp, tDown = mobDown;

    if (IS_MOBILE && mobileCtrl.active && mobileCtrl.targetY != null){
      const aim = clamp(mobileCtrl.targetY, 26, H()-26);
      const k = 10.0;
      const dy = aim - player.y;
      player.vy = clamp(player.vy + dy * k * dt, -player.maxVy, player.maxVy);
    } else {
      let ay = 0;
      const up   = tUp   || kUp;
      const down = tDown || kDown;
      if (up && !down) ay -= player.accelY;
      if (down && !up) ay += player.accelY;
      if (player.boost) ay *= 1.2;

      player.vy += ay * dt;
      if (!up && !down) player.vy *= Math.max(0, 1 - player.damping * dt);
      player.vy = clamp(player.vy, -player.maxVy, player.maxVy);
    }

    player.y  += player.vy * dt;

    // limites verticales
    const m = 26 * (H()/492);
    if (player.y > H()-m){ player.y=H()-m; player.vy=0; }
    if (player.y < m){     player.y=m;     player.vy=0; }
    player.tilt = clamp(player.vy * 0.0025, -0.35, 0.35);

    // bulles
    spawnBubbles(dt); updateBubbles(dt);

    // difficulté → timers plus courts
    const d = difficulty();
    const spawnScale = 1 + Math.min(1.2, (state.elapsed/70) + (state.score/1200) + d*0.6);

    state.orbTimer   -= dt;
    state.mineTimer  -= dt;
    state.orcaTimer  -= dt;
    state.heartTimer -= dt;

    if (state.orbTimer <= 0){
      spawnOrb();
      const base = (Math.random()*(1.15-0.80)+0.80);
      state.orbTimer  = base / spawnScale;
    }
    if (state.mineTimer <= 0){
      spawnMine();
      const base = (Math.random()*(1.55-0.95)+0.95);
      state.mineTimer = base / (spawnScale * (1 + d*0.25)); // un peu plus de mines tard
    }
    if ((state.score>160 || state.elapsed>28) && state.orcaTimer <= 0){
      spawnOrca();
      state.orcaTimer = (Math.random()*(6.4-4.0)+4.0) / (0.85 + 0.55*spawnScale);
    }
    if (state.elapsed >= state.nextHeartAt && state.heartTimer <= 0){
      if (state.rng() < 0.5) spawnHeart();
      state.nextHeartAt += 120;
      state.heartTimer = 5;
    }

    // monde vers la gauche
    const vx = -worldSpeed() * dt;

    // Orbes
    for (let i=orbs.length-1;i>=0;i--){ orbs[i].x+=vx; if(orbs[i].x<-40) orbs.splice(i,1); }

    // Mines (+ logique explosive)
    for (let i=mines.length-1;i>=0;i--){
      const mObj = mines[i];
      mObj.x += vx;
      if (mObj.x < -60){ mines.splice(i,1); continue; }

      // Approche → blink (explosives)
      if (mObj.explosive && !mObj.exploded && !mObj.blinking){
        if (mObj.x < player.x() + W()*0.18) {
          mObj.blinking = true;
          mObj.blinkTimer = 0;
          mObj.blinkCount = 0;
        }
      }
      if (mObj.blinking && !mObj.exploded){
        mObj.blinkTimer += dt;
        if (mObj.blinkTimer >= 0.25){
          mObj.blinkTimer = 0;
          mObj.blinkCount++;
          if (mObj.blinkCount >= 3){
            const nearX = mObj.x < player.x() + W()*0.02;
            const nearY = Math.abs((mObj.y + mObj.h*0.5) - player.y) <= 120;
            if (nearX && nearY){
              triggerMineExplosion(i, mObj);
              continue;
            }
          }
        }
      }
      // Sécurité : explose si dépasse après blink
      if (mObj.explosive && !mObj.exploded && mObj.blinkCount >= 3 && mObj.x < player.x() - W()*0.08){
        triggerMineExplosion(i, mObj);
        continue;
      }

      // Collision mine/whale
      if (!mObj.exploded){
        if (rectCircleHit(mObj.x,mObj.y,mObj.w,mObj.h, player.x(),player.y,player.radius)){
          spawnExplosion(mObj.x + mObj.w * 0.5, mObj.y + mObj.h * 0.5, Math.max(mObj.w,mObj.h));
          mines.splice(i,1);
          takeHit();
          continue;
        }
      }
    }

    // Orques
    for (let i=orcas.length-1;i>=0;i--){
      const o=orcas[i];
      o.x += vx*1.25*orcaSpeedFactor();
      o.y += o.vy*dt + Math.sin((state.elapsed+o.phase)*2.0)*20*dt;
      if (o.x < -100) orcas.splice(i,1); else spawnOrcaBubbles(o, dt);
    }

    // Cœurs
    for (let i=hearts.length-1;i>=0;i--){ hearts[i].x = (hearts[i].x||0) + vx; if(hearts[i].x<-70) hearts.splice(i,1); }

    // collisions orbes/whale
    for (let i=orbs.length-1;i>=0;i--){
      const o=orbs[i];
      if (circleHit(player.x(),player.y,player.radius, o.x,o.y,o.r)){
        orbs.splice(i,1); state.score+=10; playSfx(audio.orb, 0.9);
      } else { o.phase += 3.0*dt; }
    }

    // collisions orques/whale
    for (let i=orcas.length-1;i>=0;i--){
      const o=orcas[i], rr=Math.max(o.w,o.h)*0.35;
      if (circleHit(player.x(),player.y,player.radius, o.x+o.w*0.5, o.y+o.h*0.5, rr)){
        orcas.splice(i,1); takeHit();
      }
    }

    // collisions cœurs/whale
    for (let i=hearts.length-1;i>=0;i--){
      const h=hearts[i];
      const cx = (h.x!==undefined ? h.x : (h.x = W()+70));
      if (circleHit(player.x(),player.y,player.radius, cx + (h.s*0.5), h.y + (h.s*0.5), Math.max(18, h.s*0.35))){
        hearts.splice(i,1);
        state.lives = Math.min(6, state.lives + 1);
        playSfx(audio.heart, 0.9);
      }
    }

    // Brume
    if (state.score < 1000){
      spawnFogPhase1IfNeeded();
    } else {
      spawnFogPhase2(dt);
    }
    updateFog(dt);

    updateOrcaBubbles(dt);
    updateExplosions(dt);
  }

  // Déclenche l’explosion d’une mine (zone d’effet)
  function triggerMineExplosion(index, mObj){
    mObj.exploded = true;
    const cx = mObj.x + mObj.w*0.5;
    const cy = mObj.y + mObj.h*0.5;

    const base = 60 * (W()/820);
    const extra = clamp((state.score-500)/1000, 0, 1) * 24;
    const radius = base + extra;

    spawnExplosion(cx, cy, Math.max(mObj.w,mObj.h)*1.6);

    if (circleHit(player.x(), player.y, player.radius, cx, cy, radius)){
      takeHit();
    }
    mines.splice(index,1);
  }

  // ---------- Game Over Overlay ----------
  const elGameOver = document.getElementById('gameover');
  const elGoBtn    = document.getElementById('go-restart');
  elGoBtn && elGoBtn.addEventListener('click', () => {
    hideGameOverOverlay();
    resetGame();
  });

  function showGameOverOverlay(){
    if (elGameOver){
      elGameOver.style.display = 'flex';
    }
  }
  function hideGameOverOverlay(){
    if (elGameOver){
      elGameOver.style.display = 'none';
    }
  }

  function takeHit(){
    state.lives-=1;
    player.vy = Math.max(player.vy - player.jumpImpulse*0.7, -player.maxVy);
    if (state.lives<=0) {
      state.running=false;
      submitBestRun();
      showGameOverOverlay();
    }
  }

  // ---------- Dessin ----------
  function draw(dt){
    drawWater(dt);

    for(const o of orbs)  drawOrb(o);
    for(const m of mines) drawMine(m);
    for(const o of orcas) drawOrca(o);
    for(const h of hearts) drawHeart(h);

    drawOrcaBubbles();
    drawExplosions();
    drawBubbles();
    drawWhale(player.x(), player.y, player.radius, player.tilt);

    drawFog();

    const sEl = document.getElementById("score");
    const lEl = document.getElementById("lives");
    if (sEl) sEl.textContent = state.score;
    if (lEl) lEl.textContent = state.lives;
  }

  // -- Sprites drawing helpers --
  const WHALE_LENGTH_MULT = 3.0;
  function drawWhale(x,y,r,tilt=0){
    const baseScale = 2.2 * 1.5;
    const w = r * 1.2 * baseScale * WHALE_LENGTH_MULT;
    const h = r * 2 * baseScale;

    const swim = Math.sin(state.elapsed * 8) * 0.06;
    const bend = clamp((player.vy / player.maxVy) * 0.30 + swim, -0.40, 0.40);

    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(tilt);

    if (sprites.whale.ready) {
      const img   = sprites.whale.img;
      const left  = -w * 0.5;
      const right =  w * 0.5;
      const top   = -h * 0.5;
      const tailPivotX = -w * 0.22;
      const seam = 1;

      // Avant
      ctx.save();
      ctx.beginPath();
      ctx.rect(tailPivotX - seam, top, (right - tailPivotX) + seam, h);
      ctx.clip();
      ctx.drawImage(img, left, top, w, h);
      ctx.restore();

      // Queue
      ctx.save();
      ctx.translate(tailPivotX, 0);
      ctx.rotate(bend);
      ctx.translate(-tailPivotX, 0);
      ctx.beginPath();
      ctx.rect(left, top, (tailPivotX - left) + seam, h);
      ctx.clip();
      ctx.drawImage(img, left, top, w, h);
      ctx.restore();

    } else {
      ctx.fillStyle="#fff2e9";
      roundedRect(ctx,-r*.9,-r*.8,r*1.6,r*1.4,r*.6); ctx.fill();
      ctx.fillStyle="#263238";
      ctx.beginPath(); ctx.arc(r*.2,-r*.15,2.4,0,Math.PI*2); ctx.fill();
    }

    ctx.restore();
  }

  function drawOrca(o){
    if (sprites.orca.ready) ctx.drawImage(sprites.orca.img, o.x, o.y, o.w, o.h);
    else { ctx.fillStyle="#0d1b2a"; ctx.fillRect(o.x,o.y,o.w,o.h); }
  }

  function drawOrb(o){
    const pulse = 0.7 + 0.3*Math.sin(o.phase||0);
    const glowR = (o.r*2.1) * pulse;
    ctx.save(); ctx.globalCompositeOperation="screen";
    const g=ctx.createRadialGradient(o.x,o.y,0,o.x,o.y,glowR);
    g.addColorStop(0,"rgba(120,255,180,0.65)"); g.addColorStop(1,"rgba(120,255,180,0)");
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(o.x,o.y,glowR,0,Math.PI*2); ctx.fill(); ctx.restore();

    if (sprites.orb.ready) {
      const s=50*(W()/820) * (0.95 + 0.05*Math.sin((o.phase||0)*1.5));
      ctx.drawImage(sprites.orb.img, o.x-s/2, o.y-s/2, s, s);
    } else {
      ctx.beginPath(); ctx.arc(o.x,o.y,o.r,0,Math.PI*2); ctx.fillStyle="rgba(180,255,200,0.95)"; ctx.fill();
      ctx.beginPath(); ctx.arc(o.x-o.r*.3,o.y-o.r*.3,o.r*.4,0,Math.PI*2); ctx.fillStyle="rgba(255,255,255,0.85)"; ctx.fill();
    }
  }

  function drawMine(m){
    if (sprites.mine.ready){
      const s=Math.max(m.w,m.h)*1.35;
      ctx.drawImage(sprites.mine.img, m.x+(m.w-s)/2, m.y+(m.h-s)/2, s, s);
    } else {
      const r=Math.min(m.w,m.h)*0.5;
      ctx.save(); ctx.translate(m.x+m.w*.5, m.y+m.h*.5);
      ctx.fillStyle="rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.arc(0,0,r+2,0,Math.PI*2); ctx.fill();
      const g=ctx.createRadialGradient(-r*.4,-r*.4,r*.2,0,0,r); g.addColorStop(0,"#ffb17a"); g.addColorStop(1,"#ff5c2e");
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill(); ctx.restore();
    }

    // LED centrale (état)
    const cx = m.x + m.w*0.5;
    const cy = m.y + m.h*0.5;

    let color = "rgba(50,255,120,0.95)";
    let radius = Math.max(2.5, Math.min(m.w,m.h)*0.10);

    if (m.explosive){
      color = "rgba(255,180,60,0.95)";
      if (m.blinking){
        const blink = (Math.sin(state.elapsed*12) > 0) ? 1 : 0.35;
        color = `rgba(255,60,60,${0.85*blink})`;
        radius *= 1.15;
      }
    }

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const glow = ctx.createRadialGradient(cx,cy,0,cx,cy,radius*3.2);
    glow.addColorStop(0, color.replace("0.95","0.85"));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx,cy,radius*2.4,0,Math.PI*2); ctx.fill();
    ctx.restore();

    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(cx,cy,radius,0,Math.PI*2); ctx.fill();
  }

  function drawHeart(h){
    const x = h.x!==undefined ? h.x : (h.x=W()+70);
    const y = h.y, s = h.s;
    if (sprites.heart.ready) {
      ctx.drawImage(sprites.heart.img, x, y, s, s);
    } else {
      ctx.save(); ctx.translate(x+s*0.5, y+s*0.5); ctx.scale(s/40, s/40);
      ctx.fillStyle="#ff4d6d"; ctx.beginPath();
      ctx.moveTo(0,12);
      ctx.bezierCurveTo(0,-6,-18,-6,-18,8);
      ctx.bezierCurveTo(-18,20,0,28,0,36);
      ctx.bezierCurveTo(0,28,18,20,18,8);
      ctx.bezierCurveTo(18,-6,0,-6,0,12);
      ctx.fill(); ctx.restore();
    }
  }

  // ---------- Collisions & helpers ----------
  function circleHit(x1,y1,r1,x2,y2,r2){ const dx=x1-x2,dy=y1-y2; return dx*dx+dy*dy <= (r1+r2)*(r1+r2); }
  function rectCircleHit(rx,ry,rw,rh,cx,cy,cr){
    const tx=clamp(cx,rx,rx+rw), ty=clamp(cy,ry,ry+rh); const dx=cx-tx, dy=cy-ty; return dx*dx+dy*dy <= cr*cr;
  }
  function roundedRect(c,x,y,w,h,r){
    r=Math.min(r,Math.abs(w)*.5,Math.abs(h)*.5);
    c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r);
    c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath();
  }

  // ---------- Boucle ----------
  let last=performance.now();
  function loop(now){
    const dt=Math.min(0.033,(now-last)/1000); last=now;
    if(state.running) update(dt);
    draw(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
