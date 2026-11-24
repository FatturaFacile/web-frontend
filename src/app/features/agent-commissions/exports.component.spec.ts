import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentCommissionsApiService, TranslateService } from '@core';
import { icons } from '../../icons-provider';
import { translateSpy } from './agent-commissions.testing';
import { ExportsComponent } from './exports.component';

describe('ExportsComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let downloads: { name: string; href: string }[];

  beforeEach(() => {
    vi.clearAllMocks();
    api = {
      exportCu: vi.fn(() => of(new Blob(['cu']))),
      exportEnasarco: vi.fn(() => of(new Blob(['enasarco']))),
    };
    downloads = [];
    // The browser download is a click on an anchor: record it instead of navigating.
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push({ name: this.download, href: this.href });
    });
    URL.createObjectURL = vi.fn(() => 'blob:csv');
    URL.revokeObjectURL = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: AgentCommissionsApiService, useValue: api },
        { provide: TranslateService, useValue: translateSpy() },
        provideNzIcons(icons),
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function render() {
    const fixture = TestBed.createComponent(ExportsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('offers the CU and the Enasarco exports with their hints', async () => {
    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(text).toContain('agentCommissions.exports.cuTitle');
    expect(text).toContain('agentCommissions.exports.cuHint');
    expect(text).toContain('agentCommissions.exports.enasarcoTitle');
    expect(text).toContain('agentCommissions.exports.enasarcoHint');
    expect(text).toContain('agentCommissions.action.exportCu');
    expect(text).toContain('agentCommissions.action.exportEnasarco');
  });

  it('downloads the CU file of the year the browser way', async () => {
    const component = (await render()).componentInstance;
    component.store.setYear(2025);

    await component.download(component.store.exportCu());

    expect(api['exportCu']).toHaveBeenCalledWith(2025);
    expect(downloads).toEqual([{ name: 'cu-agents-2025.csv', href: 'blob:csv' }]);
  });

  it('downloads the Enasarco trace of a quarter', async () => {
    const component = (await render()).componentInstance;
    component.store.setYear(2026);
    component.store.setQuarter(3);

    await component.download(component.store.exportEnasarco());

    expect(api['exportEnasarco']).toHaveBeenCalledWith(2026, 3);
    expect(downloads.map((download) => download.name)).toEqual(['enasarco-2026-q3.csv']);
  });

  it('downloads nothing and shows the translated refusal when the export fails', async () => {
    api['exportCu'].mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 403,
            error: new Blob([JSON.stringify({ code: 'generic' })], { type: 'application/json' }),
          }),
      ),
    );
    const fixture = await render();
    const component = fixture.componentInstance;

    await component.download(component.store.exportCu());
    fixture.detectChanges();

    expect(downloads).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'agentCommissions.error.generic',
    );
  });
});
