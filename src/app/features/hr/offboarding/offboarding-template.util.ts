import { OffboardingTaskCode, OffboardingTemplateTask } from '@core';

export const OFFBOARDING_TASK_CODES: OffboardingTaskCode[] = [
  'asset_return',
  'access_revocation',
  'exit_interview',
  'final_settlement',
  'custom',
];

/**
 * Reads the tasks of a template from lines of text: `Title | code | days after the termination date`.
 * The code and the days are optional; an unknown code means a custom task, a wrong number of days is left out.
 */
export function parseTemplateTasks(text: string): OffboardingTemplateTask[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => {
      const [title, code, days] = line.split('|').map((part) => part.trim());
      const task: OffboardingTemplateTask = { title };
      if (code) {
        task.code = (OFFBOARDING_TASK_CODES as string[]).includes(code) ? (code as OffboardingTaskCode) : 'custom';
      }
      if (days !== undefined && /^-?\d+$/.test(days)) {
        task.due_after_days = Number(days);
      }
      return task;
    });
}
