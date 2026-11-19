import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeadApiService, LeadRoutingRule, SettingsApiService } from '@core';
import { icons } from '../../../icons-provider';
import { httpError, i18nStub, messageStub } from '../leads/lead-test.utils';
import { LeadRoutingComponent, moveRule } from './lead-routing.component';

function rule(id: string, priority: number): LeadRoutingRule {
  return {
    id,
    name: `Rule ${id}`,
    priority,
    conditions: {},
    strategy: 'round_robin',
    assignee_user_ids: ['u1'],
    is_default: false,
    is_active: true,
  };
}

describe('moveRule', () => {
  it('returns a reordered copy without mutating the input', () => {
    const input = ['a', 'b', 'c'];
    expect(moveRule(input, 2, 0)).toEqual(['c', 'a', 'b']);
    expect(input).toEqual(['a', 'b', 'c']);
    expect(moveRule(input, 0, 5)).toEqual(['a', 'b', 'c']);
  });
});

describe('LeadRoutingComponent reorder', () => {
  let api: {
    listRoutingRules: ReturnType<typeof vi.fn>;
    reorderRoutingRules: ReturnType<typeof vi.fn>;
  };
  let reorder$: Subject<unknown>;

  beforeEach(() => {
    reorder$ = new Subject();
    api = {
      // Server order is by priority, whatever the payload order.
      listRoutingRules: vi.fn().mockReturnValue(of([rule('c', 3), rule('a', 1), rule('b', 2)])),
      reorderRoutingRules: vi.fn().mockReturnValue(reorder$),
    };
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        i18nStub(),
        { provide: LeadApiService, useValue: api },
        { provide: SettingsApiService, useValue: { getTenantUsers: () => of({ data: [] }) } },
        { provide: NzMessageService, useValue: messageStub() },
      ],
    });
  });

  function create() {
    const fixture = TestBed.createComponent(LeadRoutingComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders rules by priority', () => {
    const fixture = create();
    expect(fixture.componentInstance.rules().map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('li.rule')).toHaveLength(3);
  });

  it('posts the full ordered id list and applies the order optimistically', () => {
    const cmp = create().componentInstance;
    cmp.move(2, -1);

    expect(api.reorderRoutingRules).toHaveBeenCalledWith(['a', 'c', 'b']);
    expect(cmp.rules().map((r) => r.id)).toEqual(['a', 'c', 'b']);
    expect(cmp.rules().map((r) => r.priority)).toEqual([1, 2, 3]);

    reorder$.next({});
    reorder$.complete();
    expect(cmp.reordering()).toBe(false);
    expect(cmp.rules().map((r) => r.id)).toEqual(['a', 'c', 'b']);
  });

  it('restores the previous order and shows a message when saving fails', () => {
    const fixture = create();
    const cmp = fixture.componentInstance;
    cmp.onDrop({ previousIndex: 0, currentIndex: 2 } as Parameters<
      LeadRoutingComponent['onDrop']
    >[0]);
    expect(cmp.rules().map((r) => r.id)).toEqual(['b', 'c', 'a']);

    reorder$.error(httpError(500, {}));
    fixture.detectChanges();

    expect(cmp.rules().map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(cmp.reorderError()).toBe('CRM.LEAD_ROUTING.REORDER_FAILED');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'CRM.LEAD_ROUTING.REORDER_FAILED',
    );
  });

  it('ignores no-op moves and moves while a reorder is in flight', () => {
    const cmp = create().componentInstance;
    cmp.move(0, -1);
    expect(api.reorderRoutingRules).not.toHaveBeenCalled();
    cmp.move(0, 1);
    cmp.move(1, 1);
    expect(api.reorderRoutingRules).toHaveBeenCalledTimes(1);
  });
});
