import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { describe, beforeEach, it, expect } from 'vitest';
import { icons } from './icons-provider';
import { AppComponent } from './app.component';
import { AppStore, AuthStore, I18nService } from '@core';

@Component({ selector: 'app-public-stub', template: '<p class="public-stub">public</p>' })
class PublicStubComponent {}

@Component({ selector: 'app-private-stub', template: '<p class="private-stub">private</p>' })
class PrivateStubComponent {}

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
        provideRouter([
          { path: 'rma-estimate/:token', data: { publicPage: true }, component: PublicStubComponent },
          { path: 'private', component: PrivateStubComponent },
        ]),
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

  it('renders public pages without the application shell even when signed in', async () => {
    const fixture = createApp();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/rma-estimate/tok');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.publicPage()).toBe(true);
    expect(compiled.querySelector('app-sidebar')).toBeNull();
    expect(compiled.querySelector('.public-stub')).not.toBeNull();

    await router.navigateByUrl('/private');
    fixture.detectChanges();
    expect(fixture.componentInstance.publicPage()).toBe(false);
    expect(compiled.querySelector('app-sidebar')).not.toBeNull();
  });
});
