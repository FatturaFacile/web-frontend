import { describe, expect, it } from 'vitest';
import { describeUserAgent, userAgentLabel } from './user-agent.util';

const CHROME_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const EDGE_WINDOWS = `${CHROME_WINDOWS} Edg/120.0.0.0`;
const FIREFOX_LINUX = 'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0';
const SAFARI_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15';
const SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1';
const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1';

describe('describeUserAgent', () => {
  it('recognises the browser and the system', () => {
    expect(describeUserAgent(CHROME_WINDOWS)).toEqual({ browser: 'Chrome', os: 'Windows', device: 'desktop' });
    expect(describeUserAgent(FIREFOX_LINUX)).toEqual({ browser: 'Firefox', os: 'Linux', device: 'desktop' });
    expect(describeUserAgent(SAFARI_MAC)).toEqual({ browser: 'Safari', os: 'macOS', device: 'desktop' });
  });

  it('prefers Edge over Chrome, which it also names', () => {
    expect(describeUserAgent(EDGE_WINDOWS).browser).toBe('Edge');
  });

  it('tells phones and tablets from computers, and Android from Linux', () => {
    expect(describeUserAgent(SAFARI_IPHONE)).toEqual({ browser: 'Safari', os: 'iOS', device: 'mobile' });
    expect(describeUserAgent(CHROME_ANDROID)).toEqual({ browser: 'Chrome', os: 'Android', device: 'mobile' });
    expect(describeUserAgent(IPAD).device).toBe('tablet');
  });

  it('returns nothing for an empty or missing User-Agent', () => {
    expect(describeUserAgent(null)).toEqual({ browser: null, os: null, device: null });
    expect(describeUserAgent('')).toEqual({ browser: null, os: null, device: null });
  });
});

describe('userAgentLabel', () => {
  it('joins the browser and the system', () => {
    expect(userAgentLabel(CHROME_WINDOWS)).toBe('Chrome / Windows');
  });

  it('falls back to the raw text, then to a dash', () => {
    expect(userAgentLabel('curl/8.4')).toBe('curl/8.4');
    expect(userAgentLabel(null)).toBe('-');
    expect(userAgentLabel('')).toBe('-');
  });
});
