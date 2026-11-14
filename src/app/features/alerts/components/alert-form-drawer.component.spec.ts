import { TestBed } from '@angular/core/testing';
import { AlertsApiService, I18nService } from '@core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertFormDrawerComponent } from './alert-form-drawer.component';

describe('AlertFormDrawerComponent', () => {
  const api = { createAlert: vi.fn(), updateAlert: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.createAlert.mockReturnValue(of({ data: {} }));
    TestBed.configureTestingModule({
      imports: [AlertFormDrawerComponent],
      providers: [
        { provide: AlertsApiService, useValue: api },
        { provide: I18nService, useValue: { translate: (key: string) => key, instant: (key: string) => key, language: () => 'it' } },
        { provide: NzMessageService, useValue: { success: vi.fn() } },
      ],
    });
  });

  function create(): { submit(): void; form: { patchValue(v: object): void; controls: { title: { touched: boolean } } } } {
    const fixture = TestBed.createComponent(AlertFormDrawerComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    return fixture.componentInstance as never;
  }

  it('does not call the API when submitted without a title', () => {
    const component = create();
    component.submit();
    expect(api.createAlert).not.toHaveBeenCalled();
    expect(component.form.controls.title.touched).toBe(true);
  });

  it('saves when the title is filled', () => {
    const component = create();
    component.form.patchValue({ title: 'Maintenance window' });
    component.submit();
    expect(api.createAlert).toHaveBeenCalledTimes(1);
  });
});
