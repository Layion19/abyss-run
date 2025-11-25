/**
 * ═══════════════════════════════════════════════════════════════
 * 🐋 ANGRY WHALES — ABYSS RUN — WALLET GATE SYSTEM v2.0
 * ═══════════════════════════════════════════════════════════════
 * 
 * FIXED:
 * - ✅ MetaMask detection via EIP-6963 (évite Coinbase)
 * - ✅ Abstract Global Wallet via SDK natif
 * - ✅ Fallback robuste pour tous les wallets
 * 
 * Support:
 * - ✅ MetaMask (Extension via EIP-6963)
 * - ✅ MetaMask Mobile (QR via SDK)
 * - ✅ Abstract Global Wallet (via AGW SDK)
 * - ✅ Autres wallets EIP-6963 (Coinbase, Rainbow, etc.)
 * - ✅ NFT gating (>= 1 NFT pour jouer, >= 20 pour bonus)
 * 
 * Contract: 0x8Bb25A82e2f0230c2CFE3278CBc16a2C93685359
 * Network: Abstract Mainnet (Chain ID: 2741 / 0xAB5)
 */

// ═══════════════════════════════════════════════════════════════
// 📋 CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  // Abstract Network
  REQUIRED_CHAIN_ID: '0xAB5', // 2741 en décimal
  REQUIRED_CHAIN_ID_DECIMAL: 2741,
  CHAIN_NAME: 'Abstract Mainnet',
  RPC_URL: 'https://api.mainnet.abs.xyz',
  BLOCK_EXPLORER: 'https://abscan.org/',
  NATIVE_CURRENCY: {
    name: 'ETH',
    symbol: 'ETH',
    decimals: 18
  },

  // NFT Contract (ERC-721)
  CONTRACT_ADDRESS: '0x8Bb25A82e2f0230c2CFE3278CBc16a2C93685359',
  
  // Gating Rules
  MIN_NFT_TO_PLAY: 1,
  MIN_NFT_FOR_BONUS: 20,
  
  // Cache Duration
  BALANCE_CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 heures
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
  walletType: null, // 'metamask' | 'abstract' | 'eip6963'
};

// EIP-6963 detected wallets
let eip6963Wallets = new Map(); // rdns -> { info, provider }
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
  <div style="
    background: #0a1428;
    border: 1px solid #223a67;
    border-radius: 16px;
    padding: 32px;
    max-width: 520px;
    width: 100%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    color: #e8f1ff;
  ">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 24px;">
      <h2 style="
        margin: 0 0 8px;
        font-family: 'Bebas Neue', sans-serif;
        font-size: 2.4rem;
        letter-spacing: 1px;
        color: #ffcc00;
      ">🐋 Connect Wallet</h2>
      <p id="aw-gate-message" style="
        margin: 0;
        color: #cfe6ff;
        font-size: 14px;
        line-height: 1.5;
      ">Choose your wallet to verify Angry Whales NFT ownership</p>
    </div>

    <!-- Wallet Options -->
    <div style="display: flex; flex-direction: column; gap: 12px;">

      <p style="margin: 0 0 4px; font-size: 13px; color: #9fb4d5; text-transform: uppercase; letter-spacing: 0.08em;">Recommended</p>

      <!-- MetaMask Extension -->
      <button id="aw-connect-metamask" style="
        width: 100%;
        padding: 16px 20px;
        background: linear-gradient(135deg, #f6851b 0%, #e2761b 100%);
        color: white;
        border: none;
        border-radius: 12px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 12px;
        transition: transform 0.2s, box-shadow 0.2s;
      " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(246,133,27,0.3)'"
         onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
        <span style="font-size: 24px;">🦊</span>
        <div style="flex: 1; text-align: left;">
          <div>MetaMask Extension</div>
          <div style="font-size: 12px; opacity: 0.9; font-weight: 400;">Browser extension required</div>
        </div>
      </button>

      <!-- MetaMask Mobile QR -->
      <button id="aw-connect-metamask-qr" style="
        width: 100%;
        padding: 16px 20px;
        background: linear-gradient(135deg, #132349 0%, #0f1c3a 100%);
        color: white;
        border: 1px solid #274173;
        border-radius: 12px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 12px;
        transition: transform 0.2s, box-shadow 0.2s;
      " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(19,35,73,0.4)'"
         onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
        <span style="font-size: 24px;">📱</span>
        <div style="flex: 1; text-align: left;">
          <div>MetaMask Mobile</div>
          <div style="font-size: 12px; opacity: 0.8; font-weight: 400;">Scan QR code with your phone</div>
        </div>
      </button>

      <p style="margin: 16px 0 4px; font-size: 13px; color: #9fb4d5; text-transform: uppercase; letter-spacing: 0.08em;">Other options</p>

      <!-- Abstract Global Wallet -->
      <button id="aw-connect-abstract" style="
        width: 100%;
        padding: 16px 20px;
        background: linear-gradient(135deg, #00d395 0%, #00b380 100%);
        color: #000;
        border: none;
        border-radius: 12px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 12px;
        transition: transform 0.2s, box-shadow 0.2s;
      " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(0,211,149,0.4)'"
         onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
        <span style="font-size: 24px;">🌐</span>
        <div style="flex: 1; text-align: left;">
          <div>Abstract Global Wallet</div>
          <div style="font-size: 12px; opacity: 0.9; font-weight: 400;">Sign in with Google or email</div>
        </div>
      </button>

      <!-- Autres wallets EIP-6963 -->
      <details id="aw-eip6963-section" style="
        margin-top: 12px;
        background: rgba(19,35,73,0.35);
        border: 1px solid #1f335c;
        border-radius: 12px;
        padding: 12px 16px;
      ">
        <summary style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; color: #cfe6ff; font-weight: 600;">
          <span>Other wallets</span>
          <span id="aw-eip6963-count" style="font-size: 12px; opacity: 0.7;">0 detected</span>
        </summary>
        <div id="aw-eip6963-wallets" style="display: none; margin-top: 12px; max-height: 220px; overflow-y: auto; padding-right: 4px;"></div>
      </details>
    </div>

    <!-- Loading State -->
    <div id="aw-gate-loading" style="display: none; text-align: center; margin-top: 20px;">
      <div style="
        display: inline-block;
        width: 40px;
        height: 40px;
        border: 3px solid rgba(255, 204, 0, 0.3);
        border-top-color: #ffcc00;
        border-radius: 50%;
        animation: aw-spin 0.8s linear infinite;
      "></div>
      <p id="aw-loading-text" style="margin: 12px 0 0; color: #cfe6ff; font-size: 14px;">Connecting...</p>
    </div>

    <!-- Error State -->
    <div id="aw-gate-error" style="display: none; margin-top: 16px; padding: 12px; background: rgba(220, 38, 38, 0.1); border: 1px solid rgba(220, 38, 38, 0.3); border-radius: 8px; color: #fca5a5; font-size: 13px;"></div>

    <!-- Footer Info -->
    <div style="
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      text-align: center;
      font-size: 13px;
      color: #8b9dc3;
      line-height: 1.6;
    ">
      <p style="margin: 0;">You need <strong style="color: #ffcc00;">≥1 Angry Whale NFT</strong> to play</p>
      <p style="margin: 8px 0 0;">Bonus rewards unlock with <strong style="color: #ffcc00;">≥20 NFTs</strong></p>
    </div>
  </div>
</div>

<style>
@keyframes aw-spin {
  to { transform: rotate(360deg); }
}
</style>
`;

// ═══════════════════════════════════════════════════════════════
// 🔧 UTILITAIRES
// ═══════════════════════════════════════════════════════════════

function log(...args) {
  console.log('[AW Gate]', ...args);
}

function error(...args) {
  console.error('[AW Gate]', ...args);
}

function showLoading(show = true, text = 'Connecting...') {
  const el = document.getElementById('aw-gate-loading');
  const textEl = document.getElementById('aw-loading-text');
  if (el) el.style.display = show ? 'block' : 'none';
  if (textEl) textEl.textContent = text;
}

function showError(message) {
  const el = document.getElementById('aw-gate-error');
  if (el) {
    el.textContent = message;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 6000);
  }
}

function hideError() {
  const el = document.getElementById('aw-gate-error');
  if (el) el.style.display = 'none';
}

async function loadScript(src) {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

// ═══════════════════════════════════════════════════════════════
// 🔌 EIP-6963 WALLET DETECTION (PRIORITÉ POUR METAMASK)
// ═══════════════════════════════════════════════════════════════

function setupEIP6963Detection() {
  // Écouter les annonces de wallets
  window.addEventListener('eip6963:announceProvider', (event) => {
    const { info, provider } = event.detail;
    const rdns = info.rdns || info.uuid || info.name;
    
    log('EIP-6963 wallet detected:', info.name, 'rdns:', rdns);
    
    // Stocker tous les wallets détectés
    eip6963Wallets.set(rdns, { info, provider });
    
    // Identifier MetaMask spécifiquement par son RDNS
    if (rdns === 'io.metamask' || rdns.includes('metamask')) {
      log('✅ MetaMask found via EIP-6963!');
      metamaskProviderEIP6963 = provider;
    }
    
    // Mettre à jour l'UI
    renderEIP6963Wallets();
  });

  // Demander aux wallets de s'annoncer
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  
  // Re-demander après un court délai (certains wallets sont lents)
  setTimeout(() => {
    window.dispatchEvent(new Event('eip6963:requestProvider'));
  }, 500);
}

function renderEIP6963Wallets() {
  const container = document.getElementById('aw-eip6963-wallets');
  const counter = document.getElementById('aw-eip6963-count');
  if (!container || !counter) return;

  // Filtrer MetaMask (on a un bouton dédié)
  const otherWallets = Array.from(eip6963Wallets.entries()).filter(([rdns]) => {
    return rdns !== 'io.metamask' && !rdns.includes('metamask');
  });

  counter.textContent = `${otherWallets.length} detected`;

  if (otherWallets.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = '';

  otherWallets.forEach(([rdns, { info, provider }]) => {
    const button = document.createElement('button');
    button.style.cssText = `
      width: 100%;
      padding: 14px 16px;
      background: linear-gradient(135deg, #132349 0%, #0f1c3a 100%);
      color: white;
      border: 1px solid #274173;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 12px;
      transition: transform 0.2s, box-shadow 0.2s;
      margin-top: 8px;
    `;

    const iconHtml = info.icon 
      ? `<img src="${info.icon}" alt="${info.name}" style="width: 24px; height: 24px; border-radius: 4px;">`
      : '<span style="font-size: 24px;">🔗</span>';

    button.innerHTML = `
      ${iconHtml}
      <div style="flex: 1; text-align: left;">
        <div>${info.name}</div>
      </div>
    `;

    button.addEventListener('click', () => connectWithProvider(provider, info.name));
    button.addEventListener('mouseover', () => {
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = '0 6px 16px rgba(19,35,73,0.4)';
    });
    button.addEventListener('mouseout', () => {
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = 'none';
    });
    
    container.appendChild(button);
  });
}

// ═══════════════════════════════════════════════════════════════
// 🌐 GESTION DU RÉSEAU
// ═══════════════════════════════════════════════════════════════

async function switchToAbstractChain(provider) {
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: CONFIG.REQUIRED_CHAIN_ID }],
    });
    return true;
  } catch (switchError) {
    // Chain not added (code 4902) - try to add it
    if (switchError.code === 4902 || switchError.message?.includes('Unrecognized chain')) {
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: CONFIG.REQUIRED_CHAIN_ID,
            chainName: CONFIG.CHAIN_NAME,
            nativeCurrency: CONFIG.NATIVE_CURRENCY,
            rpcUrls: [CONFIG.RPC_URL],
            blockExplorerUrls: [CONFIG.BLOCK_EXPLORER],
          }],
        });
        return true;
      } catch (addError) {
        error('Failed to add Abstract chain:', addError);
        return false;
      }
    }
    error('Failed to switch chain:', switchError);
    return false;
  }
}

async function checkChainId(provider) {
  try {
    const chainId = await provider.request({ method: 'eth_chainId' });
    log('Current chainId:', chainId);
    
    if (chainId !== CONFIG.REQUIRED_CHAIN_ID) {
      log(`Wrong chain (${chainId}), switching to Abstract...`);
      return await switchToAbstractChain(provider);
    }
    return true;
  } catch (err) {
    error('Failed to check chain ID:', err);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// 🔢 VÉRIFICATION NFT (ERC-721 balanceOf)
// ═══════════════════════════════════════════════════════════════

async function checkNFTBalance(address, provider) {
  try {
    // Encoder balanceOf(address) call - function selector + address padded
    const data = '0x70a08231' + address.slice(2).toLowerCase().padStart(64, '0');
    
    const result = await provider.request({
      method: 'eth_call',
      params: [{
        to: CONFIG.CONTRACT_ADDRESS,
        data: data,
      }, 'latest'],
    });

    // Décoder le résultat (uint256)
    const balance = parseInt(result, 16);
    log(`NFT Balance for ${address}: ${balance}`);
    
    return balance;
  } catch (err) {
    error('Failed to check NFT balance:', err);
    
    // Fallback: essayer via RPC direct
    try {
      return await checkNFTBalanceViaRPC(address);
    } catch (rpcErr) {
      error('RPC fallback also failed:', rpcErr);
      return 0;
    }
  }
}

async function checkNFTBalanceViaRPC(address) {
  const data = '0x70a08231' + address.slice(2).toLowerCase().padStart(64, '0');
  
  const response = await fetch(CONFIG.RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{
        to: CONFIG.CONTRACT_ADDRESS,
        data: data,
      }, 'latest'],
    }),
  });
  
  const json = await response.json();
  if (json.error) throw new Error(json.error.message);
  
  return parseInt(json.result, 16);
}

// ═══════════════════════════════════════════════════════════════
// 💾 CACHE & STORAGE
// ═══════════════════════════════════════════════════════════════

function getCachedBalance(address) {
  try {
    const cached = localStorage.getItem(`aw:balance:${address.toLowerCase()}`);
    if (!cached) return null;
    
    const data = JSON.parse(cached);
    if (Date.now() - data.timestamp < CONFIG.BALANCE_CACHE_DURATION) {
      log('Using cached balance:', data.balance);
      return data.balance;
    }
    return null;
  } catch {
    return null;
  }
}

function setCachedBalance(address, balance) {
  try {
    localStorage.setItem(`aw:balance:${address.toLowerCase()}`, JSON.stringify({
      balance,
      timestamp: Date.now(),
    }));
  } catch (err) {
    error('Failed to cache balance:', err);
  }
}

function saveWalletAddress(address, walletType) {
  try {
    localStorage.setItem('walletAddress', address);
    localStorage.setItem('walletType', walletType);
    log('Wallet saved:', address, walletType);
  } catch (err) {
    error('Failed to save wallet:', err);
  }
}

function loadWalletData() {
  try {
    return {
      address: localStorage.getItem('walletAddress'),
      walletType: localStorage.getItem('walletType'),
    };
  } catch {
    return { address: null, walletType: null };
  }
}

function clearWalletData() {
  try {
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('walletType');
    // Clear balance caches
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('aw:balance:')) {
        localStorage.removeItem(key);
      }
    });
  } catch (err) {
    error('Failed to clear wallet data:', err);
  }
}

// ═══════════════════════════════════════════════════════════════
// 📢 MISE À JOUR DE L'ÉTAT
// ═══════════════════════════════════════════════════════════════

function updateAccessState(address, balance, walletType) {
  state.address = address;
  state.balance = balance;
  state.canPlay = balance >= CONFIG.MIN_NFT_TO_PLAY;
  state.bonusEligible = balance >= CONFIG.MIN_NFT_FOR_BONUS;
  state.connected = true;
  state.walletType = walletType;

  window.AW_ACCESS = {
    address: state.address,
    balance: state.balance,
    canPlay: state.canPlay,
    bonusEligible: state.bonusEligible,
  };

  document.dispatchEvent(new CustomEvent('aw:accessChanged', { detail: window.AW_ACCESS }));
  document.dispatchEvent(new Event('aw:access'));

  log('Access state updated:', window.AW_ACCESS);
}

function clearAccessState() {
  state.connected = false;
  state.address = null;
  state.balance = 0;
  state.canPlay = false;
  state.bonusEligible = false;
  state.provider = null;
  state.walletType = null;

  window.AW_ACCESS = {
    address: null,
    balance: 0,
    canPlay: false,
    bonusEligible: false,
  };

  document.dispatchEvent(new CustomEvent('aw:accessChanged', { detail: window.AW_ACCESS }));
  document.dispatchEvent(new Event('aw:access'));

  log('Access state cleared');
}

// ═══════════════════════════════════════════════════════════════
// 🔗 CONNEXION GÉNÉRIQUE AVEC UN PROVIDER
// ═══════════════════════════════════════════════════════════════

async function connectWithProvider(provider, walletName = 'Wallet') {
  try {
    showLoading(true, `Connecting to ${walletName}...`);
    hideError();

    if (!provider) {
      throw new Error(`${walletName} not found`);
    }

    // Request accounts
    log(`Requesting accounts from ${walletName}...`);
    const accounts = await provider.request({ method: 'eth_requestAccounts' });

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found');
    }

    const address = accounts[0];
    state.provider = provider;
    log(`${walletName} address:`, address);

    // Switch to Abstract chain
    showLoading(true, 'Switching to Abstract network...');
    const switched = await checkChainId(provider);
    if (!switched) {
      throw new Error('Please switch to Abstract Mainnet in your wallet');
    }

    // Check NFT balance
    showLoading(true, 'Verifying NFT ownership...');
    let balance = getCachedBalance(address);
    if (balance === null) {
      balance = await checkNFTBalance(address, provider);
      setCachedBalance(address, balance);
    }

    if (balance < CONFIG.MIN_NFT_TO_PLAY) {
      showError(`You need at least ${CONFIG.MIN_NFT_TO_PLAY} Angry Whale NFT to play. You have ${balance}.`);
      showLoading(false);
      return false;
    }

    // Success!
    saveWalletAddress(address, walletName.toLowerCase());
    updateAccessState(address, balance, walletName.toLowerCase());
    hideOverlay();
    showLoading(false);

    log(`✅ ${walletName} connected:`, address);
    return true;

  } catch (err) {
    error(`${walletName} error:`, err);
    showError(err.message || `Failed to connect ${walletName}`);
    showLoading(false);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// 🦊 METAMASK EXTENSION (via EIP-6963)
// ═══════════════════════════════════════════════════════════════

async function connectMetaMaskExtension() {
  // Priorité 1: Utiliser le provider EIP-6963 si disponible
  if (metamaskProviderEIP6963) {
    log('Using MetaMask via EIP-6963');
    return await connectWithProvider(metamaskProviderEIP6963, 'MetaMask');
  }
  
  // Priorité 2: Fallback sur window.ethereum avec vérification stricte
  const provider = getMetaMaskProviderFallback();
  if (provider) {
    log('Using MetaMask via window.ethereum fallback');
    return await connectWithProvider(provider, 'MetaMask');
  }
  
  // MetaMask non trouvé
  showError('MetaMask extension not found. Please install MetaMask or disable other wallet extensions.');
  return false;
}

function getMetaMaskProviderFallback() {
  if (!window.ethereum) return null;
  
  const { ethereum } = window;
  
  // Si plusieurs providers (EIP-1193 providers array)
  if (ethereum.providers && Array.isArray(ethereum.providers)) {
    // Chercher MetaMask: isMetaMask=true ET PAS Coinbase/Rabby/etc
    const mm = ethereum.providers.find(p => 
      p.isMetaMask === true && 
      !p.isCoinbaseWallet && 
      !p.isCoinbaseBrowser &&
      !p.isRabby &&
      !p.isBraveWallet
    );
    if (mm) return mm;
  }
  
  // Provider unique
  if (ethereum.isMetaMask && !ethereum.isCoinbaseWallet && !ethereum.isCoinbaseBrowser) {
    return ethereum;
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════════
// 📱 METAMASK MOBILE (QR CODE via SDK)
// ═══════════════════════════════════════════════════════════════

let metamaskSDKInstance = null;

async function connectMetaMaskMobile() {
  try {
    showLoading(true, 'Loading MetaMask SDK...');
    hideError();

    // Charger le SDK MetaMask si nécessaire
    if (!window.MetaMaskSDK) {
      await loadScript('https://unpkg.com/@metamask/sdk/dist/browser/es/metamask-sdk.js');
      // Attendre que le SDK soit disponible
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const MMSDK = window.MetaMaskSDK?.MetaMaskSDK || window.MetaMaskSDK;
    if (!MMSDK) {
      throw new Error('MetaMask SDK failed to load');
    }

    showLoading(true, 'Initializing MetaMask Mobile...');
    
    // Créer une nouvelle instance ou réutiliser
    if (!metamaskSDKInstance) {
      metamaskSDKInstance = new MMSDK({
        dappMetadata: {
          name: 'Angry Whales - Abyss Run',
          url: window.location.origin,
        },
        logging: { sdk: false },
      });
    }

    const provider = metamaskSDKInstance.getProvider();
    if (!provider) {
      throw new Error('Failed to get MetaMask Mobile provider');
    }

    showLoading(true, 'Scan QR code with MetaMask Mobile...');
    
    return await connectWithProvider(provider, 'MetaMask Mobile');

  } catch (err) {
    error('MetaMask Mobile error:', err);
    showError(err.message || 'Failed to connect MetaMask Mobile');
    showLoading(false);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// 🌐 ABSTRACT GLOBAL WALLET
// ═══════════════════════════════════════════════════════════════

async function connectAbstract() {
  try {
    showLoading(true, 'Opening Abstract Portal...');
    hideError();

    // Vérifier si Abstract est déjà installé via EIP-6963
    const abstractWallet = Array.from(eip6963Wallets.entries()).find(([rdns]) => 
      rdns.includes('abstract') || rdns.includes('abs')
    );
    
    if (abstractWallet) {
      log('Abstract wallet found via EIP-6963');
      return await connectWithProvider(abstractWallet[1].provider, 'Abstract');
    }

    // Sinon, utiliser le portail Abstract avec un popup
    log('Opening Abstract Portal popup...');
    
    // Option 1: Redirection vers le portail Abstract
    const abstractPortalUrl = 'https://portal.abs.xyz';
    const currentUrl = encodeURIComponent(window.location.href);
    
    // Ouvrir le portail dans une nouvelle fenêtre/onglet
    const popup = window.open(
      `${abstractPortalUrl}?redirect=${currentUrl}&chain=abstract`,
      'Abstract Portal',
      'width=450,height=700,scrollbars=yes,resizable=yes'
    );

    if (!popup) {
      // Popup bloqué, afficher un message
      showError('Popup blocked! Please allow popups and try again, or visit portal.abs.xyz directly.');
      showLoading(false);
      return false;
    }

    showLoading(true, 'Complete sign-in in the Abstract Portal window...');
    
    // Écouter les messages du popup
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        window.removeEventListener('message', messageHandler);
        reject(new Error('Connection timeout. Please try again.'));
      }, 120000); // 2 minutes timeout

      function messageHandler(event) {
        // Vérifier l'origine
        if (!event.origin.includes('abs.xyz') && event.origin !== window.location.origin) {
          return;
        }

        log('Received message from Abstract Portal:', event.data);

        if (event.data?.type === 'abstract-wallet-connected') {
          clearTimeout(timeout);
          window.removeEventListener('message', messageHandler);
          resolve(event.data);
        } else if (event.data?.type === 'abstract-wallet-error') {
          clearTimeout(timeout);
          window.removeEventListener('message', messageHandler);
          reject(new Error(event.data.message || 'Connection failed'));
        }
      }

      window.addEventListener('message', messageHandler);

      // Vérifier périodiquement si le popup est fermé
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          clearTimeout(timeout);
          window.removeEventListener('message', messageHandler);
          
          // Vérifier si un wallet a été connecté pendant ce temps via EIP-6963
          setTimeout(async () => {
            const newAbstractWallet = Array.from(eip6963Wallets.entries()).find(([rdns]) => 
              rdns.includes('abstract') || rdns.includes('abs')
            );
            if (newAbstractWallet) {
              resolve({ provider: newAbstractWallet[1].provider });
            } else {
              reject(new Error('Portal closed without connecting'));
            }
          }, 1000);
        }
      }, 1000);
    });

    // Si on a reçu une adresse directement
    if (result.address) {
      // Vérifier le NFT balance via RPC
      const balance = await checkNFTBalanceViaRPC(result.address);
      
      if (balance < CONFIG.MIN_NFT_TO_PLAY) {
        showError(`You need at least ${CONFIG.MIN_NFT_TO_PLAY} Angry Whale NFT to play. You have ${balance}.`);
        showLoading(false);
        return false;
      }

      saveWalletAddress(result.address, 'abstract');
      updateAccessState(result.address, balance, 'abstract');
      hideOverlay();
      showLoading(false);
      
      log('✅ Abstract connected:', result.address);
      return true;
    }

    // Sinon, essayer avec le provider
    if (result.provider) {
      return await connectWithProvider(result.provider, 'Abstract');
    }

    throw new Error('No wallet data received from Abstract Portal');

  } catch (err) {
    error('Abstract connection error:', err);
    showError(err.message || 'Failed to connect Abstract Global Wallet');
    showLoading(false);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// 🎭 GESTION DE L'OVERLAY
// ═══════════════════════════════════════════════════════════════

function showOverlay(message) {
  hideOverlay(); // Remove existing

  const div = document.createElement('div');
  div.innerHTML = OVERLAY_HTML;
  document.body.appendChild(div.firstElementChild);

  if (message) {
    const msgEl = document.getElementById('aw-gate-message');
    if (msgEl) msgEl.textContent = message;
  }

  // Bind buttons
  document.getElementById('aw-connect-metamask')?.addEventListener('click', connectMetaMaskExtension);
  document.getElementById('aw-connect-metamask-qr')?.addEventListener('click', connectMetaMaskMobile);
  document.getElementById('aw-connect-abstract')?.addEventListener('click', connectAbstract);

  // Render EIP-6963 wallets
  renderEIP6963Wallets();

  log('Overlay shown');
}

function hideOverlay() {
  const overlay = document.getElementById('aw-gate-overlay');
  if (overlay) {
    overlay.remove();
    log('Overlay hidden');
  }
}

// Watchdog pour garder l'overlay visible si pas connecté
let watchdogInterval = null;

function startOverlayWatchdog() {
  if (watchdogInterval) return;
  watchdogInterval = setInterval(() => {
    if (!state.connected && !document.getElementById('aw-gate-overlay')) {
      log('Watchdog: restoring overlay');
      showOverlay();
    }
  }, 1000);
}

function stopOverlayWatchdog() {
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }
}

// ═══════════════════════════════════════════════════════════════
// 🔄 RECONNEXION AUTOMATIQUE
// ═══════════════════════════════════════════════════════════════

async function tryAutoReconnect() {
  const { address: savedAddress, walletType } = loadWalletData();
  if (!savedAddress) {
    log('No saved wallet address');
    return false;
  }

  log('Attempting auto-reconnect for:', savedAddress, 'type:', walletType);

  try {
    // Attendre que EIP-6963 détecte les wallets
    await new Promise(resolve => setTimeout(resolve, 800));

    // Essayer MetaMask via EIP-6963
    if (metamaskProviderEIP6963) {
      try {
        const accounts = await metamaskProviderEIP6963.request({ method: 'eth_accounts' });
        if (accounts?.[0]?.toLowerCase() === savedAddress.toLowerCase()) {
          state.provider = metamaskProviderEIP6963;
          
          const switched = await checkChainId(state.provider);
          if (!switched) return false;

          let balance = getCachedBalance(savedAddress);
          if (balance === null) {
            balance = await checkNFTBalance(savedAddress, state.provider);
            setCachedBalance(savedAddress, balance);
          }

          if (balance >= CONFIG.MIN_NFT_TO_PLAY) {
            updateAccessState(savedAddress, balance, 'metamask');
            log('Auto-reconnected with MetaMask (EIP-6963)');
            return true;
          }
        }
      } catch (err) {
        log('MetaMask EIP-6963 auto-reconnect failed:', err);
      }
    }

    // Essayer le fallback MetaMask
    const mmFallback = getMetaMaskProviderFallback();
    if (mmFallback) {
      try {
        const accounts = await mmFallback.request({ method: 'eth_accounts' });
        if (accounts?.[0]?.toLowerCase() === savedAddress.toLowerCase()) {
          state.provider = mmFallback;
          
          const switched = await checkChainId(state.provider);
          if (!switched) return false;

          let balance = getCachedBalance(savedAddress);
          if (balance === null) {
            balance = await checkNFTBalance(savedAddress, state.provider);
            setCachedBalance(savedAddress, balance);
          }

          if (balance >= CONFIG.MIN_NFT_TO_PLAY) {
            updateAccessState(savedAddress, balance, 'metamask');
            log('Auto-reconnected with MetaMask (fallback)');
            return true;
          }
        }
      } catch (err) {
        log('MetaMask fallback auto-reconnect failed:', err);
      }
    }

    // Essayer d'autres wallets EIP-6963
    for (const [rdns, { provider }] of eip6963Wallets) {
      try {
        const accounts = await provider.request({ method: 'eth_accounts' });
        if (accounts?.[0]?.toLowerCase() === savedAddress.toLowerCase()) {
          state.provider = provider;
          
          const switched = await checkChainId(state.provider);
          if (!switched) continue;

          let balance = getCachedBalance(savedAddress);
          if (balance === null) {
            balance = await checkNFTBalance(savedAddress, state.provider);
            setCachedBalance(savedAddress, balance);
          }

          if (balance >= CONFIG.MIN_NFT_TO_PLAY) {
            updateAccessState(savedAddress, balance, rdns);
            log(`Auto-reconnected with ${rdns}`);
            return true;
          }
        }
      } catch (err) {
        log(`${rdns} auto-reconnect failed:`, err);
      }
    }

  } catch (err) {
    error('Auto-reconnect error:', err);
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════
// 🚀 INITIALISATION
// ═══════════════════════════════════════════════════════════════

async function init() {
  if (state.initialized) {
    log('Already initialized');
    return;
  }

  log('Initializing Angry Whales Gate v2.0...');

  // Setup EIP-6963 detection FIRST
  setupEIP6963Detection();

  // Attendre un peu pour la détection des wallets
  await new Promise(resolve => setTimeout(resolve, 600));

  // Try auto-reconnect
  const reconnected = await tryAutoReconnect();

  if (!reconnected) {
    showOverlay();
    startOverlayWatchdog();
  }

  state.initialized = true;
  log('Initialization complete');
}

// ═══════════════════════════════════════════════════════════════
// 🌍 API PUBLIQUE
// ═══════════════════════════════════════════════════════════════

window.AW_GATE = {
  show: (message) => {
    showOverlay(message);
    startOverlayWatchdog();
  },
  
  hide: () => {
    hideOverlay();
    stopOverlayWatchdog();
  },
  
  check: () => state.connected && state.canPlay,
  
  disconnect: () => {
    clearWalletData();
    clearAccessState();
    showOverlay();
    startOverlayWatchdog();
    log('Disconnected');
  },

  getState: () => ({
    connected: state.connected,
    address: state.address,
    balance: state.balance,
    canPlay: state.canPlay,
    bonusEligible: state.bonusEligible,
    walletType: state.walletType,
  }),
  
  // Debug helpers
  debug: {
    eip6963Wallets: () => Array.from(eip6963Wallets.entries()),
    metamaskEIP6963: () => metamaskProviderEIP6963,
    state: () => state,
  },
};

window.AW_ACCESS = {
  address: null,
  balance: 0,
  canPlay: false,
  bonusEligible: false,
};

// ═══════════════════════════════════════════════════════════════
// 🎬 DÉMARRAGE
// ═══════════════════════════════════════════════════════════════

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

log('Wallet gate module v2.0 loaded');