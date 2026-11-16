import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '@core/auth/auth.store';
import { I18nService } from '@core/i18n/i18n.service';
import { ThemeService } from '@core/theme/theme.service';
import { UiPreferencesService } from '@core/theme/ui-preferences.service';
import { UI_DENSITIES } from '@core/theme/ui-preferences.types';
import { AppearanceSwitcherComponent } from '../../layout/header/appearance-switcher.component';
import { ToastHostComponent } from '@shared/ui/toast/toast-host.component';
import { ToastService } from '@shared/ui/toast/toast.service';
import { auditAccessibility, formatViolations } from '../../../testing/axe';
import { DesignSystemComponent } from './design-system.component';

/**
 * WCAG 2.2 AA audit with axe-core of the design system catalog (every core component) and of the header switcher,
 * in the light and the dark theme and in every density. Colour contrast and target size are checked on the tokens
 * (src/design-tokens/ff.tokens.spec.ts) because jsdom has no layout; see src/testing/axe.ts.
 */
describe('design system accessibility (axe-core, WCAG 2.2 AA)', () => {
  const root = document.documentElement;

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        {
          provide: AuthStore,
          useValue: { isAuthenticated: signal(false), activeTenantId: signal('tenant-1') },
        },
      ],
    });
    TestBed.inject(ThemeService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const attribute of ['data-theme', 'data-density', 'data-reduced-motion', 'style']) {
      root.removeAttribute(attribute);
    }
    document.getElementById('theme-dark-stylesheet')?.remove();
  });

  async function expectClean(element: Element, label: string): Promise<void> {
    const results = await auditAccessibility(element);
    expect(results.violations, `${label}\n${formatViolations(results)}`).toEqual([]);
    expect(results.passes.length, `${label}: axe ran no rules`).toBeGreaterThan(0);
  }

  function click(fixture: ComponentFixture<unknown>, text: string): void {
    const button = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((b) => b.textContent?.includes(text));
    expect(button, `button "${text}" not found`).toBeDefined();
    button?.click();
    fixture.detectChanges();
  }

  for (const theme of ['light', 'dark'] as const) {
    describe(`${theme} theme`, () => {
      it('has no violations in the catalog', async () => {
        TestBed.inject(UiPreferencesService).setTheme(theme);
        const fixture = TestBed.createComponent(DesignSystemComponent);
        fixture.detectChanges();
        TestBed.tick();

        expect(root.getAttribute('data-theme')).toBe(theme);
        await expectClean(fixture.nativeElement as HTMLElement, `catalog, ${theme}`);
      });

      it('has no violations in an open dialog, drawer and confirmation', async () => {
        TestBed.inject(UiPreferencesService).setTheme(theme);
        const fixture = TestBed.createComponent(DesignSystemComponent);
        fixture.detectChanges();

        for (const [opener, closer] of [
          ['DESIGN_SYSTEM.MODAL_OPEN', 'DESIGN_SYSTEM.CLOSE'],
          ['DESIGN_SYSTEM.DRAWER_OPEN', 'DESIGN_SYSTEM.CLOSE'],
          ['DESIGN_SYSTEM.CONFIRM_OPEN', 'DESIGN_SYSTEM.CANCEL'],
        ]) {
          click(fixture, opener);
          const dialog = (fixture.nativeElement as HTMLElement).querySelector('[role="dialog"]');
          expect(dialog, `${opener} opens a dialog`).not.toBeNull();
          await expectClean(fixture.nativeElement as HTMLElement, `${opener}, ${theme}`);
          // The footer button closes the dialog it belongs to.
          const footerButtons = Array.from(
            (dialog as HTMLElement).querySelectorAll('.footer button'),
          );
          footerButtons
            .find((b) => b.textContent?.includes(closer))
            ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          fixture.detectChanges();
          expect(
            (fixture.nativeElement as HTMLElement).querySelector('[role="dialog"]'),
          ).toBeNull();
        }
      });

      it('has no violations in the header switcher, open', async () => {
        TestBed.inject(UiPreferencesService).setTheme(theme);
        const fixture = TestBed.createComponent(AppearanceSwitcherComponent);
        fixture.detectChanges();
        (fixture.nativeElement as HTMLElement).querySelector('button')?.click();
        fixture.detectChanges();

        expect(
          (fixture.nativeElement as HTMLElement).querySelector('#ff-appearance-panel'),
        ).not.toBeNull();
        await expectClean(fixture.nativeElement as HTMLElement, `switcher, ${theme}`);
      });

      it('has no violations in the toast regions', async () => {
        TestBed.inject(UiPreferencesService).setTheme(theme);
        const toasts = TestBed.inject(ToastService);
        toasts.success('Saved');
        toasts.error('Failed');
        const fixture = TestBed.createComponent(ToastHostComponent);
        fixture.detectChanges();
        await expectClean(fixture.nativeElement as HTMLElement, `toasts, ${theme}`);
      });
    });
  }

  for (const density of UI_DENSITIES) {
    it(`has no violations with ${density} density`, async () => {
      TestBed.inject(UiPreferencesService).setDensity(density);
      const fixture = TestBed.createComponent(DesignSystemComponent);
      fixture.detectChanges();
      TestBed.tick();

      expect(root.getAttribute('data-density')).toBe(density);
      await expectClean(fixture.nativeElement as HTMLElement, `catalog, ${density}`);
    });
  }

  it('reports a violation for a control without a label (the audit is not vacuous)', async () => {
    const host = document.createElement('div');
    host.innerHTML = '<input type="text" />';
    document.body.appendChild(host);
    const results = await auditAccessibility(host);
    host.remove();
    expect(results.violations.map((v) => v.id)).toContain('label');
  });
});
