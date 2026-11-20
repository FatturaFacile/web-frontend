import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TourStep } from './academy.models';
import { SpotlightTourEngineService } from './spotlight-tour-engine.service';

const step = (selector: string, patch: Partial<TourStep> = {}): TourStep => ({
  route: '',
  selector,
  placement: 'bottom',
  text: `text ${selector}`,
  ...patch,
});

describe('SpotlightTourEngineService', () => {
  let engine: SpotlightTourEngineService;
  let router: Router;

  beforeEach(() => {
    router = { url: '/academy', navigateByUrl: vi.fn().mockResolvedValue(true) } as unknown as Router;
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: router }] });
    engine = TestBed.inject(SpotlightTourEngineService);
    document.body.innerHTML = '<input id="customer"><button id="save">Save</button>';
  });

  afterEach(() => {
    engine.stop();
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('ignores an empty step list', async () => {
    await engine.start([]);
    expect(engine.active()).toBe(false);
  });

  it('spotlights the element of the first step', async () => {
    await engine.start([step('#customer'), step('#save')]);
    expect(engine.status()).toBe('ready');
    expect(engine.step()?.selector).toBe('#customer');
    expect(engine.rect()).not.toBeNull();
    expect(engine.isFirst()).toBe(true);
    expect(engine.progressLabel()).toEqual({ current: 1, total: 2 });
  });

  it('moves forward and back, and ends after the last step', async () => {
    await engine.start([step('#customer'), step('#save')]);
    await engine.next();
    expect(engine.step()?.selector).toBe('#save');
    expect(engine.isLast()).toBe(true);
    await engine.previous();
    expect(engine.step()?.selector).toBe('#customer');
    await engine.next();
    await engine.next();
    expect(engine.active()).toBe(false);
    expect(engine.steps()).toEqual([]);
  });

  it('navigates when the step belongs to another route and not when it is already there', async () => {
    await engine.start([step('#customer', { route: '/invoices/new' })]);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/invoices/new');

    engine.stop();
    (router.navigateByUrl as ReturnType<typeof vi.fn>).mockClear();
    await engine.start([step('#customer', { route: '/academy' })]);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('waits for an element that appears after the navigation', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    const started = engine.start([step('#late')]);
    await vi.advanceTimersByTimeAsync(250);
    expect(engine.status()).toBe('locating');
    document.body.innerHTML = '<div id="late"></div>';
    await vi.advanceTimersByTimeAsync(150);
    await started;
    expect(engine.status()).toBe('ready');
  });

  it('reports a missing target after the timeout without throwing', async () => {
    vi.useFakeTimers();
    const started = engine.start([step('#nope')]);
    await vi.advanceTimersByTimeAsync(engine.timeoutMs() + 200);
    await started;
    expect(engine.status()).toBe('missing');
    expect(engine.rect()).toBeNull();
    expect(engine.step()?.text).toBe('text #nope');
  });

  it('survives an invalid selector from the API', async () => {
    vi.useFakeTimers();
    const started = engine.start([step('###')]);
    await vi.advanceTimersByTimeAsync(engine.timeoutMs() + 200);
    await started;
    expect(engine.status()).toBe('missing');
  });

  it('a stopped tour is not resurrected by a pending lookup', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    const started = engine.start([step('#late')]);
    engine.stop();
    document.body.innerHTML = '<div id="late"></div>';
    await vi.advanceTimersByTimeAsync(500);
    await started;
    expect(engine.active()).toBe(false);
  });
});
