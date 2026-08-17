/**
 * Mobile wallet **connect** deep links (encrypted universal-link protocol).
 *
 * Why this file exists: a plain link to `phantom.app` / `phantom.com/download`
 * or even `…/ul/browse/<url>` is NOT the connect protocol — on many devices the
 * OS resolves it to Phantom's marketing site instead of opening the installed
 * app. The registered universal link that Phantom (and Solflare, which mirrors
 * the same scheme) actually intercepts is:
 *
 *   https://phantom.app/ul/v1/connect
 *     ?dapp_encryption_public_key=<base58 x25519 pubkey>
 *     &cluster=mainnet-beta
 *     &app_url=<url-encoded https origin>
 *     &redirect_link=<url-encoded return url>
 *
 * The wallet approves in-app, then redirects back to `redirect_link` with
 * `phantom_encryption_public_key`, `nonce` and `data` (an encrypted
 * `{ public_key, session }` payload) which we decrypt with the ephemeral
 * keypair persisted in sessionStorage.
 *
 * Docs: docs.phantom.app/phantom-deeplinks-ios-and-android,
 * docs.solflare.com (deeplinks), docs.backpack.app (browse links only).
 */

import bs58 from "bs58";
import nacl from "tweetnacl";

export type DeepLinkWallet = "phantom" | "solflare";

const SECRET_KEY = "soliq.dl.secret";
const WALLET_KEY = "soliq.dl.wallet";
const SESSION_KEY = "soliq.dl.session";

const origin = () => (typeof window === "undefined" ? "https://soliqintel.com" : window.location.origin);

/** Ephemeral x25519 keypair for the connect handshake, stable across the redirect. */
function dappKeypair(fresh = false): nacl.BoxKeyPair {
  if (!fresh) {
    const stored = window.sessionStorage.getItem(SECRET_KEY);
    if (stored) {
      try {
        return nacl.box.keyPair.fromSecretKey(bs58.decode(stored));
      } catch {
        /* regenerate below */
      }
    }
  }
  const kp = nacl.box.keyPair();
  window.sessionStorage.setItem(SECRET_KEY, bs58.encode(kp.secretKey));
  return kp;
}

const BASES: Record<DeepLinkWallet, string> = {
  phantom: "https://phantom.app/ul/v1",
  solflare: "https://solflare.com/ul/v1",
};

/**
 * Universal link that opens the *installed* wallet app straight on its connect
 * approval screen. Falls back to the wallet's site only if the app is absent.
 */
export function buildConnectLink(wallet: DeepLinkWallet, cluster = "mainnet-beta"): string {
  const kp = dappKeypair(true);
  window.sessionStorage.setItem(WALLET_KEY, wallet);

  // Return to the page the user started from, flagged so we know to decrypt.
  const redirect = new URL(window.location.href);
  redirect.searchParams.set("wlink", wallet);

  const params = new URLSearchParams({
    dapp_encryption_public_key: bs58.encode(kp.publicKey),
    cluster,
    app_url: origin(),
    redirect_link: redirect.toString(),
  });
  return `${BASES[wallet]}/connect?${params.toString()}`;
}

/** Backpack has no encrypted connect protocol — its universal link is browse-only. */
export function backpackBrowseLink(url = typeof window === "undefined" ? origin() : window.location.href): string {
  return `https://backpack.app/ul/v1/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(origin())}`;
}

export type DeepLinkConnectResult = {
  wallet: DeepLinkWallet;
  address: string;
  session: string;
};

/**
 * Decrypt a wallet's connect response from the current URL. Returns null when
 * the URL isn't a connect return. Always strips the wallet params afterwards so
 * a reload can't replay them.
 */
export function readConnectReturn(): DeepLinkConnectResult | { error: string } | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const q = url.searchParams;
  const wallet = (q.get("wlink") ?? window.sessionStorage.getItem(WALLET_KEY)) as DeepLinkWallet | null;
  const walletPub = q.get("phantom_encryption_public_key") ?? q.get("solflare_encryption_public_key");
  const nonce = q.get("nonce");
  const data = q.get("data");
  const errorCode = q.get("errorCode");
  const errorMessage = q.get("errorMessage");

  const clean = () => {
    [
      "wlink",
      "phantom_encryption_public_key",
      "solflare_encryption_public_key",
      "nonce",
      "data",
      "errorCode",
      "errorMessage",
    ].forEach((k) => q.delete(k));
    window.history.replaceState({}, "", `${url.pathname}${q.toString() ? `?${q}` : ""}${url.hash}`);
  };

  if (errorCode || errorMessage) {
    clean();
    return { error: errorMessage ?? `Wallet returned error ${errorCode}` };
  }
  if (!wallet || !walletPub || !nonce || !data) return null;

  try {
    const kp = dappKeypair();
    const shared = nacl.box.before(bs58.decode(walletPub), kp.secretKey);
    const opened = nacl.box.open.after(bs58.decode(data), bs58.decode(nonce), shared);
    if (!opened) throw new Error("decrypt-failed");
    const payload = JSON.parse(new TextDecoder().decode(opened)) as { public_key: string; session: string };
    window.sessionStorage.setItem(SESSION_KEY, payload.session);
    clean();
    return { wallet, address: payload.public_key, session: payload.session };
  } catch {
    clean();
    return { error: "Could not verify the wallet's response. Please try connecting again." };
  }
}
