import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeadApiService } from '@core';
import { icons } from '../../../icons-provider';
import { httpError, i18nStub, messageStub } from '../leads/lead-test.utils';
import { LeadScorePreviewComponent } from './lead-score-preview.component';
import { formatRuleValue, LeadScoringRuleModalComponent, parseRuleValue } from './lead-scoring-rule-modal.component';

describe('scoring rule values', () => {
  it('parses JSON when possible and keeps plain text otherwise', () => {
    expect(parseRuleValue('["IT","CH"]')).toEqual(['IT', 'CH']);
    expect(parseRuleValue('50')).toBe(50);
    expect(parseRuleValue('manufacturing')).toBe('manufacturing');
    expect(parseRuleValue('  ')).toBeNull();
    expect(formatRuleValue([10, 50])).toBe('[10,50]');
    expect(formatRuleValue('it')).toBe('it');
  });
});

describe('lead scoring admin', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    api = {
      listLeads: vi.fn().mockReturnValue(of({ data: [{ id: 'l1', first_name: 'Anna', last_name: 'Rossi' }], meta: {} })),
      previewScore: vi.fn().mockReturnValue(
        of({ score: 72, rating: 'hot', breakdown: [{ rule_id: 'r1', code: 'INDUSTRY_IT', points: 25 }] }),
      ),
      createScoringRule: vi.fn().mockReturnValue(of({ id: 'r9' })),
      updateScoringRule: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        i18nStub(),
        { provide: LeadApiService, useValue: api },
        { provide: NzMessageService, useValue: messageStub() },
      ],
    });
  });

  it('preview asks the server and shows score, rating and breakdown', () => {
    const fixture = TestBed.createComponent(LeadScorePreviewComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;
    cmp.leadId.set('l1');
    cmp.run();
    fixture.detectChanges();

    expect(api['previewScore']).toHaveBeenCalledWith({ lead_id: 'l1' });
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('72');
    expect(text).toContain('Hot');
    expect(text).toContain('INDUSTRY_IT');
  });

  it('preview errors are shown inline', () => {
    api['previewScore'].mockReturnValue(throwError(() => httpError(422, { message: 'Lead not found', errors: {} })));
    const fixture = TestBed.createComponent(LeadScorePreviewComponent);
    fixture.componentInstance.leadId.set('l1');
    fixture.componentInstance.run();
    fixture.detectChanges();
    expect(fixture.componentInstance.error()).toBe('Lead not found');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Lead not found');
  });

  it('rule modal sends a behavioral rule with event_type and no field', () => {
    const cmp = TestBed.createComponent(LeadScoringRuleModalComponent).componentInstance;
    cmp.form.patchValue({
      code: 'CATALOG',
      name: 'Catalog download',
      category: 'behavioral',
      event_type: 'catalog_downloaded',
      field: 'industry',
      operator: 'exists',
      value: '',
      points: 15,
      decay_days: 30,
    });
    cmp.save();
    expect(api['createScoringRule']).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'CATALOG',
        category: 'behavioral',
        event_type: 'catalog_downloaded',
        field: null,
        value: null,
        points: 15,
        decay_days: 30,
      }),
    );
  });

  it('rule modal requires a target field for demographic rules', () => {
    const cmp = TestBed.createComponent(LeadScoringRuleModalComponent).componentInstance;
    cmp.form.patchValue({ code: 'X', name: 'X', category: 'demographic', field: '' });
    cmp.save();
    expect(api['createScoringRule']).not.toHaveBeenCalled();
    expect(cmp.formError()).toBe('Choose the lead field or the event type.');
  });
});
