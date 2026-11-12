import { TestBed } from '@angular/core/testing';
import { AssociationAreaApiService, AssociationAreaProfile, I18nService } from '@core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AreaProfileComponent } from './area-profile.component';

describe('AreaProfileComponent', () => {
  const api = {
    card: vi.fn(),
    updateContact: vi.fn(),
    updateWardContact: vi.fn(),
    cardPdf: vi.fn(),
  };
  const profile = { id: 'm-1', status: 'active', first_name: 'Anna', last_name: 'Rossi' } as AssociationAreaProfile;

  beforeEach(() => {
    vi.clearAllMocks();
    api.card.mockReturnValue(of({ data: null }));
    api.updateContact.mockReturnValue(of({ data: {} }));
    TestBed.configureTestingModule({
      imports: [AreaProfileComponent],
      providers: [
        { provide: AssociationAreaApiService, useValue: api },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
  });

  interface Internals {
    form: { patchValue(v: object): void; invalid: boolean };
    save(): void;
    addressStarted(): boolean;
  }

  function create(): Internals {
    const fixture = TestBed.createComponent(AreaProfileComponent);
    fixture.componentRef.setInput('person', profile);
    fixture.detectChanges();
    return fixture.componentInstance as unknown as Internals;
  }

  it('does not call the API when a started address is missing its required parts', () => {
    const component = create();
    component.form.patchValue({ street: 'Via Roma' });
    expect(component.addressStarted()).toBe(true);
    component.save();
    expect(api.updateContact).not.toHaveBeenCalled();
    expect(component.form.invalid).toBe(true);
  });

  it('saves the contact when the address is complete', () => {
    const component = create();
    component.form.patchValue({ street: 'Via Roma', postal_code: '6900', city: 'Lugano' });
    component.save();
    expect(api.updateContact).toHaveBeenCalledTimes(1);
  });
});
