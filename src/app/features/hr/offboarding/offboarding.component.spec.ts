import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { icons } from '../../../icons-provider';
import { HrApiService, HrWorkforceApiService, I18nService, PermissionsService } from '@core';
import { OffboardingComponent } from './offboarding.component';
import { OffboardingChecklistComponent } from './offboarding-checklist.component';

const page = { success: true, message: '', data: [], meta: { total: 0 } };

describe('OffboardingComponent', () => {
  const api = {
    getOffboardingChecklists: vi.fn(),
    getOffboardingTemplates: vi.fn(),
    getExitInterviews: vi.fn(),
    getExitReasonCodes: vi.fn(),
    getOffboardingChecklist: vi.fn(),
    completeOffboardingTask: vi.fn(),
  };

  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    api.getOffboardingChecklists.mockReturnValue(of(page));
    api.getOffboardingTemplates.mockReturnValue(of(page));
    api.getExitInterviews.mockReturnValue(of(page));
    api.getExitReasonCodes.mockReturnValue(of({ success: true, message: '', data: [{ code: 'other', voluntary: false }] }));
    api.getOffboardingChecklist.mockReturnValue(
      of({
        success: true,
        message: '',
        data: {
          id: 'l1',
          employee_id: 'e1',
          kind: 'offboarding',
          onboarding_template_id: null,
          reference_date: '2026-12-15',
          completed_at: null,
          employee: { id: 'e1', employee_number: 'EMP-1', full_name: 'Ada Rossi', termination_date: '2026-12-15' },
          tasks: [{ id: 't1', title: 'Return asset: Laptop', code: 'asset_return', due_on: '2026-12-15', sort_order: 0, completed_at: null, completed_by: null }],
        },
      }),
    );
    api.completeOffboardingTask.mockReturnValue(of({ success: true, message: '', data: {} }));
    TestBed.configureTestingModule({
      imports: [OffboardingComponent],
      providers: [
        provideNzIcons(icons),
        { provide: HrWorkforceApiService, useValue: api },
        { provide: HrApiService, useValue: { getEmployees: () => of(page) } },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
      ],
    });
  });

  it('loads the lookups and the reason codes when opened', async () => {
    const fixture = TestBed.createComponent(OffboardingComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(api.getExitReasonCodes).toHaveBeenCalledTimes(1);
    expect(api.getOffboardingTemplates).toHaveBeenCalled();
    expect(api.getOffboardingChecklists).toHaveBeenCalled();
  });

  it('shows the tasks of a checklist and completes one', () => {
    const fixture = TestBed.createComponent(OffboardingChecklistComponent);
    fixture.componentRef.setInput('checklistId', 'l1');
    fixture.componentRef.setInput('canWrite', true);
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as { complete(id: string): void; title(): string };
    expect(component.title()).toBe('EMP-1 - Ada Rossi');

    component.complete('t1');

    expect(api.completeOffboardingTask).toHaveBeenCalledWith('t1');
    expect(api.getOffboardingChecklist).toHaveBeenCalledTimes(2);
  });
});
