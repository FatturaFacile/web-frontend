import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { I18nService, PermissionsService } from '@core';
import { environment } from '@env';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { icons } from '../../../icons-provider';
import { act, col, cols, rf, req } from './resource-config.helpers';
import { ResourcePanelComponent } from './resource-panel.component';
import { ResourcePanelConfig } from './resource-panel.types';

const CONFIG: ResourcePanelConfig = {
  id: 'waves',
  titleKey: 'RES.P.waves',
  module: 'inventory',
  detailPath: '/inventory/waves/{id}',
  list: { path: '/inventory/waves', columns: [...cols('wave_number'), col('status', 'tag')] },
  create: act('POST', 'RES.A.new_wave', '/inventory/waves', { fields: [req(rf.text('notes'))] }),
  rowActions: [act('POST', 'RES.ACTION.CANCEL', '/inventory/waves/{id}/cancel', { confirm: true })],
  toolbar: [act('POST', 'RES.A.run_abc', '/inventory/abc-classification/run')],
};

describe('ResourcePanelComponent', () => {
  let fixture: ComponentFixture<ResourcePanelComponent>;
  let http: HttpTestingController;
  const base = environment.apiBaseUrl;
  let canWrite = true;

  beforeEach(() => {
    canWrite = true;
    TestBed.configureTestingModule({
      imports: [ResourcePanelComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(icons),
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: PermissionsService, useValue: { canWrite: () => canWrite } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ResourcePanelComponent);
    fixture.componentRef.setInput('config', CONFIG);
  });

  afterEach(() => http.verify());

  const flushList = () => {
    fixture.detectChanges();
    const req = http.expectOne((r) => r.url === `${base}/inventory/waves`);
    expect(req.request.params.get('page')).toBe('1');
    req.flush({ data: [{ id: 'w1', wave_number: 'W-1', status: 'open' }], meta: { total: 1 } });
    fixture.detectChanges();
  };

  it('loads the list and renders the rows', () => {
    flushList();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('W-1');
    expect(text).toContain('RES.A.new_wave');
    expect(text).toContain('RES.A.run_abc');
  });

  it('hides write actions without write permission', () => {
    canWrite = false;
    flushList();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('RES.A.new_wave');
    expect(text).not.toContain('RES.A.run_abc');
    expect(text).not.toContain('RES.ACTION.CANCEL');
  });

  it('runs a toolbar action without a form and reloads', () => {
    flushList();
    const panel = fixture.componentInstance as unknown as { run: (a: unknown) => void };
    panel.run(CONFIG.toolbar![0]);
    const post = http.expectOne(`${base}/inventory/abc-classification/run`);
    expect(post.request.method).toBe('POST');
    post.flush({ data: {} });
    http.expectOne((r) => r.url === `${base}/inventory/waves`).flush({ data: [], meta: { total: 0 } });
  });

  it('does not call any list endpoint for a toolbar-only panel and still runs its actions', () => {
    const toolbarOnly: ResourcePanelConfig = {
      id: 'imports',
      titleKey: 'RES.P.imports',
      module: 'associations',
      list: { path: '', columns: [] },
      toolbar: [act('GET', 'RES.A.view_import', '/associations/registry-imports/{id}', { fields: [req(rf.uuid('id'))] })],
    };
    fixture.componentRef.setInput('config', toolbarOnly);
    fixture.detectChanges();
    http.expectNone(() => true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('RES.A.view_import');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('RES.TOOLBAR_ONLY');
  });

  it('opens the detail of a row through the detail path', () => {
    flushList();
    const panel = fixture.componentInstance as unknown as { view: (r: unknown) => void };
    panel.view({ id: 'w1' });
    const get = http.expectOne(`${base}/inventory/waves/w1`);
    expect(get.request.method).toBe('GET');
    get.flush({ data: { id: 'w1', status: 'open' } });
  });
});
