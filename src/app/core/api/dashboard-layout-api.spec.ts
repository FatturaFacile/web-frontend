import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { DashboardApiService } from './dashboard-api.service';
import { SettingsApiService } from './settings-api.service';

describe('Dashboard builder and branding endpoints', () => {
  let httpTesting: HttpTestingController;
  const dashboard = `${environment.apiBaseUrl}/dashboard`;
  const settings = `${environment.apiBaseUrl}/settings`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DashboardApiService, SettingsApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  it('reads the widget catalogue and the layout', () => {
    const api = TestBed.inject(DashboardApiService);
    api.getAvailableWidgets().subscribe((res) => expect(res.data[0].id).toBe('kpi'));
    httpTesting
      .expectOne(`${dashboard}/available-widgets`)
      .flush({ success: true, message: '', data: [{ id: 'kpi' }], meta: null });

    api.getLayout().subscribe((res) => expect(res.data.is_default).toBe(true));
    const layout = httpTesting.expectOne(`${dashboard}/layout`);
    expect(layout.request.method).toBe('GET');
    layout.flush({ success: true, message: '', data: { id: null, is_default: true, widgets_layout: [] } });
  });

  it('saves and resets the layout', () => {
    const api = TestBed.inject(DashboardApiService);
    const payload = { name: 'Mine', widgets_layout: [{ widget_id: 'kpi', x: 0, y: 0, w: 4, h: 2 }] };
    api.saveLayout(payload).subscribe();
    const save = httpTesting.expectOne(`${dashboard}/layout`);
    expect(save.request.method).toBe('PUT');
    expect(save.request.body).toEqual(payload);
    save.flush({ data: {} });

    api.resetLayout().subscribe();
    const reset = httpTesting.expectOne(`${dashboard}/layout/reset`);
    expect(reset.request.method).toBe('POST');
    reset.flush({ data: {} });
  });

  it('reads the widget data, optionally for named widgets', () => {
    const api = TestBed.inject(DashboardApiService);
    api.getWidgetData().subscribe();
    const all = httpTesting.expectOne(`${dashboard}/data`);
    expect(all.request.params.has('widgets')).toBe(false);
    all.flush({ data: { widgets: [], generated_at: 'now' } });

    api.getWidgetData(['a', 'b']).subscribe();
    const some = httpTesting.expectOne((r) => r.url === `${dashboard}/data` && r.params.get('widgets') === 'a,b');
    some.flush({ data: { widgets: [], generated_at: 'now' } });
  });

  it('lists, saves and deletes document templates and reads the quota', () => {
    const api = TestBed.inject(SettingsApiService);
    api.getDocumentTemplates().subscribe((res) => expect(res.data.length).toBe(1));
    httpTesting.expectOne(`${settings}/document-templates`).flush({ data: [{ id: 't' }] });

    api.saveDocumentTemplate('invoice', { primary_color: '#112233' }).subscribe();
    const save = httpTesting.expectOne(`${settings}/document-templates/invoice`);
    expect(save.request.method).toBe('PUT');
    expect(save.request.body).toEqual({ primary_color: '#112233' });
    save.flush({ data: {} });

    api.deleteDocumentTemplate('invoice').subscribe();
    const del = httpTesting.expectOne(`${settings}/document-templates/invoice`);
    expect(del.request.method).toBe('DELETE');
    del.flush({ data: null });

    api.getDocumentQuota().subscribe((res) => expect(res.data.used).toBe('3'));
    httpTesting
      .expectOne(`${settings}/document-quota`)
      .flush({ data: { enabled: true, limit: '10', used: '3', remaining: '7', year: 2026 } });
  });
});
