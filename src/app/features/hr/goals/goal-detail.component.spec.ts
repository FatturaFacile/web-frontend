import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { HrWorkforceApiService, I18nService } from '@core';
import { GoalDetailComponent, signedDecimalValidator } from './goal-detail.component';

const goal = {
  id: 'g1',
  title: 'Ship v2',
  level: 'employee',
  status: 'active',
  progress: '50.00',
  key_results: [
    { id: 'k1', goal_id: 'g1', metric: 'Releases', unit: null, start_value: '0.0000', target_value: '2.0000', current_value: '1.0000', progress: '50.00', sort_order: 0 },
  ],
  check_ins: [{ id: 'c1', goal_id: 'g1', key_result_id: 'k1', value: '1.0000', progress: '50.00', comment: 'first', checked_in_by: null, checked_in_at: '2026-11-06' }],
  children: [],
};

describe('signedDecimalValidator', () => {
  it('accepts signed decimals and refuses text', () => {
    const check = (value: string) => signedDecimalValidator({ value } as never);
    expect(check('-12.5')).toBeNull();
    expect(check('')).toBeNull();
    expect(check('1.23456')).toEqual({ decimal: true });
    expect(check('abc')).toEqual({ decimal: true });
  });
});

describe('GoalDetailComponent', () => {
  const api = {
    getGoal: vi.fn(),
    checkInGoal: vi.fn(),
    addKeyResult: vi.fn(),
    deleteKeyResult: vi.fn(),
  };

  function create() {
    const fixture = TestBed.createComponent(GoalDetailComponent);
    fixture.componentRef.setInput('goalId', 'g1');
    fixture.componentRef.setInput('canWrite', true);
    fixture.detectChanges();
    return fixture.componentInstance as unknown as {
      keyResultForm: { patchValue(value: object): void };
      draft(id: string, current: string): string;
      updateValue(id: string, current: string): void;
      addKeyResult(): void;
      removeKeyResult(id: string): void;
    };
  }

  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    api.getGoal.mockReturnValue(of({ success: true, message: '', data: goal }));
    api.checkInGoal.mockReturnValue(of({ success: true, message: '', data: {} }));
    api.addKeyResult.mockReturnValue(of({ success: true, message: '', data: {} }));
    api.deleteKeyResult.mockReturnValue(of(undefined));
    TestBed.configureTestingModule({
      imports: [GoalDetailComponent],
      providers: [
        { provide: HrWorkforceApiService, useValue: api },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
      ],
    });
  });

  it('loads the goal when opened', () => {
    create();
    expect(api.getGoal).toHaveBeenCalledWith('g1');
  });

  it('checks in the value of a key result and reloads the goal', () => {
    const component = create();
    expect(component.draft('k1', '1.0000')).toBe('1.0000');

    component.updateValue('k1', '1.0000');

    expect(api.checkInGoal).toHaveBeenCalledWith('g1', { key_result_id: 'k1', value: '1.0000' });
    expect(api.getGoal).toHaveBeenCalledTimes(2);
  });

  it('refuses a key result without metric or target and adds a valid one', () => {
    const component = create();
    component.addKeyResult();
    expect(api.addKeyResult).not.toHaveBeenCalled();

    component.keyResultForm.patchValue({ metric: 'Bugs', start_value: '10', target_value: '0' });
    component.addKeyResult();

    expect(api.addKeyResult).toHaveBeenCalledWith('g1', { metric: 'Bugs', unit: null, start_value: '10', target_value: '0' });
  });

  it('removes a key result', () => {
    const component = create();
    component.removeKeyResult('k1');
    expect(api.deleteKeyResult).toHaveBeenCalledWith('k1');
  });
});
