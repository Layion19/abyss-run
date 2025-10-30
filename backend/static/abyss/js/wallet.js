// backend/static/abyss/js/wallet.js
// Gate "collant" + multi-wallet (EIP-6963), MetaMask QR (SDK), Abstract Global Wallet
// Bonus éligibles si balance >= 20 (ERC-721). Vérif auto 24h. Watchdog overlay.
// Émet `aw:accessChanged` à chaque changement d'accès/éligibilité.
//
// NOUVEAUTÉS v2 :
// - QR Code MetaMask VISIBLE (modal activé dans le SDK)
// - Abstract Global Wallet support (détection + bouton dédié)

(function () {
  "use strict";

  // ==================== Constantes ====================
  const WALLET_KEY = "walletAddress";
  const LAST_CHECK_KEY = "aw:lastBalanceCheckAt";
  const DAY_MS = 24 * 60 * 60 * 1000;
  const CHECK_EVERY_MS = 4000;
  const ENFORCE_EVERY_MS = 800;

  // Contrat ERC-721 Angry Whales
  const CONTRACT_ADDRESS = "0x8Bb25A82e2f0230c2CFE3278CBc16a2C93685359";

  // Réseau requis : Abstract mainnet (2741 décimal = 0xAB5 hex)
  const REQUIRED_CHAIN_ID = "0xAB5";

  // Paramètres chain
  const ABSTRACT_CHAIN_PARAMS = {
    chainId: REQUIRED_CHAIN_ID,
    chainName: "Abstract",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://api.mainnet.abs.xyz"],
    blockExplorerUrls: ["https://scan.abs.xyz/"]
  };

  // ==================== États ====================
  let currentProvider = null;
  let discoveredProviders = [];
  let mounted = false;
  let isChecking = false;
  let overlayWanted = true;
  let mmSdk = null;
  let abstractProvider = null;

  // ==================== Utils ====================
  const getStored = () => { try { return localStorage.getItem(WALLET_KEY) || null; } catch { return null; } };
  const setStored = (addr) => { try { addr ? localStorage.setItem(WALLET_KEY, addr) : localStorage.removeItem(WALLET_KEY); } catch {} };

  const lastCheckTooOld = () => {
    const t = Number(localStorage.getItem(LAST_CHECK_KEY) || 0);
    return !t || (Date.now() - t) > DAY_MS;
  };
  const markBalanceCheckedNow = () => {
    try { localStorage.setItem(LAST_CHECK_KEY, String(Date.now())); } catch {}
  };

  function hexToBigInt(x) {
    try {
      if (!x || x === "0x") return 0n;
      return BigInt(x);
    } catch { return 0n; }
  }

  // ==================== MetaMask SDK (QR VISIBLE) ====================
  async function ensureMetaMaskSdkLoaded() {
    if (window.MetaMaskSDK) return true;
    try {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://unpkg.com/@metamask/sdk/dist/metamask-sdk.umd.js";
        s.async = true;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
      return !!window.MetaMaskSDK;
    } catch { return false; }
  }

  async function getMetaMaskQRProvider() {
    const ok = await ensureMetaMaskSdkLoaded();
    if (!ok) return null;
    const SDK = window.MetaMaskSDK;
    if (!SDK) return null;

    if (!mmSdk) {
      mmSdk = new SDK({
        dappMetadata: { 
          name: "Angry Whales — Abyss Run", 
          url: location.origin 
        },
        // ========== CORRECTION : Activer les modals pour afficher le QR ==========
        useDeeplink: false,
        communicationServerUrl: "https://metamask-sdk.bridge.metamask.io",
        storage: { enabled: true },
        modals: { 
          install: true,  // Modal d'installation
          otp: true       // Modal QR/OTP
        },
        // Force l'affichage du QR
        ui: {
          installer: { auto: true },
          qrcodeModal: { open: true }
        },
        // Active le logging pour debug
        logging: { 
          developerMode: false,
          sdk: false
        }
      });
    }
    return mmSdk.getProvider();
  }

  // ==================== Abstract Global Wallet ====================
  
  // Détection du provider Abstract
  function detectAbstractProvider() {
    // Abstract peut s'injecter sous différents noms
    if (window.abstractProvider) {
      console.log('✅ Abstract provider détecté : window.abstractProvider');
      return window.abstractProvider;
    }
    
    if (window.abstract?.provider) {
      console.log('✅ Abstract provider détecté : window.abstract.provider');
      return window.abstract.provider;
    }
    
    // Si on est dans l'iframe du portail Abstract
    if (window.parent !== window && window.location.hostname.includes('abs.xyz')) {
      console.log('✅ Abstract détecté : iframe portal');
      return window.ethereum;
    }
    
    // Vérifier dans les providers EIP-6963 découverts
    for (const p of discoveredProviders) {
      const name = (p.info?.name || '').toLowerCase();
      const rdns = (p.info?.rdns || '').toLowerCase();
      if (name.includes('abstract') || rdns.includes('abstract')) {
        console.log('✅ Abstract provider détecté via EIP-6963 :', p.info?.name);
        return p.provider;
      }
    }
    
    console.log('❌ Abstract provider non détecté');
    return null;
  }

  // Connexion Abstract avec fallback vers le portail
  async function connectAbstract() {
    const overlay = overlayEl();
    const msg = overlay?.querySelector("[data-wallet-message]");
    
    if (msg) msg.textContent = "Searching for Abstract Global Wallet...";
    
    // Tenter la détection
    abstractProvider = detectAbstractProvider();
    
    if (!abstractProvider) {
      // Pas détecté → Proposer d'aller sur le portail
      if (msg) msg.textContent = "Abstract Global Wallet not detected.";
      
      const redirectMsg = document.createElement('div');
      redirectMsg.style.cssText = `
        margin-top: 15px;
        padding: 15px;
        background: rgba(255, 215, 0, 0.1);
        border: 1px solid #FFD700;
        border-radius: 8px;
        color: #FFD700;
      `;
      redirectMsg.innerHTML = `
        <p style="margin: 0 0 10px;">Abstract Global Wallet allows you to connect with Google or email.</p>
        <a href="https://portal.abs.xyz" target="_blank" rel="noopener" 
           style="display: inline-block; padding: 10px 20px; background: #FFD700; color: #000; 
                  text-decoration: none; border-radius: 6px; font-weight: bold;">
          🌐 Open Abstract Portal
        </a>
        <p style="margin: 10px 0 0; font-size: 13px; opacity: 0.8;">
          After connecting on the portal, return here and try again.
        </p>
      `;
      
      const box = overlay?.querySelector('div > div');
      if (box && !box.querySelector('.abstract-redirect')) {
        redirectMsg.classList.add('abstract-redirect');
        box.appendChild(redirectMsg);
      }
      
      return;
    }
    
    // Provider détecté → Connexion
    if (msg) msg.textContent = "Connecting to Abstract Global Wallet...";
    
    try {
      const accs = await abstractProvider.request({ method: "eth_requestAccounts" });
      if (!Array.isArray(accs) || !accs[0]) {
        if (msg) msg.textContent = "Connection cancelled.";
        return;
      }
      
      const addr = accs[0];
      const ok = await ensureChain(abstractProvider);
      if (!ok) {
        if (msg) msg.textContent = "Please switch to Abstract network.";
        return;
      }
      
      currentProvider = abstractProvider;
      setStored(addr);
      await updateAccess(addr, abstractProvider);
      bindProviderEvents(abstractProvider);
      
      if (msg) msg.textContent = "Abstract Global Wallet connected! 🎉";
      
    } catch (e) {
      console.error('Abstract connection error:', e);
      if (msg) msg.textContent = "Connection failed. Please try again.";
    }
  }

  // ==================== Overlay ====================
  const overlayEl = () => document.getElementById("wallet-overlay");

  function lockScroll(lock) {
    try {
      document.documentElement.style.overflow = lock ? "hidden" : "";
      document.body.style.overflow = lock ? "hidden" : "";
    } catch {}
  }

  function setOverlayMsg(msg) {
    const el = overlayEl();
    if (!el) return;
    const p = el.querySelector("[data-wallet-message]");
    if (p && msg) p.textContent = msg;
  }

  function createOverlay(message) {
    overlayWanted = true;
    lockScroll(true);

    const existing = overlayEl();
    if (existing) {
      setOverlayMsg(message || "You must connect a wallet to access the game.");
      existing.style.display = "flex";
      // Supprimer les anciens messages de redirection
      const oldRedirect = existing.querySelector('.abstract-redirect');
      if (oldRedirect) oldRedirect.remove();
      return;
    }

    const o = document.createElement("div");
    o.id = "wallet-overlay";
    Object.assign(o.style, {
      position: "fixed", inset: "0", background: "rgba(0,0,0,0.86)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", textAlign: "center", zIndex: "999999",
      padding: "24px", pointerEvents: "auto"
    });

    const box = document.createElement("div");
    Object.assign(box.style, {
      background: "rgba(10,20,40,0.95)", border: "1px solid #223a67",
      borderRadius: "14px", boxShadow: "0 10px 30px rgba(0,0,0,.45)",
      padding: "22px 26px", maxWidth: "680px", width: "100%",
      color: "#cfe6ff", fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif"
    });

    const h2 = document.createElement("h2");
    h2.textContent = "CONNECT YOUR WALLET TO PLAY 🐋";
    Object.assign(h2.style, {
      margin: "0 0 10px", fontFamily: "'Bebas Neue',sans-serif",
      fontSize: "42px", letterSpacing: "2px", color: "#ffcc00",
      textShadow: "0 2px 10px rgba(0,0,0,.55)"
    });

    const p = document.createElement("p");
    p.setAttribute("data-wallet-message", "1");
    p.textContent = message || "You must connect a wallet to access the game.";
    p.style.margin = "0 0 16px";

    // ========== SECTION ABSTRACT (nouveau) ==========
    const abstractSection = document.createElement("div");
    abstractSection.style.cssText = `
      margin: 0 0 20px;
      padding: 15px;
      background: rgba(255, 215, 0, 0.08);
      border: 1px solid rgba(255, 215, 0, 0.3);
      border-radius: 10px;
    `;
    
    const abstractTitle = document.createElement("div");
    abstractTitle.textContent = "🌐 New: Connect with Abstract Global Wallet";
    abstractTitle.style.cssText = `
      font-weight: bold;
      font-size: 16px;
      margin-bottom: 8px;
      color: #FFD700;
    `;
    
    const abstractDesc = document.createElement("div");
    abstractDesc.textContent = "Sign in with Google or email — no extension needed!";
    abstractDesc.style.cssText = `
      font-size: 13px;
      margin-bottom: 10px;
      opacity: 0.9;
    `;
    
    const btnAbstract = document.createElement("button");
    btnAbstract.id = "wallet-connect-abstract";
    btnAbstract.textContent = "🌐 Connect with Abstract";
    Object.assign(btnAbstract.style, {
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      padding: "12px 22px", fontSize: "16px", fontWeight: "700",
      border: "2px solid #FFD700", borderRadius: "10px",
      background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)", 
      color: "#000", cursor: "pointer", width: "100%",
      transition: "transform 0.2s"
    });
    btnAbstract.addEventListener("mouseover", () => {
      btnAbstract.style.transform = "scale(1.05)";
    });
    btnAbstract.addEventListener("mouseout", () => {
      btnAbstract.style.transform = "scale(1)";
    });
    btnAbstract.addEventListener("click", async () => { await connectAbstract(); });
    
    abstractSection.append(abstractTitle, abstractDesc, btnAbstract);

    // ========== Séparateur ==========
    const separator = document.createElement("div");
    separator.textContent = "— OR —";
    separator.style.cssText = `
      margin: 15px 0;
      color: rgba(255,255,255,0.4);
      font-size: 13px;
      font-weight: bold;
    `;

    // ========== SECTION WALLETS CLASSIQUES ==========
    const providerWrap = document.createElement("div");
    providerWrap.style.margin = "12px 0 18px";
    const label = document.createElement("label");
    label.textContent = "Or choose your wallet: ";
    label.style.marginRight = "8px";
    const select = document.createElement("select");
    select.id = "wallet-provider-select";
    Object.assign(select.style, {
      padding: "8px 10px", borderRadius: "8px", border: "1px solid #3cc2ff",
      background: "#0b2a46", color: "#cfefff", minWidth: "280px"
    });
    providerWrap.append(label, select);

    const btnRow = document.createElement("div");
    btnRow.style.display = "flex";
    btnRow.style.gap = "10px";
    btnRow.style.flexWrap = "wrap";
    btnRow.style.justifyContent = "center";

    const btn = document.createElement("button");
    btn.id = "wallet-connect-btn";
    btn.textContent = "🔗 Connect Wallet";
    Object.assign(btn.style, {
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      padding: "12px 22px", fontSize: "18px", fontWeight: "700",
      border: "1px solid #3cc2ff", borderRadius: "10px",
      background: "#0b2a46", color: "#cfefff", cursor: "pointer"
    });
    btn.addEventListener("click", async () => { await connectWallet(select.value); });

    const btnQR = document.createElement("button");
    btnQR.id = "wallet-connect-qr";
    btnQR.textContent = "📱 MetaMask Mobile (QR)";
    Object.assign(btnQR.style, {
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      padding: "12px 22px", fontSize: "16px", fontWeight: "700",
      border: "1px solid #3cc2ff", borderRadius: "10px",
      background: "#0b2a46", color: "#cfefff", cursor: "pointer"
    });
    btnQR.addEventListener("click", async () => { await connectWallet("mm-qr"); });

    btnRow.append(btn, btnQR);

    const hint = document.createElement("div");
    hint.style.opacity = "0.8"; hint.style.marginTop = "10px"; hint.style.fontSize = "13px";
    hint.innerHTML = "Detected wallets appear in the list (MetaMask, Coinbase Wallet, Rabby, ...).<br/>No wallet? Click <b>MetaMask Mobile (QR)</b> and scan with your phone.";

    box.append(h2, p, abstractSection, separator, providerWrap, btnRow, hint);
    o.appendChild(box);
    document.body.appendChild(o);
    refreshProviderOptions();
  }

  function removeOverlay() {
    overlayWanted = false;
    lockScroll(false);
    const el = overlayEl();
    if (el) el.remove();
  }

  // ==================== Providers (EIP-6963 + injected + QR + Abstract) ====================
  async function pickProvider(selectionId) {
    if (selectionId === "mm-qr") return await getMetaMaskQRProvider();
    if (selectionId === "abstract") return detectAbstractProvider();
    if (selectionId === "injected" && window.ethereum) return window.ethereum;
    if (selectionId && selectionId.startsWith("eip6963:")) {
      const idx = Number(selectionId.split(":")[1] || -1);
      if (idx >= 0 && discoveredProviders[idx]) return discoveredProviders[idx].provider;
    }
    return window.ethereum || null;
  }

  function refreshProviderOptions() {
    const select = document.getElementById("wallet-provider-select");
    if (!select) return;
    while (select.firstChild) select.removeChild(select.firstChild);

    const options = [];
    
    // Providers EIP-6963 découverts
    discoveredProviders.forEach((d, idx) => {
      const name =
        (d.info && (d.info.name || d.info.rdns)) ||
        (d.provider && d.provider.isMetaMask && "MetaMask") ||
        `Provider #${idx + 1}`;
      options.push({ id: `eip6963:${idx}`, label: name });
    });

    // MetaMask extension classique
    if (window.ethereum?.isMetaMask) {
      options.push({ id: "injected", label: "MetaMask (Extension)" });
    }
    
    // Fallback
    if (options.length === 0) {
      options.push({ id: "none", label: "No provider detected (try QR or Abstract)" });
    }

    for (const opt of options) {
      const o = document.createElement("option");
      o.value = opt.id; o.textContent = opt.label;
      select.appendChild(o);
    }

    if (select.options.length > 0) select.selectedIndex = 0;
  }

  function setupEIP6963Discovery() {
    if (mounted) return;
    mounted = true;
    window.addEventListener("eip6963:announceProvider", (e) => {
      const d = e.detail;
      if (!d?.provider) return;
      const exists = discoveredProviders.some(x =>
        (x.info && (x.info.uuid || x.info.rdns)) === (d.info && (d.info.uuid || d.info.rdns)) || x.provider === d.provider
      );
      if (!exists) { 
        discoveredProviders.push(d); 
        refreshProviderOptions(); 
      }
    });
    window.dispatchEvent(new Event("eip6963:requestProvider"));
  }

  // ==================== Réseau (switch / add Abstract) ====================
  async function ensureChain(provider) {
    if (!provider?.request) return false;
    try {
      const chain = await provider.request({ method: "eth_chainId" });
      if (chain === REQUIRED_CHAIN_ID) return true;

      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: REQUIRED_CHAIN_ID }]
        });
        return true;
      } catch (e) {
        if (e && (e.code === 4902 || String(e.message || "").toLowerCase().includes("unrecognized"))) {
          try {
            await provider.request({
              method: "wallet_addEthereumChain",
              params: [ABSTRACT_CHAIN_PARAMS]
            });
            return true;
          } catch {
            setOverlayMsg("Please add/switch to the Abstract network in your wallet.");
            return false;
          }
        }
        setOverlayMsg("Please switch to the Abstract network in your wallet.");
        return false;
      }
    } catch {
      return true;
    }
  }

  // ==================== Connexion ====================
  async function connectWallet(selectionId) {
    const overlay = overlayEl();
    const btn = overlay?.querySelector("#wallet-connect-btn");
    const msg = overlay?.querySelector("[data-wallet-message]");
    const provider = await pickProvider(selectionId);

    if (!provider) {
      setOverlayMsg("No compatible wallet detected. Try MetaMask Mobile (QR) or Abstract.");
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = "Waiting for wallet…"; }
    if (msg) msg.textContent = "Opening wallet…";

    let addr = null;
    try {
      const accs = await provider.request({ method: "eth_requestAccounts" });
      if (Array.isArray(accs) && accs[0]) addr = accs[0];
    } catch (e) {
      console.warn("eth_requestAccounts error:", e);
    }

    if (!addr) {
      if (btn) { btn.disabled = false; btn.textContent = "🔗 Connect Wallet"; }
      if (msg) msg.textContent = "Connection cancelled or failed.";
      return;
    }

    const ok = await ensureChain(provider);
    if (!ok) {
      if (btn) { btn.disabled = false; btn.textContent = "🔗 Connect Wallet"; }
      return;
    }

    currentProvider = provider;
    setStored(addr);
    await updateAccess(addr, provider);
    bindProviderEvents(provider);

    if (btn) { btn.disabled = false; btn.textContent = "🔗 Connect Wallet"; }
    if (msg) msg.textContent = "Wallet connected.";
  }

  // ==================== balanceOf (ERC-721) ====================
  async function fetchNftBalance(owner, provider) {
    const p = provider || currentProvider || window.ethereum;
    if (!p || !/^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS)) return 0n;

    const selector = "0x70a08231";
    const addrNo0x = owner.replace(/^0x/, "").toLowerCase();
    const data = selector + addrNo0x.padStart(64, "0");
    try {
      const res = await p.request({ method: "eth_call", params: [{ to: CONTRACT_ADDRESS, data }, "latest"] });
      return hexToBigInt(res);
    } catch {
      return 0n;
    }
  }

  // ==================== Access ====================
  async function updateAccess(addr, provider, { force = false } = {}) {
    const p = provider || currentProvider || window.ethereum;
    await ensureChain(p);

    const mustCheck = force || lastCheckTooOld() ||
      !window.AW_ACCESS || window.AW_ACCESS.address?.toLowerCase() !== addr.toLowerCase();

    let balance = mustCheck ? await fetchNftBalance(addr, p) : BigInt(window.AW_ACCESS?.balance ?? 0);
    if (mustCheck) markBalanceCheckedNow();

    const canPlay = balance >= 1n;
    const bonusEligible = balance >= 20n;
    const access = { address: addr, balance: Number(balance), canPlay, bonusEligible };

    window.AW_ACCESS = access;
    setStored(addr);

    try { document.dispatchEvent(new CustomEvent('aw:accessChanged', { detail: access })); } catch {}

    if (!canPlay) createOverlay("You need at least 1 Angry Whales NFT to play.");
    else removeOverlay();

    console.log("AW_ACCESS:", access);
  }

  async function checkConnection() {
    if (isChecking) return;
    isChecking = true;
    try {
      const p = currentProvider || window.ethereum || null;
      let acc = null;
      if (p?.request) {
        try {
          const a = await p.request({ method: "eth_accounts" });
          acc = Array.isArray(a) && a[0] ? a[0] : null;
        } catch {}
      }
      const stored = getStored();
      if (!acc) {
        setStored(null);
        window.AW_ACCESS = { address: null, balance: 0, canPlay: false, bonusEligible: false };
        try { document.dispatchEvent(new CustomEvent('aw:accessChanged', { detail: window.AW_ACCESS })); } catch {}
        createOverlay("You must connect a wallet to access the game.");
        return;
      }
      if (!currentProvider && window.ethereum) currentProvider = window.ethereum;
      if (stored !== acc) setStored(acc);
      await updateAccess(acc, currentProvider, { force: lastCheckTooOld() });
    } finally { isChecking = false; }
  }

  // ==================== Watchdog ====================
  function enforceOverlayPresence() {
    const need = overlayWanted || !(window.AW_ACCESS && window.AW_ACCESS.canPlay);
    const el = overlayEl();
    if (need) {
      if (!el) createOverlay("You must connect a wallet to access the game.");
      else { el.style.display = "flex"; el.style.zIndex = "999999"; lockScroll(true); }
    } else if (el) removeOverlay();
  }

  try {
    const mo = new MutationObserver(() => enforceOverlayPresence());
    mo.observe(document.body, { childList: true, subtree: true });
  } catch {}

  // ==================== API & Boot ====================
  window.AW_GATE = {
    show: () => createOverlay(),
    hide: () => removeOverlay(),
    check: () => checkConnection()
  };

  const start = () => {
    setupEIP6963Discovery();
    createOverlay("You must connect a wallet to access the game.");
    checkConnection();
    setInterval(enforceOverlayPresence, ENFORCE_EVERY_MS);
  };
  
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  // Events
  function bindProviderEvents(p) {
    if (!p?.on) return;
    p.on("accountsChanged", () => checkConnection());
    p.on("chainChanged", () => checkConnection());
    p.on("disconnect", () => checkConnection());
  }
  if (window.ethereum) bindProviderEvents(window.ethereum);
  window.addEventListener("focus", () => checkConnection());
  document.addEventListener("visibilitychange", () => { if (!document.hidden) checkConnection(); });
  setInterval(() => checkConnection(), CHECK_EVERY_MS);
})();