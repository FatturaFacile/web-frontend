import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { describe, beforeEach, it, expect } from 'vitest';
import { icons } from './icons-provider';
import { AppComponent } from './app.component';
import { AppStore, AuthStore, I18nService } from '@core';

/** Sessions start unauthenticated, so sign in first for shell testing. */
function createApp() {
  TestBed.inject(AuthStore).login();
  return TestBed.createComponent(AppComponent);
}

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        I18nService,
        AppStore,
        AuthStore,
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = createApp();
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render brand title in sidebar', () => {
    const fixture = createApp();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-text')?.textContent).toContain('Fattura Facile');
  });

  it('should toggle sidebar via store and hide brand text when collapsed', () => {
    const fixture = createApp();
    fixture.detectChanges();
    const app = fixture.componentInstance;
    expect(app.appStore.isCollapsed()).toBe(false);

    app.appStore.toggleSidebar();
    fixture.detectChanges();
    expect(app.appStore.isCollapsed()).toBe(true);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-text')).toBeNull();
  });

  it('should bind translated title on sidebar menu items for hover tooltips', () => {
    const fixture = createApp();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const firstMenuItem = compiled.querySelector('li[nz-menu-item]');
    expect(firstMenuItem?.getAttribute('title')).toBeTruthy();
  });
});
