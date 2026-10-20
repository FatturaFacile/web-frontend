import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { describe, beforeEach, it, expect } from 'vitest';
import { icons } from './icons-provider';
import { AppComponent } from './app.component';
import { AppStore, AuthStore } from '@core';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        AppStore,
        AuthStore,
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render brand title in sidebar', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-text')?.textContent).toContain('Fattura Facile');
  });

  it('should toggle sidebar via store', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    expect(app.appStore.isCollapsed()).toBe(false);

    app.appStore.toggleSidebar();
    expect(app.appStore.isCollapsed()).toBe(true);
  });
});
