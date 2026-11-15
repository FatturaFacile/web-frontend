import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { SwissdecPanelComponent } from './swissdec-panel.component';

describe('SwissdecPanelComponent', () => {
  it('requests the certification status and shows it from an object envelope', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SwissdecPanelComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(SwissdecPanelComponent);
    fixture.componentRef.setInput('canWrite', true);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http.expectOne((r) => r.url.endsWith('/swissdec/status')).flush({
      success: true,
      message: '',
      data: {
        is_certified: false,
        structure_basis: 'ELM 5.0',
        schema_namespace: 'http://www.swissdec.ch/schema/sd/20200220/SalaryDeclaration',
        schema_validated: true,
        current_certification_basis: 'none',
        domains_built: [],
        domains_not_built: ['AHV', 'UVG'],
        missing_for_certification: [{}, {}],
      },
    });
    for (const request of http.match(() => true)) {
      if (request.request.url.endsWith('.svg')) {
        request.flush('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>');
        continue;
      }
      request.flush(request.request.url.includes('/translations/') ? { translations: {} } : { success: true, message: '', data: [] });
    }
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('ELM 5.0');
    expect(text).toContain('AHV, UVG');
  });
});
