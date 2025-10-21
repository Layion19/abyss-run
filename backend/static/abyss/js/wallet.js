// backend/static/abyss/js/wallet.js
// Gate "collant" : l’overlay ne disparaît que si le wallet connecté détient ≥1 NFT.
// Bonus éligibles si balance ≥20. Multi-wallet (EIP-6963) + fallback window.ethereum.
// Watchdog (MutationObserver + interval) pour recréer l’overlay si un autre script le retire.

(function () {
  "use strict";

  // ==================== Constantes ====================
  const WALLET_KEY = "walletAddress";
  const CHECK_EVERY_MS = 4000;
  const ENFORCE_EVERY_MS = 600; // watchdog

  // ✅ Contrat ERC-721 Angry Whales
  const CONTRACT_ADDRESS = "0x8Bb25A82e2f0230c2CFE3278CBc16a2C93685359";

  // Laisser null pour ne pas forcer une chaîne (ex: '0x1' mainnet)
  const REQUIRED_CHAIN_ID = null;

  // ==================== État ====================
  let currentProvider = null;
  let discoveredProviders = []; // via EIP-6963
  let isChecking = false;
  let mounted = false;
  let overlayWanted = true; // tant que canPlay === false

  // ==================== Storage ====================
  const getStored = () => { try { return localStorage.getItem(WALLET_KEY) || null; } catch { return null; } };
  const setStored = (addr) => { try { addr ? localStorage.setItem(WALLET_KEY, addr) : localStorage.removeItem(WALLET_KEY); } catch {} };

  // ==================== Overlay UI ====================
  function overlayEl(){ return document.getElementById("wallet-overlay"); }

  function lockScroll(lock){
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
      position: "fixed",
      inset: "0",
      background: "rgba(0,0,0,0.86)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      zIndex: "999999",
      padding: "24px",
      // empêche les clics de “passer au travers”
      pointerEvents: "auto"
    });

    const box = document.createElement("div");
    Object.assign(box.style, {
      background: "rgba(10,20,40,0.95)",
      border: "1px solid #223a67",
      borderRadius: "14px",
      boxShadow: "0 10px 30px rgba(0,0,0,.45)",
      padding: "22px 26px",
      maxWidth: "560px",
      color: "#cfe6ff",
      fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif"
    });

    const h2 = document.createElement("h2");
    h2.textContent = "Connect your Wallet to play 🐋";
    Object.assign(h2.style, {
      margin: "0 0 10px",
      fontFamily: "'Bebas Neue',sans-serif",
      fontSize: "42px",
      letterSpacing: "2px",
      color: "#ffcc00",
      textShadow: "0 2px 10px rgba(0,0,0,.55)"
    });

    const p = document.createElement("p");
    p.setAttribute("data-wallet-message", "1");
    p.textContent = message || "You must connect a wallet to access the game.";
    p.style.margin = "0 0 16px";

    // Sélecteur providers
    const providerWrap = document.createElement("div");
    providerWrap.style.margin = "12px 0 18px";

    const label = document.createElement("label");
    label.textContent = "Choose your wallet: ";
    label.style.marginRight = "8px";

    const select = document.createElement("select");
    select.id = "wallet-provider-select";
    Object.assign(select.style, {
      padding: "8px 10px",
      borderRadius: "8px",
      border: "1px solid #3cc2ff",
      background: "#0b2a46",
      color: "#cfefff"
    });

    providerWrap.append(label, select);

    const btn = document.createElement("button");
    btn.textContent = "🔗 Connect Wallet";
    Object.assign(btn.style, {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "12px 22px",
      fontSize: "18px",
      fontWeight: "700",
      border: "1px solid #3cc2ff",
      borderRadius: "10px",
      background: "#0b2a46",
      color: "#cfefff",
      cursor: "pointer"
    });
    btn.addEventListener("click", async () => {
      try {
        await connectWallet(select.value); // ouvre MetaMask / Rabby si nécessaire
      } catch (e) {
        console.warn(e);
        setOverlayMsg("Connection refused or failed. Please try again.");
      }
    });

    const hint = document.createElement("div");
    hint.style.opacity = "0.8";
    hint.style.marginTop = "10px";
    hint.style.fontSize = "13px";
    hint.textContent = "If no wallet is detected, install MetaMask or open with a compatible browser.";

    box.append(h2, p, providerWrap, btn, hint);
    o.appendChild(box);
    document.body.appendChild(o);

    refreshProviderOptions();
  }

  function removeOverlay() {
    // On ne retire l’overlay que si on ne le “veut” plus (canPlay === true)
    overlayWanted = false;
    lockScroll(false);
    const el = overlayEl();
    if (el) el.remove();
  }

  // ==================== Providers (EIP-6963) ====================
  function refreshProviderOptions() {
    const select = document.getElementById("wallet-provider-select");
    if (!select) return;

    while (select.firstChild) select.removeChild(select.firstChild);

    const options = [];

    discoveredProviders.forEach((d, idx) => {
      const name =
        (d.info && (d.info.name || d.info.rdns)) ||
        (d.provider && d.provider.isMetaMask && "MetaMask") ||
        `Provider #${idx + 1}`;
      options.push({ id: `eip6963:${idx}`, label: name });
    });

    if (window.ethereum) {
      const name = window.ethereum.isMetaMask ? "MetaMask (injected)" : "Injected provider";
      options.push({ id: "injected", label: name });
    }

    if (options.length === 0) options.push({ id: "none", label: "No provider detected" });

    for (const opt of options) {
      const o = document.createElement("option");
      o.value = opt.id; o.textContent = opt.label;
      select.appendChild(o);
    }
  }

  function setupEIP6963Discovery() {
    if (mounted) return;
    mounted = true;

    window.addEventListener("eip6963:announceProvider", (event) => {
      const detail = event.detail;
      if (!detail || !detail.provider) return;
      const exists = discoveredProviders.some(d =>
        (d.info && (d.info.uuid || d.info.rdns)) === (detail.info && (detail.info.uuid || detail.info.rdns)) ||
        d.provider === detail.provider
      );
      if (!exists) {
        discoveredProviders.push(detail);
        refreshProviderOptions();
      }
    });

    window.dispatchEvent(new Event("eip6963:requestProvider"));
  }

  function pickProvider(selectionId) {
    if (selectionId && selectionId.startsWith("eip6963:")) {
      const idx = Number(selectionId.split(":")[1] || -1);
      if (idx >= 0 && discoveredProviders[idx]) return discoveredProviders[idx].provider;
    }
    if (selectionId === "injected" && window.ethereum) return window.ethereum;
    return window.ethereum || null;
  }

  // ==================== Réseau / chaîne ====================
  async function ensureChain(provider) {
    if (!REQUIRED_CHAIN_ID || !provider?.request) return true;
    try {
      const current = await provider.request({ method: "eth_chainId" });
      if (current === REQUIRED_CHAIN_ID) return true;
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: REQUIRED_CHAIN_ID }]
      });
      return true;
    } catch (e) {
      console.warn("Chain check/switch failed:", e);
      createOverlay("Please switch to the required network to play.");
      return false;
    }
  }

  // ==================== Connexion ====================
  async function connectWallet(selectionId) {
    const provider = pickProvider(selectionId);
    if (!provider) {
      setOverlayMsg("No compatible wallet detected.");
      throw new Error("No provider");
    }
    const ok = await ensureChain(provider);
    if (!ok) throw new Error("Wrong chain");

    const accounts = await provider.request({ method: "eth_requestAccounts" }); // ouvre l’extension
    const addr = Array.isArray(accounts) && accounts[0] ? accounts[0] : null;
    if (!addr) {
      setOverlayMsg("No account selected.");
      throw new Error("No account");
    }

    currentProvider = provider;
    setStored(addr);
    await updateAccess(addr, provider); // décidera de retirer ou pas l’overlay
    try { document.dispatchEvent(new CustomEvent("aw:walletConnected", { detail: { address: addr } })); } catch {}
  }

  // ==================== balanceOf(owner) (ERC-721) ====================
  async function fetchNftBalance(owner, provider) {
    const p = provider || currentProvider || window.ethereum;
    if (!p || !/^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS)) return 0n;

    const selector = "0x70a08231"; // keccak256("balanceOf(address)")
    const addrNo0x = owner.replace(/^0x/, "").toLowerCase();
    const data = selector + addrNo0x.padStart(64, "0");

    try {
      const res = await p.request({ method: "eth_call", params: [{ to: CONTRACT_ADDRESS, data }, "latest"] });
      return BigInt(res || "0x0");
    } catch (e) {
      console.warn("eth_call balanceOf failed:", e);
      return 0n;
    }
  }

  // ==================== Mise à jour d’accès ====================
  async function updateAccess(addr, provider) {
    const p = provider || currentProvider || window.ethereum;
    const ok = await ensureChain(p);
    if (!ok) {
      overlayWanted = true;
      createOverlay("Please switch to the required network to play.");
      return;
    }

    const balance = await fetchNftBalance(addr, p);
    const canPlay = balance >= 1n;        // ≥1 NFT
    const bonusEligible = balance >= 20n; // ≥20 NFTs

    const access = { address: addr, balance: Number(balance), canPlay, bonusEligible };
    setStored(addr);
    window.AW_ACCESS = access;
    try { document.dispatchEvent(new CustomEvent("aw:access", { detail: access })); } catch {}

    if (!canPlay) {
      overlayWanted = true;
      createOverlay("You need at least 1 Angry Whales NFT to play.");
    } else {
      overlayWanted = false;
      removeOverlay();
    }
    console.log("AW_ACCESS:", access);
  }

  // ==================== Vérif silencieuse ====================
  async function checkConnection() {
    if (isChecking) return;
    isChecking = true;
    try {
      const p = currentProvider || window.ethereum || null;
      let onChain = null;

      if (p?.request) {
        try {
          const accs = await p.request({ method: "eth_accounts" }); // silencieux
          onChain = Array.isArray(accs) && accs[0] ? accs[0] : null;
        } catch (e) {
          console.warn("eth_accounts failed:", e);
        }
      }

      const stored = getStored();

      if (!onChain) {
        setStored(null);
        window.AW_ACCESS = { address: null, balance: 0, canPlay: false, bonusEligible: false };
        overlayWanted = true;
        createOverlay("You must connect a wallet to access the game.");
        return;
      }

      currentProvider = p || currentProvider;
      if (stored !== onChain) setStored(onChain);
      await updateAccess(onChain, currentProvider);
    } finally {
      isChecking = false;
    }
  }

  // ==================== Watchdog “anti-disparition” ====================
  function enforceOverlayPresence() {
    const needOverlay = overlayWanted || !(window.AW_ACCESS && window.AW_ACCESS.canPlay);
    const el = overlayEl();
    if (needOverlay) {
      if (!el) createOverlay("You must connect a wallet to access the game.");
      else {
        // s’assurer qu’il est visible et au-dessus
        el.style.display = "flex";
        el.style.zIndex = "999999";
        lockScroll(true);
      }
    } else {
      if (el) removeOverlay();
    }
  }

  // MutationObserver: si quelqu’un supprime l’overlay alors qu’il est requis → on le recrée
  try {
    const mo = new MutationObserver(() => enforceOverlayPresence());
    mo.observe(document.documentElement || document.body, { childList: true, subtree: true });
  } catch {}

  // ==================== API debug ====================
  window.AW_GATE = {
    show: () => { overlayWanted = true; createOverlay("You must connect a wallet to access the game."); },
    hide: () => { overlayWanted = false; removeOverlay(); },
    reset: () => {
      setStored(null);
      window.AW_ACCESS = { address: null, balance: 0, canPlay: false, bonusEligible: false };
      overlayWanted = true;
      createOverlay("You must connect a wallet to access the game.");
    },
    check: () => checkConnection()
  };

  // ==================== Boot ====================
  const start = () => {
    setupEIP6963Discovery();
    overlayWanted = true;
    createOverlay("You must connect a wallet to access the game.");
    checkConnection();
    // Watchdog périodique
    setInterval(enforceOverlayPresence, ENFORCE_EVERY_MS);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  // ==================== Écoutes provider & polling ====================
  function bindProviderEvents(p) {
    if (!p?.on) return;
    p.on("accountsChanged", () => checkConnection());
    p.on("chainChanged",    () => checkConnection());
    p.on("disconnect",      () => checkConnection());
  }
  if (window.ethereum) bindProviderEvents(window.ethereum);

  window.addEventListener("focus", () => checkConnection());
  document.addEventListener("visibilitychange", () => { if (!document.hidden) checkConnection(); });
  setInterval(() => checkConnection(), CHECK_EVERY_MS);
})();
