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

  const getFilePath = (lang: string): string => {
    const srcPath = path.resolve(process.cwd(), `src/assets/i18n/${lang}.json`);
    if (fs.existsSync(srcPath)) return srcPath;
    return path.resolve(process.cwd(), `public/assets/i18n/${lang}.json`);
  };

  const match = urlStr.match(/\/assets\/i18n\/([a-z]{2})\.json$/i);
  if (match) {
    const lang = match[1];
    const filePath = getFilePath(lang);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return new Response(content, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const apiMatch = urlStr.match(/\/api\/translations\/([a-z]{2})/i);
  if (apiMatch) {
    const lang = apiMatch[1];
    const filePath = getFilePath(lang);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return new Response(
        JSON.stringify({
          locale: lang,
          translations: JSON.parse(content),
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  }

  if (originalFetch) {
    try {
      return await originalFetch(input, init);
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  }

  return new Response('Not Found', { status: 404 });
};
