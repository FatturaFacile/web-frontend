import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentCommissionsApiService, TranslateService } from '@core';
import { icons } from '../../icons-provider';
import { enasarcoRow, translateSpy } from './agent-commissions.testing';
import { EnasarcoComponent } from './enasarco.component';

const rows = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('tbody tr')).filter((row) => row.querySelector('td'));

describe('EnasarcoComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    api = {
      getEnasarcoOverview: vi.fn(() =>
        of({
          success: true,
          message: 'OK',
          data: [
            enasarcoRow('a-1'),
            enasarcoRow('a-2', {
              massimale_reached: true,
              massimale_remaining: '0.00',
              enasarco_base_ytd: '40000.00',
              mandate: 'single',
            }),
            enasarcoRow('a-3', {
              minimale_reached: false,
              minimale_shortfall: '120.00',
              firr_enabled: false,
            }),
          ],
          meta: { year: 2026 },
        }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AgentCommissionsApiService, useValue: api },
        { provide: TranslateService, useValue: translateSpy() },
        provideNzIcons(icons),
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(EnasarcoComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows a row per agent with the mandate and the progress against the ceiling', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const body = rows(root);

    expect(body).toHaveLength(3);
    expect(body[0].textContent).toContain('Agent a-1');
    expect(body[0].textContent).toContain('agentCommissions.enasarcoMandate.multi');
    expect(body[1].textContent).toContain('agentCommissions.enasarcoMandate.single');
    expect(root.querySelectorAll('nz-progress')).toHaveLength(3);
  });

  it('shows whether the ceiling is reached or the agent is still contributing', async () => {
    const fixture = await render();
    const body = rows(fixture.nativeElement as HTMLElement);

    expect(body[0].textContent).toContain('agentCommissions.enasarco.massimaleOpen');
    expect(body[0].textContent).not.toContain('agentCommissions.enasarco.massimaleReached');
    expect(body[1].textContent).toContain('agentCommissions.enasarco.massimaleReached');
  });

  it('shows the floor as reached, or the shortfall to it', async () => {
    const fixture = await render();
    const body = rows(fixture.nativeElement as HTMLElement);

    expect(body[0].textContent).toContain('agentCommissions.enasarco.minimaleReached');
    expect(body[2].textContent).toContain('agentCommissions.enasarco.minimaleShortfall');
    expect(body[2].textContent).toMatch(/120\D00/);
  });

  it('shows the FIRR of the agents that accrue it only', async () => {
    const fixture = await render();
    const body = rows(fixture.nativeElement as HTMLElement);

    expect(body[0].textContent).toMatch(/800\D00/);
    expect(body[2].textContent).not.toMatch(/800\D00/);
  });

  it('computes the progress against the ceiling, capped at 100', async () => {
    const component = (await render()).componentInstance;

    expect(
      component.share(enasarcoRow('x', { enasarco_base_ytd: '20000.00', massimale: '40000.00' })),
    ).toBe(50);
    expect(
      component.share(enasarcoRow('x', { enasarco_base_ytd: '50000.00', massimale: '40000.00' })),
    ).toBe(100);
    expect(component.share(enasarcoRow('x', { massimale: null }))).toBe(0);
  });

  it('reloads for the year picked in the selector', async () => {
    const component = (await render()).componentInstance;

    await component.store.setYear(2025);

    expect(api['getEnasarcoOverview']).toHaveBeenLastCalledWith(2025);
    expect(component.store.year()).toBe(2025);
    expect(component.years[0]).toBe(new Date().getFullYear());
  });

  it('shows the empty state', async () => {
    api['getEnasarcoOverview'].mockReturnValue(
      of({ success: true, message: 'OK', data: [], meta: { year: 2026 } }),
    );

    const fixture = await render();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'agentCommissions.enasarco.empty',
    );
  });

  it('shows the load failure', async () => {
    api['getEnasarcoOverview'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { code: 'generic' } })),
    );

    const fixture = await render();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'agentCommissions.error.generic',
    );
  });
});
