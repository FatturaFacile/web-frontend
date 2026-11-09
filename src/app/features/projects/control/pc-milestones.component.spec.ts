import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore, PermissionsService, ProjectControlApiService, ProjectMilestone } from '@core';
import { PcMilestonesComponent } from './pc-milestones.component';

function milestone(overrides: Partial<ProjectMilestone>): ProjectMilestone {
  return {
    id: 'm1',
    project_id: 'p1',
    project_phase_id: null,
    name: 'Go live',
    milestone_date: '2026-12-01',
    billing_percentage: '10.00',
    billing_amount: '500.00',
    is_completed: false,
    completed_at: null,
    is_billed: false,
    invoice_id: null,
    ...overrides,
  };
}

describe('PcMilestonesComponent', () => {
  const api = {
    getMilestones: vi.fn(),
    createMilestone: vi.fn(),
    updateMilestone: vi.fn(),
    completeMilestone: vi.fn(),
    billMilestone: vi.fn(),
  };
  let fixture: ComponentFixture<PcMilestonesComponent>;

  interface Internals {
    complete(m: ProjectMilestone): void;
    billTarget: { set(m: ProjectMilestone): void };
    taxRate: number;
    bill(): void;
  }

  async function create(items: ProjectMilestone[]): Promise<Internals> {
    TestBed.resetTestingModule();
    api.getMilestones.mockReturnValue(of({ success: true, message: '', data: items }));
    await TestBed.configureTestingModule({
      imports: [PcMilestonesComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ProjectControlApiService, useValue: api },
        { provide: AuthStore, useValue: { activeCurrency: () => 'EUR' } },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: NzMessageService, useValue: { success: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PcMilestonesComponent);
    fixture.componentRef.setInput('projectId', 'p1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.componentInstance as unknown as Internals;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api.completeMilestone.mockReturnValue(of({ data: milestone({ is_completed: true }) }));
    api.billMilestone.mockReturnValue(of({ data: { invoice_number: 'D-1' } }));
  });

  it('offers the completion of a milestone that is not reached yet and reloads afterwards', async () => {
    const component = await create([milestone({})]);
    expect(api.getMilestones).toHaveBeenCalledWith('p1');
    component.complete(milestone({}));
    expect(api.completeMilestone).toHaveBeenCalledWith('m1');
    expect(api.getMilestones).toHaveBeenCalledTimes(2);
  });

  it('bills a reached milestone once with the tax rate chosen', async () => {
    const reached = milestone({ is_completed: true });
    const component = await create([reached]);
    component.billTarget.set(reached);
    component.taxRate = 8.1;
    component.bill();
    expect(api.billMilestone).toHaveBeenCalledWith('p1', 'm1', { tax_rate: 8.1 });
  });

  it('shows the billing action only for a reached and not yet billed milestone', async () => {
    await create([milestone({ is_completed: true, is_billed: true })]);
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('tbody button')) as HTMLButtonElement[];
    expect(buttons).toHaveLength(0);
  });
});
