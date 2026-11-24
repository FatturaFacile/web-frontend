import '@angular/localize/init';
import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

// The UI strings live only in the API and the frontend has no copy of them. A component that creates the real
// I18nService gets an empty dictionary from the translations endpoint, so it shows translation keys. The specs that
// need real translations read the seeded dictionaries through src/testing/seeded-dictionaries.ts.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  const apiMatch = urlStr.match(/\/api\/(?:v\d+\/)?translations\/([a-z]{2})/i);
  if (apiMatch) {
    return new Response(JSON.stringify({ locale: apiMatch[1], translations: {} }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
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
