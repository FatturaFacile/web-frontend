import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeadApiService, LeadSetting } from '@core';
import { icons } from '../../../icons-provider';
import { httpError, i18nStub, messageStub } from '../leads/lead-test.utils';
import { LeadSettingsFormComponent, thresholdOrderValidator } from './lead-settings-form.component';

const SETTINGS: LeadSetting = {
  warm_threshold: 40,
  hot_threshold: 70,
  auto_qualify_threshold: 80,
  dedup_mode: 'notify',
  dedup_levenshtein_max: 2,
  dedup_similarity_min: 0.85,
  default_country: 'IT',
};

describe('thresholdOrderValidator', () => {
  const group = (warm: number, hot: number) =>
    new FormGroup({ warm_threshold: new FormControl(warm), hot_threshold: new FormControl(hot) });

  it('accepts warm < hot', () => {
    expect(thresholdOrderValidator(group(40, 70))).toBeNull();
  });

  it.each([
    [70, 70],
    [80, 70],
  ])('rejects warm %i >= hot %i', (warm, hot) => {
    expect(thresholdOrderValidator(group(warm, hot))).toEqual({ thresholdOrder: true });
  });
});

describe('LeadSettingsFormComponent', () => {
  let api: { getSettings: ReturnType<typeof vi.fn>; updateSettings: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = { getSettings: vi.fn().mockReturnValue(of(SETTINGS)), updateSettings: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        i18nStub(),
        { provide: LeadApiService, useValue: api },
        { provide: NzMessageService, useValue: messageStub() },
      ],
    });
  });

  it('blocks saving when warm >= hot and shows the validation message', () => {
    const fixture = TestBed.createComponent(LeadSettingsFormComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;

    cmp.form.patchValue({ warm_threshold: 75, hot_threshold: 70 });
    cmp.save();
    fixture.detectChanges();

    expect(api.updateSettings).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'The warm threshold must be lower than the hot threshold.',
    );
  });

  it('saves valid settings with an upper-cased country', () => {
    api.updateSettings.mockReturnValue(of({ ...SETTINGS, warm_threshold: 30 }));
    const cmp = TestBed.createComponent(LeadSettingsFormComponent).componentInstance;
    cmp.form.patchValue({ warm_threshold: 30, default_country: 'ch' });
    cmp.save();
    expect(api.updateSettings).toHaveBeenCalledWith({ ...SETTINGS, warm_threshold: 30, default_country: 'CH' });
  });

  it('shows server 422 errors inline', () => {
    api.updateSettings.mockReturnValue(
      throwError(() =>
        httpError(422, { message: 'Invalid', errors: { hot_threshold: ['Hot must be greater than warm.'] } }),
      ),
    );
    const cmp = TestBed.createComponent(LeadSettingsFormComponent).componentInstance;
    cmp.save();
    expect(cmp.form.controls.hot_threshold.errors).toEqual({ serverError: 'Hot must be greater than warm.' });
  });
});
