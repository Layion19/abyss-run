// backend/static/abyss/js/wallet.js
// Overlay bloquant tant qu’aucun wallet n’est connecté.
// Lecture balanceOf(owner) sur ton contrat ERC-721 pour :
// - canPlay      : >= 1 NFT
// - bonusEligible: >= 20 NFTs
// Multi-wallet : EIP-6963 (providers injectés) + fallback window.ethereum.

(function () {
  "use strict";

  // ==================== Constantes ====================
  const WALLET_KEY = "walletAddress";
  const CHECK_EVERY_MS = 4000;

  // ✅ Adresse du contrat Angry Whales (ERC-721)
  const CONTRACT_ADDRESS = "0x8Bb25A82e2f0230c2CFE3278CBc16a2C93685359";

  // Laisser null pour ne pas forcer une chaîne
  // (ex: '0x1' mainnet, '0x89' Polygon, etc.)
  const REQUIRED_CHAIN_ID = null;

  // ==================== État runtime ====================
  let currentProvider = null;           // provider choisi
  let discoveredProviders = [];         // via EIP-6963
  let isChecking = false;               // verrou antire-entrance
  let mounted = false;

  // ==================== Utils storage ====================
  const getStored = () => {
    try { return localStorage.getItem(WALLET_KEY) || null; } catch { return null; }
  };
  const setStored = (addr) => {
    try {
      if (addr) localStorage.setItem(WALLET_KEY, addr);
      else localStorage.removeItem(WALLET_KEY);
    } catch {}
  };

  // ==================== Overlay UI ====================
  function removeOverlay() {
    const el = document.getElementById("wallet-overlay");
    if (el) el.remove();
  }

  function createOverlay(message) {
    // Si déjà présent → maj du message
    const existing = document.getElementById("wallet-overlay");
    if (existing) {
      const msg = existing.querySelector("[data-wallet-message]");
      if (msg && message) msg.textContent = message;
      return;
    }

    const o = document.createElement("div");
    o.id = "wallet-overlay";
    Object.assign(o.style, {
      position: "fixed", inset: "0", background: "rgba(0,0,0,0.85)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", textAlign: "center", zIndex: "999999", padding: "24px"
    });

    const box = document.createElement("div");
    Object.assign(box.style, {
      background: "rgba(10,20,40,0.95)", border: "1px solid #223a67", borderRadius: "14px",
      boxShadow: "0 10px 30px rgba(0,0,0,.45)", padding: "22px 26px", maxWidth: "560px",
      color: "#cfe6ff", fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif"
    });

    const h2 = document.createElement("h2");
    h2.textContent = "Connect your Wallet to play 🐋";
    Object.assign(h2.style, {
      margin: "0 0 10px", fontFamily: "'Bebas Neue',sans-serif", fontSize: "42px",
      letterSpacing: "2px", color: "#ffcc00", textShadow: "0 2px 10px rgba(0,0,0,.55)"
    });

    const p = document.createElement("p");
    p.setAttribute("data-wallet-message", "1");
    p.textContent = message || "You must connect a wallet to access the game.";
    p.style.margin = "0 0 16px";

    // Sélecteur de provider (si plusieurs)
    const providerWrap = document.createElement("div");
    providerWrap.style.margin = "12px 0 18px";

    const label = document.createElement("label");
    label.textContent = "Sélectionne ton wallet : ";
    label.style.marginRight = "8px";

    const select = document.createElement("select");
    select.id = "wallet-provider-select";
    Object.assign(select.style, {
      padding: "8px 10px", borderRadius: "8px", border: "1px solid #3cc2ff",
      background: "#0b2a46", color: "#cfefff"
    });

    // Alimenté juste après via refreshProviderOptions()
    providerWrap.append(label, select);

    const btn = document.createElement("button");
    btn.textContent = "🔗 Connect Wallet";
    Object.assign(btn.style, {
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      padding: "12px 22px", fontSize: "18px", fontWeight: "700",
      border: "1px solid #3cc2ff", borderRadius: "10px",
      background: "#0b2a46", color: "#cfefff", cursor: "pointer"
    });
    btn.addEventListener("click", () => connectWallet(select.value));

    // Lien d'aide si aucun wallet
    const hint = document.createElement("div");
    hint.style.opacity = "0.8";
    hint.style.marginTop = "10px";
    hint.style.fontSize = "13px";
    hint.textContent = "Si tu n’as aucun wallet installé, installe MetaMask ou ouvre avec un navigateur compatible.";

    box.append(h2, p, providerWrap, btn, hint);
    o.appendChild(box);
    document.body.appendChild(o);

    refreshProviderOptions(); // peupler le select
  }

  function refreshProviderOptions() {
    const select = document.getElementById("wallet-provider-select");
    if (!select) return;

    // Nettoie
    while (select.firstChild) select.removeChild(select.firstChild);

    // Construit la liste
    const options = [];

    // Providers EIP-6963 découverts
    discoveredProviders.forEach((p, idx) => {
      const name =
        (p.info && (p.info.name || p.info.rdns)) ||
        (p.provider && p.provider.isMetaMask && "MetaMask") ||
        `Provider #${idx + 1}`;
      options.push({ id: `eip6963:${idx}`, label: name });
    });

    // Fallback window.ethereum
    if (window.ethereum) {
      const name = window.ethereum.isMetaMask ? "MetaMask (injected)" : "Injected provider";
      options.push({ id: "injected", label: name });
    }

    // Si rien détecté
    if (options.length === 0) {
      options.push({ id: "none", label: "Aucun provider détecté" });
    }

    for (const opt of options) {
      const o = document.createElement("option");
      o.value = opt.id;
      o.textContent = opt.label;
      select.appendChild(o);
    }
  }

  // ==================== Multi-provider (EIP-6963) ====================
  function setupEIP6963Discovery() {
    if (mounted) return;
    mounted = true;

    // Ecoute l’annonce de providers
    window.addEventListener("eip6963:announceProvider", (event) => {
      const detail = event.detail;
      if (!detail || !detail.provider) return;
      // Évite doublons (rdns + uuid si fournis)
      const key = (detail.info && (detail.info.uuid || detail.info.rdns)) || detail.provider;
      if (!discoveredProviders.some(d => (d.info && (d.info.uuid || d.info.rdns)) === (detail.info && (detail.info.uuid || detail.info.rdns)) || d.provider === detail.provider)) {
        discoveredProviders.push(detail);
        refreshProviderOptions();
      }
    });

    // Demande aux wallets de s’annoncer
    window.dispatchEvent(new Event("eip6963:requestProvider"));
  }

  function pickProvider(selectionId) {
    if (selectionId && selectionId.startsWith("eip6963:")) {
      const idx = Number(selectionId.split(":")[1] || -1);
      if (idx >= 0 && discoveredProviders[idx]) return discoveredProviders[idx].provider;
    }
    if (selectionId === "injected" && window.ethereum) return window.ethereum;
    // défaut
    return window.ethereum || null;
  }

  // ==================== Réseau / chain ====================
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
      alert("Aucun wallet compatible détecté dans le navigateur.");
      return;
    }
    try {
      const ok = await ensureChain(provider);
      if (!ok) return;

      const accounts = await provider.request({ method: "eth_requestAccounts" });
      const addr = Array.isArray(accounts) && accounts[0] ? accounts[0] : null;
      if (addr) {
        currentProvider = provider;
        setStored(addr);
        removeOverlay();
        await updateAccess(addr, provider);
        // Event custom pour UI externes
        try { document.dispatchEvent(new CustomEvent("aw:walletConnected", { detail: { address: addr } })); } catch {}
      }
    } catch (e) {
      console.error("Wallet connect error:", e);
      alert("Connexion refusée ou échouée.");
    }
  }

  // ==================== balanceOf(owner) (ERC-721) ====================
  async function fetchNftBalance(owner, provider) {
    const p = provider || currentProvider || window.ethereum;
    if (!p || !/^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS)) return 0n;

    // selector keccak256("balanceOf(address)") = 0x70a08231
    const selector = "0x70a08231";
    const addrNo0x = owner.replace(/^0x/, "").toLowerCase();
    const data = selector + addrNo0x.padStart(64, "0");

    try {
      const res = await p.request({
        method: "eth_call",
        params: [{ to: CONTRACT_ADDRESS, data }, "latest"]
      });
      return BigInt(res || "0x0");
    } catch (e) {
      console.warn("eth_call balanceOf failed:", e);
      return 0n;
    }
  }

  // ==================== Maj flags consommés par le jeu ====================
  async function updateAccess(addr, provider) {
    const p = provider || currentProvider || window.ethereum;
    const ok = await ensureChain(p);
    if (!ok) return;

    const balance = await fetchNftBalance(addr, p);
    const canPlay = balance >= 1n;        // ≥1 NFT peut jouer
    const bonusEligible = balance >= 20n; // ≥20 NFTs = bonus (selon ta règle)

    const access = {
      address: addr,
      balance: Number(balance),
      canPlay,
      bonusEligible
    };

    // Stocker + partager au jeu + leaderboard
    setStored(addr); // important pour le backend/leaderboard
    window.AW_ACCESS = access;

    // Event pour le jeu / UI (leaderboard écoute aw:access)
    try { document.dispatchEvent(new CustomEvent("aw:access", { detail: access })); } catch {}

    if (!canPlay) createOverlay(); else removeOverlay();

    console.log("AW_ACCESS:", access);
  }

  // ==================== Vérif silencieuse de session ====================
  async function checkConnection() {
    if (isChecking) return;
    isChecking = true;

    try {
      const p = currentProvider || window.ethereum || null;

      // 1) Détecte comptes actifs
      let onChain = null;
      if (p?.request) {
        try {
          const accs = await p.request({ method: "eth_accounts" });
          onChain = Array.isArray(accs) && accs[0] ? accs[0] : null;
        } catch (e) {
          console.warn("eth_accounts failed:", e);
        }
      }

      const stored = getStored();

      // Aucun compte actif → reset
      if (!onChain) {
        setStored(null);
        window.AW_ACCESS = { address: null, balance: 0, canPlay: false, bonusEligible: false };
        createOverlay();
        return;
      }

      // Provider peut changer si utilisateur bascule (ex: extension multi-wallet)
      if (!currentProvider && window.ethereum) currentProvider = window.ethereum;

      // Sync storage
      if (stored !== onChain) setStored(onChain);

      await updateAccess(onChain, currentProvider);
    } finally {
      isChecking = false;
    }
  }

  // ==================== API debug ====================
  window.AW_GATE = {
    show: createOverlay,
    hide: removeOverlay,
    reset: () => {
      setStored(null);
      window.AW_ACCESS = { address: null, balance: 0, canPlay: false, bonusEligible: false };
      createOverlay();
    },
    check: () => checkConnection()
  };

  // ==================== Boot ====================
  const start = () => {
    setupEIP6963Discovery();
    createOverlay();
    checkConnection();
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
    p.on("chainChanged", () => checkConnection());
    p.on("disconnect", () => checkConnection());
  }

  // Bind dès que possible
  if (window.ethereum) {
    bindProviderEvents(window.ethereum);
  }
  // Bind aussi lorsque l’utilisateur se connecte à un provider découvert
  const _origConnect = connectWallet;
  connectWallet = async function (selectionId) {
    await _origConnect(selectionId);
    const p = pickProvider(selectionId);
    if (p) bindProviderEvents(p);
  };

  // Focus / visibilité / polling
  window.addEventListener("focus", () => checkConnection());
  document.addEventListener("visibilitychange", () => { if (!document.hidden) checkConnection(); });
  setInterval(() => checkConnection(), CHECK_EVERY_MS);
})();
