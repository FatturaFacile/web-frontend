import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ProjectApiService,
  ResourcePlanningApiService,
  TranslateService,
} from '@core';
import { icons } from '../../icons-provider';
import { ProjectEvmApiService } from '../projects/evm/project-evm-api.service';
import { ResourcePlannerComponent } from './resource-planner.component';
import {
  allocation,
  dragEvent,
  heatmap,
  mutationResult,
  resources,
  translateSpy,
  wrap,
} from './resource-planning.testing';

const messageSpy = { success: vi.fn(), error: vi.fn() };

describe('ResourcePlannerComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let translate: ReturnType<typeof translateSpy>;

  beforeEach(() => {
    vi.clearAllMocks();
    translate = translateSpy();
    api = {
      getResources: vi.fn(() => of(wrap(resources))),
      getHeatmap: vi.fn(() => of(wrap(heatmap))),
      getAllocations: vi.fn(() =>
        of(
          wrap([
            allocation('a-1'),
            allocation('a-2', {
              employee_id: 'e-2',
              employee_name: 'Bruno Bianchi',
              booking_type: 'HardCommitted',
              project_name: 'Website',
            }),
          ]),
        ),
      ),
      rebalance: vi.fn(() => of(wrap(mutationResult()))),
      convertToHard: vi.fn(() => of(wrap(mutationResult()))),
      deleteAllocation: vi.fn(() => of(null)),
      createAllocation: vi.fn(() => of(wrap(mutationResult()))),
      getSkills: vi.fn(() => of(wrap([]))),
      searchCandidates: vi.fn(() => of(wrap([]))),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ResourcePlanningApiService, useValue: api },
        {
          provide: ProjectApiService,
          useValue: { getProjects: vi.fn(() => of({ success: true, message: '', data: [], meta: {} })) },
        },
        { provide: ProjectEvmApiService, useValue: { wbsBreakdown: vi.fn(() => of({ data: { nodes: [] } })) } },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translate },
        provideNzIcons(icons),
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(ResourcePlannerComponent);
    // The window starts on the Monday of the anchor: pin it so the dates of the fixtures are inside it.
    await fixture.componentInstance.store.goTo('2026-03-02');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  /** Picks a bar up as the browser does at the start of a drag. */
  function pickUp(
    component: ResourcePlannerComponent,
    id: string,
    mode: 'move' | 'resize-start' | 'resize-end' = 'move',
  ): void {
    const bar = Object.values(component.store.barsByEmployee())
      .flat()
      .find((candidate) => candidate.allocation.id === id);
    component.startDrag(dragEvent(), (bar as NonNullable<typeof bar>).allocation, mode);
  }

  describe('heatmap', () => {
    it('colours every cell by band: green below 80, yellow up to 100, red above, grey without capacity', async () => {
      const fixture = await render();
      const root = fixture.nativeElement as HTMLElement;

      expect(root.querySelectorAll('td.cell.band-green').length).toBe(3);
      expect(root.querySelectorAll('td.cell.band-yellow').length).toBe(1);
      expect(root.querySelectorAll('td.cell.band-red').length).toBe(1);
      expect(root.querySelectorAll('td.cell.band-none').length).toBe(1);
      expect(root.textContent).toContain('125%');
      expect(root.textContent).toContain('Anna Rossi');
      expect(root.textContent).toContain('Bruno Bianchi');
    });

    it('raises an explicit overload alert with the resources and a badge on the row', async () => {
      const fixture = await render();
      const root = fixture.nativeElement as HTMLElement;

      const alert = root.querySelector('.overload-alert');

      expect(alert).not.toBeNull();
      expect(translate.translate).toHaveBeenCalledWith('resourcePlanning.overload.title', {
        count: 1,
      });
      expect(alert?.textContent).toContain('Anna Rossi');
      expect(root.querySelectorAll('.resource.overloaded')).toHaveLength(1);
      expect(root.querySelector('.resource.overloaded nz-tag')).not.toBeNull();
      expect(root.querySelector('nz-badge.overload-badge')).not.toBeNull();
    });

    it('shows no overload alert when nobody is above 100 percent', async () => {
      api['getHeatmap'].mockReturnValue(
        of(
          wrap({
            ...heatmap,
            rows: [heatmap.rows[1]],
          }),
        ),
      );

      const fixture = await render();

      expect(fixture.nativeElement.querySelector('.overload-alert')).toBeNull();
      expect(fixture.componentInstance.store.overloadedEmployeeCount()).toBe(0);
    });

    it('draws the bookings as bars under their rows, hard and tentative apart', async () => {
      const fixture = await render();
      const root = fixture.nativeElement as HTMLElement;

      expect(root.querySelectorAll('.bar')).toHaveLength(2);
      expect(root.querySelectorAll('.bar-soft')).toHaveLength(2); // the bar and its legend swatch
      expect(root.querySelector('.bar.bar-hard')?.textContent).toContain('Website');
      expect(root.querySelector('.bar.bar-soft')?.textContent).toContain('Migration');
      expect(root.querySelectorAll('.handle').length).toBe(4);
    });

    it('offers the empty state when no resource has a contract', async () => {
      api['getHeatmap'].mockReturnValue(of(wrap({ ...heatmap, rows: [] })));

      const fixture = await render();

      expect(fixture.nativeElement.querySelector('nz-empty')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('table.heatmap')).toBeNull();
    });

    it('reloads the view in days when the granularity changes', async () => {
      const fixture = await render();

      fixture.componentInstance.setGranularity('day');
      await fixture.whenStable();

      expect(api['getHeatmap']).toHaveBeenLastCalledWith(
        expect.objectContaining({ granularity: 'day' }),
      );
    });
  });

  describe('drag and drop', () => {
    it('moves a booking to the next week of a colleague with one shift request', async () => {
      const fixture = await render();
      pickUp(fixture.componentInstance, 'a-1');

      await fixture.componentInstance.dropOn('e-2', '2026-03-16', false);

      expect(api['rebalance']).toHaveBeenCalledWith('a-1', {
        strategy: 'shift',
        shift_days: 7,
        employee_id: 'e-2',
      });
      expect(messageSpy.success).toHaveBeenCalledWith('resourcePlanning.saved');
      expect(fixture.componentInstance.dragging()).toBeNull();
    });

    it('does not call the API for a drop that changes nothing', async () => {
      const fixture = await render();
      pickUp(fixture.componentInstance, 'a-1');

      await fixture.componentInstance.dropOn('e-1', '2026-03-09', false);

      expect(api['rebalance']).not.toHaveBeenCalled();
      expect(messageSpy.success).not.toHaveBeenCalled();
    });

    it('ignores a drop that does not come from a bar', async () => {
      const fixture = await render();

      await fixture.componentInstance.dropOn('e-2', '2026-03-16', false);

      expect(api['rebalance']).not.toHaveBeenCalled();
    });

    it('resizes the end of a booking dragged by its right handle', async () => {
      const fixture = await render();
      pickUp(fixture.componentInstance, 'a-1', 'resize-end');

      await fixture.componentInstance.dropOn('e-1', '2026-03-23', false);

      expect(api['rebalance']).toHaveBeenCalledWith('a-1', {
        strategy: 'resize',
        end_date: '2026-03-29',
      });
    });

    it('resizes the start of a booking dragged by its left handle', async () => {
      const fixture = await render();
      pickUp(fixture.componentInstance, 'a-1', 'resize-start');

      await fixture.componentInstance.dropOn('e-1', '2026-03-02', false);

      expect(api['rebalance']).toHaveBeenCalledWith('a-1', {
        strategy: 'resize',
        start_date: '2026-03-02',
      });
    });

    it('splits a booking dropped with Shift held and gives the second part to the colleague', async () => {
      const fixture = await render();
      pickUp(fixture.componentInstance, 'a-1');

      await fixture.componentInstance.dropOn('e-2', '2026-03-16', true);

      expect(api['rebalance']).toHaveBeenCalledWith('a-1', {
        strategy: 'split',
        split_date: '2026-03-16',
        employee_id: 'e-2',
      });
    });

    it('reads the period under the pointer when a bar is dropped on the lane', async () => {
      const fixture = await render();
      pickUp(fixture.componentInstance, 'a-1');
      const event = dragEvent({
        clientX: 300,
        currentTarget: { getBoundingClientRect: () => ({ left: 0, width: 400 }) },
      });

      fixture.componentInstance.onLaneDrop(event, 'e-1');
      await fixture.whenStable();

      // 300 of 400 pixels over three periods is the third: the week of 16 March.
      expect(api['rebalance']).toHaveBeenCalledWith('a-1', { strategy: 'shift', shift_days: 7 });
    });

    it('stops the drag of a handle from starting the drag of the bar', async () => {
      const fixture = await render();
      const bar = fixture.componentInstance.store.barsByEmployee()['e-1'][0];
      const event = dragEvent();

      fixture.componentInstance.startDrag(event, bar.allocation, 'resize-end');
      fixture.componentInstance.startDrag(dragEvent(), bar.allocation, 'move');

      expect(event.stopPropagation).toHaveBeenCalled();
      expect(fixture.componentInstance.dragging()?.mode).toBe('move');
    });

    it('allows a drop only while a bar is on the drag', async () => {
      const fixture = await render();
      const idle = dragEvent();
      fixture.componentInstance.allowDrop(idle);
      expect(idle.preventDefault).not.toHaveBeenCalled();

      pickUp(fixture.componentInstance, 'a-1');
      const dragging = dragEvent();
      fixture.componentInstance.allowDrop(dragging);
      expect(dragging.preventDefault).toHaveBeenCalled();
    });
  });

  describe('results of a change', () => {
    it('shows the overload verdict and the warnings of the answer', async () => {
      api['rebalance'].mockReturnValue(
        of(
          wrap(
            mutationResult({
              overload: {
                is_overloaded: true,
                peak_load_percent: 132.5,
                weeks: [{ week_start: '2026-03-16', load_percent: 132.5 }],
              },
              warnings: [{ code: 'certificate_missing', params: { skill_name: 'Forklift' } }],
            }),
          ),
        ),
      );
      const fixture = await render();
      pickUp(fixture.componentInstance, 'a-1');

      await fixture.componentInstance.dropOn('e-2', '2026-03-16', false);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(translate.translate).toHaveBeenCalledWith('resourcePlanning.result.overload', {
        peak: '132.5%',
      });
      expect(translate.instant).toHaveBeenCalledWith('resourcePlanning.warning.certificate_missing', {
        skill_name: 'Forklift',
      });
      expect(fixture.nativeElement.textContent).toContain('resourcePlanning.warning.certificate_missing');
    });

    it('tells the planner which rule refused the change and keeps the view', async () => {
      api['rebalance'].mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 422,
              error: { detail: 'Refused', invalid_params: [{ code: 'no_working_days' }] },
            }),
        ),
      );
      const fixture = await render();
      pickUp(fixture.componentInstance, 'a-1');

      await fixture.componentInstance.dropOn('e-2', '2026-03-16', false);
      fixture.detectChanges();

      expect(messageSpy.error).toHaveBeenCalledWith('resourcePlanning.error.no_working_days');
      expect(fixture.componentInstance.store.rejectedAllocationId()).toBe('a-1');
      expect(fixture.nativeElement.textContent).toContain('no_working_days');
      expect(fixture.nativeElement.querySelector('.bar-rejected')).not.toBeNull();
    });
  });

  describe('menu actions', () => {
    it('moves a booking one period earlier or later from the keyboard', async () => {
      const fixture = await render();

      await fixture.componentInstance.step(allocation('a-1'), 1);
      await fixture.componentInstance.step(allocation('a-1'), -1);

      expect(api['rebalance']).toHaveBeenNthCalledWith(1, 'a-1', { strategy: 'shift', shift_days: 7 });
      expect(api['rebalance']).toHaveBeenNthCalledWith(2, 'a-1', { strategy: 'shift', shift_days: -7 });
    });

    it('moves by one day in the day view', async () => {
      const fixture = await render();
      fixture.componentInstance.setGranularity('day');
      await fixture.whenStable();

      await fixture.componentInstance.step(allocation('a-1'), 1);

      expect(api['rebalance']).toHaveBeenCalledWith('a-1', { strategy: 'shift', shift_days: 1 });
    });

    it('reassigns a booking to a colleague but not to its own resource', async () => {
      const fixture = await render();

      await fixture.componentInstance.reassign(allocation('a-1'), 'e-1');
      expect(api['rebalance']).not.toHaveBeenCalled();

      await fixture.componentInstance.reassign(allocation('a-1'), 'e-2');
      expect(api['rebalance']).toHaveBeenCalledWith('a-1', {
        strategy: 'reassign',
        employee_id: 'e-2',
      });
    });

    it('converts a tentative booking that has a project to hard at once', async () => {
      const fixture = await render();

      await fixture.componentInstance.convert(allocation('a-1'));

      expect(api['convertToHard']).toHaveBeenCalledWith('a-1', {});
      expect(messageSpy.success).toHaveBeenCalledWith('resourcePlanning.converted');
      expect(fixture.componentInstance.dialog()).toBeNull();
    });

    it('asks for the project first when the tentative booking holds only an opportunity', async () => {
      const fixture = await render();
      const onlyOpportunity = allocation('a-1', {
        project_id: null,
        project_name: null,
        crm_opportunity_id: 'o-1',
        crm_opportunity_name: 'Big deal',
      });

      await fixture.componentInstance.convert(onlyOpportunity);

      expect(api['convertToHard']).not.toHaveBeenCalled();
      expect(fixture.componentInstance.dialog()).toEqual({
        mode: 'convert',
        allocation: onlyOpportunity,
      });
    });

    it('sends the project of the convert dialog and closes it', async () => {
      const fixture = await render();
      const onlyOpportunity = allocation('a-1', { project_id: null });
      fixture.componentInstance.openDialog('convert', onlyOpportunity);

      await fixture.componentInstance.submitDialog({
        mode: 'convert',
        allocation: onlyOpportunity,
        convert: { project_id: 'p-2', wbs_node_id: 'w-1' },
      });

      expect(api['convertToHard']).toHaveBeenCalledWith('a-1', {
        project_id: 'p-2',
        wbs_node_id: 'w-1',
      });
      expect(fixture.componentInstance.dialog()).toBeNull();
    });

    it('resizes and splits through the dialog with the rebalance request it built', async () => {
      const fixture = await render();
      const booking = allocation('a-1');

      await fixture.componentInstance.submitDialog({
        mode: 'edit',
        allocation: booking,
        rebalance: {
          strategy: 'resize',
          start_date: '2026-03-09',
          end_date: '2026-03-27',
          allocated_hours_per_day: 6,
        },
      });
      await fixture.componentInstance.submitDialog({
        mode: 'split',
        allocation: booking,
        rebalance: { strategy: 'split', split_date: '2026-03-16' },
      });

      expect(api['rebalance']).toHaveBeenNthCalledWith(1, 'a-1', {
        strategy: 'resize',
        start_date: '2026-03-09',
        end_date: '2026-03-27',
        allocated_hours_per_day: 6,
      });
      expect(api['rebalance']).toHaveBeenNthCalledWith(2, 'a-1', {
        strategy: 'split',
        split_date: '2026-03-16',
      });
    });

    it('keeps the dialog open when the API refuses the change', async () => {
      api['rebalance'].mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 422,
              error: { invalid_params: [{ code: 'invalid_period' }] },
            }),
        ),
      );
      const fixture = await render();
      const booking = allocation('a-1');
      fixture.componentInstance.openDialog('edit', booking);

      await fixture.componentInstance.submitDialog({
        mode: 'edit',
        allocation: booking,
        rebalance: { strategy: 'resize', end_date: '2026-03-01' },
      });

      expect(fixture.componentInstance.dialog()).not.toBeNull();
      expect(messageSpy.error).toHaveBeenCalledWith('resourcePlanning.error.invalid_period');
    });

    it('deletes a booking', async () => {
      const fixture = await render();

      await fixture.componentInstance.remove(allocation('a-1'));

      expect(api['deleteAllocation']).toHaveBeenCalledWith('a-1');
      expect(messageSpy.success).toHaveBeenCalledWith('resourcePlanning.deleted');
    });
  });
});
