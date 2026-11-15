import { describe, expect, it } from 'vitest';
import { CONTRACT_AUTHORING_PAGE } from './authoring.page';

describe('CONTRACT_AUTHORING_PAGE', () => {
  it('has the four authoring tabs on the contracts module', () => {
    expect(CONTRACT_AUTHORING_PAGE.tabs.map((tab) => tab.id)).toEqual([
      'contract-clauses',
      'contract-templates',
      'contract-redlining',
      'contract-signatures',
    ]);
    expect(CONTRACT_AUTHORING_PAGE.tabs.every((tab) => tab.module === 'contracts')).toBe(true);
  });

  it('calls only the contract-authoring and contract-register endpoints', () => {
    const paths = CONTRACT_AUTHORING_PAGE.tabs.flatMap((tab) => [
      tab.list?.path,
      tab.create?.path,
      ...(tab.rowActions ?? []).map((action) => action.path),
    ]);

    expect(paths.filter((path): path is string => !!path).every((path) => /^\/contract-(authoring|register)\//.test(path) || path === '/contract-register')).toBe(true);
  });

  it('asks for every path placeholder that is not a column of the contract row', () => {
    const rowKeys = ['id', 'kind'];

    for (const tab of CONTRACT_AUTHORING_PAGE.tabs) {
      for (const action of tab.rowActions ?? []) {
        const placeholders = [...action.path.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
        const fieldKeys = (action.fields ?? []).map((field) => field.key);

        for (const placeholder of placeholders) {
          expect(rowKeys.includes(placeholder) || fieldKeys.includes(placeholder), `${action.path} needs ${placeholder}`).toBe(true);
        }
      }
    }
  });
});
