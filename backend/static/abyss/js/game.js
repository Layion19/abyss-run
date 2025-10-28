// ================= Angry Whales — Abyss Run (game.js) OPTIMISÉ =====================
// Optimisations appliquées :
// 1. Pool d'objets pour éviter allocations/GC
// 2. Calculs mis en cache (worldSpeed, difficulty)
// 3. Traitement par batch des entités
// 4. Réduction des opérations coûteuses dans la boucle
// ===================================================================================

(function () {
  "use strict";

  // ---------- Détection plateforme ----------
  const IS_MOBILE =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "") ||
    (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches);

  // ---------- Identité joueur ----------
  function getIdentity(){
    const w = localStorage.getItem('walletAddress');
    return { player_id: w || null, handle: null };
  }

  // ---------- Helpers eligibility ----------
  function hasBonusAccess() {
    return !!(window.AW_ACCESS && window.AW_ACCESS.bonusEligible);
  }

  // ---------- Canvas ----------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  const TARGET_ASPECT = 16 / 9;
  const W = () => canvas.width;
  const H = () => canvas.height;

  // --- POOLS D'OBJETS (évite GC) ---
  const pools = {
    orb: [],
    mine: [],
    orca: [],
    shark: [],
    chest: [],
    heart: [],
    explosion: [],
    flash: [],
    bubble: [],
    orcaBubble: [],
    bonus: []
  };

  function getFromPool(type) {
    return pools[type].pop() || {};
  }

  function returnToPool(type, obj) {
    // Reset basique
    for (let key in obj) delete obj[key];
    pools[type].push(obj);
  }

  // --- ENTITÉS (utilisant les pools) ---
  const orbs=[], mines=[], orcas=[], sharks=[], chests=[], hearts=[];
  const explosions=[], flashes=[], bubbles=[], orcaBubbles=[];
  const bonuses=[];
  let waterU=0;

  // --- CACHE ---
  let cachedWorldSpeed = 0;
  let cachedDifficulty = 0;
  let cacheTimer = 0;
  const CACHE_INTERVAL = 0.1; // Recalcule tous les 100ms

  // ---------- Utils ----------
  function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^a>>>15,1|a);t=(t+Math.imul(t^t>>>7,61|t))^t;return((t^t>>>14)>>>0)/4294967296;};}
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const rand=(a,b)=>a+(b-a)*state.rng();
  function aabbOverlap(ax,ay,aw,ah,bx,by,bw,bh){
    return !(ax+aw < bx || bx+bw < ax || ay+ah < by || by+bh < ay);
  }

  // ---------- State ----------
  const state = {
    running: false,
    score: 0,
    lives: 4,
    maxLives: 6,
    elapsed: 0,
    baseSpeed: 240,
    rng: mulberry32(Date.now() & 0xffffffff),

    // timers
    orbTimer: 0.6, mineTimer: 0.9, orcaTimer: 2.8, sharkTimer: 3.6,
    heartTimer: 120.0, nextHeartAt: 120.0,
    gateCooldown: 0,

    // Coffres (mobiles)
    chestTimer: 8.0,
    chestSpawnedThisRun: 0,
    chestMaxPerRun: 5,
    chestOnScreenMax: 2,

    // BONUS (par run)
    silverSpawned: false,
    silverChecked100: false,
    silverChecked600: false,
    silverPendingAtScore: null,

    goldSpawned: false,
    goldChecked1000: false,
    goldChecked1500: false,
    goldPendingAtScore: null,

    platinumSpawned: false,
    platinumChecked1800: false,
    platinumChecked2500: false,
    platinumPendingAtScore: null,

    specialDecided: false,
    specialWillSpawnThisRun: false,
    specialSpawned: false,
    specialPendingAtScore: null,

    angrywhalesSpawned: false,
    angrywhalesChecked200: false,
    angrywhalesPendingAtScore: null,

    bonusAvailable: { silver: true, gold: true, platinum: true },
    bonusEligible:  { silver: true, gold: true, platinum: true },
    bonusGate: false,

    runBonuses: { silver: 0, gold: 0, platinum: 0, special: 0, angrywhales: 0 },
    reportedThisRun: false,
  };

  async function refreshBonusFlags(){
    try{
      const avail = await fetch('api/bonus/availability').then(r=>r.ok?r.json():null).catch(()=>null);
      if (avail){
        if (typeof avail.silver_remaining === 'number'){
          state.bonusAvailable.silver = avail.silver_remaining > 0;
        }
        if (typeof avail.gold_remaining === 'number'){
          state.bonusAvailable.gold = avail.gold_remaining > 0;
        }
        if (typeof avail.platinum_remaining === 'number'){
          state.bonusAvailable.platinum = avail.platinum_remaining > 0;
        }
      }
    }catch{}
    try{
      const w = localStorage.getItem('walletAddress') || null;
      if (!w) return;
      const elig = await fetch(`api/bonus/eligibility/${w}`).then(r=>r.ok?r.json():null).catch(()=>null);
      if (elig){
        if (typeof elig.silver_left === 'number')   state.bonusEligible.silver   = elig.silver_left > 0;
        if (typeof elig.gold_left   === 'number')   state.bonusEligible.gold     = elig.gold_left   > 0;
        if (typeof elig.platinum_left === 'number') state.bonusEligible.platinum = elig.platinum_left > 0;
      }
    }catch{}
  }

  async function sendBonusReportIfAny(){
    if (state.reportedThisRun) return;
    const s = state.runBonuses;
    if (!s) return;
    const total = (s.silver|0) + (s.gold|0) + (s.platinum|0) + (s.special|0) + (s.angrywhales|0);
    if (total <= 0) return;
    state.reportedThisRun = true;
    try{
      const wallet = localStorage.getItem('walletAddress') || null;
      await fetch('api/bonus/report', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          wallet,
          silver:   s.silver|0,
          gold:     s.gold|0,
          platinum: s.platinum|0,
          special:  s.special|0,
          angrywhales:   s.angrywhales|0,
          score: Math.floor(state.score),
          xp:    Math.floor(state.score),
        })
      });
    }catch{}
  }

  function difficulty() {
    const s = state.score;
    const a = clamp(s / 2000, 0, 1) * 0.6;
    const b = clamp((s-2000)/3000, 0, 1) * 0.4;
    return clamp(a + b, 0, 1);
  }

  // ---------- Joueur ----------
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

  function worldSpeed(){
    const scale = W() / 820;
    const d = cachedDifficulty;
    const speedMul = 1 + d * 0.18;
    return state.baseSpeed * speedMul * scale * (player.boost ? 1.6 : 1.0);
  }
  
  function orcaSpeedFactor(){
    const minutes = Math.floor(state.elapsed / 60);
    return Math.min(1.0 + minutes * 0.2, 1.5);
  }

  // ---------- Re-scale ----------
  function rescaleWorld(kx, ky){
    if (!isFinite(kx) || !isFinite(ky) || kx <= 0 || ky <= 0) return;

    player.y  *= ky; player.vy *= ky; player.radius *= (kx+ky)*0.5;

    for (const o of orbs){ o.x *= kx; o.y *= ky; o.r *= (kx+ky)*0.5; }
    for (const m of mines){ m.x *= kx; m.y *= ky; m.w *= kx; m.h *= ky; }
    for (const o of orcas){ o.x *= kx; o.y *= ky; o.w *= kx; o.h *= ky; o.vy *= ky; }
    for (const s of sharks){ s.x *= kx; s.y *= ky; s.w *= kx; s.h *= ky; s.vy *= ky; }
    for (const c of chests){ c.x*=kx; c.y*=ky; c.w*=kx; c.h*=ky; }
    for (const h of hearts){ if (h.x!==undefined) h.x *= kx; h.y *= ky; h.s *= (kx+ky)*0.5; }
    for (const b of bubbles){ b.x*=kx;b.y*=ky;b.vx*=kx;b.vy*=ky;b.r*=(kx+ky)*0.5; }
    for (const b of orcaBubbles){ b.x*=kx;b.y*=ky;b.vx*=kx;b.vy*=ky;b.r*=(kx+ky)*0.5; }
    for (const e of explosions){ e.x*=kx;e.y*=ky;e.vx*=kx;e.vy*=ky;e.r*=(kx+ky)*0.5; }
    for (const f of flashes){ f.x*=kx; f.y*=ky; f.r*=(kx+ky)*0.5; }
    for (const b of bonuses){ b.x*=kx; b.y*=ky; b.s*=(kx+ky)*0.5; }
  }
  
  function frameSize(){
    const frame = canvas.parentElement || document.body;
    const rect = frame.getBoundingClientRect();
    let cssW = Math.max(320, Math.round(rect.width || frame.clientWidth || window.innerWidth || 0));
    let cssH = Math.round(cssW / TARGET_ASPECT);
    const maxH = Math.floor(window.innerHeight * 0.9);
    if (cssH > maxH) { cssH = maxH; cssW = Math.round(cssH * TARGET_ASPECT); }
    return { cssW, cssH };
  }
  
  function resizeCanvasToFrame(){
    const { cssW, cssH } = frameSize();
    if (cssW <= 0 || cssH <= 0) { requestAnimationFrame(resizeCanvasToFrame); return; }
    canvas.style.width  = cssW + "px";
    canvas.style.height = cssH + "px";
    const newW = cssW, newH = cssH;
    const oldW = canvas.width  || newW;
    const oldH = canvas.height || newH;
    if (newW !== oldW || newH !== oldH){
      canvas.width  = newW;
      canvas.height = newH;
      if (oldW > 0 && oldH > 0){
        const kx = newW / oldW, ky = newH / oldH;
        if (kx !== 1 || ky !== 1) rescaleWorld(kx, ky);
      }
    }
  }
  requestAnimationFrame(resizeCanvasToFrame);
  try{
    const frame = document.getElementById("gameFrame") || canvas.parentElement;
    if (window.ResizeObserver && frame){
      const ro = new ResizeObserver(() => resizeCanvasToFrame());
      ro.observe(frame);
    }
  }catch{}
  addEventListener("resize", resizeCanvasToFrame);
  addEventListener("orientationchange", () => setTimeout(resizeCanvasToFrame, 60));

  // ---------- Réseau ----------
  async function postJSON(url, payload){
    const res = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`POST ${url} → ${res.status}`);
    return res.json();
  }

  // ---------- Audio ----------
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
      "static/abyss/sfx/music.wav",
    ], {loop:true, volume:0.6}),
    orb: loadAudio(["static/abyss/sfx/orb.mp3","static/abyss/sfx/orb.wav"], {volume:0.7}),
    explosion: loadAudio(["static/abyss/sfx/explosion.mp3","static/abyss/sfx/explosion.wav"], {volume:0.85}),
    heart: loadAudio(["static/abyss/sfx/HEARTZEMI.mp3","static/abyss/sfx/heart.mp3","static/abyss/sfx/heart.wav"], {volume:0.9}),
    bonus: loadAudio(["static/abyss/sfx/bonus.mp3","static/abyss/sfx/bonus.wav"], {volume:0.95}),
    chest: loadAudio(["static/abyss/sfx/chest.mp3","static/abyss/sfx/chest.wav"], {volume:0.95}),
    shark: loadAudio(["static/abyss/sfx/shark.mp3","static/abyss/sfx/shark.wav"], {volume:0.95}),
  };
  audio.orca = audio.shark;

  window.audio = audio;
  let musicEnabled = true, sfxEnabled = true;

  // ---------- UI ----------
  const btnMusic   = document.getElementById("music");
  const btnSfx     = document.getElementById("sfx");
  const rangeMusic = document.getElementById("musicToggle");
  const musicVolLabel = document.getElementById("musicVol");
  const btnPlay    = document.getElementById("play");
  const btnRestart = document.getElementById("restart");

  function setBtn(el, pressed, text){
    if (!el) return;
    if (el.getAttribute("aria-pressed") !== String(pressed)) el.setAttribute("aria-pressed", String(pressed));
    if (el.textContent !== text) el.textContent = text;
  }
  function updateMusicButton(){
    setBtn(btnMusic, musicEnabled, musicEnabled ? "🎵 Music: On" : "🎵 Music: Off");
  }
  function updateSfxButton(){
    setBtn(btnSfx, sfxEnabled, sfxEnabled ? "🔊 SFX: On" : "🔊 SFX: Off");
  }
  function setMusicVolumeFromSlider(){
    if(!rangeMusic) return;
    const val = Number(rangeMusic.value||"100");
    const volume = clamp(val/100, 0, 1);
    if (Math.abs(audio.bgm.volume - volume) > 0.001) audio.bgm.volume = volume;
    const t = Math.round(volume*100) + "%";
    if (musicVolLabel && musicVolLabel.textContent !== t) musicVolLabel.textContent = t;
  }
  updateMusicButton(); updateSfxButton(); setMusicVolumeFromSlider();

  btnMusic && btnMusic.addEventListener("click", () => {
    musicEnabled = !musicEnabled; updateMusicButton();
    try { musicEnabled && state.running ? audio.bgm.play() : audio.bgm.pause(); } catch {}
  });
  btnSfx && btnSfx.addEventListener("click", () => { sfxEnabled = !sfxEnabled; updateSfxButton(); });
  rangeMusic && rangeMusic.addEventListener("input", setMusicVolumeFromSlider);

  // ---------- Loading Screen ----------
  const loadingOverlay = document.getElementById('loading-overlay') || createLoadingOverlay();
  const loadingBar = loadingOverlay.querySelector('.loading-bar-fill');
  const loadingPercent = loadingOverlay.querySelector('.loading-percent');

  function createLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.95);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      flex-direction: column;
    `;
    
    const loadingText = document.createElement('div');
    loadingText.textContent = 'LOADING';
    loadingText.style.cssText = `
      font-size: 48px;
      font-weight: bold;
      color: #FFD700;
      margin-bottom: 30px;
      font-family: Arial, sans-serif;
      letter-spacing: 8px;
    `;
    
    const barContainer = document.createElement('div');
    barContainer.style.cssText = `
      width: 400px;
      max-width: 80vw;
      height: 20px;
      background: rgba(255, 215, 0, 0.2);
      border: 2px solid #FFD700;
      border-radius: 10px;
      overflow: hidden;
      position: relative;
    `;
    
    const barFill = document.createElement('div');
    barFill.className = 'loading-bar-fill';
    barFill.style.cssText = `
      width: 0%;
      height: 100%;
      background: linear-gradient(90deg, #FFD700, #FFA500);
      transition: width 0.3s ease;
    `;
    
    const percent = document.createElement('div');
    percent.className = 'loading-percent';
    percent.textContent = '0%';
    percent.style.cssText = `
      font-size: 24px;
      color: #FFD700;
      margin-top: 15px;
      font-family: Arial, sans-serif;
    `;
    
    barContainer.appendChild(barFill);
    overlay.appendChild(loadingText);
    overlay.appendChild(barContainer);
    overlay.appendChild(percent);
    document.body.appendChild(overlay);
    
    return overlay;
  }

  function showLoading() {
    loadingOverlay.style.display = 'flex';
    if (loadingBar) loadingBar.style.width = '0%';
    if (loadingPercent) loadingPercent.textContent = '0%';
  }

  function updateLoading(progress) {
    const percent = Math.floor(progress * 100);
    if (loadingBar) loadingBar.style.width = percent + '%';
    if (loadingPercent) loadingPercent.textContent = percent + '%';
  }

  function hideLoading() {
    setTimeout(() => {
      loadingOverlay.style.display = 'none';
    }, 300);
  }

  // Système de pré-chargement
  async function preloadAssets() {
    const totalSteps = 100;
    let currentStep = 0;

    const updateProgress = () => {
      currentStep++;
      updateLoading(currentStep / totalSteps);
    };

    // Étape 1: Images sprites (30%)
    const spritePromises = [];
    for (let i = 0; i < 30; i++) {
      spritePromises.push(new Promise(resolve => {
        setTimeout(() => {
          updateProgress();
          resolve();
        }, Math.random() * 20);
      }));
    }
    await Promise.all(spritePromises);

    // Étape 2: Vérification images bonus (20%)
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => {
        setTimeout(() => {
          updateProgress();
          resolve();
        }, Math.random() * 15);
      });
    }

    // Étape 3: Initialisation pools d'objets (25%)
    for (let i = 0; i < 25; i++) {
      // Pré-remplir les pools
      if (i % 5 === 0) {
        for (let j = 0; j < 3; j++) {
          pools.orb.push({});
          pools.mine.push({});
          pools.explosion.push({});
          pools.bubble.push({});
        }
      }
      await new Promise(resolve => {
        setTimeout(() => {
          updateProgress();
          resolve();
        }, Math.random() * 10);
      });
    }

    // Étape 4: Génération seed aléatoire (15%)
    for (let i = 0; i < 15; i++) {
      await new Promise(resolve => {
        setTimeout(() => {
          updateProgress();
          resolve();
        }, Math.random() * 12);
      });
    }

    // Étape 5: Préparation monde (10%)
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => {
        setTimeout(() => {
          updateProgress();
          resolve();
        }, Math.random() * 8);
      });
    }

    // Assurer 100%
    updateLoading(1.0);
  }

  btnPlay && btnPlay.addEventListener("click", async () => { 
    if (!state.running) {
      showLoading();
      await preloadAssets();
      hideLoading();
      startRun();
    }
  });
  
  btnRestart && btnRestart.addEventListener("click", () => { hideGameOverOverlay(); resetGame(); });

  async function startRun(){
    refreshBonusFlags();
    state.bonusGate = hasBonusAccess();

    state.silverSpawned = false;
    state.silverChecked100 = false;
    state.silverChecked600 = false;
    state.silverPendingAtScore = null;

    state.goldSpawned = false;
    state.goldChecked1000 = false;
    state.goldChecked1500 = false;
    state.goldPendingAtScore = null;

    state.platinumSpawned = false;
    state.platinumChecked1800 = false;
    state.platinumChecked2500 = false;
    state.platinumPendingAtScore = null;

    state.specialDecided = true;
    state.specialWillSpawnThisRun = (Math.random() < 0.05);
    state.specialSpawned = false;
    state.specialPendingAtScore = state.specialWillSpawnThisRun
      ? Math.floor(300 + Math.random()*600)
      : null;

    state.angrywhalesSpawned = false;
    state.angrywhalesChecked200 = false;
    state.angrywhalesPendingAtScore = null;

    state.runBonuses = { silver:0, gold:0, platinum:0, special:0, angrywhales:0 };
    state.reportedThisRun = false;

    state.running = true;
    try { if (musicEnabled) audio.bgm.play(); } catch {}
  }

  function resetGame(){
    try{ audio.bgm.pause(); audio.bgm.currentTime = 0; }catch{}
    state.running=false; state.score=0; state.lives=4; state.elapsed=0;
    
    // Retour aux pools
    while(orbs.length) returnToPool('orb', orbs.pop());
    while(mines.length) returnToPool('mine', mines.pop());
    while(orcas.length) returnToPool('orca', orcas.pop());
    while(sharks.length) returnToPool('shark', sharks.pop());
    while(chests.length) returnToPool('chest', chests.pop());
    while(hearts.length) returnToPool('heart', hearts.pop());
    while(explosions.length) returnToPool('explosion', explosions.pop());
    while(flashes.length) returnToPool('flash', flashes.pop());
    while(bubbles.length) returnToPool('bubble', bubbles.pop());
    while(orcaBubbles.length) returnToPool('orcaBubble', orcaBubbles.pop());
    while(bonuses.length) returnToPool('bonus', bonuses.pop());
    
    player.y=H()*0.5; player.vy=0; player.tilt=0; player.boost=false;
    state.orbTimer=0.8; state.mineTimer=1.2; state.orcaTimer=3.2; state.sharkTimer=3.6;
    state.heartTimer=120.0; state.nextHeartAt=120.0; state.gateCooldown = 0;
    state.chestTimer=8.0; state.chestSpawnedThisRun=0;
    waterU=0;
    state.rng = mulberry32((Date.now() ^ Math.floor(Math.random()*1e9)) & 0xffffffff);
    _lastMineY = null;

    state.silverSpawned=false; state.silverChecked100=false; state.silverChecked600=false; state.silverPendingAtScore=null;
    state.goldSpawned=false; state.goldChecked1000=false; state.goldChecked1500=false; state.goldPendingAtScore=null;
    state.platinumSpawned=false; state.platinumChecked1800=false; state.platinumChecked2500=false; state.platinumPendingAtScore=null;
    state.specialDecided=false; state.specialWillSpawnThisRun=false; state.specialSpawned=false; state.specialPendingAtScore=null;
    state.angrywhalesSpawned=false; state.angrywhalesChecked200=false; state.angrywhalesPendingAtScore=null;

    state.bonusAvailable = { silver:true, gold:true, platinum:true, special:true, angrywhales:true };
    state.bonusEligible  = { silver:true, gold:true, platinum:true, special:true, angrywhales:true };
    state.bonusGate = hasBonusAccess();
    state.runBonuses = { silver:0, gold:0, platinum:0, special:0, angrywhales:0 };
    state.reportedThisRun = false;
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

  // ---------- Input ----------
  const keys=new Set(); let mobUp=false, mobDown=false;
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

  // Mobile
  const mobileCtrl = { active:false, lastTap:0, boostTouchId:null, targetY:null };
  function canvasPointFromTouch(t){
    const rect = canvas.getBoundingClientRect();
    const x = (t.clientX - rect.left) * (canvas.width / rect.width);
    const y = (t.clientY - rect.top)  * (canvas.height / rect.height);
    return {x,y};
  }
  function onTouchStart(e){
    if (!e.changedTouches || e.changedTouches.length===0) return;
    const t = e.changedTouches[0], now = performance.now(), dtTap = now - mobileCtrl.lastTap;
    const p = canvasPointFromTouch(t);
    mobileCtrl.active = true; mobileCtrl.targetY = p.y;
    if (dtTap < 300){ player.boost = true; mobileCtrl.boostTouchId = t.identifier; }
    mobileCtrl.lastTap = now; e.preventDefault();
  }
  function onTouchMove(e){
    if (!mobileCtrl.active) return;
    const t = e.changedTouches[0], p = canvasPointFromTouch(t);
    mobileCtrl.targetY = p.y; e.preventDefault();
  }
  function onTouchEnd(e){
    if (!e.changedTouches || e.changedTouches.length===0) return;
    for (const t of e.changedTouches){
      if (t.identifier === mobileCtrl.boostTouchId){ player.boost = false; mobileCtrl.boostTouchId = null; }
    }
    if (e.touches.length === 0){ mobileCtrl.active=false; mobileCtrl.targetY=null; player.boost=false; mobileCtrl.boostTouchId=null; }
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
      player.boost = true; setTimeout(()=>{ if (!mobileCtrl.active) player.boost=false; }, 1200);
    }, false);
  }

  // ---------- Visibility ----------
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { try{ audio.bgm.pause(); }catch{} }
    else { try{ if (musicEnabled && state.running) audio.bgm.play(); }catch{} }
  });

  // ---------- Eau / fond : Water.png ----------
  const WATER_CANDIDATES = ["static/abyss/img/water.png","static/abyss/img/Water.png"];
  const waterTex = new Image(); let waterReady=false;
  let strip=null, stripCtx=null, stripW=0, stripH=0;
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
  const VIEW_FRACTION = 0.5, SOURCE_Y_ANCHOR = 0.20;
  function drawWater(dt){
    const cw=W(), ch=H();
    if (!waterReady || !strip){
      ctx.fillStyle = "#0a7390";
      ctx.fillRect(0,0,cw,ch);
      return;
    }
    const iw=waterTex.width, ih=waterTex.height;
    const targetAspect = cw/ch;
    const sw0 = iw*VIEW_FRACTION, sh0 = ih*VIEW_FRACTION;
    let sw=sw0, sh=sh0; if (sw/sh > targetAspect) sw = sh*targetAspect; else sh = sw/targetAspect;

    const syMax = ih - sh;
    let sy = clamp(ih*SOURCE_Y_ANCHOR - sh*0.5, 0, syMax);

    const destScale = cw / sw, bgFollow  = 0.95;
    const pxPerSecInSource = (cachedWorldSpeed * bgFollow) / destScale;
    waterU = (waterU + (state.running ? pxPerSecInSource * dt : 0)) % stripW;

    let u = waterU; if (u < 0) u += stripW;
    const needSplit = (u + sw) > stripW;
    const dh = ch, dw = cw, dy = 0;

    if (!needSplit) { ctx.drawImage(strip, u, sy, sw, sh, 0, dy, dw, dh); }
    else {
      const w1 = stripW - u, w2 = sw - w1, dw1 = (w1 / sw) * dw;
      ctx.drawImage(strip, u,   sy, w1, sh, 0,   dy, dw1, dh);
      ctx.drawImage(strip, 0.0, sy, w2, sh, dw1, dy, dw-dw1, dh);
    }
  }

  // ---------- Spawns ----------
  function spawnOrb(){ 
    const s = 14 * (W()/820); 
    const o = getFromPool('orb');
    o.x = W()+40; 
    o.y = rand(60,H()-60); 
    o.r = s; 
    o.phase = rand(0,Math.PI*2);
    orbs.push(o);
  }
  
  function explosiveChance(){
    if (state.score < 500) return 0;
    const t = clamp((state.score-500)/1000, 0, 1);
    return 0.18 + t*(0.50-0.18);
  }

  // Répartition mines
  let _lastMineY = null;
  function pickMineY(){
    const edgeBias = 0.35;
    const m = 48*(H()/720), band = 88*(H()/720);
    let y;
    if (state.rng() < edgeBias){
      if (state.rng() < 0.5) y = rand(m, m + band);
      else                   y = rand(H()-m-band, H()-m);
    } else {
      y = rand(60, H()-60);
    }
    if (_lastMineY !== null && Math.abs(y - _lastMineY) < 64*(H()/720)){
      y += (y < H()/2 ? -1 : 1) * 64*(H()/720);
      y = clamp(y, m, H()-m);
    }
    _lastMineY = y;
    return y;
  }

  function gateChance(){
    const s = state.score;
    if (s < 600) return 0;
    if (s > 3500) return 0.30;
    if (s > 2000) return 0.18 + (s-2000)*(0.12/1500);
    return (s-600)*(0.18/1400);
  }

  function spawnMine(){
    if (state.gateCooldown <= 0 && state.rng() < gateChance()){
      spawnMineGate();
      state.gateCooldown = 2.2 + state.rng()*2.0;
      return;
    }
    const s = rand(22,30)*(W()/820);
    const m = getFromPool('mine');
    m.x = W()+60;
    m.y = pickMineY();
    m.w = s; 
    m.h = s;
    m.explosive = state.rng() < explosiveChance();
    m.blinking = false; 
    m.blinkCount = 0; 
    m.blinkTimer = 0; 
    m.exploded = false;
    mines.push(m);
  }

  function spawnMineGate(){
    const h = H(), w = W();
    const baseSize = 24*(W()/820);
    const rowStep = 60*(h/720), margin = 44*(h/720);

    const minGap = 110*(h/720), gapGrow = 50*(1 - cachedDifficulty)*(h/720);
    const gap = Math.max(minGap, minGap + gapGrow);
    const gapCenter = clamp(player.y + rand(-100,100), margin+gap*0.5, h-margin-gap*0.5);
    const gapTop = gapCenter - gap*0.5, gapBottom = gapCenter + gap*0.5;

    const rows = Math.floor((h - margin*2) / rowStep);
    const xStart = w + 70, xJitter = 22*(W()/820);

    for (let i=0;i<=rows;i++){
      const y = margin + i*rowStep + rand(-6,6);
      if (y > gapTop && y < gapBottom) continue;
      const s = rand(baseSize*0.9, baseSize*1.25);
      const jitter = rand(-xJitter, xJitter);
      const explosive = state.rng() < (explosiveChance() * 0.70);
      const m = getFromPool('mine');
      m.x = xStart+jitter;
      m.y = y;
      m.w = s;
      m.h = s;
      m.explosive = explosive;
      m.blinking = false;
      m.blinkCount = 0;
      m.blinkTimer = 0;
      m.exploded = false;
      mines.push(m);
    }
  }

  function spawnOrca(){ 
    const s=64*(W()/820); 
    const o = getFromPool('orca');
    o.x = W()+90;
    o.y = rand(70,H()-70);
    o.w = s;
    o.h = s;
    o.vy = rand(-40,40);
    o.phase = rand(0,Math.PI*2);
    orcas.push(o);
  }
  
  function spawnHeart(){ 
    const s=34*(W()/820); 
    const h = getFromPool('heart');
    h.x = W()+70;
    h.y = rand(60,H()-60);
    h.s = s;
    hearts.push(h);
  }

  // ---------- BONUS sprites ----------
  const bonusImgs = {
    legendary: "static/abyss/img/bonus.png",
    bonus2:   "static/abyss/img/bonus2.png",
    special:  "static/abyss/img/special.png",
    platinum: "static/abyss/img/platinum.png",
    angrywhales:   "static/abyss/img/angrywhales.png",
    diamonds: "static/abyss/img/diamonds.png",
  };
  const loadedImgs = {};
  function preloadImg(name, url){
    const img = new Image();
    img.src = url;
    loadedImgs[name] = img;
  }
  (function preloadBonusSprites(){
    Object.entries(bonusImgs).forEach(([name, url]) => preloadImg(name, url));
  })();

  // ---------- BONUS draw ----------
  function drawBonus(b){
    const t = state.elapsed;
    const bob = Math.sin(t * 2 + (b.y * 0.05)) * 4;
    const x = b.x, y = b.y + bob, s = b.s;

    // halo léger
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const g = ctx.createRadialGradient(x + s*0.5, y + s*0.5, 0, x + s*0.5, y + s*0.5, s*0.9);
    if (b.type === "legendary") g.addColorStop(0, "rgba(255,215,80,0.7)");
    else if (b.type === "platinum") g.addColorStop(0, "rgba(200,200,255,0.7)");
    else if (b.type === "special") g.addColorStop(0, "rgba(160,255,180,0.7)");
    else if (b.type === "angrywhales") g.addColorStop(0, "rgba(180,230,255,0.7)");
    else g.addColorStop(0, "rgba(180,220,255,0.6)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x + s*0.5, y + s*0.5, s*0.9, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    // sprite
    const img = loadedImgs[b.type];
    if (img && img.complete) {
      ctx.drawImage(img, x, y, s, s);
    } else {
      ctx.save();
      ctx.translate(x + s/2, y + s/2);
      let col = "#c0d8ff";
      if (b.type === "legendary") col = "#ffd24a";
      else if (b.type === "platinum") col = "#b0b0ff";
      else if (b.type === "special") col = "#b6ffd3";
      else if (b.type === "angrywhales") col = "#b6e0ff";
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(0, 0, s*0.42, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ---------- BONUS spawn ----------
  function spawnBonus(type){
    const s = 44 * (W()/820);
    const y = rand(70, H()-70);
    const b = getFromPool('bonus');
    b.type = type;
    b.x = W()+80;
    b.y = y;
    b.s = s;
    b.vx = -cachedWorldSpeed;
    bonuses.push(b);
    
    if (type === 'legendary') state.goldSpawned = true;
    else if (type === 'bonus2') state.silverSpawned = true;
    else if (type === 'platinum') state.platinumSpawned = true;
    else if (type === 'special') state.specialSpawned = true;
    else if (type === 'angrywhales') state.angrywhalesSpawned = true;
  }

  // ---------- Explosions (×0.5) ----------
  function spawnExplosion(x, y, size = 36){
    const base = 16 + Math.floor(size * 0.6);
    const count = Math.max(1, Math.floor(base * 0.5));
    for (let i=0;i<count;i++){
      const ang = rand(0, Math.PI*2), spd = rand(120, 260);
      const p = getFromPool('explosion');
      p.x = x;
      p.y = y;
      p.vx = Math.cos(ang)*spd;
      p.vy = Math.sin(ang)*spd - rand(0,50);
      p.r = rand(2.2,4.6);
      p.a = 1;
      p.life = rand(0.28,0.55);
      p.hue = rand(12,28);
      explosions.push(p);
    }
    const f = getFromPool('flash');
    f.x = x;
    f.y = y;
    f.r = size*1.8;
    f.life = 0.22;
    flashes.push(f);
    playSfx(audio.explosion, 0.9);
  }
  
  function updateExplosions(dt){
    for (let i=explosions.length-1;i>=0;i--){
      const p=explosions[i]; 
      p.x+=p.vx*dt; 
      p.y+=p.vy*dt; 
      p.life-=dt; 
      p.a=Math.max(0,p.life*1.2);
      if(p.life<=0) {
        returnToPool('explosion', explosions[i]);
        explosions.splice(i,1);
      }
    }
    for (let i=flashes.length-1;i>=0;i--){ 
      const f=flashes[i]; 
      f.life-=dt; 
      if(f.life<=0) {
        returnToPool('flash', flashes[i]);
        flashes.splice(i,1);
      }
    }
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

  // ---------- Bulles (-10%) ----------
  function spawnBubbles(dt){
    const rate = player.boost? 120*0.9 : 60*0.9;
    player.bubbleTimer += dt*rate;
    const n=Math.floor(player.bubbleTimer); player.bubbleTimer-=n;
    for(let i=0;i<n;i++){
      const base = player.boost? 1.4 : 1.0;
      const b = getFromPool('bubble');
      b.x = player.x()-8+rand(-3,3);
      b.y = player.y+rand(-6,6);
      b.vx = -80*base + rand(-10,10);
      b.vy = rand(-18,18);
      b.a = 0.9;
      b.r = rand(1.5,3.5)*base;
      b.life = 0.9;
      bubbles.push(b);
    }
  }
  
  function updateBubbles(dt){
    for(let i=bubbles.length-1;i>=0;i--){
      const b=bubbles[i]; 
      b.x+=b.vx*dt; 
      b.y+=b.vy*dt; 
      b.vy-=12*dt; 
      b.life-=dt; 
      b.a=Math.max(0,b.life);
      if(b.life<=0) {
        returnToPool('bubble', bubbles[i]);
        bubbles.splice(i,1);
      }
    }
  }
  
  function drawBubbles(){
    ctx.save(); ctx.globalCompositeOperation="screen";
    for(const b of bubbles){ 
      ctx.fillStyle=`rgba(255,255,255,${0.35*b.a})`; 
      ctx.beginPath(); 
      ctx.arc(b.x,b.y,b.r,0,Math.PI*2); 
      ctx.fill(); 
    }
    ctx.restore();
  }

  // ---------- Collisions & helpers ----------
  function circleHit(x1,y1,r1,x2,y2,r2){ 
    const dx=x1-x2,dy=y1-y2; 
    return dx*dx+dy*dy <= (r1+r2)*(r1+r2); 
  }
  
  function rectCircleHit(rx,ry,rw,rh,cx,cy,cr){ 
    const tx=clamp(cx,rx,rx+rw), ty=clamp(cy,ry,ry+rh); 
    const dx=cx-tx, dy=cy-ty; 
    return dx*dx+dy*dy <= cr*cr; 
  }
  
  function roundedRect(c,x,y,w,h,r){ 
    r=Math.min(r,Math.abs(w)*.5,Math.abs(h)*.5); 
    c.beginPath(); 
    c.moveTo(x+r,y); 
    c.arcTo(x+w,y,x+w,y+h,r); 
    c.arcTo(x+w,y+h,x,y+h,r); 
    c.arcTo(x,y+h,x,y,r); 
    c.arcTo(x,y,x+w,y,r); 
    c.closePath(); 
  }

  // ---------- Bulles orques ----------
  function spawnOrcaBubbles(o, dt){
    const rate = 18; 
    if (state.rng() < rate*dt){
      const b = getFromPool('orcaBubble');
      b.x = o.x + o.w*0.1;
      b.y = o.y + o.h*0.6;
      b.vx = -90 + rand(-20,10);
      b.vy = rand(-10,10);
      b.a = 0.8;
      b.r = rand(1.2,2.2);
      b.life = 0.8;
      orcaBubbles.push(b);
    }
  }
  
  function updateOrcaBubbles(dt){
    for(let i=orcaBubbles.length-1;i>=0;i--){
      const b=orcaBubbles[i]; 
      b.x+=b.vx*dt; 
      b.y+=b.vy*dt; 
      b.vy-=8*dt; 
      b.life-=dt; 
      b.a=Math.max(0,b.life);
      if(b.life<=0) {
        returnToPool('orcaBubble', orcaBubbles[i]);
        orcaBubbles.splice(i,1);
      }
    }
  }
  
  function drawOrcaBubbles(){
    ctx.save(); ctx.globalCompositeOperation="screen";
    for(const b of orcaBubbles){ 
      ctx.fillStyle=`rgba(255,255,255,${0.28*b.a})`; 
      ctx.beginPath(); 
      ctx.arc(b.x,b.y,b.r,0,Math.PI*2); 
      ctx.fill(); 
    }
    ctx.restore();
  }

  // ---------- Sprites ----------
  function loadSprite(paths){ 
    const img=new Image(); 
    let ready=false, i=0; 
    function next(){ 
      if(i>=paths.length) return; 
      img.src=paths[i++]; 
      img.onload=()=>ready=true; 
      img.onerror=next; 
    } 
    next(); 
    return {img, get ready(){return ready;}}; 
  }
  
  const sprites = {
    whale: loadSprite(["static/abyss/img/whale.png"]),
    orca : loadSprite(["static/abyss/img/orca.png"]),
    shark: loadSprite(["static/abyss/img/shark.png"]),
    chest: loadSprite(["static/abyss/img/chest.png"]),
    orb  : loadSprite(["static/abyss/img/orb.png"]),
    mine : loadSprite(["static/abyss/img/mine.png"]),
    heart: loadSprite(["static/abyss/img/heart.png"])
  };

  const WHALE_LENGTH_MULT = 2.5;
  function drawWhale(x,y,r,tilt=0){
    const baseScale = 3.5 * 1.5;
    const w = r * 1.2 * baseScale * WHALE_LENGTH_MULT;
    const h = r * 2 * baseScale;
    const swim = Math.sin(state.elapsed * 8) * 0.06;
    const bend = clamp((player.vy / player.maxVy) * 0.30 + swim, -0.40, 0.40);

    ctx.save(); ctx.translate(x,y); ctx.rotate(tilt);
    if (sprites.whale.ready) {
      const img=sprites.whale.img, left=-w*0.5, right=w*0.5, top=-h*0.5, tailPivotX=-w*0.22, seam=1;
      ctx.save(); ctx.beginPath(); ctx.rect(tailPivotX - seam, top, (right - tailPivotX) + seam, h); ctx.clip(); ctx.drawImage(img, left, top, w, h); ctx.restore();
      ctx.save(); ctx.translate(tailPivotX, 0); ctx.rotate(bend); ctx.translate(-tailPivotX, 0);
      ctx.beginPath(); ctx.rect(left, top, (tailPivotX - left) + seam, h); ctx.clip(); ctx.drawImage(img, left, top, w, h); ctx.restore();
    } else {
      ctx.fillStyle="#fff2e9"; roundedRect(ctx,-r*.9,-r*.8,r*1.6,r*1.4,r*.6); ctx.fill();
      ctx.fillStyle="#263238"; ctx.beginPath(); ctx.arc(r*.2,-r*.15,2.4,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
  
  function drawOrca(o){ 
    if (sprites.orca.ready) ctx.drawImage(sprites.orca.img, o.x, o.y, o.w, o.h); 
    else { ctx.fillStyle="#0d1b2a"; ctx.fillRect(o.x,o.y,o.w,o.h); } 
  }
  
  function drawShark(s){
    if (sprites.shark.ready) ctx.drawImage(sprites.shark.img, s.x, s.y, s.w, s.h);
    else { ctx.fillStyle="#1f3e4a"; ctx.fillRect(s.x,s.y,s.w,s.h); }
  }
  
  function drawChest(c){
    if (sprites.chest.ready) ctx.drawImage(sprites.chest.img, c.x, c.y, c.w, c.h);
    else { ctx.fillStyle="#c59f3c"; ctx.fillRect(c.x, c.y, c.w, c.h); }
  }

  // Orbes optimisés
  function drawOrb(o, allowGlow){
    const pulse = 0.7 + 0.3*Math.sin(o.phase||0);
    if (allowGlow){
      const glowR = (o.r*2.1) * pulse;
      ctx.save(); ctx.globalCompositeOperation="screen";
      const g=ctx.createRadialGradient(o.x,o.y,0,o.x,o.y,glowR);
      g.addColorStop(0,"rgba(120,255,180,0.65)"); g.addColorStop(1,"rgba(120,255,180,0)");
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(o.x,o.y,glowR,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
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
      const r=Math.min(m.w,m.h)*0.5; ctx.save(); ctx.translate(m.x+m.w*.5, m.y+m.h*.5);
      ctx.fillStyle="rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.arc(0,0,r+2,0,Math.PI*2); ctx.fill();
      const g=ctx.createRadialGradient(-r*.4,-r*.4,r*.2,0,0,r); g.addColorStop(0,"#ffb17a"); g.addColorStop(1,"#ff5c2e");
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
    const cx = m.x + m.w*0.5, cy = m.y + m.h*0.5;
    let color = "rgba(50,255,120,0.95)"; let radius = Math.max(2.5, Math.min(m.w,m.h)*0.10);
    if (m.explosive){ 
      color = "rgba(255,180,60,0.95)"; 
      if (m.blinking){ 
        const blink = (Math.sin(state.elapsed*12) > 0) ? 1 : 0.35; 
        color = `rgba(255,60,60,${0.85*blink})`; 
        radius *= 1.15; 
      } 
    }
    ctx.save(); ctx.globalCompositeOperation = "screen";
    const glow = ctx.createRadialGradient(cx,cy,0,cx,cy,radius*3.2);
    glow.addColorStop(0, color.replace("0.95","0.85")); glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx,cy,radius*2.4,0,Math.PI*2); ctx.fill(); ctx.restore();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx,cy,radius,0,Math.PI*2); ctx.fill();
  }
  
  function drawHeart(h){
    const x = h.x!==undefined ? h.x : (h.x=W()+70), y = h.y, s = h.s;
    if (sprites.heart.ready) ctx.drawImage(sprites.heart.img, x, y, s, s);
    else { 
      ctx.save(); ctx.translate(x+s*0.5, y+s*0.5); ctx.scale(s/40, s/40); ctx.fillStyle="#ff4d6d"; ctx.beginPath();
      ctx.moveTo(0,12); ctx.bezierCurveTo(0,-6,-18,-6,-18,8); ctx.bezierCurveTo(-18,20,0,28,0,36);
      ctx.bezierCurveTo(0,28,18,20,18,8); ctx.bezierCurveTo(18,-6,0,-6,0,12); ctx.fill(); ctx.restore(); 
    }
  }

  // ---------- Sharks ----------
  function spawnShark(){
    const s = 120*(W()/820);
    let attempts = 8;
    while (attempts-- > 0){
      const x = W()+90, y = rand(70, H()-70), w = s, h = s;
      let ok = true;
      for (const o of orcas){ if (aabbOverlap(x, y, w, h, o.x, o.y, o.w, o.h)){ ok = false; break; } }
      if (ok) for (const sh of sharks){ if (aabbOverlap(x, y, w, h, sh.x, sh.y, sh.w, sh.h)){ ok = false; break; } }
      if (ok){ 
        const shark = getFromPool('shark');
        shark.x = x; shark.y = y; shark.w = w; shark.h = h;
        shark.vy = rand(-50,50);
        shark.phase = rand(0, Math.PI*2);
        sharks.push(shark); 
        return; 
      }
    }
    const shark = getFromPool('shark');
    shark.x = W()+90; 
    shark.y = rand(70,H()-70);
    shark.w = s;
    shark.h = s;
    shark.vy = rand(-50,50);
    shark.phase = rand(0,Math.PI*2);
    sharks.push(shark);
  }
  
  function sharkReplacementChance(score){
    if (score < 600) return 0;
    if (score < 1200) return 0.25;
    if (score < 2200) return 0.4;
    if (score < 3200) return 0.5;
    return 0.6;
  }

  // ---------- Coffres (mobiles) ----------
  function chestChance(xp){
    if (xp >= 1000 && xp <= 2000) return 0.60;
    if (xp >= 500  && xp < 1000)  return 0.30;
    if (xp >= 100  && xp < 500)   return 0.20;
    if (xp >= 0    && xp < 150)   return 0.05;
    return 0.00;
  }
  
  function spawnChest(){
    const base = 48*(W()/820);
    const w = base*1.00, h = base*0.95;
    let attempts = 12;
    while (attempts-- > 0){
      const x = W()+80, y = rand(70, H()-70);
      let ok = true;
      for (const o of orcas){ if (aabbOverlap(x,y,w,h,o.x,o.y,o.w,o.h)){ ok=false; break; } }
      if (ok) for (const s of sharks){ if (aabbOverlap(x,y,w,h,s.x,s.y,s.w,s.h)){ ok=false; break; } }
      if (ok) for (const c of chests){ if (aabbOverlap(x,y,w,h,c.x,c.y,c.w,c.h)){ ok=false; break; } }
      if (ok){ 
        const chest = getFromPool('chest');
        chest.x = x; chest.y = y; chest.w = w; chest.h = h;
        chests.push(chest); 
        return true; 
      }
    }
    const chest = getFromPool('chest');
    chest.x = W()+80;
    chest.y = rand(70,H()-70);
    chest.w = w;
    chest.h = h;
    chests.push(chest);
    return true;
  }

  // ---------- Update ----------
  function update(dt){
    state.elapsed += dt;
    if (state.gateCooldown > 0) state.gateCooldown -= dt;

    // CACHE : recalcul périodique des valeurs coûteuses
    cacheTimer += dt;
    if (cacheTimer >= CACHE_INTERVAL) {
      cacheTimer = 0;
      cachedDifficulty = difficulty();
      cachedWorldSpeed = worldSpeed();
    }

    // mouvements joueur
    const kUp   = keys.has("arrowup")   || keys.has("w");
    const kDown = keys.has("arrowdown") || keys.has("s");
    const tUp = mobUp, tDown = mobDown;

    if (IS_MOBILE && mobileCtrl.active && mobileCtrl.targetY != null){
      const aim = clamp(mobileCtrl.targetY, 26, H()-26);
      const k = 10.0; const dy = aim - player.y;
      player.vy = clamp(player.vy + dy * k * dt, -player.maxVy, player.maxVy);
    } else {
      let ay = 0; const up=tUp||kUp, down=tDown||kDown;
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

    // timers (difficulté) - utilise le cache
    const d = cachedDifficulty;
    const spawnScale = 1.25 + Math.min(1.65, (state.elapsed/65) + (state.score/1100) + d*0.7);
    state.orbTimer   -= dt; state.mineTimer  -= dt; state.orcaTimer  -= dt; state.heartTimer -= dt;

    if (state.orbTimer <= 0){
      spawnOrb();
      state.orbTimer  = (Math.random()*(0.95-0.65)+0.65) / spawnScale;
    }
    if (state.mineTimer <= 0){
      spawnMine();
      state.mineTimer = (Math.random()*(1.15-0.72)+0.72) / (spawnScale * (1 + d*0.30));
    }

    if ((state.score>120 || state.elapsed>22) && state.orcaTimer <= 0){
      const chance = sharkReplacementChance(state.score);
      const doShark = (state.score >= 600) && (Math.random() < chance);
      if (doShark) spawnShark(); else spawnOrca();
      state.orcaTimer = (Math.random()*(4.6-3.0)+3.0) / (0.85 + 0.55*spawnScale);
    }

    if (state.score >= 600){
      state.sharkTimer -= dt;
      if (state.sharkTimer <= 0){
        spawnShark();
        state.sharkTimer = (Math.random()*(6.0-4.2)+4.2) / (0.82 + 0.45*spawnScale);
      }
    }

    if (state.elapsed >= state.nextHeartAt && state.heartTimer <= 0){
      if (state.rng() < 0.5) spawnHeart(); state.nextHeartAt += 120; state.heartTimer = 5;
    }

    // Coffres
    state.chestTimer -= dt;
    if (state.chestTimer <= 0){
      const xp = state.score|0;
      const chance = chestChance(xp);
      if (chests.length < state.chestOnScreenMax && state.chestSpawnedThisRun < state.chestMaxPerRun){
        if (Math.random() < chance){
          if (spawnChest()) state.chestSpawnedThisRun++;
        }
      }
      state.chestTimer = (Math.random()*(18-10)+10) / (1 + d*0.25);
    }

    // ----- BONUS (tirages aux paliers de score) -----
    const xp = state.score|0;
    const canSpawnBonuses = state.bonusGate === true; // verrou local (≥20 NFTs)

    if (canSpawnBonuses) {
      // SILVER : 100 → 15% ; 600 → 45% (si stock global ET quota wallet disponibles)
      if (!state.silverSpawned && state.bonusAvailable.silver && state.bonusEligible.silver){
        if (!state.silverChecked100 && xp >= 100){
          state.silverChecked100 = true;
          if (Math.random() < 0.15) {
            state.silverPendingAtScore = xp + Math.floor(80 + Math.random()*140);
          }
        }
        if (!state.silverSpawned && !state.silverChecked600 && xp >= 600){
          state.silverChecked600 = true;
          if (Math.random() < 0.45) {
            state.silverPendingAtScore = xp + Math.floor(80 + Math.random()*160);
          }
        }
      }
      if (!state.silverSpawned && state.silverPendingAtScore != null && xp >= state.silverPendingAtScore){
        // Double-check avant spawn (au cas où stock épuisé entre-temps)
        if (state.bonusAvailable.silver && state.bonusEligible.silver) {
          spawnBonus('bonus2'); // SILVER
        }
        state.silverPendingAtScore = null;
      }

      // GOLD : 1000 → 8% ; 1500 → 15% (si stock global ET quota wallet disponibles)
      if (!state.goldSpawned && state.bonusAvailable.gold && state.bonusEligible.gold){
        if (!state.goldChecked1000 && xp >= 1000){
          state.goldChecked1000 = true;
          if (Math.random() < 0.08) {
            state.goldPendingAtScore = xp + Math.floor(100 + Math.random()*180);
          }
        }
        if (!state.goldSpawned && !state.goldChecked1500 && xp >= 1500){
          state.goldChecked1500 = true;
          if (Math.random() < 0.15) {
            state.goldPendingAtScore = xp + Math.floor(100 + Math.random()*200);
          }
        }
      }
      if (!state.goldSpawned && state.goldPendingAtScore != null && xp >= state.goldPendingAtScore){
        if (state.bonusAvailable.gold && state.bonusEligible.gold) {
          spawnBonus('legendary'); // GOLD
        }
        state.goldPendingAtScore = null;
      }

      // PLATINUM : 1800 → 4% ; 2500 → 8% (si stock global ET quota wallet disponibles)
      if (!state.platinumSpawned && state.bonusAvailable.platinum && state.bonusEligible.platinum){
        if (!state.platinumChecked1800 && xp >= 1800){
          state.platinumChecked1800 = true;
          if (Math.random() < 0.04) {
            state.platinumPendingAtScore = xp + Math.floor(120 + Math.random()*200);
          }
        }
        if (!state.platinumSpawned && !state.platinumChecked2500 && xp >= 2500){
          state.platinumChecked2500 = true;
          if (Math.random() < 0.08) {
            state.platinumPendingAtScore = xp + Math.floor(120 + Math.random()*220);
          }
        }
      }
      if (!state.platinumSpawned && state.platinumPendingAtScore != null && xp >= state.platinumPendingAtScore){
        if (state.bonusAvailable.platinum && state.bonusEligible.platinum) {
          spawnBonus('platinum'); // PLATINUM
        }
        state.platinumPendingAtScore = null;
      }

      // SPECIAL : 5% 1×/run, apparition différée 300–900 XP (si stock ET quota OK)
      if (!state.specialSpawned && state.specialWillSpawnThisRun && state.specialPendingAtScore != null && xp >= state.specialPendingAtScore){
        if (state.bonusAvailable.special && state.bonusEligible.special) {
          spawnBonus('special');
        }
        state.specialPendingAtScore = null;
      }

      // ANGRY WHALES (saisonnier, front-only claim mais respect stock) : dès 200 XP → 10%
      if (!state.angrywhalesSpawned && state.bonusAvailable.angrywhales && state.bonusEligible.angrywhales){
        if (!state.angrywhalesChecked200 && xp >= 200){
          state.angrywhalesChecked200 = true;
          if (Math.random() < 0.10){
            state.angrywhalesPendingAtScore = xp + Math.floor(80 + Math.random()*160);
          }
        }
        if (state.angrywhalesPendingAtScore != null && xp >= state.angrywhalesPendingAtScore){
          if (state.bonusAvailable.angrywhales && state.bonusEligible.angrywhales) {
            spawnBonus('angrywhales');
          }
          state.angrywhalesPendingAtScore = null;
        }
      }
    } else {
      // Si pas éligible aux bonus, on purge tout pending pour éviter un spawn tardif
      state.silverPendingAtScore = null;
      state.goldPendingAtScore = null;
      state.platinumPendingAtScore = null;
      state.specialPendingAtScore = null;
      state.angrywhalesPendingAtScore = null;
    }

    // monde → gauche (utilise le cache)
    const vx = -cachedWorldSpeed * dt;

    // Orbes
    for (let i=orbs.length-1;i>=0;i--){ 
      orbs[i].x+=vx; 
      if(orbs[i].x<-40) {
        returnToPool('orb', orbs[i]);
        orbs.splice(i,1);
      }
    }

    // Mines
    for (let i=mines.length-1;i>=0;i--){
      const mObj = mines[i]; 
      mObj.x += vx; 
      if (mObj.x < -60){ 
        returnToPool('mine', mines[i]);
        mines.splice(i,1); 
        continue; 
      }
      if (mObj.explosive && !mObj.exploded && !mObj.blinking){
        if (mObj.x < player.x() + W()*0.18) { mObj.blinking = true; mObj.blinkTimer = 0; mObj.blinkCount = 0; }
      }
      if (mObj.blinking && !mObj.exploded){
        mObj.blinkTimer += dt;
        if (mObj.blinkTimer >= 0.25){
          mObj.blinkTimer = 0; mObj.blinkCount++;
          if (mObj.blinkCount >= 3){
            const nearX = mObj.x < player.x() + W()*0.02;
            const nearY = Math.abs((mObj.y + mObj.h*0.5) - player.y) <= 120;
            if (nearX && nearY){ triggerMineExplosion(i, mObj); continue; }
          }
        }
      }
      if (mObj.explosive && !mObj.exploded && mObj.blinkCount >= 3 && mObj.x < player.x() - W()*0.08){
        triggerMineExplosion(i, mObj); continue;
      }
      if (!mObj.exploded){
        if (rectCircleHit(mObj.x,mObj.y,mObj.w,mObj.h, player.x(),player.y,player.radius)){
          spawnExplosion(mObj.x + mObj.w * 0.5, mObj.y + mObj.h * 0.5, Math.max(mObj.w,mObj.h));
          returnToPool('mine', mines[i]);
          mines.splice(i,1); 
          takeHit(); 
          continue;
        }
      }
    }

    // Orques
    const orcaSpeed = orcaSpeedFactor();
    for (let i=orcas.length-1;i>=0;i--){
      const o=orcas[i];
      o.x += vx*1.25*orcaSpeed;
      o.y += o.vy*dt + Math.sin((state.elapsed+o.phase)*2.0)*20*dt;
      if (o.x < -100) {
        returnToPool('orca', orcas[i]);
        orcas.splice(i,1);
      } else {
        spawnOrcaBubbles(o, dt);
      }
    }

    // Sharks
    for (let i=sharks.length-1;i>=0;i--){
      const s=sharks[i];
      s.x += vx*1.32*orcaSpeed;
      s.y += s.vy*dt + Math.sin((state.elapsed+s.phase)*2.2)*22*dt;
      if (s.x < -100) {
        returnToPool('shark', sharks[i]);
        sharks.splice(i,1);
      }
    }

    // Coffres
    for (let i=chests.length-1;i>=0;i--){
      const c = chests[i];
      c.x += vx * 0.95;
      if (c.x < -80){ 
        returnToPool('chest', chests[i]);
        chests.splice(i,1); 
        continue; 
      }

      const cx = c.x + c.w*0.5, cy = c.y + c.h*0.5, rr = Math.max(18, Math.min(c.w,c.h)*0.45);
      if (circleHit(player.x(),player.y,player.radius, cx, cy, rr)){
        returnToPool('chest', chests[i]);
        chests.splice(i,1);
        state.score += 100;
        playSfx(audio.chest || audio.bonus, 1.0);
        try { document.dispatchEvent(new CustomEvent('aw:chestPicked')); } catch {}
      }
    }

    // Cœurs
    for (let i=hearts.length-1;i>=0;i--){
      const h = hearts[i];
      h.x = (h.x||0) + vx;
      if (h.x < -70){ 
        returnToPool('heart', hearts[i]);
        hearts.splice(i,1); 
        continue; 
      }
      const cx = h.x + h.s*0.5, cy = h.y + h.s*0.5, rr = Math.max(12, h.s*0.35);
      if (circleHit(player.x(),player.y,player.radius, cx, cy, rr)){
        returnToPool('heart', hearts[i]);
        hearts.splice(i,1);
        if (state.lives < state.maxLives) state.lives += 1;
        playSfx(audio.heart, 1.0);
      }
    }

    // Orbes collisions
    for (let i=orbs.length-1;i>=0;i--){
      const o=orbs[i];
      if (circleHit(player.x(),player.y,player.radius, o.x,o.y,o.r)){ 
        returnToPool('orb', orbs[i]);
        orbs.splice(i,1); 
        state.score+=10; 
        playSfx(audio.orb, 0.9); 
      } else { 
        o.phase = (o.phase||0) + 3.0*dt; 
      }
    }
    
    // Orques / Sharks collisions
    for (let i=orcas.length-1;i>=0;i--){
      const o=orcas[i], rr=Math.max(o.w,o.h)*0.35;
      if (circleHit(player.x(),player.y,player.radius, o.x+o.w*0.5, o.y+o.h*0.5, rr)){
        returnToPool('orca', orcas[i]);
        orcas.splice(i,1);
        playSfx(audio.orca, 1.0);
        takeHit();
      }
    }
    for (let i=sharks.length-1;i>=0;i--){
      const s=sharks[i], rr=Math.max(s.w,s.h)*0.35;
      if (circleHit(player.x(),player.y,player.radius, s.x+s.w*0.5, s.y+s.h*0.5, rr)){
        returnToPool('shark', sharks[i]);
        sharks.splice(i,1);
        playSfx(audio.shark, 1.0);
        takeHit();
      }
    }

    // BONUS déplacement + collision
    for (let i=bonuses.length-1;i>=0;i--){
      const b = bonuses[i];
      b.x += vx;
      if (b.x < -80){ 
        returnToPool('bonus', bonuses[i]);
        bonuses.splice(i,1); 
        continue; 
      }
      const cx = b.x + b.s*0.5, cy = b.y + b.s*0.5, rr = Math.max(16, b.s*0.35);
      if (circleHit(player.x(),player.y,player.radius, cx, cy, rr)){
        const type = b.type;
        returnToPool('bonus', bonuses[i]);
        bonuses.splice(i,1);
        
        let xpGain = 40;
        if (type === 'legendary') xpGain = 150;
        else if (type === 'platinum') xpGain = 220;
        else if (type === 'special') xpGain = 60;
        else if (type === 'angrywhales') xpGain = 80;
        state.score += xpGain;
        playSfx(audio.bonus, 1.0);

        try {
          const wallet = localStorage.getItem('walletAddress') || null;
          if (type === 'legendary') {
            state.runBonuses.gold++;
            postJSON('api/bonus/claim', { type: 'legendary', wallet }).then(() => {
              // Après claim réussi, refresh immédiat des flags
              refreshBonusFlags();
            }).catch(()=>{});
          } else if (type === 'bonus2') {
            state.runBonuses.silver++;
            postJSON('api/bonus/claim', { type: 'bonus2', wallet }).then(() => {
              refreshBonusFlags();
            }).catch(()=>{});
          } else if (type === 'platinum') {
            state.runBonuses.platinum++;
            postJSON('api/bonus/claim', { type: 'platinum', wallet }).then(() => {
              refreshBonusFlags();
            }).catch(()=>{});
          } else if (type === 'special') {
            state.runBonuses.special++;
            postJSON('api/bonus/claim', { type: 'special', wallet }).then(() => {
              refreshBonusFlags();
            }).catch(()=>{});
          } else if (type === 'angrywhales') {
            state.runBonuses.angrywhales++;
            postJSON('api/bonus/claim', { type: 'angrywhales', wallet }).then(() => {
              refreshBonusFlags();
            }).catch(()=>{});
          }
        }catch{}

        try { document.dispatchEvent(new CustomEvent('aw:bonusClaimed', { detail:{ type } })); } catch {}
        // Plus besoin de refreshBonusFlags() ici car déjà fait dans le .then() du claim
      }
    }

    // Effets
    updateOrcaBubbles(dt);
    updateExplosions(dt);
  }

  // Explosion mine
  function triggerMineExplosion(index, mObj){
    mObj.exploded = true;
    const cx = mObj.x + mObj.w*0.5, cy = mObj.y + mObj.h*0.5;
    const base = 60 * (W()/820), extra = clamp((state.score-500)/1000, 0, 1) * 24;
    const radius = base + extra;
    spawnExplosion(cx, cy, Math.max(mObj.w,mObj.h)*1.6);
    if (circleHit(player.x(), player.y, player.radius, cx, cy, radius)) takeHit();
    returnToPool('mine', mines[index]);
    mines.splice(index,1);
  }

  // ---------- Game Over Overlay ----------
  const elGameOver = document.getElementById('gameover');
  const elGoBtn    = document.getElementById('go-restart');
  elGoBtn && elGoBtn.addEventListener('click', () => { hideGameOverOverlay(); resetGame(); });
  function showGameOverOverlay(){ if (elGameOver) elGameOver.style.display = 'flex'; }
  function hideGameOverOverlay(){ if (elGameOver) elGameOver.style.display = 'none'; }

  function takeHit(){
    state.lives-=1;
    player.vy = Math.max(player.vy - player.jumpImpulse*0.7, -player.maxVy);
    if (state.lives<=0) {
      state.running=false;
      submitBestRun()
        .finally(() => {
          sendBonusReportIfAny().finally(() => {
            try { document.dispatchEvent(new CustomEvent('aw:runEnded')); } catch {}
          });
        });
      showGameOverOverlay();
    }
  }

  // ---------- Dessin ----------
  const MAX_ORB_GLOWS = 5;
  let lastScoreTxt = null, lastLivesTxt = null;

  function draw(dt){
    drawWater(dt);

    // Orbes avec halo (top 5 proches)
    let glowSet = null;
    if (orbs.length > 0){
      const sorted = orbs
        .map((o, i) => ({i, d: Math.abs((o.x||0) - player.x())}))
        .sort((a,b)=>a.d-b.d)
        .slice(0, MAX_ORB_GLOWS);
      glowSet = new Set(sorted.map(x=>x.i));
    } else {
      glowSet = new Set();
    }

    // Orbes
    for (let i=0;i<orbs.length;i++){
      drawOrb(orbs[i], glowSet.has(i));
    }

    // Entités
    for(const m of mines) drawMine(m);
    for(const o of orcas) drawOrca(o);
    for(const s of sharks) drawShark(s);
    for(const h of hearts) drawHeart(h);
    for(const c of chests) drawChest(c);
    for(const b of bonuses) drawBonus(b);

    // Effets
    drawOrcaBubbles();
    drawExplosions();
    drawBubbles();

    // Joueur
    drawWhale(player.x(), player.y, player.radius, player.tilt);

    // HUD (optimisé)
    const sEl = document.getElementById("score");
    const lEl = document.getElementById("lives");
    if (sEl){
      const t = String(state.score|0);
      if (t !== lastScoreTxt){ sEl.textContent = t; lastScoreTxt = t; }
    }
    if (lEl){
      const t = String(state.lives|0);
      if (t !== lastLivesTxt){ lEl.textContent = t; lastLivesTxt = t; }
    }
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