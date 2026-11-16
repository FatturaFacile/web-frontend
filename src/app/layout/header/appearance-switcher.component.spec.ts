import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from '@core/i18n/i18n.service';
import { UiPreferencesApiService } from '@core/api/ui-preferences-api.service';
import { UiPreferencesService } from '@core/theme/ui-preferences.service';
import { AppearanceSwitcherComponent } from './appearance-switcher.component';

describe('AppearanceSwitcherComponent', () => {
  let fixture: ComponentFixture<AppearanceSwitcherComponent>;
  let prefs: UiPreferencesService;
  let root: HTMLElement;

  const trigger = (): HTMLButtonElement =>
    root.querySelector('.appearance-trigger') as HTMLButtonElement;
  const panel = (): HTMLElement | null => root.querySelector('#ff-appearance-panel');
  const radio = (name: string, value: string): HTMLInputElement =>
    root.querySelector(`input[name="${name}"][value="${value}"]`) as HTMLInputElement;

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    TestBed.configureTestingModule({
      providers: [
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: UiPreferencesApiService, useValue: {} },
      ],
    });
    prefs = TestBed.inject(UiPreferencesService);
    fixture = TestBed.createComponent(AppearanceSwitcherComponent);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('is a labelled disclosure button that starts collapsed', () => {
    expect(trigger().getAttribute('aria-label')).toBe('DESIGN_SYSTEM.APPEARANCE');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(panel()).toBeNull();
  });

  it('opens a panel with a theme group and a density group of radios', () => {
    trigger().click();
    fixture.detectChanges();

    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelectorAll('fieldset')).toHaveLength(2);
    expect(root.querySelectorAll('input[name="ff-theme"]')).toHaveLength(3);
    expect(root.querySelectorAll('input[name="ff-density"]')).toHaveLength(3);
    expect(radio('ff-theme', 'system').checked).toBe(true);
    expect(radio('ff-density', 'comfortable').checked).toBe(true);
  });

  it('changes the theme and the density in real time', () => {
    trigger().click();
    fixture.detectChanges();

    radio('ff-theme', 'dark').click();
    radio('ff-density', 'compact').click();
    fixture.detectChanges();

    expect(prefs.themePreference()).toBe('dark');
    expect(prefs.resolvedTheme()).toBe('dark');
    expect(prefs.density()).toBe('compact');
    expect(radio('ff-theme', 'dark').checked).toBe(true);
  });

  it('closes with Escape and gives the focus back to the button', () => {
    trigger().click();
    fixture.detectChanges();
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('closes on a click outside but not on a click inside', () => {
    trigger().click();
    fixture.detectChanges();

    (panel() as HTMLElement).click();
    expect(panel()).not.toBeNull();

    document.body.click();
    fixture.detectChanges();
    expect(panel()).toBeNull();
  });
});
