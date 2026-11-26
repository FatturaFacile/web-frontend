import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthStore, I18nService } from '@core';
import { describe, expect, it, vi } from 'vitest';
import { FiduciaryPortalComponent } from './fiduciary-portal.component';

describe('FiduciaryPortalComponent', () => {
  it('renders the fiduciary portal workspace with translation keys', () => {
    TestBed.configureTestingModule({
      imports: [FiduciaryPortalComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthStore,
          useValue: { selectTenant: vi.fn() },
        },
        {
          provide: I18nService,
          useValue: {
            currentLanguage: () => 'it-CH',
            translate: (key: string) => key,
          },
        },
      ],
    });

    const fixture: ComponentFixture<FiduciaryPortalComponent> = TestBed.createComponent(FiduciaryPortalComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
