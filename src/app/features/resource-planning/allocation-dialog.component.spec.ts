import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectApiService, TranslateService } from '@core';
import { icons } from '../../icons-provider';
import { ProjectEvmApiService } from '../projects/evm/project-evm-api.service';
import { AllocationDialogComponent, DialogResult } from './allocation-dialog.component';
import { flattenWbs } from './project-wbs-picker.component';
import { allocation, translateSpy } from './resource-planning.testing';

describe('AllocationDialogComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslateService, useValue: translateSpy() },
        {
          provide: ProjectApiService,
          useValue: { getProjects: vi.fn(() => of({ success: true, message: '', data: [], meta: {} })) },
        },
        { provide: ProjectEvmApiService, useValue: { wbsBreakdown: vi.fn(() => of({ data: { nodes: [] } })) } },
        provideNzIcons(icons),
      ],
    });
  });

  function create(mode: 'edit' | 'split' | 'convert', booking = allocation('a-1')) {
    const fixture = TestBed.createComponent(AllocationDialogComponent);
    const submitted = vi.fn<(result: DialogResult) => void>();
    fixture.componentInstance.submitted.subscribe(submitted);
    fixture.componentRef.setInput('request', { mode, allocation: booking });
    fixture.detectChanges();
    return { fixture, dialog: fixture.componentInstance, submitted, booking };
  }

  it('starts the edit form from the booking and sends a resize with the three values', () => {
    const { dialog, submitted, booking } = create('edit');

    expect(dialog.startDate()).toBe('2026-03-09');
    expect(dialog.endDate()).toBe('2026-03-20');
    expect(dialog.hoursPerDay()).toBe(4);
    expect(dialog.valid()).toBe(true);

    dialog.endDate.set('2026-03-27');
    dialog.hoursPerDay.set(6);
    dialog.submit();

    expect(submitted).toHaveBeenCalledWith({
      mode: 'edit',
      allocation: booking,
      rebalance: {
        strategy: 'resize',
        start_date: '2026-03-09',
        end_date: '2026-03-27',
        allocated_hours_per_day: 6,
      },
    });
  });

  it('refuses an end before the start and hours outside 0 to 24', () => {
    const { dialog, submitted } = create('edit');

    dialog.endDate.set('2026-03-01');
    expect(dialog.valid()).toBe(false);
    dialog.submit();

    dialog.endDate.set('2026-03-20');
    dialog.hoursPerDay.set(25);
    expect(dialog.valid()).toBe(false);
    dialog.hoursPerDay.set(0);
    expect(dialog.valid()).toBe(false);

    expect(submitted).not.toHaveBeenCalled();
  });

  it('splits only after the first day and up to the last, and may hand the second part to a colleague', () => {
    const { dialog, submitted, booking } = create('split');

    expect(dialog.valid()).toBe(false); // the start date itself is not a cut

    dialog.splitDate.set('2026-03-16');
    dialog.splitEmployeeId.set('e-2');
    expect(dialog.valid()).toBe(true);
    dialog.submit();

    expect(submitted).toHaveBeenCalledWith({
      mode: 'split',
      allocation: booking,
      rebalance: { strategy: 'split', split_date: '2026-03-16', employee_id: 'e-2' },
    });
  });

  it('leaves the employee out of a split that keeps the same resource', () => {
    const { dialog, submitted } = create('split');
    dialog.splitDate.set('2026-03-16');
    dialog.splitEmployeeId.set('e-1');

    dialog.submit();

    expect(submitted.mock.calls[0][0].rebalance).toEqual({
      strategy: 'split',
      split_date: '2026-03-16',
    });
  });

  it('converts a tentative booking that has a project without asking for one', () => {
    const { dialog, submitted, booking } = create('convert');

    expect(dialog.needsProject()).toBe(false);
    expect(dialog.valid()).toBe(true);
    dialog.submit();

    expect(submitted).toHaveBeenCalledWith({
      mode: 'convert',
      allocation: booking,
      convert: { project_id: 'p-1' },
    });
  });

  it('requires a project when the tentative booking holds only an opportunity', () => {
    const { dialog, submitted } = create(
      'convert',
      allocation('a-1', { project_id: null, crm_opportunity_id: 'o-1' }),
    );

    expect(dialog.needsProject()).toBe(true);
    expect(dialog.valid()).toBe(false);
    dialog.submit();
    expect(submitted).not.toHaveBeenCalled();

    dialog.projectId.set('p-2');
    dialog.wbsNodeId.set('w-1');
    expect(dialog.valid()).toBe(true);
    dialog.submit();

    expect(submitted.mock.calls[0][0].convert).toEqual({ project_id: 'p-2', wbs_node_id: 'w-1' });
  });

  it('flattens the WBS tree depth first with the code and the title', () => {
    const node = (id: string, code: string, children: unknown[] = []) =>
      ({ wbs_node_id: id, wbs_code: code, title: `Node ${code}`, children }) as never;

    expect(flattenWbs([node('w-1', '1', [node('w-2', '1.1')]), node('w-3', '2')])).toEqual([
      { id: 'w-1', label: '1 · Node 1' },
      { id: 'w-2', label: '1.1 · Node 1.1' },
      { id: 'w-3', label: '2 · Node 2' },
    ]);
  });
});
