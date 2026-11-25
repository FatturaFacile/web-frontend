import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { baseProviders, convention, lookups, page, wrap } from './corporate-conventions.testing';
import { ConventionsComponent } from './conventions.component';

describe('ConventionsComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let canWrite: boolean;

  beforeEach(() => {
    canWrite = true;
    api = {
      getLookups: vi.fn(() => of(wrap(lookups))),
      listConventions: vi.fn(() =>
        of(
          page([
            convention('1', { status: 'DRAFT', name: 'Draft one' }),
            convention('2', { status: 'ACTIVE', name: 'Active two', has_contract_document: true }),
            convention('3', { status: 'EXPIRED', name: 'Expired three' }),
          ]),
        ),
      ),
      transitionConvention: vi.fn(() => of(wrap(convention('1')))),
      deleteConvention: vi.fn(() => of(wrap(null))),
      getConvention: vi.fn(() => of(wrap(convention('2')))),
      getIdentifierStats: vi.fn(() => of(wrap({ total: 0, used: 0 }))),
    };
    TestBed.configureTestingModule({ providers: baseProviders(api, () => canWrite) });
  });

  async function render() {
    const fixture = TestBed.createComponent(ConventionsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function rowOf(root: HTMLElement, name: string): Element | undefined {
    return Array.from(root.querySelectorAll('tbody tr.ant-table-row')).find((row) =>
      (row.textContent ?? '').includes(name),
    );
  }

  it('lists the conventions with partner, type, validity, enrolment and status', async () => {
    const root = await render();

    expect(api['listConventions']).toHaveBeenCalledWith({ per_page: 25, page: 1 });
    expect(root.querySelectorAll('tbody tr.ant-table-row')).toHaveLength(3);
    const second = rowOf(root, 'Active two')?.textContent ?? '';
    expect(second).toContain('Partner 2 Srl');
    expect(second).toContain('corporateConventions.partnerType.CORPORATE');
    expect(second).toContain('corporateConventions.status.ACTIVE');
    expect(second).toContain('12');
    expect(second).toContain('+ 4');
  });

  it('offers activation of a draft, suspension of an active convention and nothing on an expired one', async () => {
    const root = await render();
    const draft = rowOf(root, 'Draft one')?.textContent ?? '';
    const active = rowOf(root, 'Active two')?.textContent ?? '';
    const expired = rowOf(root, 'Expired three')?.textContent ?? '';

    expect(draft).toContain('corporateConventions.action.activate');
    expect(draft).not.toContain('corporateConventions.action.suspend');
    expect(active).toContain('corporateConventions.action.suspend');
    expect(active).toContain('corporateConventions.action.expire');
    expect(active).toContain('corporateConventions.action.contract');
    expect(expired).not.toContain('corporateConventions.action.activate');
    expect(expired).not.toContain('corporateConventions.action.suspend');
  });

  it('activates a convention from its row', async () => {
    const root = await render();
    const button = Array.from(rowOf(root, 'Draft one')?.querySelectorAll('button') ?? []).find(
      (candidate) => (candidate.textContent ?? '').includes('corporateConventions.action.activate'),
    );

    (button as HTMLButtonElement).click();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(api['transitionConvention']).toHaveBeenCalledWith('1', 'ACTIVE');
  });

  it('hides creation, edit and deletion from a member who cannot write', async () => {
    canWrite = false;
    const root = await render();

    expect(root.textContent).not.toContain('corporateConventions.action.newConvention');
    expect(root.textContent).not.toContain('corporateConventions.action.edit');
    expect(root.textContent).not.toContain('corporateConventions.action.delete');
    expect(root.textContent).toContain('corporateConventions.action.landing');
  });
});
