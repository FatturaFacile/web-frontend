import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ClientApiService,
  DebtCollectionApiService,
  PermissionsService,
  TranslateService,
} from '@core';
import { icons } from '../../icons-provider';
import { DcProposalsComponent } from './dc-proposals.component';
import {
  lookups,
  notice,
  proposalGroup,
  proposalItem,
  translateSpy,
  wrap,
} from './debt-collection.testing';
import { WorkbenchStore } from './workbench.store';

const messageSpy = { success: vi.fn(), error: vi.fn() };

interface ProposalsInternals {
  openGenerate(dispatch: boolean): void;
  confirmGenerate(): Promise<void>;
}

describe('DcProposalsComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let canWrite: boolean;

  beforeEach(() => {
    vi.clearAllMocks();
    canWrite = true;
    api = {
      getLookups: vi.fn(() => of(wrap(lookups))),
      listProposals: vi.fn(() =>
        of(
          wrap({
            items: [
              proposalItem('r-1'),
              proposalItem('r-2'),
              proposalItem('r-3', {
                status: 'excluded',
                exclusion_reason: 'dispute',
                proposed_level: null,
                customer_name: 'Beta Srl',
              }),
            ],
            groups: [proposalGroup()],
          }),
        ),
      ),
      calculate: vi.fn(() => of(wrap({}))),
      generate: vi.fn(() => of(wrap({ notices: [notice('n-1')], batch: null }))),
    };
    TestBed.configureTestingModule({
      providers: [
        WorkbenchStore,
        { provide: DebtCollectionApiService, useValue: api },
        {
          provide: ClientApiService,
          useValue: { list: vi.fn(() => of({ data: [] })), get: vi.fn() },
        },
        { provide: PermissionsService, useValue: { canWrite: () => canWrite } },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy() },
        provideNzIcons(icons),
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(DcProposalsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows the groups and the items of the queue with the exclusion reasons', async () => {
    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(api['listProposals']).toHaveBeenCalledOnce();
    expect(text).toContain('INV-r-1');
    expect(text).toContain('INV-r-2');
    expect(text).toContain('debtCollection.proposalStatus.excluded');
    expect(text).toContain('debtCollection.exclusionReason.dispute');
    expect(text).toContain('debtCollection.level.1');
  });

  it('hides the selection and the generation controls from a member who cannot write', async () => {
    canWrite = false;
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.selection-bar')).toBeNull();
    expect(root.textContent).not.toContain('debtCollection.action.generateDispatch');
  });

  it('keeps the generation disabled until a group is selected', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(
      root.querySelectorAll('.selection-bar button'),
    ) as HTMLButtonElement[];

    expect(buttons).toHaveLength(2);
    expect(buttons.every((button) => button.disabled)).toBe(true);

    TestBed.inject(WorkbenchStore).toggleGroup('c-1|CHF|1', true);
    fixture.detectChanges();

    expect(buttons.every((button) => !button.disabled)).toBe(true);
  });

  it('generates and dispatches the selected groups through the chosen channel', async () => {
    const fixture = await render();
    TestBed.inject(WorkbenchStore).toggleGroup('c-1|CHF|1', true);
    const component = fixture.componentInstance as unknown as ProposalsInternals;

    component.openGenerate(true);
    await component.confirmGenerate();

    const payload = api['generate']?.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload['channel']).toBe('email');
    expect(payload['dispatch']).toBe(true);
    expect(payload['post_charges']).toBe(true);
    expect(payload['groups']).toEqual([
      { customer_id: 'c-1', currency: 'CHF', level: 1, receivable_item_ids: ['r-1', 'r-2'] },
    ]);
    expect(messageSpy.success).toHaveBeenCalledWith('debtCollection.msg.generated');
  });
});
