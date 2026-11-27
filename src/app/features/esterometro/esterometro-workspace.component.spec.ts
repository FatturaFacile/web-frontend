import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { EsterometroApiService } from '../../core/api/esterometro-api.service';
import { EsterometroWorkspaceComponent } from './esterometro-workspace.component';

describe('EsterometroWorkspaceComponent', () => {
  const mockApi = {
    getDashboard: vi.fn().mockReturnValue(
      of({
        data: {
          as_of: '2026-04-20',
          next_monthly_deadline: '2026-05-15',
          days_to_next_monthly_deadline: 25,
          counts: {
            total: 0,
            overdue: 0,
            due_soon: 0,
            upcoming: 0,
            transmitted: 0,
            rejected: 0,
            draft: 0,
            reconciled: 0,
          },
          totals_eur: {
            taxable_eur: 0,
            vat_eur: 0,
            deductible_vat_eur: 0,
            non_deductible_vat_eur: 0,
          },
          by_document_type: [],
        },
      }),
    ),
    listSelfInvoices: vi.fn().mockReturnValue(of({ data: [] })),
    listRules: vi.fn().mockReturnValue(of({ data: [] })),
    getSettings: vi.fn().mockReturnValue(of({ data: null })),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EsterometroWorkspaceComponent],
      providers: [
        { provide: EsterometroApiService, useValue: mockApi },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    }).compileComponents();
  });

  it('creates workspace component and loads data on init', async () => {
    const fixture = TestBed.createComponent(EsterometroWorkspaceComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
    expect(mockApi.getDashboard).toHaveBeenCalled();
  });
});
