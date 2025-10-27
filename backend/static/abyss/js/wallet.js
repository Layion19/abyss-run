// backend/static/abyss/js/wallet.js
// Gate "collant" + multi-wallet (EIP-6963), MetaMask QR (SDK), Abstract chain (0xAB5).
// Bonus éligibles si balance >= 20 (ERC-721). Vérif auto 24h. Watchdog overlay.
// Émet `aw:accessChanged` à chaque changement d’accès/éligibilité.

(function () {
  "use strict";

  // ==================== Constantes ====================
  const WALLET_KEY = "walletAddress";
  const LAST_CHECK_KEY = "aw:lastBalanceCheckAt";
  const DAY_MS = 24 * 60 * 60 * 1000;
  const CHECK_EVERY_MS = 4000;   // ping connexion/provider
  const ENFORCE_EVERY_MS = 800;  // watchdog overlay

  // Contrat ERC-721 Angry Whales
  const CONTRACT_ADDRESS = "0x8Bb25A82e2f0230c2CFE3278CBc16a2C93685359";

  // Réseau requis : Abstract mainnet (2741 décimal = 0xAB5 hex)
  const REQUIRED_CHAIN_ID = "0xAB5";

  // Paramètres pour `wallet_addEthereumChain` (à ajuster si besoin)
  const ABSTRACT_CHAIN_PARAMS = {
    chainId: REQUIRED_CHAIN_ID,
    chainName: "Abstract",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://api.mainnet.abs.xyz"],      // ← mets ton RPC si différent
    blockExplorerUrls: ["https://scan.abs.xyz/"]   // ← mets ton explorer si différent
  };

  // ==================== États ====================
  let currentProvider = null;
  let discoveredProviders = [];
  let mounted = false;
  let isChecking = false;
  let overlayWanted = true;
  let mmSdk = null;

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

  // ==================== Chargement MetaMask SDK (QR) ====================
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
    } catch {
      return false;
    }
  }
  async function getMetaMaskQRProvider() {
    const ok = await ensureMetaMaskSdkLoaded();
    if (!ok) return null;
    const SDK = window.MetaMaskSDK;
    if (!SDK) return null;
    if (!mmSdk) {
      mmSdk = new SDK({
        dappMetadata: { name: "Angry Whales — Abyss Run", url: location.origin },
        // Optionnel: désactiver les "modals" internes si tu préfères l’overlay du jeu
        // checkInstallationImmediately: false,
      });
    }
    return mmSdk.getProvider();
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
      padding: "22px 26px", maxWidth: "620px",
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

    const providerWrap = document.createElement("div");
    providerWrap.style.margin = "12px 0 18px";
    const label = document.createElement("label");
    label.textContent = "Choose your wallet: ";
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

    box.append(h2, p, providerWrap, btnRow, hint);
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

  // ==================== Providers (EIP-6963 + injected + QR) ====================
  async function pickProvider(selectionId) {
    if (selectionId === "mm-qr") return await getMetaMaskQRProvider();
    if (selectionId === "injected" && window.ethereum) return window.ethereum;
    if (selectionId && selectionId.startsWith("eip6963:")) {
      const idx = Number(selectionId.split(":")[1] || -1);
      if (idx >= 0 && discoveredProviders[idx]) return discoveredProviders[idx].provider;
    }
    // Fallback: injected ethereum si dispo
    return window.ethereum || null;
  }

  function refreshProviderOptions() {
    const select = document.getElementById("wallet-provider-select");
    if (!select) return;
    while (select.firstChild) select.removeChild(select.firstChild);

    const options = [];

    // Providers EIP-6963 (Coinbase Wallet, Rabby, MetaMask, etc.)
    discoveredProviders.forEach((d, idx) => {
      const name =
        (d.info && (d.info.name || d.info.rdns)) ||
        (d.provider && d.provider.isMetaMask && "MetaMask") ||
        `Provider #${idx + 1}`;
      options.push({ id: `eip6963:${idx}`, label: name });
    });

    // Injected MetaMask (legacy/injected)
    if (window.ethereum?.isMetaMask) options.push({ id: "injected", label: "MetaMask (Extension)" });

    // S’il n’y a aucun provider EIP-6963, on propose tout de même l’option QR via bouton dédié
    if (options.length === 0) options.push({ id: "none", label: "No provider detected (try QR button)" });

    for (const opt of options) {
      const o = document.createElement("option");
      o.value = opt.id; o.textContent = opt.label;
      select.appendChild(o);
    }

    // Sélectionner par défaut le premier provider détecté
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
      if (!exists) { discoveredProviders.push(d); refreshProviderOptions(); }
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
        // 4902: Unrecognized chain → on tente d’ajouter Abstract
        if (e && (e.code === 4902 || String(e.message || "").toLowerCase().includes("unrecognized"))) {
          try {
            await provider.request({
              method: "wallet_addEthereumChain",
              params: [ABSTRACT_CHAIN_PARAMS]
            });
            // Après add, on est généralement déjà sur le bon réseau
            return true;
          } catch (addErr) {
            setOverlayMsg("Please add/switch to the Abstract network in your wallet.");
            return false;
          }
        }
        setOverlayMsg("Please switch to the Abstract network in your wallet.");
        return false;
      }
    } catch {
      // Impossible de lire la chaîne → on laisse tenter la connexion quand même
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
      setOverlayMsg("No compatible wallet detected. Try MetaMask Mobile (QR).");
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = "Waiting for wallet…"; }
    if (msg) msg.textContent = "Opening wallet…";

    // On demande les comptes (déclenche l’extension / mobile)
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

    // S’assurer ensuite d’être sur Abstract
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
    // ERC-721 balanceOf(address) → même selector que ERC-20
    const selector = "0x70a08231";
    const addrNo0x = owner.replace(/^0x/, "").toLowerCase();
    const data = selector + addrNo0x.padStart(64, "0");
    try {
      const res = await p.request({ method: "eth_call", params: [{ to: CONTRACT_ADDRESS, data }, "latest"] });
      return BigInt(res || "0x0");
    } catch {
      return 0n;
    }
  }

  // ==================== Access ====================
  async function updateAccess(addr, provider, { force = false } = {}) {
    const p = provider || currentProvider || window.ethereum;

    // On tente de rester sur Abstract; si échec, on ne bloque pas le fetch mais on affichera l’overlay
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
