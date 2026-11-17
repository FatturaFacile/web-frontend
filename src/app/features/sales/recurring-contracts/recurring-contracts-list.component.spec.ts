import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { RecurringContractsApiService } from '@core/api/recurring-contracts-api.service';
import { RecurringContractsListComponent } from './recurring-contracts-list.component';

describe('RecurringContractsListComponent', () => {
  let mockApi: {
    getContracts: ReturnType<typeof vi.fn>;
    getMetrics: ReturnType<typeof vi.fn>;
    deleteContract: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockApi = {
      getContracts: vi.fn().mockReturnValue(of({ data: [], meta: { total: 0, current_page: 1, per_page: 15 } })),
      getMetrics: vi.fn().mockReturnValue(of({
        active_contracts_count: 5,
        mrr: '5000.00',
        arr: '60000.00',
        expiring_within_30_days_count: 1,
        due_for_billing_count: 2,
      })),
      deleteContract: vi.fn().mockReturnValue(of({ message: 'Deleted' })),
    };

    await TestBed.configureTestingModule({
      imports: [RecurringContractsListComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzI18n(en_US),
        { provide: RecurringContractsApiService, useValue: mockApi },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } },
      ],
    }).compileComponents();
  });

  it('creates the component and initializes signals', () => {
    const fixture = TestBed.createComponent(RecurringContractsListComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
    expect(component.contracts()).toEqual([]);
    expect(component.pageIndex()).toBe(1);
    expect(component.pageSize()).toBe(15);
  });

  it('formats contract types accurately', () => {
    const fixture = TestBed.createComponent(RecurringContractsListComponent);
    const component = fixture.componentInstance;
    expect(component.formatType('maintenance')).toBe('Manutenzione');
    expect(component.formatType('rental')).toBe('Noleggio / Locazione');
    expect(component.formatType('software_license')).toBe('Licenza SaaS');
    expect(component.formatType('service_subscription')).toBe('Abbonamento');
  });

  it('returns appropriate nzColor for status values', () => {
    const fixture = TestBed.createComponent(RecurringContractsListComponent);
    const component = fixture.componentInstance;
    expect(component.statusColor('active')).toBe('success');
    expect(component.statusColor('suspended')).toBe('warning');
    expect(component.statusColor('draft')).toBe('default');
    expect(component.statusColor('cancelled')).toBe('error');
    expect(component.statusColor('expired')).toBe('purple');
  });
});

