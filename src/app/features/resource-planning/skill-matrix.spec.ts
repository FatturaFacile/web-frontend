import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeSkillProfile, ResourcePlanningApiService, TranslateService } from '@core';
import { icons } from '../../icons-provider';
import { resources, skills, translateSpy, wrap } from './resource-planning.testing';
import { SkillMatrixComponent } from './skill-matrix.component';
import { SkillMatrixStore } from './skill-matrix.store';

const profile = (overrides: Partial<EmployeeSkillProfile> = {}): EmployeeSkillProfile => ({
  id: 'pr-1',
  employee_id: 'e-1',
  employee_name: 'Anna Rossi',
  skill_id: 's-1',
  skill_name: 'Angular',
  category: 'Engineering',
  proficiency_level: 4,
  valid_until_date: null,
  is_valid: true,
  requires_certification: false,
  certification_code: null,
  certification_status: 'not_required',
  certification_valid_until: null,
  ...overrides,
});

const profiles: EmployeeSkillProfile[] = [
  profile(),
  profile({
    id: 'pr-2',
    employee_id: 'e-2',
    employee_name: 'Bruno Bianchi',
    skill_id: 's-2',
    skill_name: 'Forklift',
    category: 'Safety',
    proficiency_level: 3,
    requires_certification: true,
    certification_code: 'FORKLIFT',
    certification_status: 'expired',
    certification_valid_until: '2025-12-31',
  }),
];

function mockApi(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    getResources: vi.fn(() => of(wrap(resources))),
    getSkills: vi.fn(() => of(wrap(skills))),
    getSkillProfiles: vi.fn(() => of(wrap(profiles))),
    createSkill: vi.fn(() => of(wrap(skills[0]))),
    updateSkill: vi.fn(() => of(wrap(skills[0]))),
    deleteSkill: vi.fn(() => of(null)),
    saveSkillProfile: vi.fn(() => of(wrap(profiles[0]))),
    deleteSkillProfile: vi.fn(() => of(null)),
  };
}

describe('SkillMatrixStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof SkillMatrixStore>;

  beforeEach(() => {
    api = mockApi();
    TestBed.configureTestingModule({
      providers: [SkillMatrixStore, { provide: ResourcePlanningApiService, useValue: api }],
    });
    store = TestBed.inject(SkillMatrixStore);
  });

  it('builds the matrix of every employee with a contract by the skills, with empty cells', async () => {
    await store.init();

    const matrix = store.matrix();

    expect(matrix.map((row) => row.employeeName)).toEqual(['Anna Rossi', 'Bruno Bianchi']);
    expect(store.visibleSkills().map((skill) => skill.skill_name)).toEqual(['Angular', 'Forklift']);
    expect(matrix[0].cells[0].profile?.proficiency_level).toBe(4);
    expect(matrix[0].cells[1].profile).toBeNull();
    expect(matrix[1].cells[1].profile?.certification_status).toBe('expired');
  });

  it('filters the columns by category', async () => {
    await store.init();

    store.setCategory('Safety');

    expect(store.categories()).toEqual(['Engineering', 'Safety']);
    expect(store.visibleSkills().map((skill) => skill.skill_name)).toEqual(['Forklift']);
    expect(store.matrix()[0].cells).toHaveLength(1);

    store.setCategory(null);
    expect(store.visibleSkills()).toHaveLength(2);
  });

  it('counts the profiles whose certificate or validity needs attention', async () => {
    await store.init();

    expect(store.attentionCount()).toBe(1);
  });

  it('creates a skill, or updates the one with an id, then reloads', async () => {
    await store.init();
    api['getSkills'].mockClear();

    const created = await store.saveSkill(null, {
      category: 'Safety',
      skill_name: 'Welding',
      requires_certification: true,
      certification_code: 'WELD',
    });
    const updated = await store.saveSkill('s-1', { category: 'Engineering', skill_name: 'Angular 22' });

    expect(created.ok).toBe(true);
    expect(updated.ok).toBe(true);
    expect(api['createSkill']).toHaveBeenCalledWith({
      category: 'Safety',
      skill_name: 'Welding',
      requires_certification: true,
      certification_code: 'WELD',
    });
    expect(api['updateSkill']).toHaveBeenCalledWith('s-1', {
      category: 'Engineering',
      skill_name: 'Angular 22',
    });
    expect(api['getSkills']).toHaveBeenCalledTimes(2);
  });

  it('reports the rule that refused a skill', async () => {
    api['createSkill'].mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { detail: 'Refused', invalid_params: [{ code: 'certification_code_required' }] },
          }),
      ),
    );
    await store.init();

    const outcome = await store.saveSkill(null, { category: 'Safety', skill_name: 'Welding' });

    expect(outcome.ok).toBe(false);
    expect(outcome.issues[0].code).toBe('certification_code_required');
    expect(store.saving()).toBe(false);
  });

  it('upserts and deletes an employee profile and deletes a skill', async () => {
    await store.init();

    await store.saveProfile({ employee_id: 'e-1', skill_id: 's-2', proficiency_level: 2 });
    await store.deleteProfile(profiles[0]);
    await store.deleteSkill(skills[0]);

    expect(api['saveSkillProfile']).toHaveBeenCalledWith({
      employee_id: 'e-1',
      skill_id: 's-2',
      proficiency_level: 2,
    });
    expect(api['deleteSkillProfile']).toHaveBeenCalledWith('pr-1');
    expect(api['deleteSkill']).toHaveBeenCalledWith('s-1');
  });

  it('keeps the matrix empty and reports a failed load', async () => {
    api['getSkills'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: {} })),
    );

    await store.init();

    expect(store.error()).toBe('resourcePlanning.loadError');
    expect(store.matrix()[0]?.cells ?? []).toEqual([]);
  });
});

describe('SkillMatrixComponent', () => {
  const messageSpy = { success: vi.fn(), error: vi.fn() };
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    api = mockApi();
    TestBed.configureTestingModule({
      providers: [
        { provide: ResourcePlanningApiService, useValue: api },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy() },
        provideNzIcons(icons),
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(SkillMatrixComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows the employees by skills with the proficiency of each cell and the attention alert', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('table.matrix tbody tr')).toHaveLength(2);
    expect(root.querySelectorAll('table.matrix th.skill-head')).toHaveLength(2);
    expect(root.querySelectorAll('button.cell')).toHaveLength(4);
    expect(root.querySelectorAll('button.cell.cell-empty')).toHaveLength(2);
    expect(root.textContent).toContain('Anna Rossi');
    expect(root.textContent).toContain('Forklift');
    expect(root.querySelector('i.cert-expired')).not.toBeNull();
    expect(root.querySelector('nz-alert')).not.toBeNull();
  });

  it('opens a cell with its level and validity and saves the new level', async () => {
    const fixture = await render();
    const component = fixture.componentInstance;
    const row = component.store.matrix()[0];

    component.openProfile(row, row.cells[0]);
    expect(component.profileLevel()).toBe(4);

    component.profileLevel.set(5);
    component.profileValidUntil.set('2027-01-31');
    await component.saveProfile();

    expect(api['saveSkillProfile']).toHaveBeenCalledWith({
      employee_id: 'e-1',
      skill_id: 's-1',
      proficiency_level: 5,
      valid_until_date: '2027-01-31',
    });
    expect(component.profileDraft()).toBeNull();
    expect(messageSpy.success).toHaveBeenCalledWith('resourcePlanning.skills.profileSaved');
  });

  it('sets a first level on an empty cell without validity', async () => {
    const fixture = await render();
    const component = fixture.componentInstance;
    const row = component.store.matrix()[0];

    component.openProfile(row, row.cells[1]);
    expect(component.profileLevel()).toBe(3);
    await component.saveProfile();

    expect(api['saveSkillProfile']).toHaveBeenCalledWith({
      employee_id: 'e-1',
      skill_id: 's-2',
      proficiency_level: 3,
      valid_until_date: null,
    });
  });

  it('removes the skill of an employee', async () => {
    const fixture = await render();
    const component = fixture.componentInstance;

    await component.removeProfile(profiles[0]);

    expect(api['deleteSkillProfile']).toHaveBeenCalledWith('pr-1');
    expect(messageSpy.success).toHaveBeenCalledWith('resourcePlanning.skills.profileDeleted');
  });

  it('needs a certificate code for a certified skill before it can be saved', async () => {
    const fixture = await render();
    const component = fixture.componentInstance;

    component.openSkill(null);
    component.skillCategory.set('Safety');
    component.skillName.set('Welding');
    component.skillRequiresCertification.set(true);
    expect(component.skillInput()).toBeNull();

    component.skillCode.set('WELD');
    expect(component.skillInput()?.certification_code).toBe('WELD');

    await component.saveSkill();

    expect(api['createSkill']).toHaveBeenCalledWith({
      category: 'Safety',
      skill_name: 'Welding',
      requires_certification: true,
      certification_code: 'WELD',
    });
    expect(component.skillDialog()).toBeNull();
  });

  it('edits an existing skill and deletes one', async () => {
    const fixture = await render();
    const component = fixture.componentInstance;

    component.openSkill(skills[1]);
    expect(component.skillName()).toBe('Forklift');
    expect(component.skillCode()).toBe('FORKLIFT');
    component.skillName.set('Forklift truck');
    await component.saveSkill();
    await component.deleteSkill(skills[0]);

    expect(api['updateSkill']).toHaveBeenCalledWith('s-2', {
      category: 'Safety',
      skill_name: 'Forklift truck',
      requires_certification: true,
      certification_code: 'FORKLIFT',
    });
    expect(api['deleteSkill']).toHaveBeenCalledWith('s-1');
    expect(messageSpy.success).toHaveBeenCalledWith('resourcePlanning.skills.deleted');
  });

  it('keeps the dialog open and tells the rule when the API refuses a skill', async () => {
    api['createSkill'].mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { invalid_params: [{ code: 'certification_code_required' }] },
          }),
      ),
    );
    const fixture = await render();
    const component = fixture.componentInstance;
    component.openSkill(null);
    component.skillCategory.set('Safety');
    component.skillName.set('Welding');

    await component.saveSkill();

    expect(component.skillDialog()).not.toBeNull();
    expect(messageSpy.error).toHaveBeenCalledWith(
      'resourcePlanning.error.certification_code_required',
    );
  });
});
