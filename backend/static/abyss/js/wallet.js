// backend/static/abyss/js/wallet.js
// Overlay bloquant tant qu’aucun wallet n’est connecté.
// Lecture balanceOf(owner) sur ton contrat ERC-721 (holdings) pour:
// - canPlay  : >= 1 NFT
// - bonusElig: >= 20 NFTs   (corrigé: 50 -> 20)

(function () {
  const WALLET_KEY = 'walletAddress';
  const CHECK_EVERY_MS = 4000;

  // ✅ Adresse du contrat Angry Whales (ERC-721)
  const CONTRACT_ADDRESS = '0x8Bb25A82e2f0230c2CFE3278CBc16a2C93685359';

  // (Optionnel) forcer une chaîne: ex. Ethereum mainnet = '0x1'
  // Laisse à null/undefined pour ne pas vérifier.
  const REQUIRED_CHAIN_ID = null; // '0x1' pour mainnet, '0x89' pour Polygon, etc.

  // --- Storage helpers ---
  const getStored = () => { try { return localStorage.getItem(WALLET_KEY) || null; } catch { return null; } };
  const setStored = (addr) => { try { addr ? localStorage.setItem(WALLET_KEY, addr) : localStorage.removeItem(WALLET_KEY); } catch {} };

  // --- Overlay UI ---
  function removeOverlay() {
    const el = document.getElementById('wallet-overlay');
    if (el) el.remove();
  }
  function createOverlay(message) {
    if (document.getElementById('wallet-overlay')) return;

    const o = document.createElement('div');
    o.id = 'wallet-overlay';
    Object.assign(o.style, {
      position:'fixed', inset:'0', background:'rgba(0,0,0,0.85)',
      display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', textAlign:'center', zIndex:'999999', padding:'24px'
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
      background:'rgba(10,20,40,0.95)', border:'1px solid #223a67', borderRadius:'14px',
      boxShadow:'0 10px 30px rgba(0,0,0,.45)', padding:'22px 26px', maxWidth:'520px',
      color:'#cfe6ff', fontFamily:"system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    });

    const h2 = document.createElement('h2');
    h2.textContent = 'Connect your Wallet to play 🐋';
    Object.assign(h2.style, {
      margin:'0 0 10px', fontFamily:"'Bebas Neue',sans-serif", fontSize:'42px',
      letterSpacing:'2px', color:'#ffcc00', textShadow:'0 2px 10px rgba(0,0,0,.55)'
    });

    const p = document.createElement('p');
    p.textContent = message || 'You must connect a wallet to access the game.';
    p.style.margin = '0 0 16px';

    const btn = document.createElement('button');
    btn.textContent = '🔗 Connect Wallet';
    Object.assign(btn.style, {
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      padding:'12px 22px', fontSize:'18px', fontWeight:'700',
      border:'1px solid #3cc2ff', borderRadius:'10px',
      background:'#0b2a46', color:'#cfefff', cursor:'pointer'
    });
    btn.addEventListener('click', connectWallet);

    box.append(h2, p, btn);
    o.appendChild(box);
    document.body.appendChild(o);
  }

  // --- Connexion ---
  async function ensureChain() {
    if (!REQUIRED_CHAIN_ID || !window.ethereum?.request) return true;
    try {
      const current = await window.ethereum.request({ method:'eth_chainId' });
      if (current === REQUIRED_CHAIN_ID) return true;
      // tente de switch
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: REQUIRED_CHAIN_ID }]
      });
      return true;
    } catch (e) {
      console.warn('Chain check/switch failed:', e);
      createOverlay('Please switch to the required network to play.');
      return false;
    }
  }

  async function connectWallet() {
    if (!window.ethereum) { alert('A compatible wallet (e.g., MetaMask) is not installed.'); return; }
    try {
      const ok = await ensureChain();
      if (!ok) return;
      const accounts = await window.ethereum.request({ method:'eth_requestAccounts' });
      const addr = Array.isArray(accounts) && accounts[0] ? accounts[0] : null;
      if (addr) { setStored(addr); removeOverlay(); await updateAccess(addr); }
    } catch (e) {
      console.error('Wallet connect error:', e);
      alert('Connection refused or failed.');
    }
  }

  // --- Lecture balanceOf(owner) via eth_call (ERC-721) ---
  async function fetchNftBalance(owner) {
    if (!window.ethereum || !/^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS)) return 0n;

    // function selector: keccak256("balanceOf(address)") -> 0x70a08231
    const selector = '0x70a08231';
    const addrNo0x = owner.replace(/^0x/, '').toLowerCase();
    const data = selector + addrNo0x.padStart(64, '0');

    try {
      const res = await window.ethereum.request({
        method: 'eth_call',
        params: [{ to: CONTRACT_ADDRESS, data }, 'latest']
      });
      return BigInt(res || '0x0');
    } catch (e) {
      console.warn('eth_call balanceOf failed:', e);
      return 0n;
    }
  }

  // --- Flags globaux consommés par le jeu ---
  async function updateAccess(addr) {
    const ok = await ensureChain();
    if (!ok) return;

    const balance = await fetchNftBalance(addr);
    const canPlay = balance >= 1n;    // ≥1 NFT peut jouer
    const bonusEligible = balance >= 20n; // ✅ corrigé à 20 NFTs

    window.AW_ACCESS = {
      address: addr,
      balance: Number(balance),
      canPlay,
      bonusEligible
    };

    document.dispatchEvent(new CustomEvent('aw:access', { detail: window.AW_ACCESS }));

    if (!canPlay) createOverlay(); else removeOverlay();

    console.log('AW_ACCESS:', window.AW_ACCESS);
  }

  // --- Vérifie l’état réel provider sans popup ---
  async function checkConnection() {
    let onChain = null;
    try {
      if (window.ethereum?.request) {
        const accs = await window.ethereum.request({ method:'eth_accounts' });
        onChain = Array.isArray(accs) && accs[0] ? accs[0] : null;
      }
    } catch (e) { console.warn('eth_accounts failed:', e); }

    const stored = getStored();

    if (!onChain) {
      setStored(null);
      window.AW_ACCESS = { address:null, balance:0, canPlay:false, bonusEligible:false };
      createOverlay();
      return;
    }

    if (stored !== onChain) setStored(onChain);
    await updateAccess(onChain);
  }

  // --- API debug ---
  window.AW_GATE = {
    show: createOverlay,
    hide: removeOverlay,
    reset: () => { setStored(null); window.AW_ACCESS = { address:null, balance:0, canPlay:false, bonusEligible:false }; createOverlay(); },
    check: () => checkConnection()
  };

  // --- Boot ---
  const start = () => { createOverlay(); checkConnection(); };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once:true });
  } else {
    start();
  }

  // --- Écoutes provider & vérifs régulières ---
  if (window.ethereum?.on) {
    window.ethereum.on('accountsChanged', () => checkConnection());
    window.ethereum.on('chainChanged',    () => checkConnection());
    window.ethereum.on('disconnect',      () => checkConnection());
  }
  window.addEventListener('focus', () => checkConnection());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkConnection(); });
  setInterval(() => checkConnection(), CHECK_EVERY_MS);
})();
