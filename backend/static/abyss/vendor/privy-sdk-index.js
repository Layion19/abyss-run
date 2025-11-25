var $bwzhE$privyiopublicapi = require("@privy-io/public-api");
var $bwzhE$eventemitter3 = require("eventemitter3");
var $bwzhE$ethersprojectabstractsigner = require("@ethersproject/abstract-signer");
var $bwzhE$ethersprojectbignumber = require("@ethersproject/bignumber");
var $bwzhE$ethersprojectproviders = require("@ethersproject/providers");
var $bwzhE$ethersprojectunits = require("@ethersproject/units");
var $bwzhE$fetchretry = require("fetch-retry");
var $bwzhE$uuid = require("uuid");
var $bwzhE$privyioapibase = require("@privy-io/api-base");
var $bwzhE$jscookie = require("js-cookie");
var $bwzhE$jose = require("jose");
var $bwzhE$setcookieparser = require("set-cookie-parser");


function $parcel$defineInteropFlag(a) {
  Object.defineProperty(a, '__esModule', {value: true, configurable: true});
}

function $parcel$exportWildcard(dest, source) {
  Object.keys(source).forEach(function(key) {
    if (key === 'default' || key === '__esModule' || Object.prototype.hasOwnProperty.call(dest, key)) {
      return;
    }

    Object.defineProperty(dest, key, {
      enumerable: true,
      get: function get() {
        return source[key];
      }
    });
  });

  return dest;
}

function $parcel$export(e, n, v, s) {
  Object.defineProperty(e, n, {get: v, set: s, enumerable: true, configurable: true});
}

function $parcel$interopDefault(a) {
  return a && a.__esModule ? a.default : a;
}

$parcel$defineInteropFlag(module.exports);

$parcel$export(module.exports, "default", function () { return $af690e564931f5d7$export$2e2bcd8739ae039; });
$parcel$export(module.exports, "LocalStorage", function () { return $0272941682c7469a$export$19fffca37ef3e106; });
$parcel$export(module.exports, "InMemoryCache", function () { return $bd1b2bb0e0f7eac2$export$467265324939f47f; });
$parcel$export(module.exports, "PrivyApiError", function () { return $c3e99570b7f4dc3f$export$55a617531281a33a; });
$parcel$export(module.exports, "PrivyClientError", function () { return $c3e99570b7f4dc3f$export$dfe83f5386c4bd02; });
$parcel$export(module.exports, "PrivyEmbeddedWalletErrorCode", function () { return $78157d361a638447$export$4c2ccc1f429bf31; });
$parcel$export(module.exports, "errorIndicatesRecoveryIsNeeded", function () { return $78157d361a638447$export$8e5517a02da6043; });
$parcel$export(module.exports, "getUserEmbeddedWallet", function () { return $e9d6bfa9ea62d5d1$export$8483e4c9b261aeda; });
$parcel$export(module.exports, "populateTransactionRequest", function () { return $e83859313c481527$export$88448d96dde6cfee; });


class $1f739692461effaf$export$2e2bcd8739ae039 {
    /**
   * @internal
   */ constructor(privyInternal){
        this._privyInternal = privyInternal;
    }
    /**
   * Logs a user in via a custom JWT from another (non-Privy) service
   *
   * @param token The JWT from the non-Privy service
   */ async syncWithToken(token) {
        const res = await this._privyInternal.fetch((0, $bwzhE$privyiopublicapi.authenticateCustomJwtAccount), {
            body: {
                token: token
            }
        });
        this._privyInternal.session.storeToken(res.token);
        this._privyInternal.session.storeRefreshToken(res.refresh_token);
        this._privyInternal.callbacks?.setUser?.(res.user);
        return res;
    }
}



class $1f21db1ab6fece0e$export$2e2bcd8739ae039 {
    /**
   * @internal
   */ constructor(privyInternal){
        this._privyInternal = privyInternal;
    }
    /**
   * Sends a one time login code to a user's email address
   *
   * @param email The email address to send the one time login code
   * @param token A CAPTCHA token
   */ async sendCode(email, token) {
        return this._privyInternal.fetch((0, $bwzhE$privyiopublicapi.passwordlessInit), {
            body: {
                email: email,
                token: token
            }
        });
    }
    /**
   * Logs a user in via an email address and one time code
   *
   * @param email The email address that the one time code was sent to
   * @param code The one time code
   */ async loginWithCode(email, code) {
        const res = await this._privyInternal.fetch((0, $bwzhE$privyiopublicapi.passwordlessAuthenticate), {
            body: {
                email: email,
                code: code
            }
        });
        await Promise.all([
            this._privyInternal.session.storeToken(res.token),
            this._privyInternal.session.storeRefreshToken(res.refresh_token)
        ]);
        this._privyInternal.callbacks?.setUser?.(res.user);
        return res;
    }
    /**
   * Links an email adress to an existing user
   *
   * @param email The email address that the one time code was sent to
   * @param code The one time code
   */ async linkWithCode(email, code) {
        const res = await this._privyInternal.fetch((0, $bwzhE$privyiopublicapi.passwordlessLink), {
            body: {
                email: email,
                code: code
            }
        });
        this._privyInternal.callbacks?.setUser?.(res);
        return res;
    }
    async unlink(email) {
        const res = await this._privyInternal.fetch((0, $bwzhE$privyiopublicapi.passwordlessUnlink), {
            body: {
                address: email
            }
        });
        this._privyInternal.callbacks?.setUser?.(res);
        return res;
    }
}



class $beeb9c2819ecb256$export$2e2bcd8739ae039 {
    /**
   * @internal
   */ constructor(privyInternal){
        this._privyInternal = privyInternal;
    }
    /**
   * Starts an OAuth flow with a specific provider
   * Sends a one time login code to a user's email address
   *
   * @param provider The OAuth provider
   * @param redirectURI The URL to redirect to after a successful OAuth flow
   */ async generateURL(provider, redirectURI) {
        // TODO(PKCE): implement PKCE similar to Recovery
        return this._privyInternal.fetch((0, $bwzhE$privyiopublicapi.initOAuth), {
            body: {
                redirect_to: redirectURI,
                provider: provider
            }
        });
    }
    /**
   * Logs a user in via successfull OAuth flow codes
   *
   * @param authorizationCode The code generated by the authorization server
   * @param stateCode The state value initially set in the request by Privy to the authorization server
   */ async loginWithCode(authorizationCode, stateCode) {
        // TODO(PKCE): implement PKCE similar to Recovery
        const res = await this._privyInternal.fetch((0, $bwzhE$privyiopublicapi.authenticateOauthAccount), {
            body: {
                authorization_code: authorizationCode,
                state_code: stateCode
            }
        });
        this._privyInternal.session.storeToken(res.token);
        this._privyInternal.session.storeRefreshToken(res.refresh_token);
        this._privyInternal.callbacks?.setUser?.(res.user);
        return res;
    }
    /**
   * Links an OAuth account to an existing user
   *
   * @param authorizationCode The code generated by the authorization server
   * @param stateCode The state value initially set in the request by Privy to the authorization server
   */ async linkWithCode(authorizationCode, stateCode) {
        // TODO(PKCE): implement PKCE similar to Recovery
        const res = await this._privyInternal.fetch((0, $bwzhE$privyiopublicapi.linkOAuthAccount), {
            body: {
                authorization_code: authorizationCode,
                state_code: stateCode
            }
        });
        this._privyInternal.callbacks?.setUser?.(res);
        return res;
    }
    /**
   * Un-links an OAuth account from an existing user
   *
   * @param provider The OAuth provider
   * @param subject The subject of the OAuth account, usually an email or username
   */ async unlink(provider, subject) {
        const res = await this._privyInternal.fetch((0, $bwzhE$privyiopublicapi.unlinkOAuthAccount), {
            body: {
                provider: provider,
                subject: subject
            }
        });
        this._privyInternal.callbacks?.setUser?.(res);
        return res;
    }
}



class $666f81df71e5be3a$export$2e2bcd8739ae039 {
    /**
   * @internal
   */ constructor(privyInternal){
        this._privyInternal = privyInternal;
    }
    /**
   * Begin a link flow with a passkey.
   */ async generateRegistrationOptions(relyingParty) {
        const res = await this._privyInternal.fetch((0, $bwzhE$privyiopublicapi.passkeyInitLink), {
            body: {
                relying_party: relyingParty
            }
        });
        return res;
    }
    /**
   * Begin a login flow with a passkey.
   */ async generateAuthenticationOptions(relyingParty) {
        const res = await this._privyInternal.fetch((0, $bwzhE$privyiopublicapi.passkeyInitAuthenticate), {
            body: {
                relying_party: relyingParty
            }
        });
        return res;
    }
    /**
   * Log a user in via a passkey.
   *
   * Does _NOT_ create a new passkey account for the current user.
   */ async loginWithPasskey(input, challenge, relyingParty) {
        const res = await this._privyInternal.fetch((0, $bwzhE$privyiopublicapi.passkeyAuthenticate), {
            body: {
                relying_party: relyingParty,
                challenge: challenge,
                authenticator_response: {
                    type: input.type,
                    id: input.id,
                    raw_id: input.rawId,
                    response: {
                        signature: input.response.signature,
                        client_data_json: input.response.clientDataJSON,
                        authenticator_data: input.response.authenticatorData,
                        user_handle: input.response.userHandle || undefined
                    },
                    authenticator_attachment: input.authenticatorAttachment || undefined,
                    client_extension_results: {
                        app_id: input.clientExtensionResults.appid || undefined,
                        cred_props: input.clientExtensionResults.credProps || undefined,
                        hmac_create_secret: input.clientExtensionResults.hmacCreateSecret || undefined
                    }
                }
            }
        });
        await Promise.all([
            this._privyInternal.session.storeToken(res.token),
            this._privyInternal.session.storeRefreshToken(res.refresh_token)
        ]);
        this._privyInternal.callbacks?.setUser?.(res.user);
        return res;
    }
    /**
   * Links a passkey to an existing user.
   *
   * Creates a new passkey account for the current user.
   */ async linkWithPasskey(input, relyingParty) {
        const res = await this._privyInternal.fetch((0, $bwzhE$privyiopublicapi.passkeyLink), {
            body: {
                relying_party: relyingParty,
                authenticator_response: {
                    type: input.type,
                    id: input.id,
                    raw_id: input.rawId,
                    response: {
                        client_data_json: input.response.clientDataJSON,
                        attestation_object: input.response.attestationObject,
                        authenticator_data: input.response.authenticatorData || undefined,
                        transports: input.response.transports || undefined,
                        public_key: input.response.publicKey || undefined,
                        public_key_algorithm: input.response.publicKeyAlgorithm || undefined
                    },
                    authenticator_attachment: input.authenticatorAttachment || undefined,
                    client_extension_results: {
                        app_id: input.clientExtensionResults.appid || undefined,
                        cred_props: input.clientExtensionResults.credProps || undefined,
                        hmac_create_secret: input.clientExtensionResults.hmacCreateSecret || undefined
                    }
                }
            }
        });
        this._privyInternal.callbacks?.setUser?.(res);
        return res;
    }
}



class $488e97f499cf9159$export$2e2bcd8739ae039 {
    /**
   * @internal
   */ constructor(privyInternal){
        this._privyInternal = privyInternal;
    }
    /**
   * Sends a one time login code to a user's phone number via sms
   *
   * @param phoneNumber The phone number to send the one time login code
   * @param token A CAPTCHA token
   */ async sendCode(phoneNumber, token) {
        return this._privyInternal.fetch((0, $bwzhE$privyiopublicapi.passwordlessSmsInit), {
            body: {
                phoneNumber: phoneNumber,
                token: token
            }
        });
    }
    /**
   * Logs a user in via a phone number and one time code
   *
   * @param phoneNumber The phone number that the one time code was sent to
   * @param code The one time code
   */ async loginWithCode(phoneNumber, code) {
        const res = await this._privyInternal.fetch((0, $bwzhE$privyiopublicapi.passwordlessSmsAuthenticate), {
            body: {
                phoneNumber: phoneNumber,
                code: code
            }
        });
        this._privyInternal.session.storeToken(res.token);
        this._privyInternal.session.storeRefreshToken(res.refresh_token);
        this._privyInternal.callbacks?.setUser?.(res.user);
        return res;
    }
    /**
   * Links a phone number to an existing user
   *
   * @param phoneNumber The phone number that the one time code was sent to
   * @param code The one time code
   */ async linkWithCode(phoneNumber, code) {
        const res = await this._privyInternal.fetch((0, $bwzhE$privyiopublicapi.passwordlessSmsLink), {
            body: {
                phoneNumber: phoneNumber,
                code: code
            }
        });
        this._privyInternal.callbacks?.setUser?.(res);
        return res;
    }
    async unlink(phoneNumber) {
        const res = await this._privyInternal.fetch((0, $bwzhE$privyiopublicapi.passwordlessSmsUnlink), {
            body: {
                phoneNumber: phoneNumber
            }
        });
        this._privyInternal.callbacks?.setUser?.(res);
        return res;
    }
}



class $1b7e1f4d312093ce$export$2e2bcd8739ae039 {
    /** @internal */ constructor(privyInternal){
        /**
   * @internal
   *
   * Wallet is cached after generating a message, so that a wallet doesn't need to be provided in login/link methods
   * > _Note: a `walletOverride` still **can** be provided in those methods if for some reason this is beneficial to the developer_
   */ this._wallet = undefined;
        this._privyInternal = privyInternal;
    }
    /**
   * Link a new wallet via the [Sign-In With Ethereum](https://eips.ethereum.org/EIPS/eip-4361) spec.
   *
   * @returns The user object.
   */ async linkWithSiwe(/**
     * Signature generated against standard [Sign-In With Ethereum](https://eips.ethereum.org/EIPS/eip-4361) message
     */ signature, /**
     * Optional `ExternalWallet`, only needed if the wallet differs from the one cached during previous call to `generateMessage`
     */ walletOverride, /**
     * Optional [Sign-In With Ethereum](https://eips.ethereum.org/EIPS/eip-4361) message, only needed if the message differs from the one in memory that was cached in previous call to `generateMessage`
     */ messageOverride) {
        const wallet = walletOverride || this._wallet;
        const message = messageOverride || this._preparedMessage;
        if (!wallet) throw new Error("A wallet must be provided in the init step or as an argument to linkWithSiwe");
        if (!message) throw new Error("A message must be generated and signed before being used to link a wallet to privy");
        try {
            const res = await this._privyInternal.fetch((0, $bwzhE$privyiopublicapi.linkSiwe), {
                body: {
                    message: message,
                    signature: signature,
                    chainId: wallet.chainId,
                    walletClientType: wallet.walletClientType,
                    connectorType: wallet.connectorType
                }
            });
            this._privyInternal.callbacks?.setUser?.(res);
            return res;
        } catch (error) {
            throw error;
        }
    }
    /**
   * Authenticate with Privy via the [Sign-In With Ethereum](https://eips.ethereum.org/EIPS/eip-4361) spec.
   *
   * @returns Session information.
   */ async loginWithSiwe(/**
     * Signature generated against standard [Sign-In With Ethereum](https://eips.ethereum.org/EIPS/eip-4361) message
     */ signature, /**
     * Optional `ExternalWallet`, only needed if the wallet differs from the one cached during previous call to `generateMessage`
     */ walletOverride, /**
     * Optional [Sign-In With Ethereum](https://eips.ethereum.org/EIPS/eip-4361) message, only needed if the message differs from the one in memory that was cached in previous call to `generateMessage`
     */ messageOverride) {
        const wallet = walletOverride || this._wallet;
        const message = messageOverride || this._preparedMessage;
        if (!wallet) throw new Error("A wallet must be provided in the init step or as an argument to loginWithSiwe");
        if (!message) throw new Error("A message must be generated and signed before being used to login to privy with a wallet");
        try {
            const res = await this._privyInternal.fetch((0, $bwzhE$privyiopublicapi.authenticateSiwe), {
                body: {
                    signature: signature,
                    message: message,
                    chainId: Number(wallet.chainId).toString(16),
                    walletClientType: wallet.walletClientType,
                    connectorType: wallet.connectorType
                }
            });
            await Promise.all([
                this._privyInternal.session.storeToken(res.token),
                this._privyInternal.session.storeRefreshToken(res.refresh_token)
            ]);
            this._privyInternal.callbacks?.setUser?.(res.user);
            return {
                user: res.user,
                isNewUser: Boolean(res.is_new_user)
            };
        } catch (error) {
            throw error;
        }
    }
    /**
   * Begin a login or link flow according to the [Sign-In With Ethereum](https://eips.ethereum.org/EIPS/eip-4361) spec.
   *
   * @returns [EIP-4361](https://eips.ethereum.org/EIPS/eip-4361) message and nonce used to create it
   */ async init(/** Wallet to request a [Sign-In With Ethereum](https://eips.ethereum.org/EIPS/eip-4361) signature from */ wallet, /** [RFC 3986](https://datatracker.ietf.org/doc/html/rfc3986) authority that is requesting the signing */ domain, /** [RFC 3986](https://datatracker.ietf.org/doc/html/rfc3986) URI referring to the resource that is the subject of the signing */ uri) {
        this._wallet = wallet;
        const response = await this._privyInternal.fetch((0, $bwzhE$privyiopublicapi.initSiwe), {
            body: {
                address: wallet.address
            }
        });
        const { nonce: nonce } = response;
        const message = $1b7e1f4d312093ce$var$createSiweMessage({
            // Remove `CAIP-2` prefix for Ethereum chains
            chainId: wallet.chainId.toString().replace("eip155:", ""),
            address: wallet.address,
            issuedAt: new Date().toISOString(),
            statement: `By signing, you are proving you own this wallet and logging in. This does not initiate a transaction or cost any fees.`,
            domain: domain,
            nonce: nonce,
            uri: uri
        });
        this._preparedMessage = message;
        return {
            nonce: nonce,
            message: message
        };
    }
}
/**
 * @internal
 *
 * Create [EIP-4361](https://eips.ethereum.org/EIPS/eip-4361) message for signing.
 * @returns [EIP-4361](https://eips.ethereum.org/EIPS/eip-4361) message to sign
 */ function $1b7e1f4d312093ce$var$createSiweMessage(opts) {
    return `${opts.domain} wants you to sign in with your Ethereum account:
${opts.address}

${opts.statement}

URI: ${opts.uri}
Version: 1
Chain ID: ${opts.chainId}
Nonce: ${opts.nonce}
Issued At: ${opts.issuedAt}
Resources:
- https://privy.io`;
}


class $98111b9dfa4b03f7$export$2e2bcd8739ae039 {
    /** @internal */ constructor(privyInternal){
        this._privyInternal = privyInternal;
        this.phone = new (0, $488e97f499cf9159$export$2e2bcd8739ae039)(this._privyInternal);
        this.email = new (0, $1f21db1ab6fece0e$export$2e2bcd8739ae039)(this._privyInternal);
        this.oauth = new (0, $beeb9c2819ecb256$export$2e2bcd8739ae039)(this._privyInternal);
        this.siwe = new (0, $1b7e1f4d312093ce$export$2e2bcd8739ae039)(this._privyInternal);
        this.passkey = new (0, $666f81df71e5be3a$export$2e2bcd8739ae039)(this._privyInternal);
        this.customProvider = new (0, $1f739692461effaf$export$2e2bcd8739ae039)(this._privyInternal);
    }
    /**
   * Logs the current user out.
   */ async logout() {
        try {
            const refresh_token = await this._privyInternal.session.getRefreshToken() ?? undefined;
            await this._privyInternal.fetch((0, $bwzhE$privyiopublicapi.logout), {
                body: {
                    refresh_token: refresh_token
                }
            });
        } catch (e) {
            // Fail silently, as API error should not block logging the user out
            console.warn("Error destroying session");
        }
        // Destroy the local auth state
        await this._privyInternal.session.destroyLocalState({
            reason: "logout"
        });
        this._privyInternal.callbacks?.setUser?.(null);
    }
}


var $c4dbc45adbe7f814$exports = {};

$parcel$export($c4dbc45adbe7f814$exports, "chainDefs", function () { return $c4dbc45adbe7f814$export$2096d4cea8b814f3; });
$parcel$export($c4dbc45adbe7f814$exports, "DEFAULT_SUPPORTED_CHAINS", function () { return $c4dbc45adbe7f814$export$f92d15367ea6b4f7; });
$parcel$export($c4dbc45adbe7f814$exports, "DEFAULT_SUPPORTED_CHAIN_IDS", function () { return $c4dbc45adbe7f814$export$3486db705befb001; });
const $2cbcf8f77ded2980$export$625cf84d855940d4 = {
    id: 42161,
    name: "Arbitrum One",
    network: "arbitrum",
    nativeCurrency: {
        name: "Ether",
        symbol: "ETH",
        decimals: 18
    },
    rpcUrls: {
        alchemy: {
            http: [
                "https://arb-mainnet.g.alchemy.com/v2"
            ],
            webSocket: [
                "wss://arb-mainnet.g.alchemy.com/v2"
            ]
        },
        infura: {
            http: [
                "https://arbitrum-mainnet.infura.io/v3"
            ],
            webSocket: [
                "wss://arbitrum-mainnet.infura.io/ws/v3"
            ]
        },
        default: {
            http: [
                "https://arb1.arbitrum.io/rpc"
            ]
        },
        public: {
            http: [
                "https://arb1.arbitrum.io/rpc"
            ]
        }
    },
    blockExplorers: {
        etherscan: {
            name: "Arbiscan",
            url: "https://arbiscan.io"
        },
        default: {
            name: "Arbiscan",
            url: "https://arbiscan.io"
        }
    }
};


const $766d1441a6fe8323$export$857f1b5f596fb425 = {
    id: 421613,
    name: "Arbitrum Goerli",
    network: "arbitrum-goerli",
    nativeCurrency: {
        name: "Goerli Ether",
        symbol: "AGOR",
        decimals: 18
    },
    rpcUrls: {
        alchemy: {
            http: [
                "https://arb-goerli.g.alchemy.com/v2"
            ],
            webSocket: [
                "wss://arb-goerli.g.alchemy.com/v2"
            ]
        },
        infura: {
            http: [
                "https://arbitrum-goerli.infura.io/v3"
            ],
            webSocket: [
                "wss://arbitrum-goerli.infura.io/ws/v3"
            ]
        },
        default: {
            http: [
                "https://goerli-rollup.arbitrum.io/rpc"
            ]
        },
        public: {
            http: [
                "https://goerli-rollup.arbitrum.io/rpc"
            ]
        }
    },
    blockExplorers: {
        etherscan: {
            name: "Arbiscan",
            url: "https://goerli.arbiscan.io/"
        },
        default: {
            name: "Arbiscan",
            url: "https://goerli.arbiscan.io/"
        }
    },
    testnet: true
};


const $a1182a098f7425ef$export$21799e7ae6cc115 = {
    id: 421614,
    name: "Arbitrum Sepolia",
    network: "arbitrum-sepolia",
    nativeCurrency: {
        name: "Arbitrum Sepolia Ether",
        symbol: "ETH",
        decimals: 18
    },
    rpcUrls: {
        privy: {
            http: [
                "https://arbitrum-sepolia.rpc.privy.systems"
            ]
        },
        default: {
            http: [
                "https://sepolia-rollup.arbitrum.io/rpc"
            ]
        },
        public: {
            http: [
                "https://sepolia-rollup.arbitrum.io/rpc"
            ]
        }
    },
    blockExplorers: {
        default: {
            name: "Blockscout",
            url: "https://sepolia-explorer.arbitrum.io"
        }
    },
    testnet: true
};


const $e87e50afa870660d$export$ca1d15c01fde7266 = {
    id: 43114,
    name: "Avalanche",
    network: "avalanche",
    nativeCurrency: {
        decimals: 18,
        name: "Avalanche",
        symbol: "AVAX"
    },
    rpcUrls: {
        default: {
            http: [
                "https://api.avax.network/ext/bc/C/rpc"
            ]
        },
        public: {
            http: [
                "https://api.avax.network/ext/bc/C/rpc"
            ]
        }
    },
    blockExplorers: {
        etherscan: {
            name: "SnowTrace",
            url: "https://snowtrace.io"
        },
        default: {
            name: "SnowTrace",
            url: "https://snowtrace.io"
        }
    }
};


const $0fb5af1793d0d7b1$export$714c92acd9d3100a = {
    id: 43113,
    name: "Avalanche Fuji",
    network: "avalanche-fuji",
    nativeCurrency: {
        decimals: 18,
        name: "Avalanche Fuji",
        symbol: "AVAX"
    },
    rpcUrls: {
        default: {
            http: [
                "https://api.avax-test.network/ext/bc/C/rpc"
            ]
        },
        public: {
            http: [
                "https://api.avax-test.network/ext/bc/C/rpc"
            ]
        }
    },
    blockExplorers: {
        etherscan: {
            name: "SnowTrace",
            url: "https://testnet.snowtrace.io"
        },
        default: {
            name: "SnowTrace",
            url: "https://testnet.snowtrace.io"
        }
    },
    testnet: true
};


const $060f2147d602435c$export$e2253033e6e1df16 = {
    id: 8453,
    network: "base",
    name: "Base",
    nativeCurrency: {
        name: "Ether",
        symbol: "ETH",
        decimals: 18
    },
    rpcUrls: {
        blast: {
            http: [
                "https://base-mainnet.blastapi.io"
            ],
            webSocket: [
                "wss://base-mainnet.blastapi.io"
            ]
        },
        default: {
            http: [
                "https://mainnet.base.org"
            ]
        },
        public: {
            http: [
                "https://mainnet.base.org"
            ]
        }
    },
    blockExplorers: {
        etherscan: {
            name: "Basescan",
            url: "https://basescan.org"
        },
        default: {
            name: "Basescan",
            url: "https://basescan.org"
        }
    },
    testnet: true
};


const $bfe3f51ac963dde3$export$8ae5747389a6ab6b = {
    id: 84531,
    network: "base-goerli",
    name: "Base Goerli Testnet",
    nativeCurrency: {
        name: "Goerli Ether",
        symbol: "ETH",
        decimals: 18
    },
    rpcUrls: {
        blast: {
            http: [
                "https://base-goerli.blastapi.io"
            ],
            webSocket: [
                "wss://base-goerli.blastapi.io"
            ]
        },
        default: {
            http: [
                "https://goerli.base.org"
            ]
        },
        public: {
            http: [
                "https://goerli.base.org"
            ]
        }
    },
    blockExplorers: {
        etherscan: {
            name: "Basescan",
            url: "https://goerli.basescan.org"
        },
        default: {
            name: "Basescan",
            url: "https://goerli.basescan.org"
        }
    },
    testnet: true
};


const $e0a92682c0d6f5a7$export$e02aa76c029b1df5 = {
    id: 84532,
    network: "base-sepolia",
    name: "Base Sepolia",
    nativeCurrency: {
        name: "Sepolia Ether",
        symbol: "ETH",
        decimals: 18
    },
    rpcUrls: {
        privy: {
            http: [
                "https://base-sepolia.rpc.privy.systems"
            ]
        },
        default: {
            http: [
                "https://sepolia.base.org"
            ]
        },
        public: {
            http: [
                "https://sepolia.base.org"
            ]
        }
    },
    blockExplorers: {
        default: {
            name: "Blockscout",
            url: "https://base-sepolia.blockscout.com"
        }
    },
    testnet: true
};


const $98b0789cdb07b2ff$export$3c457235eec24c53 = {
    id: 80085,
    network: "berachain-artio",
    name: "Berachain Artio",
    nativeCurrency: {
        name: "BERA",
        symbol: "BERA",
        decimals: 18
    },
    rpcUrls: {
        default: {
            http: [
                "https://artio.rpc.berachain.com"
            ]
        },
        public: {
            http: [
                "https://artio.rpc.berachain.com"
            ]
        }
    },
    blockExplorers: {
        default: {
            name: "Beratrail",
            url: "https://artio.beratrail.io"
        }
    },
    testnet: true
};


const $3a346aa418e66782$export$671bdf559232d1e0 = {
    id: 42220,
    name: "Celo Mainnet",
    network: "celo",
    nativeCurrency: {
        decimals: 18,
        name: "CELO",
        symbol: "CELO"
    },
    rpcUrls: {
        default: {
            http: [
                "https://forno.celo.org"
            ]
        },
        infura: {
            http: [
                "https://celo-mainnet.infura.io/v3"
            ]
        },
        public: {
            http: [
                "https://forno.celo.org"
            ]
        }
    },
    blockExplorers: {
        default: {
            name: "Celo Explorer",
            url: "https://explorer.celo.org/mainnet"
        },
        etherscan: {
            name: "CeloScan",
            url: "https://celoscan.io"
        }
    },
    testnet: false
};


const $45a59ca9359026be$export$ea1d1a16df546697 = {
    id: 44787,
    name: "Celo Alfajores Testnet",
    network: "celo-alfajores",
    nativeCurrency: {
        decimals: 18,
        name: "CELO",
        symbol: "CELO"
    },
    rpcUrls: {
        default: {
            http: [
                "https://alfajores-forno.celo-testnet.org"
            ]
        },
        infura: {
            http: [
                "https://celo-alfajores.infura.io/v3"
            ]
        },
        public: {
            http: [
                "https://alfajores-forno.celo-testnet.org"
            ]
        }
    },
    blockExplorers: {
        default: {
            name: "Celo Explorer",
            url: "https://explorer.celo.org/alfajores"
        },
        etherscan: {
            name: "CeloScan",
            url: "https://alfajores.celoscan.io/"
        }
    },
    testnet: true
};


const $ffc6e47b863526a4$export$d5a6d2ad15089d83 = {
    id: 314,
    name: "Filecoin - Mainnet",
    network: "filecoin-mainnet",
    nativeCurrency: {
        decimals: 18,
        name: "filecoin",
        symbol: "FIL"
    },
    rpcUrls: {
        default: {
            http: [
                "https://api.node.glif.io/rpc/v1"
            ]
        },
        public: {
            http: [
                "https://api.node.glif.io/rpc/v1"
            ]
        }
    },
    blockExplorers: {
        default: {
            name: "Filfox",
            url: "https://filfox.info/en"
        },
        filscan: {
            name: "Filscan",
            url: "https://filscan.io"
        },
        filscout: {
            name: "Filscout",
            url: "https://filscout.io/en"
        },
        glif: {
            name: "Glif",
            url: "https://explorer.glif.io"
        }
    }
};


const $7210151d9502f10c$export$de9b05abdae7c2c = {
    id: 314159,
    name: "Filecoin - Calibration testnet",
    network: "filecoin-calibration",
    nativeCurrency: {
        decimals: 18,
        name: "testnet filecoin",
        symbol: "tFIL"
    },
    rpcUrls: {
        default: {
            http: [
                "https://api.calibration.node.glif.io/rpc/v1"
            ]
        },
        public: {
            http: [
                "https://api.calibration.node.glif.io/rpc/v1"
            ]
        }
    },
    blockExplorers: {
        default: {
            name: "Filscan",
            url: "https://calibration.filscan.io"
        }
    }
};


const $5ff31066814f3c17$export$50b37201a1017e1e = {
    id: 5,
    network: "goerli",
    name: "Goerli",
    nativeCurrency: {
        name: "Goerli Ether",
        symbol: "ETH",
        decimals: 18
    },
    rpcUrls: {
        privy: {
            http: [
                "https://goerli.rpc.privy.systems"
            ]
        },
        alchemy: {
            http: [
                "https://eth-goerli.g.alchemy.com/v2"
            ],
            webSocket: [
                "wss://eth-goerli.g.alchemy.com/v2"
            ]
        },
        infura: {
            http: [
                "https://goerli.infura.io/v3"
            ],
            webSocket: [
                "wss://goerli.infura.io/ws/v3"
            ]
        },
        default: {
            http: [
                "https://rpc.ankr.com/eth_goerli"
            ]
        },
        public: {
            http: [
                "https://rpc.ankr.com/eth_goerli"
            ]
        }
    },
    blockExplorers: {
        etherscan: {
            name: "Etherscan",
            url: "https://goerli.etherscan.io"
        },
        default: {
            name: "Etherscan",
            url: "https://goerli.etherscan.io"
        }
    },
    testnet: true
};


const $283523508bc31e33$export$55c20919802936dd = {
    id: 17000,
    name: "Holesky",
    network: "holesky",
    nativeCurrency: {
        name: "ETH",
        symbol: "ETH",
        decimals: 18
    },
    rpcUrls: {
        default: {
            http: [
                "https://ethereum-holesky.publicnode.com"
            ]
        },
        public: {
            http: [
                "https://ethereum-holesky.publicnode.com"
            ]
        }
    },
    blockExplorers: {
        etherscan: {
            name: "EtherScan",
            url: "https://holesky.etherscan.io"
        },
        default: {
            name: "EtherScan",
            url: "https://holesky.etherscan.io"
        }
    }
};


const $69d0dc3a7a522279$export$7d9a0b32b656284d = {
    id: 59144,
    network: "linea-mainnet",
    name: "Linea Mainnet",
    nativeCurrency: {
        name: "Linea Ether",
        symbol: "ETH",
        decimals: 18
    },
    rpcUrls: {
        infura: {
            http: [
                "https://linea-mainnet.infura.io/v3"
            ],
            webSocket: [
                "wss://linea-mainnet.infura.io/ws/v3"
            ]
        },
        default: {
            http: [
                "https://rpc.linea.build"
            ],
            webSocket: [
                "wss://rpc.linea.build"
            ]
        },
        public: {
            http: [
                "https://rpc.linea.build"
            ],
            webSocket: [
                "wss://rpc.linea.build"
            ]
        }
    },
    blockExplorers: {
        default: {
            name: "Etherscan",
            url: "https://lineascan.build"
        },
        etherscan: {
            name: "Etherscan",
            url: "https://lineascan.build"
        }
    },
    testnet: false
};


const $82142547387b7e5f$export$9b359a3964075c2b = {
    id: 59140,
    network: "linea-testnet",
    name: "Linea Goerli Testnet",
    nativeCurrency: {
        name: "Linea Ether",
        symbol: "ETH",
        decimals: 18
    },
    rpcUrls: {
        infura: {
            http: [
                "https://linea-goerli.infura.io/v3"
            ],
            webSocket: [
                "wss://linea-goerli.infura.io/ws/v3"
            ]
        },
        default: {
            http: [
                "https://rpc.goerli.linea.build"
            ],
            webSocket: [
                "wss://rpc.goerli.linea.build"
            ]
        },
        public: {
            http: [
                "https://rpc.goerli.linea.build"
            ],
            webSocket: [
                "wss://rpc.goerli.linea.build"
            ]
        }
    },
    blockExplorers: {
        default: {
            name: "Etherscan",
            url: "https://goerli.lineascan.build"
        },
        etherscan: {
            name: "Etherscan",
            url: "https://goerli.lineascan.build"
        }
    },
    testnet: true
};


const $d0d9ebc43faa74f6$export$536d3e0d2c7baf54 = {
    id: 1,
    network: "homestead",
    name: "Ethereum",
    nativeCurrency: {
        name: "Ether",
        symbol: "ETH",
        decimals: 18
    },
    rpcUrls: {
        alchemy: {
            http: [
                "https://eth-mainnet.g.alchemy.com/v2"
            ],
            webSocket: [
                "wss://eth-mainnet.g.alchemy.com/v2"
            ]
        },
        infura: {
            http: [
                "https://mainnet.infura.io/v3"
            ],
            webSocket: [
                "wss://mainnet.infura.io/ws/v3"
            ]
        },
        default: {
            http: [
                "https://cloudflare-eth.com"
            ]
        },
        public: {
            http: [
                "https://cloudflare-eth.com"
            ]
        }
    },
    blockExplorers: {
        etherscan: {
            name: "Etherscan",
            url: "https://etherscan.io"
        },
        default: {
            name: "Etherscan",
            url: "https://etherscan.io"
        }
    }
};


const $8e165bf5e9d99a0d$export$e584d4a579189f9b = {
    id: 10,
    name: "OP Mainnet",
    network: "optimism",
    nativeCurrency: {
        name: "Ether",
        symbol: "ETH",
        decimals: 18
    },
    rpcUrls: {
        alchemy: {
            http: [
                "https://opt-mainnet.g.alchemy.com/v2"
            ],
            webSocket: [
                "wss://opt-mainnet.g.alchemy.com/v2"
            ]
        },
        infura: {
            http: [
                "https://optimism-mainnet.infura.io/v3"
            ],
            webSocket: [
                "wss://optimism-mainnet.infura.io/ws/v3"
            ]
        },
        default: {
            http: [
                "https://mainnet.optimism.io"
            ]
        },
        public: {
            http: [
                "https://mainnet.optimism.io"
            ]
        }
    },
    blockExplorers: {
        etherscan: {
            name: "Etherscan",
            url: "https://optimistic.etherscan.io"
        },
        default: {
            name: "Optimism Explorer",
            url: "https://explorer.optimism.io"
        }
    }
};


const $31337d4b0853106e$export$50b3e5cabd7d7a60 = {
    id: 420,
    name: "Optimism Goerli Testnet",
    network: "optimism-goerli",
    nativeCurrency: {
        name: "Goerli Ether",
        symbol: "ETH",
        decimals: 18
    },
    rpcUrls: {
        alchemy: {
            http: [
                "https://opt-goerli.g.alchemy.com/v2"
            ],
            webSocket: [
                "wss://opt-goerli.g.alchemy.com/v2"
            ]
        },
        infura: {
            http: [
                "https://optimism-goerli.infura.io/v3"
            ],
            webSocket: [
                "wss://optimism-goerli.infura.io/ws/v3"
            ]
        },
        default: {
            http: [
                "https://goerli.optimism.io"
            ]
        },
        public: {
            http: [
                "https://goerli.optimism.io"
            ]
        }
    },
    blockExplorers: {
        etherscan: {
            name: "Etherscan",
            url: "https://goerli-optimism.etherscan.io"
        },
        default: {
            name: "Etherscan",
            url: "https://goerli-optimism.etherscan.io"
        }
    },
    testnet: true
};


const $343d99fc8e37a972$export$af869f83341a963d = {
    id: 11155420,
    name: "Optimism Sepolia",
    network: "optimism-sepolia",
    nativeCurrency: {
        name: "Sepolia Ether",
        symbol: "ETH",
        decimals: 18
    },
    rpcUrls: {
        privy: {
            http: [
                "https://optimism-sepolia.rpc.privy.systems"
            ]
        },
        default: {
            http: [
                "https://sepolia.optimism.io"
            ]
        },
        public: {
            http: [
                "https://sepolia.optimism.io"
            ]
        },
        infura: {
            http: [
                "https://optimism-sepolia.infura.io/v3"
            ]
        }
    },
    blockExplorers: {
        default: {
            name: "Blockscout",
            url: "https://optimism-sepolia.blockscout.com"
        }
    },
    testnet: true
};


const $fade430349f6bbba$export$b7b19aa0ee06c73 = {
    id: 137,
    name: "Polygon Mainnet",
    network: "matic",
    nativeCurrency: {
        name: "MATIC",
        symbol: "MATIC",
        decimals: 18
    },
    rpcUrls: {
        alchemy: {
            http: [
                "https://polygon-mainnet.g.alchemy.com/v2"
            ],
            webSocket: [
                "wss://polygon-mainnet.g.alchemy.com/v2"
            ]
        },
        infura: {
            http: [
                "https://polygon-mainnet.infura.io/v3"
            ],
            webSocket: [
                "wss://polygon-mainnet.infura.io/ws/v3"
            ]
        },
        default: {
            http: [
                "https://polygon-rpc.com"
            ]
        },
        public: {
            http: [
                "https://polygon-rpc.com"
            ]
        }
    },
    blockExplorers: {
        etherscan: {
            name: "PolygonScan",
            url: "https://polygonscan.com"
        },
        default: {
            name: "PolygonScan",
            url: "https://polygonscan.com"
        }
    }
};


const $75564322c4498b92$export$34b6ef3a78067459 = {
    id: 80001,
    name: "Mumbai",
    network: "maticmum",
    nativeCurrency: {
        name: "MATIC",
        symbol: "MATIC",
        decimals: 18
    },
    rpcUrls: {
        privy: {
            http: [
                "https://polygon-mumbai.rpc.privy.systems"
            ]
        },
        alchemy: {
            http: [
                "https://polygon-mumbai.g.alchemy.com/v2"
            ],
            webSocket: [
                "wss://polygon-mumbai.g.alchemy.com/v2"
            ]
        },
        infura: {
            http: [
                "https://polygon-mumbai.infura.io/v3"
            ],
            webSocket: [
                "wss://polygon-mumbai.infura.io/ws/v3"
            ]
        },
        default: {
            http: [
                "https://matic-mumbai.chainstacklabs.com"
            ]
        },
        public: {
            http: [
                "https://matic-mumbai.chainstacklabs.com"
            ]
        }
    },
    blockExplorers: {
        etherscan: {
            name: "PolygonScan",
            url: "https://mumbai.polygonscan.com"
        },
        default: {
            name: "PolygonScan",
            url: "https://mumbai.polygonscan.com"
        }
    },
    testnet: true
};


const $ccdf7ff0bc688c87$export$1939d6ce88bc478 = {
    id: 17001,
    name: "Redstone Holesky",
    network: "redstone-holesky",
    nativeCurrency: {
        name: "ETH",
        symbol: "ETH",
        decimals: 18
    },
    rpcUrls: {
        default: {
            http: [
                "https://rpc.holesky.redstone.xyz"
            ]
        },
        public: {
            http: [
                "https://rpc.holesky.redstone.xyz"
            ]
        }
    },
    blockExplorers: {
        etherscan: {
            name: "EtherScan",
            url: "https://explorer.holesky.redstone.xyz"
        },
        default: {
            name: "EtherScan",
            url: "https://explorer.holesky.redstone.xyz"
        }
    }
};


const $0bf4b4fa7f105340$export$31254237fd28c61a = {
    id: 11155111,
    network: "sepolia",
    name: "Sepolia",
    nativeCurrency: {
        name: "Sepolia Ether",
        symbol: "SEP",
        decimals: 18
    },
    rpcUrls: {
        privy: {
            http: [
                "https://sepolia.rpc.privy.systems"
            ]
        },
        alchemy: {
            http: [
                "https://eth-sepolia.g.alchemy.com/v2"
            ],
            webSocket: [
                "wss://eth-sepolia.g.alchemy.com/v2"
            ]
        },
        infura: {
            http: [
                "https://sepolia.infura.io/v3"
            ],
            webSocket: [
                "wss://sepolia.infura.io/ws/v3"
            ]
        },
        default: {
            http: [
                "https://rpc.sepolia.org"
            ]
        },
        public: {
            http: [
                "https://rpc.sepolia.org"
            ]
        }
    },
    blockExplorers: {
        etherscan: {
            name: "Etherscan",
            url: "https://sepolia.etherscan.io"
        },
        default: {
            name: "Etherscan",
            url: "https://sepolia.etherscan.io"
        }
    },
    testnet: true
};


const $6fdd837c6bca8025$export$29294a3e855ae137 = {
    id: 7777777,
    name: "Zora",
    network: "zora",
    nativeCurrency: {
        decimals: 18,
        name: "Ether",
        symbol: "ETH"
    },
    rpcUrls: {
        default: {
            http: [
                "https://rpc.zora.energy"
            ],
            webSocket: [
                "wss://rpc.zora.energy"
            ]
        },
        public: {
            http: [
                "https://rpc.zora.energy"
            ],
            webSocket: [
                "wss://rpc.zora.energy"
            ]
        }
    },
    blockExplorers: {
        default: {
            name: "Explorer",
            url: "https://explorer.zora.energy"
        }
    }
};


const $a8b98a832800e74f$export$d8a9d70d598eef4f = {
    id: 999999999,
    name: "Zora Sepolia",
    network: "zora-sepolia",
    nativeCurrency: {
        decimals: 18,
        name: "Zora Sepolia",
        symbol: "ETH"
    },
    rpcUrls: {
        default: {
            http: [
                "https://sepolia.rpc.zora.energy"
            ],
            webSocket: [
                "wss://sepolia.rpc.zora.energy"
            ]
        },
        public: {
            http: [
                "https://sepolia.rpc.zora.energy"
            ],
            webSocket: [
                "wss://sepolia.rpc.zora.energy"
            ]
        }
    },
    blockExplorers: {
        default: {
            name: "Zora Sepolia Explorer",
            url: "https://sepolia.explorer.zora.energy/"
        }
    },
    testnet: true
};


const $ec9efbf7de155634$export$3755fcd3ba6f95fe = {
    id: 999,
    name: "Zora Goerli Testnet",
    network: "zora-testnet",
    nativeCurrency: {
        decimals: 18,
        name: "Zora Goerli",
        symbol: "ETH"
    },
    rpcUrls: {
        default: {
            http: [
                "https://testnet.rpc.zora.energy"
            ],
            webSocket: [
                "wss://testnet.rpc.zora.energy"
            ]
        },
        public: {
            http: [
                "https://testnet.rpc.zora.energy"
            ],
            webSocket: [
                "wss://testnet.rpc.zora.energy"
            ]
        }
    },
    blockExplorers: {
        default: {
            name: "Explorer",
            url: "https://testnet.explorer.zora.energy"
        }
    },
    testnet: true
};


const $c4dbc45adbe7f814$export$2096d4cea8b814f3 = {
    mainnet: $d0d9ebc43faa74f6$export$536d3e0d2c7baf54,
    goerli: $5ff31066814f3c17$export$50b37201a1017e1e,
    sepolia: $0bf4b4fa7f105340$export$31254237fd28c61a,
    arbitrum: $2cbcf8f77ded2980$export$625cf84d855940d4,
    arbitrumGoerli: $766d1441a6fe8323$export$857f1b5f596fb425,
    arbitrumSepolia: $a1182a098f7425ef$export$21799e7ae6cc115,
    optimism: $8e165bf5e9d99a0d$export$e584d4a579189f9b,
    optimismGoerli: $31337d4b0853106e$export$50b3e5cabd7d7a60,
    optimismSepolia: $343d99fc8e37a972$export$af869f83341a963d,
    polygon: $fade430349f6bbba$export$b7b19aa0ee06c73,
    polygonMumbai: $75564322c4498b92$export$34b6ef3a78067459,
    celo: $3a346aa418e66782$export$671bdf559232d1e0,
    celoAlfajores: $45a59ca9359026be$export$ea1d1a16df546697,
    filecoin: $ffc6e47b863526a4$export$d5a6d2ad15089d83,
    filecoinCalibration: $7210151d9502f10c$export$de9b05abdae7c2c,
    base: $060f2147d602435c$export$e2253033e6e1df16,
    baseGoerli: $bfe3f51ac963dde3$export$8ae5747389a6ab6b,
    baseSepolia: $e0a92682c0d6f5a7$export$e02aa76c029b1df5,
    linea: $69d0dc3a7a522279$export$7d9a0b32b656284d,
    lineaTestnet: $82142547387b7e5f$export$9b359a3964075c2b,
    avalanche: $e87e50afa870660d$export$ca1d15c01fde7266,
    avalancheFuji: $0fb5af1793d0d7b1$export$714c92acd9d3100a,
    holesky: $283523508bc31e33$export$55c20919802936dd,
    redstoneHolesky: $ccdf7ff0bc688c87$export$1939d6ce88bc478,
    zora: $6fdd837c6bca8025$export$29294a3e855ae137,
    zoraSepolia: $a8b98a832800e74f$export$d8a9d70d598eef4f,
    zoraTestnet: $ec9efbf7de155634$export$3755fcd3ba6f95fe
};
const $c4dbc45adbe7f814$export$f92d15367ea6b4f7 = [
    // mainnet should always be first so we can default to it as our initial chain
    (0, $d0d9ebc43faa74f6$export$536d3e0d2c7baf54),
    // then we have the mainstream testnets
    (0, $5ff31066814f3c17$export$50b37201a1017e1e),
    (0, $0bf4b4fa7f105340$export$31254237fd28c61a),
    // then the rest
    (0, $2cbcf8f77ded2980$export$625cf84d855940d4),
    (0, $766d1441a6fe8323$export$857f1b5f596fb425),
    (0, $a1182a098f7425ef$export$21799e7ae6cc115),
    (0, $8e165bf5e9d99a0d$export$e584d4a579189f9b),
    (0, $31337d4b0853106e$export$50b3e5cabd7d7a60),
    (0, $343d99fc8e37a972$export$af869f83341a963d),
    (0, $fade430349f6bbba$export$b7b19aa0ee06c73),
    (0, $75564322c4498b92$export$34b6ef3a78067459),
    (0, $3a346aa418e66782$export$671bdf559232d1e0),
    (0, $45a59ca9359026be$export$ea1d1a16df546697),
    (0, $ffc6e47b863526a4$export$d5a6d2ad15089d83),
    (0, $7210151d9502f10c$export$de9b05abdae7c2c),
    (0, $060f2147d602435c$export$e2253033e6e1df16),
    (0, $bfe3f51ac963dde3$export$8ae5747389a6ab6b),
    (0, $e0a92682c0d6f5a7$export$e02aa76c029b1df5),
    (0, $98b0789cdb07b2ff$export$3c457235eec24c53),
    (0, $69d0dc3a7a522279$export$7d9a0b32b656284d),
    (0, $82142547387b7e5f$export$9b359a3964075c2b),
    (0, $e87e50afa870660d$export$ca1d15c01fde7266),
    (0, $0fb5af1793d0d7b1$export$714c92acd9d3100a),
    (0, $283523508bc31e33$export$55c20919802936dd),
    (0, $ccdf7ff0bc688c87$export$1939d6ce88bc478),
    (0, $6fdd837c6bca8025$export$29294a3e855ae137),
    (0, $a8b98a832800e74f$export$d8a9d70d598eef4f),
    (0, $ec9efbf7de155634$export$3755fcd3ba6f95fe)
];
const $c4dbc45adbe7f814$export$3486db705befb001 = new Set($c4dbc45adbe7f814$export$f92d15367ea6b4f7.map((chain)=>chain.id));



/**
 * We support a subset of the provider methods found here:
 *
 *     https://ethereum.org/en/developers/docs/apis/json-rpc/#json-rpc-methods
 *
 * For now, we're focused on signing-related methods because the iframe (this code)
 * is the only place that has access to the private key and thus is the only one
 * who can create signatures. All other methods do not need the private key and
 * can therefore be implemented by clients of the iframe.
 */ const $949f03fa75f710dc$export$c70f8b9e7a68f3d9 = [
    "eth_sign",
    "eth_populateTransactionRequest",
    "eth_signTransaction",
    "personal_sign",
    "eth_signTypedData_v4"
];
const $949f03fa75f710dc$export$ed257f2588d73f92 = (method)=>{
    return $949f03fa75f710dc$export$c70f8b9e7a68f3d9.includes(method);
};
const $949f03fa75f710dc$export$beaff6b088e4f134 = [
    "error",
    "invalid_request_arguments",
    "wallet_not_on_device",
    "invalid_recovery_pin",
    "insufficient_funds"
];


var $78157d361a638447$export$4c2ccc1f429bf31;
(function(PrivyEmbeddedWalletErrorCode) {
    PrivyEmbeddedWalletErrorCode["MISSING_OR_INVALID_PRIVY_APP_ID"] = "missing_or_invalid_privy_app_id";
    PrivyEmbeddedWalletErrorCode["MISSING_OR_INVALID_PRIVY_ACCOUNT_ID"] = "missing_or_invalid_privy_account_id";
    PrivyEmbeddedWalletErrorCode["INVALID_DATA"] = "invalid_data";
    PrivyEmbeddedWalletErrorCode["LINKED_TO_ANOTHER_USER"] = "linked_to_another_user";
    PrivyEmbeddedWalletErrorCode["ALLOWLIST_REJECTED"] = "allowlist_rejected";
    PrivyEmbeddedWalletErrorCode["OAUTH_USER_DENIED"] = "oauth_user_denied";
    PrivyEmbeddedWalletErrorCode["UNKNOWN_AUTH_ERROR"] = "unknown_auth_error";
    PrivyEmbeddedWalletErrorCode["USER_EXITED_AUTH_FLOW"] = "exited_auth_flow";
    PrivyEmbeddedWalletErrorCode["MUST_BE_AUTHENTICATED"] = "must_be_authenticated";
    PrivyEmbeddedWalletErrorCode["UNKNOWN_CONNECT_WALLET_ERROR"] = "unknown_connect_wallet_error";
    PrivyEmbeddedWalletErrorCode["GENERIC_CONNECT_WALLET_ERROR"] = "generic_connect_wallet_error";
    PrivyEmbeddedWalletErrorCode["CLIENT_REQUEST_TIMEOUT"] = "client_request_timeout";
    PrivyEmbeddedWalletErrorCode["INVALID_CREDENTIALS"] = "invalid_credentials";
})($78157d361a638447$export$4c2ccc1f429bf31 || ($78157d361a638447$export$4c2ccc1f429bf31 = {}));
class $78157d361a638447$export$40842056b5426348 extends Error {
    /**
   * @param type Privy error type.
   * @param message Human-readable message.
   * @param cause Source of this error.
   */ constructor(message, cause, privyErrorCode){
        super(message);
        if (cause instanceof Error) this.cause = cause;
        this.privyErrorCode = privyErrorCode;
    }
    toString() {
        return `${this.type}${this.privyErrorCode ? `-${this.privyErrorCode}` : ""}: ${this.message}${this.cause ? ` [cause: ${this.cause}]` : ""}`;
    }
}
class $78157d361a638447$export$417589b978208a8f extends $78157d361a638447$export$40842056b5426348 {
    constructor(message, code, data){
        super(message);
        this.type = "provider_error";
        this.code = code;
        this.data = data;
    }
}
class $78157d361a638447$export$4ee5e2a38200b61e extends Error {
    constructor(type, message){
        super(message);
        this.type = type;
    }
}
class $78157d361a638447$export$75d61f1bcb44b776 extends $78157d361a638447$export$40842056b5426348 {
    constructor(message, cause, privyErrorCode){
        super(message, cause, privyErrorCode);
        this.type = "connector_error";
    }
}
class $78157d361a638447$export$7c35c76e874bdcb extends Error {
    constructor(message, code, data){
        super(message);
        this.code = code;
        this.data = data;
    }
}
function $78157d361a638447$export$141c9b0218e5efe9(error) {
    const type = error.type;
    return typeof type === "string" && (0, $949f03fa75f710dc$export$beaff6b088e4f134).includes(type);
}
function $78157d361a638447$export$8e5517a02da6043(error) {
    return $78157d361a638447$export$141c9b0218e5efe9(error) && error.type === "wallet_not_on_device";
}


const $e2cd667b45950d1e$var$SUPPORTED_IFRAME_JSON_RPC_METHODS = [
    "eth_sign",
    "eth_signTransaction",
    "personal_sign",
    "eth_signTypedData_v4"
];
const $e2cd667b45950d1e$export$1302a7f662bde246 = (method)=>{
    return $e2cd667b45950d1e$var$SUPPORTED_IFRAME_JSON_RPC_METHODS.includes(method);
};









const $cc567275a7ee3d06$export$30b117205588fcb5 = [
    (0, $c4dbc45adbe7f814$export$2096d4cea8b814f3).polygon.id,
    (0, $c4dbc45adbe7f814$export$2096d4cea8b814f3).polygonMumbai.id
];
const $cc567275a7ee3d06$var$convertGasStationFeesToWei = (fee)=>{
    // fee.{maxPriorityFee, maxFee} are both decimal numbers. When parsing them to
    // gwei, we must round them to at most 9 decimal places to avoid an underflow
    // error by ethers. We use 9 decimal places for gwei since 1 ETH = 10^9 gwei
    // https://docs.ethers.org/v5/api/utils/display-logic/#display-logic--named-units
    return {
        maxPriorityFee: (0, $bwzhE$ethersprojectunits.parseUnits)(fee.maxPriorityFee.toFixed(9), "gwei").toHexString(),
        maxFee: (0, $bwzhE$ethersprojectunits.parseUnits)(fee.maxFee.toFixed(9), "gwei").toHexString()
    };
};
const $cc567275a7ee3d06$var$parseGasStationResponse = (res)=>{
    return {
        safeLow: $cc567275a7ee3d06$var$convertGasStationFeesToWei(res.safeLow),
        standard: $cc567275a7ee3d06$var$convertGasStationFeesToWei(res.standard),
        fast: $cc567275a7ee3d06$var$convertGasStationFeesToWei(res.fast)
    };
};
const $cc567275a7ee3d06$export$d57e90e2ca3fc708 = async (chainId)=>{
    let url = "";
    switch(chainId){
        case (0, $c4dbc45adbe7f814$export$2096d4cea8b814f3).polygon.id:
            url = "https://gasstation.polygon.technology/v2";
            break;
        case (0, $c4dbc45adbe7f814$export$2096d4cea8b814f3).polygonMumbai.id:
            url = "https://gasstation-testnet.polygon.technology/v2";
            break;
        default:
            throw Error(`chainId ${chainId} does not support polygon gas stations`);
    }
    const res = await fetch(url);
    const gasStationResponse = await res.json();
    return $cc567275a7ee3d06$var$parseGasStationResponse(gasStationResponse);
};


const $e83859313c481527$export$e682a3879cb3666e = "4df5e2316331463a9130964bd6078dfa";
const $e83859313c481527$export$5cf1676300c48d00 = "fe9c30fc-3bc5-4064-91e2-6ab5887f8f4d";
const $e83859313c481527$export$28973486bddd2e5e = (chainId, chains, rpcConfig, options)=>{
    const chainIdInt = Number(chainId);
    const chain = chains.find((chain)=>chain.id === chainIdInt);
    if (!chain) throw new (0, $78157d361a638447$export$75d61f1bcb44b776)(`Unsupported chainId ${chainId}`, 4901);
    let rpcProvider;
    // Priority given to bring-your-own RPC -> Privy -> Infura -> Blast -> Default
    if (chain.rpcUrls.privyWalletOverride && chain.rpcUrls.privyWalletOverride.http[0]) rpcProvider = new (0, $bwzhE$ethersprojectproviders.StaticJsonRpcProvider)(chain.rpcUrls.privyWalletOverride.http[0]);
    else if (rpcConfig.rpcUrls && rpcConfig.rpcUrls[chainIdInt]) rpcProvider = new (0, $bwzhE$ethersprojectproviders.StaticJsonRpcProvider)(rpcConfig.rpcUrls[chainIdInt]);
    else if (chain.rpcUrls["privy"]?.http[0]) rpcProvider = new (0, $bwzhE$ethersprojectproviders.StaticJsonRpcProvider)({
        url: chain.rpcUrls["privy"].http[0],
        headers: {
            "privy-app-id": options.appId
        }
    });
    else if (chain.rpcUrls["infura"]?.http[0]) rpcProvider = new (0, $bwzhE$ethersprojectproviders.StaticJsonRpcProvider)(chain.rpcUrls["infura"].http[0] + "/" + $e83859313c481527$export$e682a3879cb3666e);
    else if (chain.rpcUrls["blast"]?.http[0]) rpcProvider = new (0, $bwzhE$ethersprojectproviders.StaticJsonRpcProvider)(chain.rpcUrls["blast"].http[0] + "/" + $e83859313c481527$export$5cf1676300c48d00);
    else rpcProvider = new (0, $bwzhE$ethersprojectproviders.StaticJsonRpcProvider)(chain.rpcUrls["default"]?.http[0]);
    if (!rpcProvider) throw new (0, $78157d361a638447$export$75d61f1bcb44b776)(`No RPC url found for ${chainId}`);
    return rpcProvider;
};
function $e83859313c481527$var$isHexString(value) {
    return /^-?0x[a-f0-9]+$/i.test(value);
}
function $e83859313c481527$var$isValidQuantity(value) {
    const validNumber = typeof value === "number";
    const validBigInt = typeof value === "bigint";
    const validHexString = typeof value === "string" && $e83859313c481527$var$isHexString(value);
    return validNumber || validBigInt || validHexString;
}
function $e83859313c481527$export$e7229ef546d7b9cd(txRequest) {
    const hexStringProperties = [
        "gasLimit",
        "gasPrice",
        "value",
        "maxPriorityFeePerGas",
        "maxFeePerGas"
    ];
    for (const prop of hexStringProperties){
        const txRequestQuantity = txRequest[prop];
        // These can all be undefined
        if (typeof txRequestQuantity === "undefined") continue;
        // But if they're not undefined, they must be a valid quantity which we define as either a hex string, number, or (native) bigint.
        if (!$e83859313c481527$var$isValidQuantity(txRequestQuantity)) throw new Error(`Transaction request property '${prop}' must be a valid number, bigint, or hex string representing a quantity`);
    }
    // This should never throw because we should populate this as mainnet (if missing) in a previous step, but important to assert.
    if (typeof txRequest.chainId !== "number") throw new Error(`Transaction request property 'chainId' must be a number`);
}
function $e83859313c481527$var$convertBigNumberish(value) {
    if (typeof value === "number" || typeof value === "bigint" || typeof value === "string") return value;
    // This is trying to assert if value is an actual ethers BigNumber.
    // typeof only works on primitive types, so instead, we attempt to
    // cast it as a BigNumber, and then check if .toHexString(), which is an
    // ethers BigNumber method, is a defined function.
    if (typeof value.toHexString === "function") return value.toHexString();
    throw new Error(`Expected numeric value but received ${value}`);
}
/**
 * Check if the chain ID is for a BSC chain
 */ function $e83859313c481527$var$isBsc(chainId) {
    // TODO: We should probably move this elsewhere so there is better awareness for adding new BSC chains
    // TODO: update this to use chain .id once we move to wagmi connectors/viem
    const BSC_MAINNET_ID = 56;
    const BSC_TESTNET_ID = 97;
    return [
        BSC_MAINNET_ID,
        BSC_TESTNET_ID
    ].includes(chainId);
}
/**
 * Check if the chain ID is based on the OP stack
 */ function $e83859313c481527$var$isOpStack(chainId) {
    // TODO: We should probably move this elsewhere so there is better awareness for adding new OP stack chains
    // or possibly find a way to determine if it is an OP stack chain from the provider, so no config is necessary?
    return [
        (0, $c4dbc45adbe7f814$export$2096d4cea8b814f3).base.id,
        (0, $c4dbc45adbe7f814$export$2096d4cea8b814f3).baseGoerli.id,
        (0, $c4dbc45adbe7f814$export$2096d4cea8b814f3).baseSepolia.id,
        (0, $c4dbc45adbe7f814$export$2096d4cea8b814f3).optimism.id,
        (0, $c4dbc45adbe7f814$export$2096d4cea8b814f3).optimismGoerli.id,
        (0, $c4dbc45adbe7f814$export$2096d4cea8b814f3).optimismSepolia.id,
        (0, $c4dbc45adbe7f814$export$2096d4cea8b814f3).zora.id,
        (0, $c4dbc45adbe7f814$export$2096d4cea8b814f3).zoraTestnet.id,
        (0, $c4dbc45adbe7f814$export$2096d4cea8b814f3).zoraSepolia.id
    ].includes(chainId);
}
/**
 * Check if the chain ID is for an arbitrum chain
 */ function $e83859313c481527$var$isArb(chainId) {
    // TODO: We should probably move this elsewhere so there is better awareness for adding new Arbitrum chains
    // or possibly find a way to determine if it is an Arbitrum chain from the provider, so no config is necessary?
    return [
        (0, $c4dbc45adbe7f814$export$2096d4cea8b814f3).arbitrum.id,
        (0, $c4dbc45adbe7f814$export$2096d4cea8b814f3).arbitrumGoerli.id,
        (0, $c4dbc45adbe7f814$export$2096d4cea8b814f3).arbitrumSepolia.id
    ].includes(chainId);
}
function $e83859313c481527$var$fromEthersTransactionRequest(txRequest) {
    const result = {};
    if (txRequest.to !== undefined) result.to = txRequest.to;
    if (txRequest.data !== undefined) result.data = txRequest.data;
    if (txRequest.chainId !== undefined) result.chainId = txRequest.chainId;
    if (txRequest.type !== undefined) result.type = txRequest.type;
    if (txRequest.accessList !== undefined) result.accessList = txRequest.accessList;
    if (txRequest.nonce !== undefined) result.nonce = $e83859313c481527$var$convertBigNumberish(txRequest.nonce);
    if (txRequest.gasLimit !== undefined) result.gasLimit = $e83859313c481527$var$convertBigNumberish(txRequest.gasLimit);
    if (txRequest.gasPrice !== undefined) result.gasPrice = $e83859313c481527$var$convertBigNumberish(txRequest.gasPrice);
    if (txRequest.value !== undefined) result.value = $e83859313c481527$var$convertBigNumberish(txRequest.value);
    if (txRequest.maxFeePerGas !== undefined) result.maxFeePerGas = $e83859313c481527$var$convertBigNumberish(txRequest.maxFeePerGas);
    if (txRequest.maxPriorityFeePerGas !== undefined) result.maxPriorityFeePerGas = $e83859313c481527$var$convertBigNumberish(txRequest.maxPriorityFeePerGas);
    return result;
}
async function $e83859313c481527$export$88448d96dde6cfee(address, txRequest, provider) {
    // TODO fix types to support hex strings (which is the EIP's spec).
    txRequest.chainId = Number(txRequest.chainId);
    // Construct a void signer (without access to the private key)
    // to make the eth_populateTransactionRequest RPC. This needs to be
    // a signer, because it must know wallet-specific information, like
    // the wallet's nonce
    const signer = new (0, $bwzhE$ethersprojectabstractsigner.VoidSigner)(address, provider);
    // ethers' `sendTransaction` (used externally) and `populateTransactionRequest`
    // (used internally) both hexlify their inputs - in this process, they convert the
    // `gasLimit` key into `gas`. Since the tx passed into here may have already gone through
    // here may have already gone through ethers (in the consuming app), we must revert ethers'
    // re-assignment and update `gas` to `gasLimit`, since we'll call ethers again later.
    // https://github.com/ethers-io/ethers.js/blob/ec1b9583039a14a0e0fa15d0a2a6082a2f41cf5b/packages/providers/lib/json-rpc-provider.js#L836
    /* eslint-disable @typescript-eslint/ban-ts-comment */ // @ts-ignore
    if (txRequest.gas) {
        // @ts-ignore
        txRequest.gasLimit = txRequest.gas;
        // @ts-ignore
        delete txRequest.gas;
    }
    /* eslint-disable @typescript-eslint/ban-ts-comment */ // Polygon has a non-standard implementation of eip-1559 that still requires a gas station
    // https://wiki.polygon.technology/docs/tools/faucets/polygon-gas-station/.
    // Explanation here: https://github.com/ethers-io/ethers.js/issues/2828#issuecomment-1283014250
    if ((0, $cc567275a7ee3d06$export$30b117205588fcb5).includes(txRequest.chainId) && (!txRequest.maxPriorityFeePerGas || !txRequest.maxFeePerGas)) try {
        const { standard: standard } = await (0, $cc567275a7ee3d06$export$d57e90e2ca3fc708)(txRequest.chainId);
        if (!txRequest.maxPriorityFeePerGas) txRequest.maxPriorityFeePerGas = standard.maxPriorityFee;
        if (!txRequest.maxFeePerGas) txRequest.maxFeePerGas = standard.maxFee;
    } catch (error) {
        throw new Error(`Failed to set gas prices from Polygon gas station with error: ${error}.`);
    }
    // Since Ethers does not accurately calculate the gas fee on Arbitrum, here we will take the base fee
    // from the last block and pass in a value that is 20% higher to account for increased network activity
    // 20% is consistent with what Metamask does for their 'medium' fee threshold:
    // https://github.com/MetaMask/core/blob/b1946ebf6d91a08773d8e98436813987836f67f0/packages/gas-fee-controller/src/fetchGasEstimatesViaEthFeeHistory/calculateGasFeeEstimatesForPriorityLevels.ts#L27
    if ($e83859313c481527$var$isArb(txRequest.chainId) && !txRequest.maxFeePerGas) try {
        const { lastBaseFeePerGas: lastBaseFeePerGas } = await signer.getFeeData();
        if (lastBaseFeePerGas) {
            // Calculate the correct maxFeePerGas to pass in
            const newMaxFeePerGasBN = lastBaseFeePerGas.mul((0, $bwzhE$ethersprojectbignumber.BigNumber).from(120)).div((0, $bwzhE$ethersprojectbignumber.BigNumber).from(100));
            txRequest.maxFeePerGas = $e83859313c481527$var$convertBigNumberish(newMaxFeePerGasBN);
            // No priority fee is required on Arbitrum: https://docs.arbitrum.io/learn-more/faq#do-i-need-to-pay-a-tip--priority-fee-for-my-arbitrum-transactions
            txRequest.maxPriorityFeePerGas = $e83859313c481527$var$convertBigNumberish((0, $bwzhE$ethersprojectbignumber.BigNumber).from(0));
        }
    } catch (error) {
        throw new Error(`Failed to set gas price for Arbitrum transaction: ${error}.`);
    }
    // If this is an OP stack transaction, and the developer has not specified maxPriorityFeePerGas, maxFeePerGas, or gasPrice (unlikely)
    // We will estimate what the best fee is, rather than relying on Ethers for it because Ethers' implementation is inaccurate
    if ($e83859313c481527$var$isOpStack(txRequest.chainId) && (!txRequest.maxPriorityFeePerGas || !txRequest.maxFeePerGas) && !txRequest.gasPrice) try {
        // Set type to 2 since we know it is supported on this network & we are estimating the gas according to
        // type 2 (eip1559) transactions, and no gasPrice was specified.
        txRequest.type = 2;
        // Fetching a good maxPriorityFeePerGas from the network RPC call
        // This happens first because the maxPriorityFeePerGas will be used to calculate the maxFeePerGas
        if (!txRequest.maxPriorityFeePerGas) {
            const networkMaxPriorityFeePerGas = await provider.send("eth_maxPriorityFeePerGas", []);
            txRequest.maxPriorityFeePerGas = networkMaxPriorityFeePerGas;
        }
        // If maxFeePerGas is specified, that means maxPriorityFeePerGas is not specified, and this can result in hung transactions
        // We explicitly warn against doing this in the docs.
        if (txRequest.maxFeePerGas) {
            console.warn("maxFeePerGas is specified without maxPriorityFeePerGas - this can result in hung transactions.");
            // If the maxPriorityFeePerGas that we calculated to be required is higher than the maxFeePerGas the tx will not go through, so we will throw here.
            // This should be rare and is likely a developer error.
            if (txRequest.maxPriorityFeePerGas >= txRequest.maxFeePerGas) throw new Error(`Overridden maxFeePerGas is less than or equal to the calculated maxPriorityFeePerGas. Please set both values or maxPriorityFeePerGas alone for correct gas estimation.`);
        // If maxFeePerGas is greater than maxPriorityFeePerGas, the transaction will go through, however possibly not immediately (depending on the baseFee)
        // We warned the developer, and we will continue.
        // NOOP
        }
        // This is the more expected path (relative to the above if), where maxFeePerGas is not set
        // We can calculate the correct maxFeePerGas to pass in, based on the last base fee & the max priority fee calculated above
        // Pass in a base fee that is 26% higher than the last base fee, in case the last block was full and the base fee has increased.
        // If the previous block was full the base fee will increase by 12.5% so this gives us a buffer of two full blocks.
        // https://docs.alchemy.com/docs/how-to-build-a-gas-fee-estimator-using-eip-1559#relationship-between-gasusedratio-and-basefeepergas
        if (!txRequest.maxFeePerGas) {
            const { lastBaseFeePerGas: lastBaseFeePerGas } = await signer.getFeeData();
            if (!lastBaseFeePerGas) throw new Error(`Unable to fetch baseFee for last block.`);
            const lastBaseFeePerGasBN = (0, $bwzhE$ethersprojectbignumber.BigNumber).from(lastBaseFeePerGas);
            const lastBaseFeePerGasMultipliedBN = lastBaseFeePerGasBN.mul((0, $bwzhE$ethersprojectbignumber.BigNumber).from(126)).div((0, $bwzhE$ethersprojectbignumber.BigNumber).from(100));
            const newMaxFeePerGasBN = lastBaseFeePerGasMultipliedBN.add((0, $bwzhE$ethersprojectbignumber.BigNumber).from(txRequest.maxPriorityFeePerGas));
            txRequest.maxFeePerGas = $e83859313c481527$var$convertBigNumberish(newMaxFeePerGasBN);
        }
    } catch (error) {
        throw new Error(`Failed to set gas price for OP stack transaction: ${error}.`);
    }
    // If this is a BSC transaction and tx type 0 is not specified, ethers will assume tx type 2 and populate the incorrect gas values
    // We want to add specific logic that covers all cases where the tx type is not specified to be 0
    if ($e83859313c481527$var$isBsc(txRequest.chainId) && txRequest.type != 0) {
        // TODO: this logic may be able to be applied generally to all non eip1559 chains
        // If the transaction type is set to 1 or 2 we should warn the developer
        if (txRequest.type == 1 || txRequest.type == 2) console.warn("Transaction request type specified is incompatible for chain and will result in undefined behavior.  Please use transaction type 0.");
        // If txRequest.type is undefined, let's set it to 0, and ethers will then properly estimate gasPrice for the transaction
        if (txRequest.type === undefined) txRequest.type = 0;
    }
    // If the `txRequest` is populated by a third-party SDK, it may include parameters that ethers does not
    // recognize. When this is the case, ethers will throw a hard error instead of ignoring it. To resolve this,
    // we only include the parameters that ethers includes in their TransactionRequest object when making this call.
    const populateTxResponse = await signer.populateTransaction({
        to: txRequest.to,
        from: txRequest.from,
        nonce: txRequest.nonce,
        gasLimit: txRequest.gasLimit,
        gasPrice: txRequest.gasPrice,
        data: txRequest.data,
        value: txRequest.value,
        chainId: txRequest.chainId,
        type: txRequest.type,
        accessList: txRequest.accessList,
        maxFeePerGas: txRequest.maxFeePerGas,
        maxPriorityFeePerGas: txRequest.maxPriorityFeePerGas
    });
    const finalTx = $e83859313c481527$var$fromEthersTransactionRequest(populateTxResponse);
    $e83859313c481527$export$e7229ef546d7b9cd(finalTx);
    return finalTx;
}


class $a983a2431488eb50$export$26f7ada50d209c97 extends (0, ($parcel$interopDefault($bwzhE$eventemitter3))) {
    /** @internal */ constructor({ walletProxy: walletProxy, privyInternal: privyInternal, address: address, chains: chains, chainId: chainId = chains[0].id }){
        super();
        this._walletProxy = walletProxy;
        this._privyInternal = privyInternal;
        this._address = address;
        this._chainId = chainId;
        this._chains = chains;
        this._jsonRpcProvider = (0, $e83859313c481527$export$28973486bddd2e5e)(chainId, chains, {
            rpcUrls: []
        }, {
            appId: this._privyInternal.appId
        });
    }
    async request(request) {
        // TODO: validate params on each branch
        if ((0, $e2cd667b45950d1e$export$1302a7f662bde246)(request.method)) return this.handleIFrameRpc(request);
        switch(request.method){
            case "eth_accounts":
            case "eth_requestAccounts":
                return this._address ? [
                    this._address
                ] : [];
            case "eth_chainId":
                return `0x${this._chainId.toString(16)}`;
            case "wallet_switchEthereumChain":
                return this.handleSwitchEthereumChain(request);
            case "eth_estimateGas":
                return this.handleEstimateGas(request);
            case "eth_sendTransaction":
                {
                    const data = request.params?.[0];
                    return this.handleSendTransaction(data);
                }
            case "eth_populateTransactionRequest":
                {
                    const data = request.params?.[0];
                    return this.handlePopulateTransaction(data);
                }
            default:
                return this.handleJsonRpc(request);
        }
    }
    /**
   * Backfills a transaction that may not specify a `chainId` with the provider's `this._chianId`
   */ ensureChainId(tx) {
        const ensureTxChainId = {
            chainId: this._chainId,
            ...tx
        };
        this.internalSwitchEthereumChain(ensureTxChainId.chainId);
        return ensureTxChainId;
    }
    /**
   * If a chainId is provided that differs from the current `this._chainId`,
   * the new chain and StaticJsonRpcProvider will be set
   */ internalSwitchEthereumChain(chainId) {
        if (!chainId || Number(chainId) === this._chainId) return;
        this._chainId = Number(chainId);
        this._jsonRpcProvider = (0, $e83859313c481527$export$28973486bddd2e5e)(this._chainId, this._chains, {
            rpcUrls: []
        }, {
            appId: this._privyInternal.appId
        });
        this.emit("chainChanged", chainId);
    }
    async handlePopulateTransaction(tx) {
        const txRequest = this.ensureChainId(tx);
        return (0, $e83859313c481527$export$88448d96dde6cfee)(this._address, txRequest, this._jsonRpcProvider);
    }
    async handleSendTransaction(tx) {
        const txRequest = this.ensureChainId(tx);
        const populatedTx = await (0, $e83859313c481527$export$88448d96dde6cfee)(this._address, txRequest, this._jsonRpcProvider);
        const signedTx = await this.handleIFrameRpc({
            method: "eth_signTransaction",
            params: [
                populatedTx
            ]
        });
        return await this.handleJsonRpc({
            method: "eth_sendRawTransaction",
            params: [
                signedTx
            ]
        });
    }
    async handleEstimateGas(args) {
        if (!args.params || !Array.isArray(args.params)) throw new Error("Invalid params for eth_estimateGas");
        // Delete gas parameters to avoid balance checks
        delete args.params[0].gasPrice;
        delete args.params[0].maxFeePerGas;
        delete args.params[0].maxPriorityFeePerGas;
        // Empirically observed that we need:
        // 1. The chainId, so we add it.
        const txRequest = {
            ...args.params[0],
            chainId: `0x${this._chainId.toString(16)}`
        };
        this.internalSwitchEthereumChain(txRequest.chainId);
        try {
            return await this._jsonRpcProvider.send("eth_estimateGas", [
                txRequest
            ]);
        } catch (e) {
            // If the original request fails, it may be because the wallet has insufficient funds.
            // We want to produce a successful gas estimate even if the wallet does not have funds,
            // because ethers prevents `eth_sendTransaction` from being called if gas estimation fails.
            // We only try this if the original request fails, because some transactions include logic
            // that requires the `from` address in order for gas to be computed.
            delete txRequest.from;
            return await this._jsonRpcProvider.send("eth_estimateGas", [
                txRequest
            ]);
        }
    }
    handleSwitchEthereumChain(args) {
        if (!args.params || !Array.isArray(args.params)) // 4200 = unsupported method
        throw new (0, $78157d361a638447$export$7c35c76e874bdcb)(`Invalid params for ${args.method}`, 4200);
        let newChain;
        // Legacy support for passing in a chainId as a string.
        // The standard is to pass in an object with a chainId property.
        // https://eips.ethereum.org/EIPS/eip-3326#parameters
        if (typeof args.params[0] === "string") newChain = args.params[0];
        else if ("chainId" in args.params[0] && typeof args.params[0].chainId === "string") newChain = args.params[0].chainId;
        else // 4200 = unsupported method
        throw new (0, $78157d361a638447$export$7c35c76e874bdcb)(`Invalid params for ${args.method}`, 4200);
        this.internalSwitchEthereumChain(newChain);
    }
    async handleIFrameRpc(request) {
        try {
            const token = await this._privyInternal.getAccessToken();
            if (!token) throw new Error("Missing privy token. User must be logged in");
            this._privyInternal.createAnalyticsEvent("embedded_wallet_sdk_rpc_started", {
                method: request.method,
                address: this._address
            });
            const result = await this._walletProxy.rpc({
                request: request,
                address: this._address,
                accessToken: token
            });
            this._privyInternal.createAnalyticsEvent("embedded_wallet_sdk_rpc_completed", {
                method: request.method,
                address: this._address
            });
            return result.response.data;
        } catch (error) {
            console.error(error);
            this._privyInternal.createAnalyticsEvent("embedded_wallet_sdk_rpc_failed", {
                method: request.method,
                address: this._address,
                error: error instanceof Error ? error.message : "Unable to make wallet request"
            });
            throw new Error("Unable to make wallet request");
        }
    }
    async handleJsonRpc(request) {
        return this._jsonRpcProvider.send(request.method, request.params ?? []);
    }
    toJSON() {
        // prettier-ignore
        return `PrivyEIP1193Provider { address: '${this._address}', chainId: ${this._chainId}, request: [Function] }`;
    }
}


class $64a107020789acc0$export$4a16012cef0432f7 {
    enqueue(eventId, callbacks) {
        this.callbacks[eventId] = callbacks;
    }
    dequeue(event, eventId) {
        const callbacks = this.callbacks[eventId];
        if (!callbacks) // If this happens, it is a bug with Privy's code.
        throw new Error(`cannot dequeue ${event} event: no event found for id ${eventId}`);
        delete this.callbacks[eventId];
        switch(event){
            case "privy:iframe:ready":
                return callbacks;
            case "privy:wallet:create":
                return callbacks;
            case "privy:wallet:connect":
                return callbacks;
            case "privy:wallet:recover":
                return callbacks;
            case "privy:wallet:rpc":
                return callbacks;
            case "privy:wallet:set-recovery-password":
                return callbacks;
            default:
                throw new Error(`invalid wallet event type ${event}`);
        }
    }
    constructor(){
        this.callbacks = {};
    }
}



const $20cd5544df41b9a5$export$4702905edceab12f = 15000;
function $20cd5544df41b9a5$var$isErrorResponseEvent(event) {
    return event.error !== undefined;
}
// We'll need unique identifiers to associate with each event.
const $20cd5544df41b9a5$var$uniqueId = function(id) {
    return ()=>`id-${id++}`;
}(0);
// This is a lossy serialization!
// i.e. trying to deserialize the output will result in `string`s where there
// were originally `BigInt`s
const $20cd5544df41b9a5$var$replacer = (_key, value)=>typeof value === "bigint" ? value.toString() : value;
const $20cd5544df41b9a5$var$serialize = (event, data)=>`${event}${JSON.stringify(data, $20cd5544df41b9a5$var$replacer)}`;
const $20cd5544df41b9a5$var$sleep = (ms)=>{
    return new Promise((resolve)=>{
        setTimeout(resolve, ms);
    });
};
const $20cd5544df41b9a5$var$expiringPromise = (promise, ms, msg = "")=>{
    return Promise.race([
        promise,
        new Promise((_, reject)=>{
            setTimeout(()=>{
                reject(new Error(msg ? `Operation reached timeout: ${msg}` : "Operation reached timeout"));
            }, ms);
        })
    ]);
};
const $20cd5544df41b9a5$var$EVENT_CALLBACK_QUEUE = new (0, $64a107020789acc0$export$4a16012cef0432f7)();
class $20cd5544df41b9a5$export$574bb90dcdb39533 {
    constructor(embeddedWalletMessagePoster){
        this.ready = false;
        this.cache = new Map();
        this._embeddedWalletMessagePoster = embeddedWalletMessagePoster;
    }
    /**
   * Checks to see if the iframe messaging pipeline is up and running
   *
   * Resolves with empty/void
   */ ping(timeoutMs = $20cd5544df41b9a5$export$4702905edceab12f) {
        return $20cd5544df41b9a5$var$expiringPromise(this.invoke("privy:iframe:ready", {}, this._embeddedWalletMessagePoster), timeoutMs, "ping");
    }
    create(data, timeoutMs = $20cd5544df41b9a5$export$4702905edceab12f) {
        return $20cd5544df41b9a5$var$expiringPromise(this.waitForReady().then(()=>this.invoke("privy:wallet:create", data, this._embeddedWalletMessagePoster)), timeoutMs, "create");
    }
    connect(data, timeoutMs = $20cd5544df41b9a5$export$4702905edceab12f) {
        return $20cd5544df41b9a5$var$expiringPromise(this.waitForReady().then(()=>this.invoke("privy:wallet:connect", data, this._embeddedWalletMessagePoster)), timeoutMs, "connect");
    }
    recover(data, timeoutMs = $20cd5544df41b9a5$export$4702905edceab12f) {
        return $20cd5544df41b9a5$var$expiringPromise(this.waitForReady().then(()=>this.invoke("privy:wallet:recover", data, this._embeddedWalletMessagePoster)), timeoutMs, "recover");
    }
    setPassword(data, timeoutMs = $20cd5544df41b9a5$export$4702905edceab12f) {
        return $20cd5544df41b9a5$var$expiringPromise(this.waitForReady().then(()=>this.invoke("privy:wallet:set-recovery-password", data, this._embeddedWalletMessagePoster)), timeoutMs, "setPassword");
    }
    rpc(data, timeoutMs = $20cd5544df41b9a5$export$4702905edceab12f) {
        return $20cd5544df41b9a5$var$expiringPromise(this.waitForReady().then(()=>this.invoke("privy:wallet:rpc", data, this._embeddedWalletMessagePoster)), timeoutMs, "rpc");
    }
    handleEmbeddedWalletMessages(event) {
        switch(event.event){
            case "privy:iframe:ready":
                const readyCallbacks = $20cd5544df41b9a5$var$EVENT_CALLBACK_QUEUE.dequeue(event.event, event.id);
                if ($20cd5544df41b9a5$var$isErrorResponseEvent(event)) return readyCallbacks.reject(new (0, $78157d361a638447$export$4ee5e2a38200b61e)(event.error.type, event.error.message));
                else return readyCallbacks.resolve(event.data);
            case "privy:wallet:create":
                const createCallbacks = $20cd5544df41b9a5$var$EVENT_CALLBACK_QUEUE.dequeue(event.event, event.id);
                if ($20cd5544df41b9a5$var$isErrorResponseEvent(event)) return createCallbacks.reject(new (0, $78157d361a638447$export$4ee5e2a38200b61e)(event.error.type, event.error.message));
                else return createCallbacks.resolve(event.data);
            case "privy:wallet:connect":
                const connectCallbacks = $20cd5544df41b9a5$var$EVENT_CALLBACK_QUEUE.dequeue(event.event, event.id);
                if ($20cd5544df41b9a5$var$isErrorResponseEvent(event)) return connectCallbacks.reject(new (0, $78157d361a638447$export$4ee5e2a38200b61e)(event.error.type, event.error.message));
                else return connectCallbacks.resolve(event.data);
            case "privy:wallet:recover":
                const recoverCallbacks = $20cd5544df41b9a5$var$EVENT_CALLBACK_QUEUE.dequeue(event.event, event.id);
                if ($20cd5544df41b9a5$var$isErrorResponseEvent(event)) return recoverCallbacks.reject(new (0, $78157d361a638447$export$4ee5e2a38200b61e)(event.error.type, event.error.message));
                else return recoverCallbacks.resolve(event.data);
            case "privy:wallet:rpc":
                const rpcCallbacks = $20cd5544df41b9a5$var$EVENT_CALLBACK_QUEUE.dequeue(event.event, event.id);
                if ($20cd5544df41b9a5$var$isErrorResponseEvent(event)) return rpcCallbacks.reject(new (0, $78157d361a638447$export$4ee5e2a38200b61e)(event.error.type, event.error.message));
                else return rpcCallbacks.resolve(event.data);
            case "privy:wallet:set-recovery-password":
                const cb = $20cd5544df41b9a5$var$EVENT_CALLBACK_QUEUE.dequeue(event.event, event.id);
                if ($20cd5544df41b9a5$var$isErrorResponseEvent(event)) return cb.reject(new (0, $78157d361a638447$export$4ee5e2a38200b61e)(event.error.type, event.error.message));
                else return cb.resolve(event.data);
        }
    }
    // Ping the iframe once every 150 ms until we receive a pong
    // Then, set the ready flag indicating the proxy is receiving/responding to messages
    //
    // NOTE: it's unlikely we actually reach the `.catch` of the `invoke` method
    // the common case is that these promises are dropped,
    // aka sent to the iframe before the listeners are registered
    // which is why we aren't able to `await` the `invoke` call
    waitForReady() {
        if (this.ready) return Promise.resolve();
        return new Promise(async (resolve, reject)=>{
            while(!this.ready){
                this.invoke("privy:iframe:ready", {}, this._embeddedWalletMessagePoster).then(()=>{
                    this.ready = true;
                    resolve();
                }).catch(reject);
                await $20cd5544df41b9a5$var$sleep(150);
            }
        });
    }
    invoke(event, data, embeddedWalletMessagePoster) {
        const key = $20cd5544df41b9a5$var$serialize(event, data);
        if (event === "privy:wallet:create") {
            const cached = this.cache.get(key);
            if (cached) return cached;
        }
        // This is the promise that is returned to outside callers so they can use async functions.
        const res = new Promise((resolve, reject)=>{
            // Create a unique ID for this event.
            const eventId = $20cd5544df41b9a5$var$uniqueId();
            // Enqueue callbacks for this event associated with the unique id.
            $20cd5544df41b9a5$var$EVENT_CALLBACK_QUEUE.enqueue(eventId, {
                resolve: resolve,
                reject: reject
            });
            // Send the iframe this event. We pass along the unique event id so that when it
            // sends us a response back, we are able to pair it back to the originating request.
            // TODO: Target proper destination: https://github.com/privy-io/react-auth/pull/596
            embeddedWalletMessagePoster.postMessage(JSON.stringify({
                id: eventId,
                event: event,
                data: data
            }), "*");
        }).finally(()=>{
            this.cache.delete(key);
        });
        this.cache.set(key, res);
        return res;
    }
}





class $99761f88b99b6cb6$export$2e2bcd8739ae039 {
    /**
   * @internal
   */ constructor(privyInternal, embeddedWalletMessagePoster, chains){
        /**
   * @internal
   *
   * List of chains passed to the `EmbeddedWalletProvider`. Used to map chain IDs to RPC URLs.
   *
   * `Array.from` removes the `readonly` constraint
   */ this._chains = Array.from((0, $c4dbc45adbe7f814$export$f92d15367ea6b4f7));
        this._privyInternal = privyInternal;
        if (embeddedWalletMessagePoster) this._proxy = new (0, $20cd5544df41b9a5$export$574bb90dcdb39533)(embeddedWalletMessagePoster);
        if (chains) this._chains = chains;
    }
    /**
   * @internal
   */ setMessagePoster(poster) {
        this._proxy = new (0, $20cd5544df41b9a5$export$574bb90dcdb39533)(poster);
    }
    /**
   * Creates an embedded wallet
   *
   * @param password Recovery password for the embedded wallet
   * @returns EmbeddedWalletProvider implementing EIP1193Provider
   */ async create(password, recoveryMethod, recoveryToken) {
        if (!this._proxy) throw new Error("Embedded wallet proxy not initialized");
        let parsedRecoveryMethod;
        if (recoveryMethod) parsedRecoveryMethod = recoveryMethod;
        else parsedRecoveryMethod = password ? "user-passcode" : "privy";
        if (password && typeof password !== "string") throw new Error("Invalid recovery password, must be a string");
        // the embedded_wallet_config.require_user_password_on_create is now awkwardly named (since introducing cloud-service based recovery methods)
        // but it means: automated `privy` recovery method is not allowed - user must specify password or cloud-service recovery
        if (parsedRecoveryMethod === "privy" && this._privyInternal.config?.embedded_wallet_config.require_user_password_on_create) throw new Error("Password not provided yet is required by App configuration");
        const accessToken = await this._privyInternal.getAccessToken();
        if (!accessToken) throw new Error("User must be logged in to create an embedded wallet");
        const { address: address } = await this._proxy.create({
            accessToken: accessToken,
            recoveryMethod: parsedRecoveryMethod,
            recoveryPassword: password,
            recoveryAccessToken: recoveryToken
        });
        if (!address) throw new Error("Failed to create wallet");
        // This is used to ensure that after the user's embedded wallet
        // account is created We refetch the user and get the most up to
        // date version (including the new linked account).
        if (this._privyInternal.callbacks?.setUser) await this._privyInternal.refreshSession();
        return new (0, $a983a2431488eb50$export$26f7ada50d209c97)({
            address: address,
            privyInternal: this._privyInternal,
            chains: this._chains,
            walletProxy: this._proxy
        });
    }
    async hasEmbeddedWallet() {
        const { user: user, token: token } = await this._privyInternal.refreshSession();
        if (!user || !token) throw new Error("User must be logged in to interact with embedded wallets");
        const embeddedWallet = this._getEmbeddedWallet(user);
        return embeddedWallet ? true : false;
    }
    async isPasswordRequired() {
        if (!this._proxy) throw new Error("Embedded wallet proxy not initialized");
        const { user: user, token: token } = await this._privyInternal.refreshSession();
        if (!user || !token) throw new Error("User must be logged in to interact with embedded wallets");
        const embeddedWallet = this._getEmbeddedWallet(user);
        if (!embeddedWallet) return false;
        if (embeddedWallet.recovery_method === "privy") return false;
        try {
            await this._proxy.connect({
                accessToken: token,
                address: embeddedWallet.address
            });
            return false;
        } catch (e) {
            return (0, $78157d361a638447$export$8e5517a02da6043)(e);
        }
    }
    /**
   * Retrieve this users embedded wallet.
   * If the wallet has never been used on this device recover.
   *
   * @param password Recovery password for the embedded wallet
   * @returns EmbeddedWalletProvider implementing EIP1193Provider
   */ async getProvider(wallet, password, recoveryToken) {
        if (!this._proxy) throw new Error("Embedded wallet proxy not initialized");
        const address = await this._load(wallet, password, recoveryToken);
        return new (0, $a983a2431488eb50$export$26f7ada50d209c97)({
            address: address,
            privyInternal: this._privyInternal,
            chains: this._chains,
            walletProxy: this._proxy
        });
    }
    /**
   * Add or change the password used to recover an embedded wallet.
   *
   * @param password New recovery password
   * @param currentPassword Current recovery password used to recover the embedded wallet
   * @returns EmbeddedWalletProvider implementing EIP1193Provider
   */ async setPassword(wallet, password, currentPassword) {
        if (!this._proxy) throw new Error("Embedded wallet proxy not initialized");
        if (wallet.recovery_method !== "privy" && wallet.recovery_method !== "user-passcode") throw new Error("Cannot set password for google-drive recovery method");
        const address = await this._load(wallet, currentPassword);
        const accessToken = await this._privyInternal.getAccessToken();
        if (!accessToken) throw new Error("User must be logged in to interact with embedded wallets");
        await this._proxy.setPassword({
            accessToken: accessToken,
            address: address,
            recoveryPassword: password
        });
        if (this._privyInternal.callbacks?.setUser) // This is used to ensure that after the password is set on an embedded wallet,
        // The user is refetched and updated in downstream UI logic that depends on setUser callback
        await this._privyInternal.refreshSession();
        return new (0, $a983a2431488eb50$export$26f7ada50d209c97)({
            address: address,
            privyInternal: this._privyInternal,
            chains: this._chains,
            walletProxy: this._proxy
        });
    }
    /**
   * @returns URL to load in the embedded wallet iframe
   */ getURL() {
        if (this._privyInternal.caid) return `${this._privyInternal.baseUrl}/apps/${this._privyInternal.appId}/embedded-wallets?caid=${this._privyInternal.caid}`;
        else return `${this._privyInternal.baseUrl}/apps/${this._privyInternal.appId}/embedded-wallets`;
    }
    /**
   * @returns Allows the user to subscribe
   * to the response events from the embedded wallet iframe
   *
   * @example
   * const handler = privy.wallet.getMessageHandler()
   * window.addEventListener('message', handler)
   */ getMessageHandler() {
        if (!this._proxy) throw new Error("Embedded wallet proxy not initialized");
        return this._proxy.handleEmbeddedWalletMessages.bind(this._proxy);
    }
    /**
   * @internal
   *
   * Ping the iframe for a ready response
   */ async ping(timeoutMs) {
        try {
            if (!this._proxy) throw new Error("Embedded wallet proxy not initialized");
            await this._proxy.ping(timeoutMs);
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    }
    /**
   * @internal
   *
   * Attempt to get an embedded wallet with a device share. If no
   * device share is present then recover the wallet.
   * @param password the pin used to encrypt the user's recovery share
   * @returns
   */ async _load(wallet, password, recoveryToken) {
        if (!this._proxy) throw new Error("Embedded wallet proxy not initialized");
        const token = await this._privyInternal.getAccessToken();
        if (!token) throw new Error("User must be logged in to interact with embedded wallets");
        const address = wallet.address;
        try {
            // NOTE: This call no longer throws initially if a device is revoked,
            // since MFA implementation in the iframe. Upstream this means that
            // an RPC request can fail with needs recovery error. Even if this succeeds.
            // Under the hood that failing RPC will clear stale revoked state so future
            // calls to `connect` will fail as expected.
            await this._proxy.connect({
                accessToken: token,
                address: address
            });
            return address;
        } catch (err) {
            // Most likely case is that `connect` failed because we need to recover
            // Otherwise, we propagate the error
            if ((0, $78157d361a638447$export$8e5517a02da6043)(err)) {
                // Pinless wallets can be recovered without a password
                if (wallet.recovery_method === "privy") {
                    const recovered = await this._proxy.recover({
                        accessToken: token,
                        address: address
                    });
                    return recovered.address;
                }
                // Wallets secured by user-passcode require the password to recover
                if (wallet.recovery_method === "user-passcode" && password) {
                    const recovered = await this._proxy.recover({
                        accessToken: token,
                        address: address,
                        recoveryPassword: password
                    });
                    return recovered.address;
                }
                // Wallets secured by google drive require the recovery token to recover
                if (wallet.recovery_method === "google-drive" && recoveryToken) {
                    const recovered = await this._proxy.recover({
                        accessToken: token,
                        address: address,
                        recoveryAccessToken: recoveryToken
                    });
                    return recovered.address;
                }
                // The wallet is not pinless AND we dont have a password to use for recovery
                throw err;
            } else throw err;
        }
    }
    /** @internal */ _getEmbeddedWallet(user) {
        return user?.linked_accounts.find((account)=>account.type === "wallet" && account.connector_type === "embedded" && account.wallet_client_type === "privy");
    }
}






var $af98a8a573bb7c25$exports = {};
$af98a8a573bb7c25$exports = JSON.parse('{"name":"@privy-io/js-sdk-core","version":"0.15.2","description":"Vanilla JS client for the Privy Auth API","keywords":["authentication","authorization","identity","privacy","privy","user data","web3"],"license":"Apache-2.0","source":"./src/index.ts","main":"./dist/index.js","module":"./dist/index.mjs","types":"./dist/index.d.ts","exports":{".":{"require":"./dist/index.js","import":"./dist/index.mjs","types":"./dist/index.d.ts"}},"targets":{"main":{"isLibrary":true,"sourceMap":false},"module":{"isLibrary":true,"sourceMap":false}},"files":["dist/**/*","LICENSE","README.md"],"scripts":{"build":"npx parcel build --no-cache","clean":"rm -rf dist .turbo","dev":"npx parcel watch -p 1234","test":"jest --testMatch \\"**/test/**/*.test.ts\\"","test:watch":"npm run test -- --watch","test:ci":"npm run test","lint":"eslint \\"src/**/*.{ts,tsx,js,jsx}\\" && npx tsc --noEmit","format":"eslint \\"src/**/*.{ts,tsx,js,jsx}\\" --fix"},"devDependencies":{"@privy-io/parcel-config":"*","@privy-io/tsconfig":"*","@simplewebauthn/types":"9.0.1","@tsconfig/node16-strictest-esm":"^1.0.3","@types/jest":"^29.5.11","@types/set-cookie-parser":"^2.4.7","@types/text-encoding":"^0.0.37","msw":"^2.0.13","text-encoding":"^0.7.0","ts-jest":"^29.1.1"},"dependencies":{"@ethersproject/abstract-signer":"^5.7.0","@ethersproject/bignumber":"^5.7.0","@ethersproject/providers":"^5.7.2","@ethersproject/units":"^5.7.0","@privy-io/api-base":"^0.4.6","@privy-io/public-api":"1.11.1","eventemitter3":"^5.0.1","fetch-retry":"^5.0.6","jose":"^4.15.5","js-cookie":"^3.0.5","set-cookie-parser":"^2.6.0","uuid":">=8 <10"},"author":"privy.io","browserslist":["defaults","node >= 18","not op_mini all"],"publishConfig":{"access":"public"}}');


class $c3e99570b7f4dc3f$export$55a617531281a33a extends Error {
    constructor({ error: error, code: code }){
        super(error);
        this.error = error;
        this.code = code;
    }
}
class $c3e99570b7f4dc3f$export$dfe83f5386c4bd02 extends Error {
    constructor({ error: error, code: code }){
        super(error);
        this.code = code;
        this.error = error;
    }
}





class $4c28dd58a3e1b414$export$50792b0e93539fde {
    static parse(token) {
        try {
            return new $4c28dd58a3e1b414$export$50792b0e93539fde(token);
        } catch (error) {
            return null;
        }
    }
    constructor(value){
        this.value = value;
        this._decoded = $bwzhE$jose.decodeJwt(value);
    }
    /**
   * The subject is the user id to which this token is assigned.
   */ get subject() {
        return this._decoded.sub;
    }
    /**
   * The date in seconds since Epoch that this token expires.
   */ get expiration() {
        return this._decoded.exp;
    }
    /**
   * The party that issued the token, which should always be 'privy.io'
   */ get issuer() {
        return this._decoded.iss;
    }
    /**
   * The token audience, which will be the app ID for the customer app.'
   */ get audience() {
        return this._decoded.aud;
    }
    /**
   * Whether or not the token is to be considered expired.
   *
   * @param {number} seconds A number in seconds to reduce the expiration time by. Defaults to 0
   */ isExpired(seconds = 0) {
        const now = Date.now();
        const expiration = (this.expiration - seconds) * 1000;
        return now >= expiration;
    }
}


const $4a5ceffc04a8e7b0$var$TOKEN_STORAGE_KEY = "privy:token";
const $4a5ceffc04a8e7b0$var$TOKEN_COOKIE_KEY = "privy-token";
const $4a5ceffc04a8e7b0$var$REFRESH_TOKEN_STORAGE_KEY = "privy:refresh_token";
const $4a5ceffc04a8e7b0$var$REFRESH_TOKEN_COOKIE_KEY = "privy-refresh-token";
const $4a5ceffc04a8e7b0$var$SESSION_COOKIE_KEY = "privy-session";
const $4a5ceffc04a8e7b0$var$FORKED_TOKEN_STORAGE_KEY = "privy:session_transfer_token";
// By default, a session will be considered unauthenticated
// 30 seconds prior to its token's expiration time. This is
// so we can eagerly re-authenticate before the server would
// reject requests with a 401.
const $4a5ceffc04a8e7b0$var$DEFAULT_EXPIRATION_PADDING_IN_SECONDS = 30;
const $4a5ceffc04a8e7b0$var$events = [
    "storage_cleared",
    "token_cleared",
    "refresh_token_cleared",
    "forked_token_cleared",
    "token_stored",
    "refresh_token_stored"
];
class $4a5ceffc04a8e7b0$export$1fb4852a55678982 extends (0, ($parcel$interopDefault($bwzhE$eventemitter3))) {
    static #_ = this.events = $4a5ceffc04a8e7b0$var$events;
    constructor(o){
        super();
        /** @internal */ this._isUsingServerCookies = false;
        this._storage = o.storage;
    }
    set isUsingServerCookies(isUsingServerCookies) {
        this._isUsingServerCookies = isUsingServerCookies;
    }
    async getToken() {
        const token = await this._storage.get($4a5ceffc04a8e7b0$var$TOKEN_STORAGE_KEY);
        try {
            if (typeof token === "string") // This should throw error if the token is not a JWT
            return new (0, $4c28dd58a3e1b414$export$50792b0e93539fde)(token).value;
            else return null;
        } catch (error) {
            console.error(error);
            await this.destroyLocalState({
                reason: "getToken_error"
            });
            return null;
        }
    }
    async getRefreshToken() {
        try {
            const refreshToken = await this._storage.get($4a5ceffc04a8e7b0$var$REFRESH_TOKEN_STORAGE_KEY);
            return typeof refreshToken === "string" ? refreshToken : null;
        } catch (error) {
            console.error(error);
            await this.destroyLocalState({
                reason: "getRefreshToken_error"
            });
            return null;
        }
    }
    async getForkedToken() {
        try {
            const forkedToken = await this._storage.get($4a5ceffc04a8e7b0$var$FORKED_TOKEN_STORAGE_KEY);
            return typeof forkedToken === "string" ? forkedToken : null;
        } catch (error) {
            console.error(error);
            await this.destroyLocalState({
                reason: "getForkedToken_error"
            });
            return null;
        }
    }
    // Check the non-HTTPOnly server cookie. If present, it's likely that an HTTPOnly server cookie
    // is present, as it is set with the same lifespan as the refresh token and at the same time.
    get mightHaveServerCookies() {
        try {
            const sessionToken = (0, ($parcel$interopDefault($bwzhE$jscookie))).get($4a5ceffc04a8e7b0$var$SESSION_COOKIE_KEY);
            return sessionToken !== undefined && sessionToken.length > 0;
        } catch (error) {
            console.error(error);
        }
        return false;
    }
    /**
   * Checks to see if locally we have refresh credentials. Refresh
   * credentials consist of:
   *
   *     1. Client access token and refresh token
   *     2. Server cookies
   *
   * @returns true if we have what appear to be valid credentials, false otherwise.
   */ hasRefreshCredentials(token, refreshToken) {
        return this.mightHaveServerCookies || typeof token === "string" && typeof refreshToken === "string";
    }
    /**
   * Checks to see if locally we have recovery credentials (forked session token)
   *
   * @returns true if we have what appear to be valid credentials, false otherwise.
   */ async hasRecoveryCredentials() {
        const forkedToken = await this.getForkedToken();
        return typeof forkedToken === "string";
    }
    /**
   * Checks if the session contains a valid token that is not
   * expired or expiring soon.
   *
   * @returns true if token is considered active, false otherwise.
   */ tokenIsActive(tokenRaw) {
        if (!tokenRaw) return false;
        const token = (0, $4c28dd58a3e1b414$export$50792b0e93539fde).parse(tokenRaw);
        return token !== null && !token.isExpired($4a5ceffc04a8e7b0$var$DEFAULT_EXPIRATION_PADDING_IN_SECONDS);
    }
    /**
   * Accepts an optional options object to specify the reason storage is being cleared
   */ async destroyLocalState(opts) {
        if (opts?.reason) this.emit("storage_cleared", {
            reason: opts.reason
        });
        return Promise.all([
            this._storage.del($4a5ceffc04a8e7b0$var$TOKEN_STORAGE_KEY),
            this._storage.del($4a5ceffc04a8e7b0$var$REFRESH_TOKEN_STORAGE_KEY),
            this.clearForkedToken()
        ]);
    }
    async storeToken(token) {
        if (typeof token === "string") {
            const previousToken = await this._storage.get($4a5ceffc04a8e7b0$var$TOKEN_STORAGE_KEY);
            await this._storage.put($4a5ceffc04a8e7b0$var$TOKEN_STORAGE_KEY, token);
            // if the token being stored is new, trigger the storage callback
            if (previousToken !== token) this.emit("token_stored", {
                cookiesEnabled: this._isUsingServerCookies
            });
            if (!this._isUsingServerCookies) {
                const exp = (0, $4c28dd58a3e1b414$export$50792b0e93539fde).parse(token)?.expiration;
                (0, ($parcel$interopDefault($bwzhE$jscookie))).set($4a5ceffc04a8e7b0$var$TOKEN_COOKIE_KEY, token, {
                    sameSite: "Strict",
                    secure: true,
                    expires: exp ? new Date(exp * 1000) : undefined
                });
            }
        } else {
            await this._storage.del($4a5ceffc04a8e7b0$var$TOKEN_STORAGE_KEY);
            this.emit("token_cleared", {
                reason: "set_with_non_string_value"
            });
            (0, ($parcel$interopDefault($bwzhE$jscookie))).remove($4a5ceffc04a8e7b0$var$TOKEN_COOKIE_KEY);
        }
    }
    async storeRefreshToken(refreshToken) {
        if (typeof refreshToken === "string") {
            await this._storage.put($4a5ceffc04a8e7b0$var$REFRESH_TOKEN_STORAGE_KEY, refreshToken);
            this.emit("refresh_token_stored", {
                cookiesEnabled: this._isUsingServerCookies
            });
            if (!this._isUsingServerCookies) {
                (0, ($parcel$interopDefault($bwzhE$jscookie))).set($4a5ceffc04a8e7b0$var$SESSION_COOKIE_KEY, "t", {
                    sameSite: "Strict",
                    secure: true,
                    // Note! This is capped to 7 days on Safari and Brave:
                    // https://github.com/js-cookie/js-cookie/issues/627#issuecomment-626144237
                    expires: 30
                });
                (0, ($parcel$interopDefault($bwzhE$jscookie))).set($4a5ceffc04a8e7b0$var$REFRESH_TOKEN_COOKIE_KEY, refreshToken, {
                    sameSite: "Strict",
                    secure: true,
                    // Note! This is capped to 7 days on Safari and Brave:
                    // https://github.com/js-cookie/js-cookie/issues/627#issuecomment-626144237
                    expires: 30
                });
            }
        } else {
            await this._storage.del($4a5ceffc04a8e7b0$var$REFRESH_TOKEN_STORAGE_KEY);
            this.emit("refresh_token_cleared", {
                reason: "set_with_non_string_value"
            });
            (0, ($parcel$interopDefault($bwzhE$jscookie))).remove($4a5ceffc04a8e7b0$var$REFRESH_TOKEN_COOKIE_KEY);
            (0, ($parcel$interopDefault($bwzhE$jscookie))).remove($4a5ceffc04a8e7b0$var$SESSION_COOKIE_KEY);
        }
    }
    async clearForkedToken() {
        await this._storage.del($4a5ceffc04a8e7b0$var$FORKED_TOKEN_STORAGE_KEY);
    }
}


/**
 * Patch for AbortSignal.timeout since it is not supported in iOS Safari < 16
 * Adapted from: https://github.com/mo/abortcontroller-polyfill/issues/73#issuecomment-1541180943
 */ const $6e80017c879d5d9d$var$toAbortSignalTimeout = (duration)=>{
    const controller = new AbortController();
    setTimeout(()=>controller.abort(), duration);
    return controller.signal;
};
var $6e80017c879d5d9d$export$2e2bcd8739ae039 = $6e80017c879d5d9d$var$toAbortSignalTimeout;



function $6cf677c8f51ab5b0$export$cf2a37f713bfda4b(headers) {
    const setCookieHeaderValue = headers.get("set-cookie");
    if (!setCookieHeaderValue) return {};
    return (0, $bwzhE$setcookieparser.parse)((0, $bwzhE$setcookieparser.splitCookiesString)(setCookieHeaderValue)).reduce((res, { name: name, value: value, httpOnly: httpOnly })=>httpOnly ? {
            ...res,
            [name]: value
        } : res, {});
}


const $5945f4703f62befa$var$DEFAULT_PRIVY_API_URL = "https://auth.privy.io";
const $5945f4703f62befa$var$CLIENT_ANALYTICS_ID_KEY = "privy:caid";
class $5945f4703f62befa$export$9e80c3751b841788 {
    /**
   * Constructor for PrivyInternal class
   * @param {PrivyInternalOptions} o - options for PrivyInternal
   * @property {Storage} o.storage - The storage instance to be used
   * @property {string} o.appId - The application ID
   * @property {string} o.baseUrl - The base URL for the application
   */ constructor(o){
        this._logLevel = "ERROR";
        /** Should get overriden by wrapping libraries */ this._sdkVersion = `js-sdk-core:${0, $af98a8a573bb7c25$exports.version}`;
        /**
   * Prevents multiple calls in short succession from being made to the session endpoint,
   * As this results in re-using a refresh_token which invalidates the ongoing session
   */ this._cache = new Map();
        if (o.logLevel) this._logLevel = o.logLevel;
        // The call below to _getOrGenerateClientAnalyticsId accesses storage so prepare it first
        this._storage = o.storage;
        // Sets this.__clientId (for analytics) early
        this._clientId = null;
        this._getOrGenerateClientAnalyticsId();
        this.baseUrl = o.baseUrl ?? $5945f4703f62befa$var$DEFAULT_PRIVY_API_URL;
        this.appId = o.appId;
        this._sdkVersion = o.sdkVersion ?? this._sdkVersion;
        this.callbacks = o.callbacks;
        // If the sdk is being used in a non-browser environment,
        // (native mobile app), the application identifier must be manually specified
        // when creating the privy client, otherwise outgoing requests will be rejected
        if (typeof document === "undefined") this.nativeAppIdentifier = o.nativeAppIdentifier;
        this.session = new (0, $4a5ceffc04a8e7b0$export$1fb4852a55678982)({
            storage: this._storage,
            isUsingServerCookies: false
        });
        this._fetch = (0, ($parcel$interopDefault($bwzhE$fetchretry)))(fetch, {
            retries: 3,
            retryDelay: 500
        });
        if (this._logLevel === "DEBUG") (0, $4a5ceffc04a8e7b0$export$1fb4852a55678982).events.forEach((name)=>{
            this.session.on(name, (opts)=>this.createAnalyticsEvent(name, opts));
        });
    }
    /**
   * Getter for isReady state
   *
   * Returns true if the configuration is defined, false otherwise
   */ get isReady() {
        return Boolean(this._config);
    }
    /**
   * Getter for config state
   */ get config() {
        return this._config;
    }
    /**
   * Getter for client analytics Id
   *
   * Because this ID is generated async, we can't guarantee that it isn't null.
   * Functionally though, it should rarely actually be null as we attempt to
   * initialize it in our constructor.
   */ get caid() {
        return this._clientId;
    }
    /**
   * Initialize the PrivyInternal instance
   * This method fetches the application configuration and sets up the base URL
   * It also triggers the creation of an analytics event for SDK initialization
   */ async _initialize() {
        if (this.isReady) return;
        this._config = await this.getAppConfig();
        this.callbacks?.setIsReady?.(true);
        if (this._config?.custom_api_url) {
            this.baseUrl = this._config.custom_api_url;
            this.session.isUsingServerCookies = true;
        }
        this.createAnalyticsEvent("sdk_initialize", {});
    }
    /**
   * Strongly typed fetch, takes a `Route` and determines body and path parameter types
   */ async fetch(r, { body: body, params: params = {}, options: options = {
        onRequest: this._beforeRequest.bind(this)
    } }) {
        const request = new Request(`${this.baseUrl}${r.constructPath({
            params: params
        })}`, {
            method: r.method,
            body: JSON.stringify(body)
        });
        const requestInit = await options.onRequest(request);
        const res = await this._fetch(request, requestInit);
        if (res.status !== r.expectedStatusCode) {
            console.warn(`Privy: Expected status code ${r.expectedStatusCode}, received ${res.status}`);
            const errorBody = await res.json();
            throw new (0, $c3e99570b7f4dc3f$export$55a617531281a33a)(errorBody);
        }
        const parsedResponse = await res.json();
        if (typeof document !== "undefined" || !this.nativeAppIdentifier) // everything below is to handle httpOnly cookies when running on react-native
        // so return the result as-is if running in a browser environment
        return parsedResponse;
        const { ["privy-token"]: httpOnlyToken, ["privy-refresh-token"]: httpOnlyRefreshToken } = (0, $6cf677c8f51ab5b0$export$cf2a37f713bfda4b)(res.headers);
        if (httpOnlyToken) parsedResponse.token = httpOnlyToken;
        if (httpOnlyRefreshToken) parsedResponse.refresh_token = httpOnlyRefreshToken;
        return parsedResponse;
    }
    /**
   * **Middleware for requests that do not require a fully initialized client.**
   *
   * This method sets the headers, a timeout, and other default options for
   * fetch requests. Example endpoints include `/api/v1/apps/[app_id]` (get app config).
   *
   * @param {Request} request - The request object
   */ async _beforeRequestWithoutInitialize(request) {
        const token = await this.session.getToken();
        const headers = new Headers(request.headers);
        headers.set("privy-app-id", this.appId);
        headers.set("privy-client", this._sdkVersion);
        headers.set("Authorization", `Bearer ${token}`);
        headers.set("Content-Type", "application/json");
        headers.set("Accept", "application/json");
        const caid = await this._getOrGenerateClientAnalyticsId();
        if (caid) headers.set("privy-ca-id", caid);
        if (this.nativeAppIdentifier) headers.set("x-native-app-identifier", this.nativeAppIdentifier);
        return {
            // 20 second tmeout on all requests, same as react-auth
            signal: (0, $6e80017c879d5d9d$export$2e2bcd8739ae039)(20000),
            headers: headers,
            credentials: "include"
        };
    }
    /**
   * **Middleware for requests that do not require a refreshed access token.**
   *
   * This method first ensures the client is initialized, then sets the headers,
   * a timeout, and other default options for fetch requests.
   *
   * Example endpoints include `/api/v1/session` (refreshSession).
   *
   * @param {Request} request - The request object
   */ async beforeRequestWithoutRefresh(request) {
        // Ensure we have initialized the client
        await this._initialize();
        return this._beforeRequestWithoutInitialize(request);
    }
    /**
   * **You should not need to call this method directly.**
   *
   * This is the default request middleware. This method initializes the
   * PrivyInternal instance and refreshes the session if necessary. It then
   * calls the `beforeRequestWithoutRefresh` method to set headers.
   *
   * @param {Request} request - The request object
   */ async _beforeRequest(request) {
        // Ensure we have initialized the client, should come before `getAccessToken`
        await this._initialize();
        // Ensure we refresh our session token if we need to
        await this.getAccessToken();
        return this.beforeRequestWithoutRefresh(request);
    }
    /**
   * Get app config
   * This method fetches the application configuration from the server
   *
   * Returns a promise that resolves to the application configuration
   */ async getAppConfig() {
        return await this.fetch((0, $bwzhE$privyiopublicapi.getAppConfig), {
            params: {
                app_id: this.appId
            },
            options: {
                onRequest: this._beforeRequestWithoutInitialize.bind(this)
            }
        });
    }
    // Get a unique ID for this client instance, used to tag analytics events
    // If the client analytics ID is not set, generate a new one and store it
    // in storage if possible.
    async _getOrGenerateClientAnalyticsId() {
        if (this._clientId) return this._clientId;
        try {
            const clientAnalyticsId = await this._storage.get($5945f4703f62befa$var$CLIENT_ANALYTICS_ID_KEY);
            if (typeof clientAnalyticsId === "string" && clientAnalyticsId.length > 0) {
                this._clientId = clientAnalyticsId;
                return clientAnalyticsId;
            }
        } catch (e) {
            console.error("Unable to load clientId", e);
        }
        try {
            this._clientId = (0, $bwzhE$uuid.v4)();
        } catch (e) {
            console.error("Unable to generate uuidv4", e);
        }
        if (!this._clientId) return null;
        try {
            await this._storage.put($5945f4703f62befa$var$CLIENT_ANALYTICS_ID_KEY, this._clientId);
        } catch (e) {
            console.error(`Unable to store clientId: ${this._clientId}`, e);
        }
        return this._clientId;
    }
    /**
   * Create analytics event
   * This method creates an analytics event with the given name and properties
   * @param {string} name - The name of the event
   * @param {object} properties - The properties of the event
   *
   * Returns a promise that resolves to the response of the analytics event creation
   */ async createAnalyticsEvent(name, properties) {
        try {
            await this.fetch((0, $bwzhE$privyiopublicapi.recordAnalyticsEvent), {
                body: {
                    event_name: name,
                    client_id: await this._getOrGenerateClientAnalyticsId(),
                    payload: properties
                },
                options: {
                    onRequest: this.beforeRequestWithoutRefresh.bind(this)
                }
            });
        } catch (e) {
        // Explicitly swallow errors here
        }
    }
    /**
   * Refresh the session
   * This method refreshes the session by sending a request to the server
   *
   * Returns a promise that resolves to the response of the session refresh
   */ async refreshSession() {
        const refreshToken = await this.session.getRefreshToken() ?? undefined;
        // Use the refresh token as the cache key, if there is no stored token
        // (i.e. the current app is using cookies) then we use a hardcoded cache key.
        const key = refreshToken ?? "key";
        const cached = this._cache.get(key);
        if (cached) return await cached;
        const promise = this._refreshSession(refreshToken);
        this._cache.set(key, promise);
        try {
            return await promise;
        } catch (e) {
            throw e;
        } finally{
            this._cache.delete(key);
        }
    }
    /**
   * Private internals of refresh session. Allows us to cache the request higher up
   * the callstack while separating the actual refresh logic.
   */ async _refreshSession(refreshToken) {
        /**
     * Higher level Privy SDKs will call refresh without knowing whether or not there
     * are currently refresh credentials stored. This check prevents unneccessary requests
     * to the API and throws an error simulating a 400/logged-out view. Because we depend on
     * the request/fetch call to run our fetch middleware and call initialize, we will
     * explicitly call and await that here before we throw the error in order to ensure that
     * it get's called early.
     *
     * NOTE: this._initialize() could be called elsewhere, such as at the end of the constructor
     * but it becomes much harder to synchronize and we run into duplicate requests.
     */ const token = await this.session.getToken();
        if (!this.session.hasRefreshCredentials(token, refreshToken ?? null)) {
            await this._initialize();
            throw new Error("missing_or_invalid_token");
        }
        try {
            const { session_update_action: session_update_action, ...res } = await this.fetch((0, $bwzhE$privyiopublicapi.refreshSession), {
                body: {
                    refresh_token: refreshToken
                },
                options: {
                    onRequest: this.beforeRequestWithoutRefresh.bind(this)
                }
            });
            if (session_update_action === "set") await Promise.all([
                this.session.storeToken(res.token),
                this.session.storeRefreshToken(res.refresh_token)
            ]);
            if (session_update_action === "clear") await Promise.all([
                this.session.destroyLocalState(),
                this._logLevel === "DEBUG" ? this.createAnalyticsEvent("storage_cleared", {
                    reason: "session_update_action: clear"
                }) : Promise.resolve()
            ]);
            // In the case of ignore, we may still be in a state where localStorage is not yet set. In
            // order to self-heal, if the token is present and non-empty, we attempt to store it - the
            // underlying storeToken will only update if it has changed.
            if (session_update_action === "ignore" && res.token) await this.session.storeToken(res.token);
            this.callbacks?.setUser?.(res.user);
            return res;
        } catch (error) {
            if (error instanceof (0, $c3e99570b7f4dc3f$export$55a617531281a33a) && error.code === (0, $bwzhE$privyioapibase.PrivyErrorCode).MISSING_OR_INVALID_TOKEN) {
                // If session cannot be refreshed with current refreshToken, clear local auth state
                // otherwise this will result in a loop that is only escapable by clearing storage in userland
                await Promise.all([
                    this.session.destroyLocalState(),
                    this._logLevel === "DEBUG" ? this.createAnalyticsEvent("storage_cleared", {
                        reason: error.code
                    }) : Promise.resolve()
                ]);
                this.callbacks?.setUser?.(null);
            } else if (error instanceof Error && error.message === "missing_or_invalid_token") {
                // Handle when this error is throw explicitly above
                await Promise.all([
                    this.session.destroyLocalState(),
                    this._logLevel === "DEBUG" ? this.createAnalyticsEvent("storage_cleared", {
                        reason: error.message
                    }) : Promise.resolve()
                ]);
                this.callbacks?.setUser?.(null);
            }
            throw error;
        }
    }
    async getAccessToken() {
        const [token, refreshToken] = await Promise.all([
            this.session.getToken(),
            this.session.getRefreshToken()
        ]);
        if (!this.session.tokenIsActive(token) && this.session.hasRefreshCredentials(token, refreshToken)) try {
            const { token: token } = await this.refreshSession();
            return token;
        } catch (error) {
            return null;
        }
        return token;
    }
}




/** This module is a port of the PKCE implementation in react-auth */ 
const $7eca82e1ac601538$var$DEFAULT_CODE_CHALLENGE_METHOD = "S256";
const $7eca82e1ac601538$var$S256_CODE_CHALLENGE_METHOD = "S256";
async function $7eca82e1ac601538$export$f955f8b46bc09916(message, digest) {
    const data = new TextEncoder().encode(message);
    const hash = await digest("SHA-256", data);
    return new Uint8Array(hash);
}
function $7eca82e1ac601538$export$5f828d93ff035aa8(size) {
    return crypto.getRandomValues(new Uint8Array(size));
}
function $7eca82e1ac601538$export$4b3e330be6cd671d() {
    // As specified here: https://datatracker.ietf.org/doc/html/rfc7636#section-4.1
    // code_verifier = high-entropy cryptographic random STRING using the unreserved characters [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
    // [...] with a minimum length of 43 characters and a maximum length of 128 characters.
    //
    // 32 bytes gets us 256 bits, which results in 43 characters (6 bits per base64 character)
    // This is what is recommended in the spec.
    // In sanitizeCodeVerifier, we replace the base64 characters that are not allowed per the PKCE spec (above) for ones that are
    return (0, $bwzhE$jose.base64url).encode($7eca82e1ac601538$export$5f828d93ff035aa8(36));
}
function $7eca82e1ac601538$export$eaf16c02ca227468() {
    // For now, we are only using state_code to make sure we are communicating with the same server
    // throughout the auth process (not to store any state), so we can use the same implementation of random string
    // generation that we use for the code_verifier.
    return $7eca82e1ac601538$export$4b3e330be6cd671d();
}
async function $7eca82e1ac601538$export$31f3d2c0aef14fc1({ codeVerifier: codeVerifier, method: method = $7eca82e1ac601538$var$DEFAULT_CODE_CHALLENGE_METHOD, digest: digest = crypto.subtle.digest }) {
    if (method == $7eca82e1ac601538$var$S256_CODE_CHALLENGE_METHOD) {
        // This is the happy and most likely path.  As of 12/13/23 we only support S256 and I don't see that changing any time soon
        const hashBuffer = await $7eca82e1ac601538$export$f955f8b46bc09916(codeVerifier, digest);
        return (0, $bwzhE$jose.base64url).encode(hashBuffer);
    } else // The only other supported method I've seen is plain, which does not have any translation, so we'll just return here
    // This should really never happen, since we only support S256
    // We do not support plain, but we'll be able to detect failure on the API side so there is no point failing loudly on the client
    return codeVerifier;
}


const $18b2ddc407ff778b$export$71f689623592ddcf = "privy:state_code";
const $18b2ddc407ff778b$export$317c4f00f26b42e2 = "privy:code_verifier";
class $18b2ddc407ff778b$export$2e2bcd8739ae039 {
    /**
   * @internal
   */ constructor(privyInternal, storage, crypto){
        this._privyInternal = privyInternal;
        this._storage = storage;
        this._crypto = crypto;
    }
    /**
   * Starts a Recovery OAuth flow with a specific provider
   *
   * @param provider The OAuth provider
   * @param redirectURI The URL to redirect to after a successful OAuth flow
   */ async generateURL(redirectURI) {
        const codeVerifier = (0, $7eca82e1ac601538$export$4b3e330be6cd671d)();
        const stateCode = (0, $7eca82e1ac601538$export$eaf16c02ca227468)();
        const codeChallenge = await (0, $7eca82e1ac601538$export$31f3d2c0aef14fc1)({
            codeVerifier: codeVerifier,
            digest: this._crypto?.digest
        });
        await Promise.all([
            this._storage.put($18b2ddc407ff778b$export$317c4f00f26b42e2, codeVerifier),
            this._storage.put($18b2ddc407ff778b$export$71f689623592ddcf, stateCode)
        ]);
        return this._privyInternal.fetch((0, $bwzhE$privyiopublicapi.initOAuthRecovery), {
            body: {
                redirect_to: redirectURI,
                code_challenge: codeChallenge,
                state_code: stateCode
            }
        });
    }
    /**
   * Completes the recovery OAuth login flow for user
   *
   * @param authorizationCode The code generated by the authorization server
   * @param returnedStateCode The state value initially set in the request by Privy to the authorization server
   */ async authorize(authorizationCode, returnedStateCode) {
        const [codeVerifier, storedStateCode] = await Promise.all([
            this._storage.get($18b2ddc407ff778b$export$317c4f00f26b42e2),
            this._storage.get($18b2ddc407ff778b$export$71f689623592ddcf)
        ]);
        if (storedStateCode !== returnedStateCode) {
            // Create an AnalyticsEvent for this so we can have some visibility.
            this._privyInternal.createAnalyticsEvent("possible_phishing_attempt", {
                flow: "recovery_oauth",
                storedStateCode: storedStateCode ?? "",
                returnedStateCode: returnedStateCode ?? ""
            });
            throw new (0, $c3e99570b7f4dc3f$export$dfe83f5386c4bd02)({
                code: "pkce_state_code_mismatch",
                error: "Unexpected auth flow. This may be a phishing attempt."
            });
        }
        const res = await this._privyInternal.fetch((0, $bwzhE$privyiopublicapi.authenticateOauthRecovery), {
            body: {
                authorization_code: authorizationCode,
                state_code: storedStateCode,
                code_verifier: codeVerifier
            }
        });
        await Promise.all([
            this._storage.del($18b2ddc407ff778b$export$317c4f00f26b42e2),
            this._storage.del($18b2ddc407ff778b$export$71f689623592ddcf)
        ]);
        return res;
    }
}


class $e0de4032a49d46b3$export$2e2bcd8739ae039 {
    /** @internal */ constructor(privyInternal, storage, crypto){
        this._privyInternal = privyInternal;
        this.auth = new (0, $18b2ddc407ff778b$export$2e2bcd8739ae039)(this._privyInternal, storage, crypto);
    }
}


class $121751b77c00c530$export$2e2bcd8739ae039 {
    /**
   * @internal
   */ constructor(privyInternal){
        this._privyInternal = privyInternal;
    }
    /**
   * Get the logged in user.
   */ async get() {
        try {
            const { user: user } = await this._privyInternal.refreshSession();
            return {
                user: user
            };
        } catch (e) {
            throw e;
        }
    }
}


class $2af0542ababa71ac$export$2e2bcd8739ae039 {
    /** Create a new `Privy` Client */ constructor(o){
        this._privyInternal = new (0, $5945f4703f62befa$export$9e80c3751b841788)(o);
        this.user = new (0, $121751b77c00c530$export$2e2bcd8739ae039)(this._privyInternal);
        this.auth = new (0, $98111b9dfa4b03f7$export$2e2bcd8739ae039)(this._privyInternal);
        this.embeddedWallet = new (0, $99761f88b99b6cb6$export$2e2bcd8739ae039)(this._privyInternal, o.embeddedWalletMessagePoster, o.supportedChains);
        this.recovery = new (0, $e0de4032a49d46b3$export$2e2bcd8739ae039)(this._privyInternal, o.storage, o.crypto);
    }
    setMessagePoster(poster) {
        this.embeddedWallet.setMessagePoster(poster);
    }
    getAccessToken() {
        return this._privyInternal.getAccessToken();
    }
}


class $0272941682c7469a$export$19fffca37ef3e106 {
    async get(key) {
        const val = localStorage.getItem(key);
        return val === null ? undefined : JSON.parse(val);
    }
    put(key, val) {
        if (val !== undefined) localStorage.setItem(key, JSON.stringify(val));
        else this.del(key);
    }
    del(key) {
        localStorage.removeItem(key);
    }
    getKeys() {
        return Object.entries(localStorage).map(([key])=>key);
    }
}


class $bd1b2bb0e0f7eac2$export$467265324939f47f {
    get(key) {
        return this._cache[key];
    }
    put(key, val) {
        if (val !== undefined) this._cache[key] = val;
        else this.del(key);
    }
    del(key) {
        delete this._cache[key];
    }
    getKeys() {
        return Object.keys(this._cache);
    }
    constructor(){
        this._cache = {};
    }
}




const $e9d6bfa9ea62d5d1$export$8483e4c9b261aeda = (user)=>{
    if (!user) return null;
    const wallet = user.linked_accounts.find((account)=>account.type === "wallet" && account.wallet_client_type === "privy" && account.connector_type === "embedded");
    return wallet ? wallet : null;
};



var $bddf10e9b41f04d0$exports = {};

$parcel$export($bddf10e9b41f04d0$exports, "ALL_WALLET_CLIENT_TYPES", function () { return $bddf10e9b41f04d0$export$59db14277d48cc12; });
$parcel$export($bddf10e9b41f04d0$exports, "SUPPORTED_CONNECTOR_TYPES", function () { return $bddf10e9b41f04d0$export$2479c2f610d9796a; });
const $bddf10e9b41f04d0$var$EMBEDDED_WALLET_CLIENT_TYPES = [
    "privy"
];
const $bddf10e9b41f04d0$var$INJECTED_WALLET_CLIENT_TYPES = [
    "metamask",
    "phantom",
    "brave_wallet",
    "rainbow"
];
const $bddf10e9b41f04d0$var$COINBASE_WALLET_CLIENT_TYPES = [
    "coinbase_wallet"
];
/** @internal
 *
 * How this works:
 *
 * The raw data is pulled from https://registry.walletconnect.com/api/v3/wallets
 * Some post-processing is done using the following script.
 *
 * const axios = require('axios');
 * const walletTypes = [];
 * axios.get("https://explorer-api.walletconnect.com/v3/wallets?projectId=2f05ae7f1116030fde2d36508f472bfb&entries=400&page=1&version=2&chains=eip155%3A1").then((apiResult) => {
 *   Object.values(apiResult.data.listings).forEach((walletEntry) => {
 *     if (!walletEntry.mobile.native || !walletEntry.mobile.universal) return;
 *     if (!walletEntry.chains.includes('eip155:1')) return;
 *     if (!walletEntry.metadata.shortName) return;
 *     // Manually removed for cleanliness
 *     if (walletEntry.id === 'b2ce31fb31735fa886270806340de999f72342a7c29484badd8d4d013d77c8b8') return;
 *     if (walletEntry.id) walletTypes.push(`'${walletEntry.id}'`);
 *   });
 *   console.log(walletTypes.join("\n  | "));
 * });
 */ const $bddf10e9b41f04d0$var$WALLET_CONNECT_WALLET_CLIENT_TYPES = [
    "metamask",
    "trust",
    "safe",
    "rainbow",
    "uniswap",
    "zerion",
    "argent",
    "spot",
    "omni",
    "cryptocom",
    "blockchain",
    "safepal",
    "bitkeep",
    "zengo",
    "1inch",
    "binance",
    "exodus",
    "mew_wallet",
    "alphawallet",
    "keyring_pro",
    "mathwallet",
    "unstoppable",
    "obvious",
    "ambire",
    "internet_money_wallet",
    "coin98",
    "abc_wallet",
    "arculus_wallet",
    "haha",
    "cling_wallet",
    "broearn",
    "copiosa",
    "burrito_wallet",
    "enjin_wallet",
    "plasma_wallet",
    "avacus",
    "bee",
    "pitaka",
    "pltwallet",
    "minerva",
    "kryptogo",
    "prema",
    "slingshot",
    "kriptonio",
    "timeless",
    "secux",
    "bitizen",
    "blocto",
    "safemoon"
];
const $bddf10e9b41f04d0$var$UNKNOWN_WALLET_CLIENT_TYPES = [
    "unknown"
];
const $bddf10e9b41f04d0$export$59db14277d48cc12 = [
    ...$bddf10e9b41f04d0$var$INJECTED_WALLET_CLIENT_TYPES,
    ...$bddf10e9b41f04d0$var$COINBASE_WALLET_CLIENT_TYPES,
    ...$bddf10e9b41f04d0$var$WALLET_CONNECT_WALLET_CLIENT_TYPES,
    ...$bddf10e9b41f04d0$var$EMBEDDED_WALLET_CLIENT_TYPES,
    ...$bddf10e9b41f04d0$var$UNKNOWN_WALLET_CLIENT_TYPES
];
const $bddf10e9b41f04d0$export$2479c2f610d9796a = [
    "injected",
    "wallet_connect",
    "wallet_connect_v2",
    "coinbase_wallet",
    "embedded"
];



var $af690e564931f5d7$export$2e2bcd8739ae039 = (0, $2af0542ababa71ac$export$2e2bcd8739ae039);
$parcel$exportWildcard(module.exports, $bddf10e9b41f04d0$exports);
$parcel$exportWildcard(module.exports, $c4dbc45adbe7f814$exports);


