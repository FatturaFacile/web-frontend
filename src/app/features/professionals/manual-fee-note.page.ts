import { Component, computed, inject } from '@angular/core';
import { CreateFeeNotePayload, PermissionsService, ProfessionalsApiService } from '@core';
import { HubPageComponent } from '../resource-hub/hub-page.component';
import { f, HubTab } from '../resource-hub/hub.types';

/** A fee note typed by hand (taxable fees plus CPA, ritenuta and VAT rates), for fees that do not come from logged activities. */
@Component({
  selector: 'app-manual-fee-note',
  imports: [HubPageComponent],
  template: `<app-hub-page
    title="PROFESSIONALS.MANUAL_FEE_NOTE.TITLE"
    subtitle="PROFESSIONALS.MANUAL_FEE_NOTE.SUBTITLE"
    [tabs]="tabs()"
  />`,
})
export class ManualFeeNoteComponent {
  private readonly api = inject(ProfessionalsApiService);
  private readonly permissions = inject(PermissionsService);

  protected readonly tabs = computed<HubTab[]>(() => [
    {
      kind: 'form',
      title: 'PROFESSIONALS.MANUAL_FEE_NOTE.TAB_NEW',
      submitLabel: 'PROFESSIONALS.MANUAL_FEE_NOTE.SUBMIT_BTN',
      canWrite: this.permissions.canWrite('professionals'),
      resetOnSuccess: true,
      hint: 'PROFESSIONALS.MANUAL_FEE_NOTE.RATES_HINT',
      fields: [
        f.id('client_id', 'PROFESSIONALS.MANUAL_FEE_NOTE.CLIENT_ID', { required: true }),
        f.id('legal_case_id', 'PROFESSIONALS.MANUAL_FEE_NOTE.LEGAL_CASE_ID'),
        f.text('note_number', 'PROFESSIONALS.MANUAL_FEE_NOTE.NOTE_NUMBER', { required: true }),
        f.date('date', 'COMMON.DATE', { required: true }),
        f.num('taxable_fees', 'PROFESSIONALS.MANUAL_FEE_NOTE.TAXABLE_FEES', { required: true, min: 0 }),
        f.num('cpa_rate', 'PROFESSIONALS.MANUAL_FEE_NOTE.CPA_RATE', { min: 0, max: 10 }),
        f.num('ritenuta_rate', 'PROFESSIONALS.MANUAL_FEE_NOTE.RITENUTA_RATE', { min: 0, max: 30 }),
        f.num('vat_rate', 'PROFESSIONALS.MANUAL_FEE_NOTE.VAT_RATE', { min: 0, max: 25 }),
      ],
      submit: (p) => this.api.createFeeNote(this.toPayload(p)),
    },
  ]);

  private toPayload(p: Record<string, unknown>): CreateFeeNotePayload {
    const num = (key: string): number | null => (p[key] === undefined ? null : Number(p[key]));
    return {
      client_id: String(p['client_id']),
      legal_case_id: p['legal_case_id'] === undefined ? null : String(p['legal_case_id']),
      note_number: String(p['note_number']),
      date: String(p['date']),
      taxable_fees: Number(p['taxable_fees']),
      cpa_rate: num('cpa_rate'),
      ritenuta_rate: num('ritenuta_rate'),
      vat_rate: num('vat_rate'),
    };
  }
}
