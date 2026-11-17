import { ResourceAction, ResourcePageConfig, ResourcePanelConfig } from '@shared';
import { describe, expect, it } from 'vitest';
import { PROJECT_PLANNING_PAGE, PROJECT_TOOL_PANELS } from '../../projects/control/pc-tools.page';
import { SUPPLIER_BACK_OFFICE_PAGE } from '../../supplier-portal/supplier-back-office.page';
import { TREASURY_ADVANCED_PAGE } from './treasury-advanced.page';

const PAGES: Record<string, ResourcePageConfig> = {
  TREASURY_ADVANCED_PAGE,
  SUPPLIER_BACK_OFFICE_PAGE,
  PROJECT_PLANNING_PAGE,
  PROJECT_TOOL_PANELS: { titleKey: 'RES.PAGE.PROJECT_TOOLS', tabs: PROJECT_TOOL_PANELS },
};

function actionsOf(tab: ResourcePanelConfig): ResourceAction[] {
  return [...(tab.create ? [tab.create] : []), ...(tab.rowActions ?? []), ...(tab.toolbar ?? [])];
}

describe('treasury, supplier portal and project back-office page configs', () => {
  for (const [name, page] of Object.entries(PAGES)) {
    describe(name, () => {
      it('has unique tab ids and a module on every panel', () => {
        const ids = page.tabs.map((tab) => tab.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(page.tabs.every((tab) => tab.module.length > 0)).toBe(true);
      });

      it('uses API-relative paths without the version prefix', () => {
        for (const tab of page.tabs) {
          expect(tab.list.path.startsWith('/')).toBe(true);
          for (const action of actionsOf(tab)) {
            expect(action.path.startsWith('/')).toBe(true);
            expect(action.path.includes('/v1/')).toBe(false);
          }
        }
      });

      it('asks for every path placeholder of a toolbar action in its form', () => {
        for (const tab of page.tabs) {
          for (const action of tab.toolbar ?? []) {
            const placeholders = [...action.path.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
            const keys = new Set((action.fields ?? []).map((field) => field.key));
            for (const placeholder of placeholders) {
              expect(placeholder === 'project_id' || keys.has(placeholder)).toBe(true);
            }
          }
        }
      });
    });
  }
});
