import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import {
  ProposalLine,
  ProposalPortalApiService,
  ProposalSignatureStep,
  ProposalSignerDetails,
  ProposalView,
} from '@core';

export type ProposalOutcome = 'signed' | 'rejected' | null;

/** One group of mutually exclusive lines (radio buttons). */
export interface ProposalAlternativeGroup {
  group: string;
  lines: ProposalLine[];
}

/**
 * State of the public proposal page. The server is the authority on prices, discounts and tax: every toggle is sent and the
 * recalculated proposal replaces the signal, so the summary box and the VAT breakdown always show what will be signed.
 */
@Injectable()
export class ProposalPortalStore {
  private readonly api = inject(ProposalPortalApiService);

  readonly view = signal<ProposalView | null>(null);
  readonly token = signal<string>('');
  readonly session = signal<string | null>(null);
  readonly loading = signal(true);
  readonly recalculating = signal(false);
  readonly invalid = signal(false);
  readonly pinRequired = signal(false);
  readonly pinInvalid = signal(false);
  readonly busy = signal(false);
  readonly error = signal(false);
  readonly outcome = signal<ProposalOutcome>(null);
  readonly signatureStep = signal<ProposalSignatureStep | null>(null);
  readonly codeInvalid = signal(false);

  readonly open = computed(() => {
    const status = this.view()?.status;
    return (
      this.outcome() === null &&
      (status === 'sent' || status === 'viewed' || status === 'negotiating')
    );
  });
  readonly accepted = computed(
    () =>
      this.outcome() === 'signed' ||
      this.view()?.status === 'accepted' ||
      this.view()?.status === 'converted',
  );

  /** The current choices: optional lines on or off, the chosen line of each alternative group. */
  readonly selections = computed<Record<string, boolean>>(() => {
    const result: Record<string, boolean> = {};
    for (const line of this.view()?.lines ?? []) {
      if (line.selection_mode !== 'mandatory') {
        result[line.id] = line.selected;
      }
    }
    return result;
  });

  readonly alternativeGroups = computed<ProposalAlternativeGroup[]>(() => {
    const groups = new Map<string, ProposalLine[]>();
    for (const line of this.view()?.lines ?? []) {
      if (line.selection_mode === 'alternative_group') {
        const key = line.alternative_group ?? 'default';
        groups.set(key, [...(groups.get(key) ?? []), line]);
      }
    }
    return [...groups.entries()].map(([group, lines]) => ({ group, lines }));
  });

  linesOf(sectionId: string): ProposalLine[] {
    return (this.view()?.lines ?? []).filter((line) => line.section_id === sectionId);
  }

  load(token: string): void {
    this.token.set(token);
    this.loading.set(true);
    this.api.get(token, this.session()).subscribe({
      next: (res) => {
        this.view.set(res.data);
        this.pinRequired.set(false);
        this.invalid.set(false);
        this.loading.set(false);
      },
      // The portal answers 404 for every refusal; a PIN-protected link looks the same, so the page offers the PIN gate first.
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        if (error.status === 404 && this.session() === null && !this.invalid()) {
          this.pinRequired.set(true);
        } else {
          this.invalid.set(true);
          this.pinRequired.set(false);
        }
      },
    });
  }

  unlock(pin: string): void {
    this.busy.set(true);
    this.pinInvalid.set(false);
    this.api.verifyPin(this.token(), pin).subscribe({
      next: (res) => {
        this.session.set(res.data.session);
        this.busy.set(false);
        this.load(this.token());
      },
      error: () => {
        this.busy.set(false);
        this.pinInvalid.set(true);
      },
    });
  }

  setOptional(lineId: string, on: boolean): void {
    this.send({ ...this.selections(), [lineId]: on });
  }

  chooseAlternative(group: string, lineId: string): void {
    const next = { ...this.selections() };
    for (const line of this.alternativeGroups().find((g) => g.group === group)?.lines ?? []) {
      next[line.id] = line.id === lineId;
    }
    this.send(next);
  }

  private send(selections: Record<string, boolean>): void {
    this.recalculating.set(true);
    this.error.set(false);
    this.api.updateSelections(this.token(), this.session(), selections).subscribe({
      next: (res) => {
        this.view.set(res.data);
        this.recalculating.set(false);
      },
      error: () => {
        this.recalculating.set(false);
        this.error.set(true);
      },
    });
  }

  comment(body: string, authorName?: string): void {
    this.api.comment(this.token(), this.session(), body, authorName).subscribe({
      next: () => this.load(this.token()),
      error: () => this.error.set(true),
    });
  }

  startSignature(signer: ProposalSignerDetails): void {
    this.busy.set(true);
    this.error.set(false);
    this.api.initiateSignature(this.token(), this.session(), signer).subscribe({
      next: (res) => {
        this.signatureStep.set(res.data);
        this.busy.set(false);
      },
      error: () => {
        this.busy.set(false);
        this.error.set(true);
      },
    });
  }

  confirmCode(code: string): void {
    const step = this.signatureStep();
    if (step === null) {
      return;
    }
    this.busy.set(true);
    this.codeInvalid.set(false);
    this.api.completeSignature(this.token(), this.session(), step.envelope_id, code).subscribe({
      next: () => {
        this.busy.set(false);
        this.outcome.set('signed');
        this.load(this.token());
      },
      error: () => {
        this.busy.set(false);
        this.codeInvalid.set(true);
      },
    });
  }

  reject(reason: string): void {
    this.busy.set(true);
    this.api.reject(this.token(), this.session(), reason).subscribe({
      next: () => {
        this.busy.set(false);
        this.outcome.set('rejected');
      },
      error: () => {
        this.busy.set(false);
        this.error.set(true);
      },
    });
  }

  download(kind: 'proposal' | 'certificate'): void {
    this.api.downloadDocument(this.token(), this.session(), kind).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${this.view()?.quote_number ?? 'proposal'}-${kind}.pdf`;
        anchor.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.error.set(true),
    });
  }
}
