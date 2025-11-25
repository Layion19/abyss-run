/**
 * ═══════════════════════════════════════════════════════════════
 * 🐋 ANGRY WHALES — ABYSS RUN — WALLET GATE SYSTEM v2.1
 * ═══════════════════════════════════════════════════════════════
 * 
 * FIXED v2.1:
 * - ✅ Abstract Portal callback fix
 * - ✅ Address input verification
 * 
 * Support:
 * - ✅ MetaMask (Extension via EIP-6963)
 * - ✅ MetaMask Mobile (QR via SDK)
 * - ✅ Abstract Global Wallet (Portal + address verification)
 * - ✅ Autres wallets EIP-6963
 * - ✅ NFT gating (>= 1 NFT pour jouer, >= 20 pour bonus)
 * 
 * Contract: 0x8Bb25A82e2f0230c2CFE3278CBc16a2C93685359
 * Network: Abstract Mainnet (Chain ID: 2741 / 0xAB5)
 */

// ═══════════════════════════════════════════════════════════════
// 📋 CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  REQUIRED_CHAIN_ID: '0xAB5',
  REQUIRED_CHAIN_ID_DECIMAL: 2741,
  CHAIN_NAME: 'Abstract Mainnet',
  RPC_URL: 'https://api.mainnet.abs.xyz',
  BLOCK_EXPLORER: 'https://abscan.org/',
  NATIVE_CURRENCY: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  CONTRACT_ADDRESS: '0x8Bb25A82e2f0230c2CFE3278CBc16a2C93685359',
  MIN_NFT_TO_PLAY: 1,
  MIN_NFT_FOR_BONUS: 20,
  BALANCE_CACHE_DURATION: 24 * 60 * 60 * 1000,
};

// ═══════════════════════════════════════════════════════════════
// 🌍 ÉTAT GLOBAL
// ═══════════════════════════════════════════════════════════════

let state = {
  initialized: false,
  connected: false,
  address: null,
  balance: 0,
  canPlay: false,
  bonusEligible: false,
  provider: null,
  walletType: null,
};

let eip6963Wallets = new Map();
let metamaskProviderEIP6963 = null;

// ═══════════════════════════════════════════════════════════════
// 🎨 OVERLAY HTML
// ═══════════════════════════════════════════════════════════════

const OVERLAY_HTML = `
<div id="aw-gate-overlay" style="
  position: fixed;
  inset: 0;
  z-index: 999999;
  background: rgba(0, 0, 0, 0.86);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
">
  <div id="aw-gate-container" style="
    background: #0a1428;
    border: 1px solid #223a67;
    border-radius: 16px;
    padding: 32px;
    max-width: 520px;
    width: 100%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    color: #e8f1ff;
  ">
    <div id="aw-gate-content">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="margin: 0 0 8px; font-family: 'Bebas Neue', sans-serif; font-size: 2.4rem; letter-spacing: 1px; color: #ffcc00;">🐋 Connect Wallet</h2>
        <p id="aw-gate-message" style="margin: 0; color: #cfe6ff; font-size: 14px; line-height: 1.5;">Choose your wallet to verify Angry Whales NFT ownership</p>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        <p style="margin: 0 0 4px; font-size: 13px; color: #9fb4d5; text-transform: uppercase; letter-spacing: 0.08em;">Recommended</p>

        <button id="aw-connect-metamask" class="aw-wallet-btn" style="
          width: 100%; padding: 16px 20px;
          background: linear-gradient(135deg, #f6851b 0%, #e2761b 100%);
          color: white; border: none; border-radius: 12px;
          font-size: 16px; font-weight: 600; cursor: pointer;
          display: flex; align-items: center; gap: 12px;
          transition: transform 0.2s, box-shadow 0.2s;
        ">
          <span style="font-size: 24px;">🦊</span>
          <div style="flex: 1; text-align: left;">
            <div>MetaMask Extension</div>
            <div style="font-size: 12px; opacity: 0.9; font-weight: 400;">Browser extension required</div>
          </div>
        </button>

        <button id="aw-connect-metamask-qr" class="aw-wallet-btn" style="
          width: 100%; padding: 16px 20px;
          background: linear-gradient(135deg, #132349 0%, #0f1c3a 100%);
          color: white; border: 1px solid #274173; border-radius: 12px;
          font-size: 16px; font-weight: 600; cursor: pointer;
          display: flex; align-items: center; gap: 12px;
          transition: transform 0.2s, box-shadow 0.2s;
        ">
          <span style="font-size: 24px;">📱</span>
          <div style="flex: 1; text-align: left;">
            <div>MetaMask Mobile</div>
            <div style="font-size: 12px; opacity: 0.8; font-weight: 400;">Scan QR code with your phone</div>
          </div>
        </button>

        <p style="margin: 16px 0 4px; font-size: 13px; color: #9fb4d5; text-transform: uppercase; letter-spacing: 0.08em;">Other options</p>

        <button id="aw-connect-abstract" class="aw-wallet-btn" style="
          width: 100%; padding: 16px 20px;
          background: linear-gradient(135deg, #00d395 0%, #00b380 100%);
          color: #000; border: none; border-radius: 12px;
          font-size: 16px; font-weight: 600; cursor: pointer;
          display: flex; align-items: center; gap: 12px;
          transition: transform 0.2s, box-shadow 0.2s;
        ">
          <span style="font-size: 24px;">🌐</span>
          <div style="flex: 1; text-align: left;">
            <div>Abstract Global Wallet</div>
            <div style="font-size: 12px; opacity: 0.9; font-weight: 400;">Sign in with Google or email</div>
          </div>
        </button>

        <details id="aw-eip6963-section" style="margin-top: 12px; background: rgba(19,35,73,0.35); border: 1px solid #1f335c; border-radius: 12px; padding: 12px 16px;">
          <summary style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; color: #cfe6ff; font-weight: 600;">
            <span>Other wallets</span>
            <span id="aw-eip6963-count" style="font-size: 12px; opacity: 0.7;">0 detected</span>
          </summary>
          <div id="aw-eip6963-wallets" style="display: none; margin-top: 12px; max-height: 220px; overflow-y: auto;"></div>
        </details>
      </div>

      <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center; font-size: 13px; color: #8b9dc3; line-height: 1.6;">
        <p style="margin: 0;">You need <strong style="color: #ffcc00;">≥1 Angry Whale NFT</strong> to play</p>
        <p style="margin: 8px 0 0;">Bonus rewards unlock with <strong style="color: #ffcc00;">≥20 NFTs</strong></p>
      </div>
    </div>

    <div id="aw-gate-loading" style="display: none; text-align: center; padding: 40px 0;">
      <div style="display: inline-block; width: 50px; height: 50px; border: 3px solid rgba(255, 204, 0, 0.3); border-top-color: #ffcc00; border-radius: 50%; animation: aw-spin 0.8s linear infinite;"></div>
      <p id="aw-loading-text" style="margin: 16px 0 0; color: #cfe6ff; font-size: 15px;">Connecting...</p>
    </div>

    <div id="aw-gate-error" style="display: none; margin-top: 16px; padding: 12px; background: rgba(220, 38, 38, 0.1); border: 1px solid rgba(220, 38, 38, 0.3); border-radius: 8px; color: #fca5a5; font-size: 13px; text-align: center;"></div>
  </div>
</div>
<style>
@keyframes aw-spin { to { transform: rotate(360deg); } }
.aw-wallet-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.3); }
</style>
`;

// ═══════════════════════════════════════════════════════════════
// 🎨 ABSTRACT ADDRESS INPUT VIEW
// ═══════════════════════════════════════════════════════════════

const ABSTRACT_INPUT_HTML = `
<div style="text-align: center;">
  <h2 style="margin: 0 0 16px; font-family: 'Bebas Neue', sans-serif; font-size: 2rem; letter-spacing: 1px; color: #00d395;">🌐 Abstract Wallet</h2>
  
  <p style="color: #cfe6ff; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
    Signed in to Abstract Portal?<br>
    Enter your wallet address to verify NFT ownership.
  </p>

  <div style="margin-bottom: 16px;">
    <input type="text" id="aw-abstract-address" placeholder="0x... (your Abstract wallet address)" style="
      width: 100%; padding: 14px 16px;
      background: #0d1f3c; border: 1px solid #274173; border-radius: 10px;
      color: #fff; font-size: 14px; font-family: monospace;
      outline: none; box-sizing: border-box;
    ">
  </div>

  <p style="color: #8b9dc3; font-size: 12px; margin: 0 0 20px;">
    💡 Find your address on <a href="https://portal.abs.xyz" target="_blank" style="color: #00d395;">portal.abs.xyz</a> → Click your profile icon
  </p>

  <div style="display: flex; gap: 12px;">
    <button id="aw-abstract-back" style="
      flex: 1; padding: 14px;
      background: transparent; color: #cfe6ff;
      border: 1px solid #274173; border-radius: 10px;
      font-size: 15px; font-weight: 600; cursor: pointer;
    ">← Back</button>
    
    <button id="aw-abstract-verify" style="
      flex: 2; padding: 14px;
      background: linear-gradient(135deg, #00d395 0%, #00b380 100%);
      color: #000; border: none; border-radius: 10px;
      font-size: 15px; font-weight: 600; cursor: pointer;
    ">Verify & Connect</button>
  </div>
</div>
`;

// ═══════════════════════════════════════════════════════════════
// 🔧 UTILITAIRES
// ═══════════════════════════════════════════════════════════════

function log(...args) { console.log('[AW Gate]', ...args); }
function error(...args) { console.error('[AW Gate]', ...args); }

function showLoading(show = true, text = 'Connecting...') {
  const content = document.getElementById('aw-gate-content');
  const loading = document.getElementById('aw-gate-loading');
  const textEl = document.getElementById('aw-loading-text');
  if (content) content.style.display = show ? 'none' : 'block';
  if (loading) loading.style.display = show ? 'block' : 'none';
  if (textEl) textEl.textContent = text;
}

function showError(message) {
  const el = document.getElementById('aw-gate-error');
  if (el) { el.textContent = message; el.style.display = 'block'; setTimeout(() => el.style.display = 'none', 6000); }
}

function hideError() {
  const el = document.getElementById('aw-gate-error');
  if (el) el.style.display = 'none';
}

function isValidAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

async function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const script = document.createElement('script');
    script.src = src; script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

// ═══════════════════════════════════════════════════════════════
// 🔌 EIP-6963
// ═══════════════════════════════════════════════════════════════

function setupEIP6963Detection() {
  window.addEventListener('eip6963:announceProvider', (event) => {
    const { info, provider } = event.detail;
    const rdns = info.rdns || info.uuid || info.name;
    log('EIP-6963:', info.name, rdns);
    eip6963Wallets.set(rdns, { info, provider });
    if (rdns === 'io.metamask' || rdns.includes('metamask')) {
      metamaskProviderEIP6963 = provider;
    }
    renderEIP6963Wallets();
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  setTimeout(() => window.dispatchEvent(new Event('eip6963:requestProvider')), 500);
}

function renderEIP6963Wallets() {
  const container = document.getElementById('aw-eip6963-wallets');
  const counter = document.getElementById('aw-eip6963-count');
  if (!container || !counter) return;

  const otherWallets = Array.from(eip6963Wallets.entries()).filter(([rdns]) => 
    rdns !== 'io.metamask' && !rdns.includes('metamask')
  );

  counter.textContent = `${otherWallets.length} detected`;
  if (otherWallets.length === 0) { container.style.display = 'none'; return; }

  container.style.display = 'block';
  container.innerHTML = '';

  otherWallets.forEach(([rdns, { info, provider }]) => {
    const btn = document.createElement('button');
    btn.className = 'aw-wallet-btn';
    btn.style.cssText = `width:100%;padding:14px 16px;background:linear-gradient(135deg,#132349,#0f1c3a);color:#fff;border:1px solid #274173;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:12px;margin-top:8px;`;
    const icon = info.icon ? `<img src="${info.icon}" style="width:24px;height:24px;border-radius:4px;">` : '<span style="font-size:24px;">🔗</span>';
    btn.innerHTML = `${icon}<div style="flex:1;text-align:left;"><div>${info.name}</div></div>`;
    btn.addEventListener('click', () => connectWithProvider(provider, info.name));
    container.appendChild(btn);
  });
}

// ═══════════════════════════════════════════════════════════════
// 🌐 NETWORK & NFT
// ═══════════════════════════════════════════════════════════════

async function switchToAbstractChain(provider) {
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CONFIG.REQUIRED_CHAIN_ID }] });
    return true;
  } catch (e) {
    if (e.code === 4902 || e.message?.includes('Unrecognized')) {
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [{ chainId: CONFIG.REQUIRED_CHAIN_ID, chainName: CONFIG.CHAIN_NAME, nativeCurrency: CONFIG.NATIVE_CURRENCY, rpcUrls: [CONFIG.RPC_URL], blockExplorerUrls: [CONFIG.BLOCK_EXPLORER] }],
        });
        return true;
      } catch { return false; }
    }
    return false;
  }
}

async function checkChainId(provider) {
  try {
    const chainId = await provider.request({ method: 'eth_chainId' });
    if (chainId !== CONFIG.REQUIRED_CHAIN_ID) return await switchToAbstractChain(provider);
    return true;
  } catch { return false; }
}

async function checkNFTBalanceViaRPC(address) {
  const data = '0x70a08231' + address.slice(2).toLowerCase().padStart(64, '0');
  const res = await fetch(CONFIG.RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: CONFIG.CONTRACT_ADDRESS, data }, 'latest'] }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return parseInt(json.result, 16);
}

async function checkNFTBalance(address, provider) {
  try {
    const data = '0x70a08231' + address.slice(2).toLowerCase().padStart(64, '0');
    const result = await provider.request({ method: 'eth_call', params: [{ to: CONFIG.CONTRACT_ADDRESS, data }, 'latest'] });
    return parseInt(result, 16);
  } catch { return await checkNFTBalanceViaRPC(address); }
}

// ═══════════════════════════════════════════════════════════════
// 💾 STORAGE
// ═══════════════════════════════════════════════════════════════

function getCachedBalance(address) {
  try {
    const c = localStorage.getItem(`aw:balance:${address.toLowerCase()}`);
    if (!c) return null;
    const d = JSON.parse(c);
    return Date.now() - d.timestamp < CONFIG.BALANCE_CACHE_DURATION ? d.balance : null;
  } catch { return null; }
}

function setCachedBalance(address, balance) {
  try { localStorage.setItem(`aw:balance:${address.toLowerCase()}`, JSON.stringify({ balance, timestamp: Date.now() })); } catch {}
}

function saveWalletAddress(address, type) {
  try { localStorage.setItem('walletAddress', address); localStorage.setItem('walletType', type); } catch {}
}

function loadWalletData() {
  try { return { address: localStorage.getItem('walletAddress'), walletType: localStorage.getItem('walletType') }; } catch { return { address: null, walletType: null }; }
}

function clearWalletData() {
  try {
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('walletType');
    Object.keys(localStorage).forEach(k => { if (k.startsWith('aw:balance:')) localStorage.removeItem(k); });
  } catch {}
}

// ═══════════════════════════════════════════════════════════════
// 📢 STATE
// ═══════════════════════════════════════════════════════════════

function updateAccessState(address, balance, walletType) {
  state = { ...state, address, balance, canPlay: balance >= CONFIG.MIN_NFT_TO_PLAY, bonusEligible: balance >= CONFIG.MIN_NFT_FOR_BONUS, connected: true, walletType };
  window.AW_ACCESS = { address, balance, canPlay: state.canPlay, bonusEligible: state.bonusEligible };
  document.dispatchEvent(new CustomEvent('aw:accessChanged', { detail: window.AW_ACCESS }));
  document.dispatchEvent(new Event('aw:access'));
  log('Access:', window.AW_ACCESS);
}

function clearAccessState() {
  state = { initialized: true, connected: false, address: null, balance: 0, canPlay: false, bonusEligible: false, provider: null, walletType: null };
  window.AW_ACCESS = { address: null, balance: 0, canPlay: false, bonusEligible: false };
  document.dispatchEvent(new CustomEvent('aw:accessChanged', { detail: window.AW_ACCESS }));
  document.dispatchEvent(new Event('aw:access'));
}

// ═══════════════════════════════════════════════════════════════
// 🔗 GENERIC CONNECT
// ═══════════════════════════════════════════════════════════════

async function connectWithProvider(provider, name = 'Wallet') {
  try {
    showLoading(true, `Connecting ${name}...`);
    hideError();

    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    if (!accounts?.length) throw new Error('No accounts found');
    const address = accounts[0];
    state.provider = provider;

    showLoading(true, 'Switching to Abstract...');
    if (!await checkChainId(provider)) throw new Error('Switch to Abstract Mainnet');

    showLoading(true, 'Verifying NFT...');
    let balance = getCachedBalance(address);
    if (balance === null) { balance = await checkNFTBalance(address, provider); setCachedBalance(address, balance); }

    if (balance < CONFIG.MIN_NFT_TO_PLAY) {
      showLoading(false);
      showError(`Need ${CONFIG.MIN_NFT_TO_PLAY}+ NFT. You have ${balance}.`);
      return false;
    }

    saveWalletAddress(address, name.toLowerCase());
    updateAccessState(address, balance, name.toLowerCase());
    hideOverlay();
    return true;
  } catch (err) {
    error(name, err);
    showLoading(false);
    showError(err.message || `Failed to connect ${name}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// 🦊 METAMASK
// ═══════════════════════════════════════════════════════════════

async function connectMetaMaskExtension() {
  if (metamaskProviderEIP6963) return connectWithProvider(metamaskProviderEIP6963, 'MetaMask');
  const p = getMetaMaskProviderFallback();
  if (p) return connectWithProvider(p, 'MetaMask');
  showError('MetaMask not found. Install it or disable other wallets.');
  return false;
}

function getMetaMaskProviderFallback() {
  if (!window.ethereum) return null;
  const { ethereum } = window;
  if (ethereum.providers?.length) {
    const mm = ethereum.providers.find(p => p.isMetaMask && !p.isCoinbaseWallet && !p.isCoinbaseBrowser && !p.isRabby && !p.isBraveWallet);
    if (mm) return mm;
  }
  if (ethereum.isMetaMask && !ethereum.isCoinbaseWallet && !ethereum.isCoinbaseBrowser) return ethereum;
  return null;
}

// ═══════════════════════════════════════════════════════════════
// 📱 METAMASK MOBILE
// ═══════════════════════════════════════════════════════════════

let mmSDK = null;

async function connectMetaMaskMobile() {
  try {
    showLoading(true, 'Loading SDK...');
    hideError();

    if (!window.MetaMaskSDK) {
      await loadScript('https://unpkg.com/@metamask/sdk/dist/browser/es/metamask-sdk.js');
      await new Promise(r => setTimeout(r, 500));
    }

    const SDK = window.MetaMaskSDK?.MetaMaskSDK || window.MetaMaskSDK;
    if (!SDK) throw new Error('SDK failed');

    if (!mmSDK) mmSDK = new SDK({ dappMetadata: { name: 'Angry Whales', url: location.origin }, logging: { sdk: false } });
    const provider = mmSDK.getProvider();
    if (!provider) throw new Error('No provider');

    showLoading(true, 'Scan QR...');
    return connectWithProvider(provider, 'MetaMask Mobile');
  } catch (err) {
    error('MM Mobile', err);
    showLoading(false);
    showError(err.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// 🌐 ABSTRACT
// ═══════════════════════════════════════════════════════════════

function connectAbstract() {
  // Ouvrir le portail
  window.open('https://portal.abs.xyz', '_blank', 'width=500,height=700');
  // Afficher l'input d'adresse
  showAbstractInput();
}

function showAbstractInput() {
  const content = document.getElementById('aw-gate-content');
  if (!content) return;
  content.innerHTML = ABSTRACT_INPUT_HTML;

  document.getElementById('aw-abstract-back')?.addEventListener('click', resetOverlay);
  document.getElementById('aw-abstract-verify')?.addEventListener('click', verifyAbstractAddress);
  document.getElementById('aw-abstract-address')?.addEventListener('keypress', e => { if (e.key === 'Enter') verifyAbstractAddress(); });

  // Pre-fill
  const saved = loadWalletData();
  if (saved.address && saved.walletType === 'abstract') {
    document.getElementById('aw-abstract-address').value = saved.address;
  }
}

async function verifyAbstractAddress() {
  const input = document.getElementById('aw-abstract-address');
  const address = input?.value?.trim();

  if (!address) { showError('Enter your wallet address'); return; }
  if (!isValidAddress(address)) { showError('Invalid address (0x + 40 hex chars)'); return; }

  try {
    showLoading(true, 'Verifying NFT...');
    hideError();

    let balance = getCachedBalance(address);
    if (balance === null) { balance = await checkNFTBalanceViaRPC(address); setCachedBalance(address, balance); }

    log('Abstract balance:', balance);

    if (balance < CONFIG.MIN_NFT_TO_PLAY) {
      showLoading(false);
      showError(`Need ${CONFIG.MIN_NFT_TO_PLAY}+ NFT. You have ${balance}.`);
      return;
    }

    saveWalletAddress(address, 'abstract');
    updateAccessState(address, balance, 'abstract');
    hideOverlay();
    log('✅ Abstract connected:', address);
  } catch (err) {
    error('Abstract verify', err);
    showLoading(false);
    showError('Verification failed. Check address.');
  }
}

function resetOverlay() {
  hideOverlay();
  showOverlay();
}

// ═══════════════════════════════════════════════════════════════
// 🎭 OVERLAY
// ═══════════════════════════════════════════════════════════════

function showOverlay(message) {
  hideOverlay();
  const div = document.createElement('div');
  div.innerHTML = OVERLAY_HTML;
  document.body.appendChild(div.firstElementChild);

  if (message) {
    const m = document.getElementById('aw-gate-message');
    if (m) m.textContent = message;
  }

  document.getElementById('aw-connect-metamask')?.addEventListener('click', connectMetaMaskExtension);
  document.getElementById('aw-connect-metamask-qr')?.addEventListener('click', connectMetaMaskMobile);
  document.getElementById('aw-connect-abstract')?.addEventListener('click', connectAbstract);

  renderEIP6963Wallets();
  log('Overlay shown');
}

function hideOverlay() {
  document.getElementById('aw-gate-overlay')?.remove();
}

let watchdog = null;
function startWatchdog() {
  if (watchdog) return;
  watchdog = setInterval(() => {
    if (!state.connected && !document.getElementById('aw-gate-overlay')) showOverlay();
  }, 1000);
}
function stopWatchdog() {
  if (watchdog) { clearInterval(watchdog); watchdog = null; }
}

// ═══════════════════════════════════════════════════════════════
// 🔄 AUTO-RECONNECT
// ═══════════════════════════════════════════════════════════════

async function tryAutoReconnect() {
  const { address, walletType } = loadWalletData();
  if (!address) return false;
  log('Auto-reconnect:', address, walletType);

  try {
    await new Promise(r => setTimeout(r, 800));

    // Abstract: juste vérifier le balance
    if (walletType === 'abstract') {
      let balance = getCachedBalance(address);
      if (balance === null) { balance = await checkNFTBalanceViaRPC(address); setCachedBalance(address, balance); }
      if (balance >= CONFIG.MIN_NFT_TO_PLAY) {
        updateAccessState(address, balance, 'abstract');
        log('Auto-reconnected Abstract');
        return true;
      }
    }

    // MetaMask EIP-6963
    if (metamaskProviderEIP6963) {
      try {
        const accs = await metamaskProviderEIP6963.request({ method: 'eth_accounts' });
        if (accs?.[0]?.toLowerCase() === address.toLowerCase()) {
          state.provider = metamaskProviderEIP6963;
          if (await checkChainId(state.provider)) {
            let balance = getCachedBalance(address);
            if (balance === null) { balance = await checkNFTBalance(address, state.provider); setCachedBalance(address, balance); }
            if (balance >= CONFIG.MIN_NFT_TO_PLAY) {
              updateAccessState(address, balance, 'metamask');
              log('Auto-reconnected MetaMask');
              return true;
            }
          }
        }
      } catch {}
    }

    // MetaMask fallback
    const mm = getMetaMaskProviderFallback();
    if (mm) {
      try {
        const accs = await mm.request({ method: 'eth_accounts' });
        if (accs?.[0]?.toLowerCase() === address.toLowerCase()) {
          state.provider = mm;
          if (await checkChainId(state.provider)) {
            let balance = getCachedBalance(address);
            if (balance === null) { balance = await checkNFTBalance(address, state.provider); setCachedBalance(address, balance); }
            if (balance >= CONFIG.MIN_NFT_TO_PLAY) {
              updateAccessState(address, balance, 'metamask');
              log('Auto-reconnected MetaMask fallback');
              return true;
            }
          }
        }
      } catch {}
    }
  } catch (err) { error('Auto-reconnect', err); }

  return false;
}

// ═══════════════════════════════════════════════════════════════
// 🚀 INIT
// ═══════════════════════════════════════════════════════════════

async function init() {
  if (state.initialized) return;
  log('Init v2.1...');

  setupEIP6963Detection();
  await new Promise(r => setTimeout(r, 600));

  if (!await tryAutoReconnect()) {
    showOverlay();
    startWatchdog();
  }

  state.initialized = true;
  log('Ready');
}

// ═══════════════════════════════════════════════════════════════
// 🌍 API
// ═══════════════════════════════════════════════════════════════

window.AW_GATE = {
  show: (m) => { showOverlay(m); startWatchdog(); },
  hide: () => { hideOverlay(); stopWatchdog(); },
  check: () => state.connected && state.canPlay,
  disconnect: () => { clearWalletData(); clearAccessState(); showOverlay(); startWatchdog(); },
  getState: () => ({ ...state }),
  debug: { wallets: () => [...eip6963Wallets.entries()], mm: () => metamaskProviderEIP6963, state: () => state },
};

window.AW_ACCESS = { address: null, balance: 0, canPlay: false, bonusEligible: false };

// ═══════════════════════════════════════════════════════════════
// 🎬 START
// ═══════════════════════════════════════════════════════════════

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

log('Wallet gate v2.1 loaded');