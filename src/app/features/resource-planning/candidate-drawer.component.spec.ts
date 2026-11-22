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
import { CandidateDrawerComponent } from './candidate-drawer.component';
import { ResourcePlannerStore } from './resource-planning.store';
import {
  candidate,
  heatmap,
  mutationResult,
  skills,
  translateSpy,
  wrap,
} from './resource-planning.testing';

const messageSpy = { success: vi.fn(), error: vi.fn() };

describe('CandidateDrawerComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let translate: ReturnType<typeof translateSpy>;

  beforeEach(() => {
    vi.clearAllMocks();
    translate = translateSpy();
    api = {
      getSkills: vi.fn(() => of(wrap(skills))),
      searchCandidates: vi.fn(() => of(wrap([candidate()]))),
      createAllocation: vi.fn(() => of(wrap(mutationResult()))),
      getResources: vi.fn(() => of(wrap([]))),
      getHeatmap: vi.fn(() => of(wrap(heatmap))),
      getAllocations: vi.fn(() => of(wrap([]))),
    };
    TestBed.configureTestingModule({
      providers: [
        ResourcePlannerStore,
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

  async function render(open = true) {
    const fixture = TestBed.createComponent(CandidateDrawerComponent);
    fixture.componentRef.setInput('open', open);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const drawer = fixture.componentInstance;
    drawer.startDate.set('2026-03-02');
    drawer.endDate.set('2026-03-13');
    drawer.hoursPerDay.set(4);
    return fixture;
  }

  it('loads the skills of the taxonomy when it opens', async () => {
    const fixture = await render();

    expect(api['getSkills']).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.skills()).toHaveLength(2);
  });

  it('does not load anything while it is closed', async () => {
    await render(false);

    expect(api['getSkills']).not.toHaveBeenCalled();
  });

  it('cannot search without a skill, a valid window and hours', async () => {
    const fixture = await render();
    const drawer = fixture.componentInstance;

    expect(drawer.canSearch()).toBe(false);
    await drawer.search();
    expect(api['searchCandidates']).not.toHaveBeenCalled();

    drawer.setSkill(0, 's-1');
    expect(drawer.canSearch()).toBe(true);
    drawer.endDate.set('2026-03-01');
    expect(drawer.canSearch()).toBe(false);
  });

  it('searches with the skills, their minimum level, the window and the hours per day', async () => {
    const fixture = await render();
    const drawer = fixture.componentInstance;
    drawer.setSkill(0, 's-1');
    drawer.setLevel(0, 4);
    drawer.addRequirement();
    drawer.setSkill(1, 's-2');
    drawer.departmentId.set('d-2');
    drawer.includeIneligible.set(true);

    await drawer.search();

    expect(api['searchCandidates']).toHaveBeenCalledWith({
      start_date: '2026-03-02',
      end_date: '2026-03-13',
      allocated_hours_per_day: 4,
      requirements: [
        { skill_id: 's-1', min_level: 4 },
        { skill_id: 's-2', min_level: 3 },
      ],
      department_id: 'd-2',
      require_valid_certificates: true,
      include_ineligible: true,
    });
    expect(drawer.candidates()).toHaveLength(1);
  });

  it('keeps at least one requirement row', async () => {
    const fixture = await render();
    const drawer = fixture.componentInstance;

    drawer.removeRequirement(0);
    expect(drawer.requirements()).toHaveLength(1);

    drawer.addRequirement();
    drawer.removeRequirement(0);
    expect(drawer.requirements()).toHaveLength(1);
  });

  it('ranks the candidates with their matched skills, blockers, residual hours and peak load', async () => {
    api['searchCandidates'].mockReturnValue(
      of(
        wrap([
          candidate(),
          candidate({
            employee_id: 'e-3',
            employee_name: 'Carla Verdi',
            score: 41,
            eligible: false,
            matched_skills: [
              {
                skill_id: 's-2',
                skill_name: 'Forklift',
                level: 3,
                min_level: 3,
                valid_until_date: '2025-12-31',
                certification_status: 'expired',
              },
            ],
            blockers: [
              { code: 'certificate_expired', skill_id: 's-2' },
              { code: 'insufficient_availability', skill_id: null },
            ],
            residual_hours_per_day: 0,
            peak_load_after_percent: 112,
          }),
        ]),
      ),
    );
    const fixture = await render();
    fixture.componentInstance.setSkill(0, 's-1');

    await fixture.componentInstance.search();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = document.body.textContent as string;
    const items = document.body.querySelectorAll('li.candidate');

    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Bruno Bianchi');
    expect(items[0].textContent).toContain('3.5h');
    expect(items[0].textContent).toContain('72.5%');
    expect(items[0].textContent).toContain('resourcePlanning.candidates.eligible');
    expect(items[1].classList.contains('ineligible')).toBe(true);
    expect(items[1].textContent).toContain('Forklift');
    expect(items[1].textContent).toContain('resourcePlanning.certification.expired');
    expect(items[1].textContent).toContain('112%');
    expect(text).toContain('resourcePlanning.blocker.certificate_expired');
    expect(text).toContain('resourcePlanning.blocker.insufficient_availability');
    expect(translate.instant).toHaveBeenCalledWith('resourcePlanning.blocker.certificate_expired', {});
  });

  it('shows the empty state when nobody is compatible', async () => {
    api['searchCandidates'].mockReturnValue(of(wrap([])));
    const fixture = await render();
    fixture.componentInstance.setSkill(0, 's-1');

    await fixture.componentInstance.search();
    fixture.detectChanges();

    expect(document.body.querySelector('nz-empty')).not.toBeNull();
  });

  it('reports a failed search', async () => {
    api['searchCandidates'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: {} })),
    );
    const fixture = await render();
    fixture.componentInstance.setSkill(0, 's-1');

    await fixture.componentInstance.search();

    expect(fixture.componentInstance.searchError()).toBe('resourcePlanning.candidates.searchError');
    expect(fixture.componentInstance.searching()).toBe(false);
  });

  describe('one-click allocation', () => {
    async function searched() {
      const fixture = await render();
      const drawer = fixture.componentInstance;
      drawer.setSkill(0, 's-1');
      drawer.setLevel(0, 4);
      drawer.projectId.set('p-1');
      await drawer.search();
      return { fixture, drawer, found: (drawer.candidates() ?? [])[0] };
    }

    it('books the candidate hard on the project and WBS node of the search and searches again', async () => {
      const { drawer, found } = await searched();
      drawer.wbsNodeId.set('w-1');

      await drawer.allocate(found, 'HardCommitted');

      expect(api['createAllocation']).toHaveBeenCalledWith({
        employee_id: 'e-2',
        project_id: 'p-1',
        wbs_node_id: 'w-1',
        booking_type: 'HardCommitted',
        start_date: '2026-03-02',
        end_date: '2026-03-13',
        allocated_hours_per_day: 4,
        required_skill_ids: ['s-1'],
      });
      expect(messageSpy.success).toHaveBeenCalledWith('resourcePlanning.created');
      // The residual availability changed: the list is searched again.
      expect(api['searchCandidates']).toHaveBeenCalledTimes(2);
    });

    it('books the candidate tentatively', async () => {
      const { drawer, found } = await searched();

      await drawer.allocate(found, 'SoftTentative');

      expect(api['createAllocation']).toHaveBeenCalledWith(
        expect.objectContaining({ employee_id: 'e-2', booking_type: 'SoftTentative' }),
      );
    });

    it('needs a project', async () => {
      const { drawer, found } = await searched();
      drawer.projectId.set(null);

      await drawer.allocate(found, 'HardCommitted');

      expect(api['createAllocation']).not.toHaveBeenCalled();
    });

    it('shows the lapsed skill and certificate warnings of the new booking', async () => {
      api['createAllocation'].mockReturnValue(
        of(
          wrap(
            mutationResult({
              warnings: [{ code: 'skill_expired', params: { skill_id: 's-1', skill_name: 'Angular' } }],
            }),
          ),
        ),
      );
      const { fixture, drawer, found } = await searched();

      await drawer.allocate(found, 'HardCommitted');
      fixture.detectChanges();

      expect(translate.instant).toHaveBeenCalledWith('resourcePlanning.warning.skill_expired', {
        skill_id: 's-1',
        skill_name: 'Angular',
      });
      expect(document.body.textContent).toContain('resourcePlanning.warning.skill_expired');
    });

    it('tells the planner which rule refused the booking', async () => {
      api['createAllocation'].mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 422,
              error: { invalid_params: [{ code: 'project_not_allocatable' }] },
            }),
        ),
      );
      const { drawer, found } = await searched();

      await drawer.allocate(found, 'HardCommitted');

      expect(messageSpy.error).toHaveBeenCalledWith('resourcePlanning.error.project_not_allocatable');
      expect(messageSpy.success).not.toHaveBeenCalled();
      expect(api['searchCandidates']).toHaveBeenCalledTimes(1);
    });
  });
});
