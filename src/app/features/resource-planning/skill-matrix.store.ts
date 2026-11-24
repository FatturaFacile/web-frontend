import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  CapacityResource,
  EmployeeSkillProfile,
  EmployeeSkillProfilePayload,
  PlanningIssue,
  ResourcePlanningApiService,
  Skill,
  SkillPayload,
} from '@core';
import { problemDetail, problemIssues } from './resource-planning.util';

export interface SkillMatrixState {
  skills: Skill[];
  profiles: EmployeeSkillProfile[];
  resources: CapacityResource[];
  /** Category filter of the matrix columns; null shows every skill. */
  category: string | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/** What a save or delete answered: the rules the API refused are in `issues`. */
export interface SkillOutcome {
  ok: boolean;
  issues: PlanningIssue[];
  message: string | null;
}

export interface MatrixCell {
  skill: Skill;
  profile: EmployeeSkillProfile | null;
}

export interface MatrixEmployeeRow {
  employeeId: string;
  employeeName: string;
  cells: MatrixCell[];
}

const initialState: SkillMatrixState = {
  skills: [],
  profiles: [],
  resources: [],
  category: null,
  loading: false,
  saving: false,
  error: null,
};

export const profileKey = (employeeId: string, skillId: string): string =>
  `${employeeId}|${skillId}`;

export const SkillMatrixStore = signalStore(
  withState(initialState),
  withComputed(({ skills, profiles, resources, category }) => ({
    categories: computed(() => [...new Set(skills().map((skill) => skill.category))].sort()),
    visibleSkills: computed(() =>
      skills()
        .filter((skill) => category() === null || skill.category === category())
        .sort((a, b) => a.category.localeCompare(b.category) || a.skill_name.localeCompare(b.skill_name)),
    ),
    /** Employees by skills: every employee with a contract is a row, a missing profile is an empty cell. */
    matrix: computed<MatrixEmployeeRow[]>(() => {
      const index = new Map(
        profiles().map((profile) => [profileKey(profile.employee_id, profile.skill_id), profile]),
      );
      const visible = skills()
        .filter((skill) => category() === null || skill.category === category())
        .sort(
          (a, b) => a.category.localeCompare(b.category) || a.skill_name.localeCompare(b.skill_name),
        );
      return [...resources()]
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
        .map((resource) => ({
          employeeId: resource.employee_id,
          employeeName: resource.full_name,
          cells: visible.map((skill) => ({
            skill,
            profile: index.get(profileKey(resource.employee_id, skill.id)) ?? null,
          })),
        }));
    }),
    /** Profiles whose certificate is missing or expired, or whose own validity has ended. */
    attentionCount: computed(
      () =>
        profiles().filter(
          (profile) =>
            !profile.is_valid ||
            profile.certification_status === 'missing' ||
            profile.certification_status === 'expired',
        ).length,
    ),
  })),
  withMethods((store, api = inject(ResourcePlanningApiService)) => {
    const load = async (): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const [skills, profiles] = await Promise.all([
          firstValueFrom(api.getSkills()),
          firstValueFrom(api.getSkillProfiles()),
        ]);
        patchState(store, { skills: skills.data, profiles: profiles.data, loading: false });
      } catch (error) {
        patchState(store, {
          loading: false,
          error: problemDetail(error) ?? 'resourcePlanning.loadError',
        });
      }
    };

    const run = async (call: () => Promise<unknown>): Promise<SkillOutcome> => {
      patchState(store, { saving: true, error: null });
      try {
        await call();
        await load();
        patchState(store, { saving: false });
        return { ok: true, issues: [], message: null };
      } catch (error) {
        patchState(store, { saving: false });
        return {
          ok: false,
          issues: problemIssues(error),
          message: problemDetail(error) ?? 'resourcePlanning.saveError',
        };
      }
    };

    return {
      async init(): Promise<void> {
        const resources = await firstValueFrom(api.getResources()).catch(() => null);
        patchState(store, { resources: resources?.data ?? [] });
        await load();
      },
      load,
      setCategory(category: string | null): void {
        patchState(store, { category });
      },
      /** Creates a skill, or updates the one with the id. */
      saveSkill(id: string | null, payload: SkillPayload): Promise<SkillOutcome> {
        return run(() =>
          firstValueFrom(id === null ? api.createSkill(payload) : api.updateSkill(id, payload)),
        );
      },
      deleteSkill(skill: Skill): Promise<SkillOutcome> {
        return run(() => firstValueFrom(api.deleteSkill(skill.id)));
      },
      /** Sets the proficiency of an employee in a skill (upsert on employee and skill). */
      saveProfile(payload: EmployeeSkillProfilePayload): Promise<SkillOutcome> {
        return run(() => firstValueFrom(api.saveSkillProfile(payload)));
      },
      deleteProfile(profile: EmployeeSkillProfile): Promise<SkillOutcome> {
        return run(() => firstValueFrom(api.deleteSkillProfile(profile.id)));
      },
    };
  }),
);
