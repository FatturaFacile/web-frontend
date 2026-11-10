import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { I18nService, PermissionsService } from '@core';
import { environment } from '@env';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { icons } from '../../../icons-provider';
import { act, cols, rf, req } from './resource-config.helpers';
import { ResourcePanelComponent } from './resource-panel.component';
import { ResourcePanelConfig } from './resource-panel.types';

const CONFIG: ResourcePanelConfig = {
  id: 'guardians',
  titleKey: 'RES.P.assoc_guardians',
  module: 'associations',
  rowLink: { labelKey: 'RES.A.member_file', route: '/associations/members/{id}' },
  list: { path: '/associations/members/{id}/guardians', columns: cols('relationship') },
  create: act('POST', 'RES.A.add_guardian', '/associations/members/{id}/guardians', { fields: [req(rf.text('relationship'))] }),
  rowActions: [act('DELETE', 'RES.ACTION.DELETE', '/associations/guardians/{id}', { confirm: true })],
};

describe('ResourcePanelComponent with a host context', () => {
  let fixture: ComponentFixture<ResourcePanelComponent>;
  let http: HttpTestingController;
  const base = environment.apiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ResourcePanelComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNzIcons(icons),
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ResourcePanelComponent);
    fixture.componentRef.setInput('config', CONFIG);
    fixture.componentRef.setInput('context', { id: 'm-1' });
  });

  afterEach(() => http.verify());

  it('fills the path placeholders of the list from the context', () => {
    fixture.detectChanges();
    const req = http.expectOne((r) => r.url === `${base}/associations/members/m-1/guardians`);
    req.flush({ data: [{ id: 'g-1', relationship: 'parent' }] });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('parent');
  });

  it('prefers the id of the row over the context for the row actions', () => {
    fixture.detectChanges();
    http.expectOne((r) => r.url === `${base}/associations/members/m-1/guardians`).flush({ data: [{ id: 'g-1' }] });
    const panel = fixture.componentInstance as unknown as { execute: (a: unknown, r: unknown, b: unknown) => void };
    panel.execute(CONFIG.rowActions![0], { id: 'g-1' }, {});
    const del = http.expectOne(`${base}/associations/guardians/g-1`);
    expect(del.request.method).toBe('DELETE');
    del.flush({});
    http.expectOne((r) => r.url === `${base}/associations/members/m-1/guardians`).flush({ data: [] });
  });

  it('links every row to its detail route', () => {
    fixture.detectChanges();
    http.expectOne((r) => r.url === `${base}/associations/members/m-1/guardians`).flush({ data: [{ id: 'g-1' }] });
    fixture.detectChanges();
    const link = (fixture.nativeElement as HTMLElement).querySelector('a[href="/associations/members/g-1"]');
    expect(link).not.toBeNull();
  });
});
