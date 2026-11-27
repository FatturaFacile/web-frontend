import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { beforeEach, describe, expect, it } from 'vitest';
import { GcPassageCounter, I18nService } from '@core';
import { icons } from '../../icons-provider';
import { GreenCarePassageCounterComponent } from './green-care-passage-counter.component';

const counter = (completed: number, included: number): GcPassageCounter => ({
  completed,
  included,
  extra: Math.max(0, completed - included),
  is_over_included: completed > included,
  percent: included > 0 ? (completed / included) * 100 : 0,
});

describe('GreenCarePassageCounterComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [GreenCarePassageCounterComponent],
      providers: [
        provideNzIcons(icons),
        {
          provide: I18nService,
          useValue: {
            translate: (key: string, params?: Record<string, number>) =>
              params ? `${key}|${Object.values(params).join('/')}` : key,
          },
        },
      ],
    });
  });

  function render(value: GcPassageCounter): HTMLElement {
    const fixture = TestBed.createComponent(GreenCarePassageCounterComponent);
    fixture.componentRef.setInput('counter', value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows "passage 8 of 16" without the extra warning while the contract has passages left', () => {
    const root = render(counter(8, 16));

    expect(root.querySelector('[data-test="passage-badge"]')?.textContent).toContain('greenCare.passage.within|8/16/0');
    expect(root.querySelector('[data-test="passage-extra"]')).toBeNull();
    expect(root.querySelector('.passage-counter')?.classList.contains('over')).toBe(false);
  });

  it('flags passage 17 of 16 as an extra passage to invoice', () => {
    const root = render(counter(17, 16));

    expect(root.querySelector('[data-test="passage-badge"]')?.textContent).toContain('greenCare.passage.extra|17/16/1');
    expect(root.querySelector('[data-test="passage-extra"]')).not.toBeNull();
    expect(root.querySelector('.passage-counter')?.classList.contains('over')).toBe(true);
  });
});
