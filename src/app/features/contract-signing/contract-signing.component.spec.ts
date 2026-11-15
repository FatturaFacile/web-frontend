import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { ContractPublicSigningView, ContractRegisterApiService, I18nService } from '@core';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { icons } from '../../icons-provider';
import { ContractSigningComponent } from './contract-signing.component';

const VIEW: ContractPublicSigningView = {
  status: 'sent',
  signer_status: 'notified',
  signer_name: 'Ann',
  can_sign: true,
  waiting_for_previous: false,
  document_hash: 'abc',
  body: 'Text to sign',
  company_name: 'Alfa',
  signers: [{ name: 'Ann', position: 1, status: 'notified' }],
};

describe('ContractSigningComponent', () => {
  let fixture: ComponentFixture<ContractSigningComponent>;
  const api = { getPublicSigning: vi.fn(), signPublicSigning: vi.fn(), declinePublicSigning: vi.fn() };

  interface Internals {
    invalidLink: () => boolean;
    outcome: () => string | null;
    declineForm: { patchValue: (value: { reason: string }) => void };
    sign: () => void;
    decline: () => void;
  }
  const internals = () => fixture.componentInstance as unknown as Internals;
  const create = async (): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [ContractSigningComponent],
      providers: [
        { provide: ContractRegisterApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ token: 'link-token' }) } } },
        { provide: I18nService, useValue: { translate: (key: string) => key, currentLang: () => 'en', lang: () => 'en' } },
        provideNzIcons(icons),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ContractSigningComponent);
    fixture.detectChanges();
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getPublicSigning.mockReturnValue(of({ data: VIEW }));
  });

  it('loads the text with the token of the route', async () => {
    await create();

    expect(api.getPublicSigning).toHaveBeenCalledWith('link-token');
    expect(fixture.nativeElement.querySelector('[data-test="signing-text"]').textContent).toContain('Text to sign');
  });

  it('shows the invalid link message when the token is refused', async () => {
    api.getPublicSigning.mockReturnValue(throwError(() => ({ status: 404 })));
    await create();

    expect(internals().invalidLink()).toBe(true);
  });

  it('signs with the token and shows the outcome', async () => {
    api.signPublicSigning.mockReturnValue(of({ data: { ...VIEW, signer_status: 'signed', can_sign: false } }));
    await create();

    internals().sign();

    expect(api.signPublicSigning).toHaveBeenCalledWith('link-token');
    expect(internals().outcome()).toBe('signed');
  });

  it('needs a reason to decline', async () => {
    api.declinePublicSigning.mockReturnValue(of({ data: { ...VIEW, status: 'declined', can_sign: false } }));
    await create();

    internals().decline();
    expect(api.declinePublicSigning).not.toHaveBeenCalled();

    internals().declineForm.patchValue({ reason: 'Terms not agreed' });
    internals().decline();
    expect(api.declinePublicSigning).toHaveBeenCalledWith('link-token', 'Terms not agreed');
    expect(internals().outcome()).toBe('declined');
  });
});
