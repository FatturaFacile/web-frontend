import { Injectable, signal } from '@angular/core';
import { EsigSignableType } from '../models/electronic-signature.model';

/** The document a user wants to send for signature. */
export interface SignatureRequest {
  signableType: EsigSignableType;
  signableId: string;
  /** What the document is called in the wizard (number or title). */
  label: string | null;
  /** Gross amount as a decimal string; it decides the minimum signature level of the compliance policy. */
  amount: string | null;
  currency: string | null;
}

/**
 * Opens the send-for-signature wizard from anywhere (quote editor, purchase order list, contract list, documents). The wizard
 * itself is mounted once in the application shell, so a page only asks for it here and does not depend on the feature.
 */
@Injectable({ providedIn: 'root' })
export class SignatureRequestService {
  private readonly current = signal<SignatureRequest | null>(null);
  private readonly completed = signal(0);

  /** The pending request, or `null` while the wizard is closed. */
  readonly request = this.current.asReadonly();
  /** Counts the envelopes created from the wizard, so a page can refresh when it changes. */
  readonly created = this.completed.asReadonly();

  open(request: SignatureRequest): void {
    this.current.set(request);
  }

  close(): void {
    this.current.set(null);
  }

  notifyCreated(): void {
    this.completed.update((count) => count + 1);
  }
}
