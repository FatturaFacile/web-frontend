import '@angular/localize/init';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import * as fs from 'node:fs';
import * as path from 'node:path';

getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());

// Mock fetch for Vitest / JSDOM environment to serve local static i18n JSON files
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  const match = urlStr.match(/\/assets\/i18n\/([a-z]{2})\.json$/i);
  if (match) {
    const lang = match[1];
    const filePath = path.resolve(process.cwd(), `public/assets/i18n/${lang}.json`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return new Response(content, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (originalFetch) {
    return originalFetch(input, init);
  }

  return new Response('Not Found', { status: 404 });
};
