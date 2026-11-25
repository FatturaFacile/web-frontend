import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SignatureRequestService } from './signature-request.service';

describe('SignatureRequestService', () => {
  let service: SignatureRequestService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SignatureRequestService);
  });

  it('starts without a request', () => {
    expect(service.request()).toBeNull();
    expect(service.created()).toBe(0);
  });

  it('opens the wizard for a document and closes it again', () => {
    service.open({
      signableType: 'quote',
      signableId: 'q-1',
      label: 'Q-2027-001',
      amount: '1200.00',
      currency: 'CHF',
    });

    expect(service.request()).toEqual({
      signableType: 'quote',
      signableId: 'q-1',
      label: 'Q-2027-001',
      amount: '1200.00',
      currency: 'CHF',
    });

    service.close();

    expect(service.request()).toBeNull();
  });

  it('counts the envelopes created so a page can refresh', () => {
    service.notifyCreated();
    service.notifyCreated();

    expect(service.created()).toBe(2);
  });
});
