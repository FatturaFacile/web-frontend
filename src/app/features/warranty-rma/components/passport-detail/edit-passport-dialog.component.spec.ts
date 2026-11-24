import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { I18nService } from '@core';
import { PassportStore } from '../../state/passport.store';
import { i18nStub, passportFixture } from '../../testing/rma-fixtures';
import { EditPassportDialogComponent } from './edit-passport-dialog.component';

describe('EditPassportDialogComponent', () => {
  async function setup(result: unknown = { ok: true, data: passportFixture() }) {
    const store = { saving: signal(false), updatePassport: vi.fn().mockResolvedValue(result) };
    await TestBed.configureTestingModule({
      imports: [EditPassportDialogComponent],
      providers: [
        { provide: PassportStore, useValue: store },
        { provide: I18nService, useValue: i18nStub() },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(EditPassportDialogComponent);
    fixture.componentRef.setInput('passport', passportFixture({ installed_firmware_version: '1.0.0' }));
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, store };
  }

  it('prefills the form with the passport data', async () => {
    const { fixture } = await setup();
    const value = fixture.componentInstance.form.getRawValue();
    expect(value.installed_firmware_version).toBe('1.0.0');
    expect(value.current_owner_customer_id).toBe('c-1');
  });

  it('saves the changes and closes the dialog', async () => {
    const { fixture, store } = await setup();
    fixture.componentInstance.form.patchValue({ installed_firmware_version: '2.0.0', contract_warranty_months: 36 });
    await fixture.componentInstance.submit();
    expect(store.updatePassport).toHaveBeenCalledWith(
      'pp-1',
      expect.objectContaining({ installed_firmware_version: '2.0.0', contract_warranty_months: 36 }),
    );
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it('does not save when the owner is missing', async () => {
    const { fixture, store } = await setup();
    fixture.componentInstance.form.patchValue({ current_owner_customer_id: '' });
    await fixture.componentInstance.submit();
    expect(store.updatePassport).not.toHaveBeenCalled();
  });
});
