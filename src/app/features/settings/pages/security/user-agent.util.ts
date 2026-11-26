/** Browser, operating system and device class read from a User-Agent string, for the list of sessions. */
export interface DescribedUserAgent {
  browser: string | null;
  os: string | null;
  device: 'desktop' | 'mobile' | 'tablet' | null;
}

/** Order matters: Edge, Opera and Samsung Internet also say "Chrome"; Chrome says "Safari". */
const BROWSERS: readonly (readonly [string, RegExp])[] = [
  ['Edge', /\bEdg(?:e|A|iOS)?\/[\d.]+/],
  ['Opera', /\b(?:OPR|Opera)\/[\d.]+/],
  ['Samsung Internet', /\bSamsungBrowser\/[\d.]+/],
  ['Firefox', /\b(?:Firefox|FxiOS)\/[\d.]+/],
  ['Chrome', /\b(?:Chrome|CriOS)\/[\d.]+/],
  ['Safari', /\bVersion\/[\d.]+.*\bSafari\//],
];

/** Order matters: iPadOS and Android UAs contain "Mac OS X" and "Linux". */
const SYSTEMS: readonly (readonly [string, RegExp])[] = [
  ['iOS', /\b(?:iPhone|iPad|iPod)\b/],
  ['Android', /\bAndroid\b/],
  ['Windows', /\bWindows\b/],
  ['macOS', /\bMac OS X\b|\bMacintosh\b/],
  ['ChromeOS', /\bCrOS\b/],
  ['Linux', /\bLinux\b|\bX11\b/],
];

export function describeUserAgent(userAgent: string | null | undefined): DescribedUserAgent {
  const ua = userAgent ?? '';
  const browser = BROWSERS.find(([, pattern]) => pattern.test(ua))?.[0] ?? null;
  const os = SYSTEMS.find(([, pattern]) => pattern.test(ua))?.[0] ?? null;
  const device = /\biPad\b|\bTablet\b/.test(ua) || (/\bAndroid\b/.test(ua) && !/\bMobile\b/.test(ua))
    ? 'tablet'
    : /\bMobile\b|\biPhone\b|\biPod\b/.test(ua)
      ? 'mobile'
      : ua
        ? 'desktop'
        : null;

  return { browser, os, device };
}

/** "Chrome / Windows" (brand names are not translated); the raw User-Agent when nothing is recognised. */
export function userAgentLabel(userAgent: string | null | undefined): string {
  const { browser, os } = describeUserAgent(userAgent);
  if (browser && os) {
    return `${browser} / ${os}`;
  }
  return browser ?? os ?? (userAgent && userAgent !== '' ? userAgent : '-');
}
