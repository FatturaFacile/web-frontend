import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';

describe('app routes', () => {
  it('sends the old time-attendance screen to the HR time page', () => {
    const legacy = routes.find((route) => route.path === 'time-attendance');
    expect(legacy?.redirectTo).toBe('hr/time');
    expect(legacy?.pathMatch).toBe('full');
  });

  it('keeps the HR time page reachable', () => {
    expect(routes.some((route) => route.path === 'hr')).toBe(true);
  });
});
