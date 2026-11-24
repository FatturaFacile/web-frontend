import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { UiPreferencesService, UI_STORAGE_KEY } from '@core/theme';
import { ThemeSelectorComponent } from './theme-selector.component';

describe('ThemeSelectorComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [ThemeSelectorComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  function create() {
    const fixture = TestBed.createComponent(ThemeSelectorComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('offers light, dark and system', () => {
    const values = create().componentInstance['options'].map((option) => option.value);
    expect(values).toEqual(['light', 'dark', 'system']);
  });

  it('applies the chosen theme at once and remembers it in the browser', () => {
    const fixture = create();

    fixture.componentInstance['onThemeChange']('dark');

    expect(TestBed.inject(UiPreferencesService).themePreference()).toBe('dark');
    expect(JSON.parse(localStorage.getItem(UI_STORAGE_KEY) ?? '{}').theme).toBe('dark');
  });

  it('has an accessible name', () => {
    const select = create().nativeElement.querySelector('nz-select');
    expect(select.getAttribute('aria-label')).toBeTruthy();
  });
});
