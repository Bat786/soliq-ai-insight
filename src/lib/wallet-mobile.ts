/**
 * Mobile wallet connection helpers.
 *
 * Root cause this module exists for: regular mobile browsers (Chrome / Safari
 * on iOS and Android) have NO injected wallet provider — `window.solana` and
 * `window.ethereum` simply do not exist, because extensions are a desktop-only
 * concept. Wallet-standard detection therefore correctly finds nothing and the
 * adapters fall back to an "install wallet" redirect, which looks like a bug to
 * the user (see anza-xyz/wallet-adapter issues #319, #385, #1111).
 *
 * The fix is deep-linking: bounce the user into the wallet app's own in-app
 * browser (which DOES inject a provider) via the vendor's universal link, or
 * pair over WalletConnect's mobile linking on the EVM side.
 */

/** True in a mobile browser (phone or tablet), including iPadOS desktop-mode Safari. */
export function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/android|iphone|ipad|ipod|windows phone/i.test(ua)) return true;
  // iPadOS 13+ reports a macOS UA but exposes touch points.
  return /macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1;
}

export function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (/macintosh/i.test(navigator.userAgent) && (navigator.maxTouchPoints ?? 0) > 1);
}

type WalletWindow = Window & {
  solana?: { isPhantom?: boolean };
  phantom?: { solana?: unknown };
  solflare?: unknown;
  ethereum?: { isMetaMask?: boolean };
};

/** Are we already running inside a wallet app's in-app browser? */
export function isInWalletBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as WalletWindow;
  const ua = navigator.userAgent;
  return Boolean(
    w.phantom?.solana ||
      w.solana ||
      w.solflare ||
      w.ethereum ||
      /Phantom|Solflare|MetaMask|Backpack|Trust|Coinbase/i.test(ua),
  );
}

export function hasInjectedSolana(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as WalletWindow;
  return Boolean(w.phantom?.solana || w.solana || w.solflare);
}

export function hasInjectedEvm(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as WalletWindow).ethereum);
}

/**
 * A mobile browser with no wallet provider — the exact state where plain
 * adapter detection produces the "install page" dead end.
 */
export function needsSolanaDeepLink(): boolean {
  return isMobileBrowser() && !hasInjectedSolana();
}

export function needsEvmDeepLink(): boolean {
  return isMobileBrowser() && !hasInjectedEvm();
}

const currentUrl = () => (typeof window === "undefined" ? "https://soliqintel.com" : window.location.href);
const currentOrigin = () => (typeof window === "undefined" ? "https://soliqintel.com" : window.location.origin);

/**
 * Phantom universal link — `https://phantom.app/ul/browse/<url>?ref=<origin>`.
 * Opens SOLIQ inside Phantom's in-app browser, where `window.phantom.solana`
 * exists and the normal adapter connect flow works unchanged.
 * https://docs.phantom.app/solana/integrating-phantom/deeplinks-ios-and-android
 */
export function phantomBrowseLink(url = currentUrl()): string {
  return `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(currentOrigin())}`;
}

/** Solflare's equivalent universal link. */
export function solflareBrowseLink(url = currentUrl()): string {
  return `https://solflare.com/ul/v1/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(currentOrigin())}`;
}

/**
 * MetaMask deep link — `https://metamask.app.link/dapp/<host+path>`.
 * Opens SOLIQ in MetaMask's in-app browser when the app is installed, and
 * falls through to the App Store / Play Store listing when it is not.
 */
export function metamaskDappLink(url = currentUrl()): string {
  return `https://metamask.app.link/dapp/${url.replace(/^https?:\/\//, "")}`;
}

/** Navigate the top-level window to a wallet universal link. */
export function openWalletApp(link: string) {
  if (typeof window === "undefined") return;
  window.location.href = link;
}
