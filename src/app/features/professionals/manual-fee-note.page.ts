import { Component, computed, inject } from '@angular/core';
import { CreateFeeNotePayload, PermissionsService, ProfessionalsApiService } from '@core';
import { HubPageComponent } from '../resource-hub/hub-page.component';
import { f, HubTab } from '../resource-hub/hub.types';

/** A fee note typed by hand (taxable fees plus CPA, ritenuta and VAT rates), for fees that do not come from logged activities. */
@Component({
  selector: 'app-manual-fee-note',
  imports: [HubPageComponent],
  template: `<app-hub-page
    title="Parcella manuale"
    subtitle="Emetti una nota di parcella indicando direttamente onorari imponibili e aliquote"
    [tabs]="tabs()"
  />`,
})
export class ManualFeeNoteComponent {
  private readonly api = inject(ProfessionalsApiService);
  private readonly permissions = inject(PermissionsService);

  protected readonly tabs = computed<HubTab[]>(() => [
    {
      kind: 'form',
      title: 'Nuova parcella',
      submitLabel: 'Emetti parcella',
      canWrite: this.permissions.canWrite('professionals'),
      resetOnSuccess: true,
      hint: 'Le aliquote sono percentuali: CPA fino al 10%, ritenuta fino al 30%, IVA fino al 25%.',
      fields: [
        f.id('client_id', 'Cliente (ID contatto)', { required: true }),
        f.id('legal_case_id', 'Pratica (ID, facoltativo)'),
        f.text('note_number', 'Numero parcella', { required: true }),
        f.date('date', 'Data', { required: true }),
        f.num('taxable_fees', 'Onorari imponibili', { required: true, min: 0 }),
        f.num('cpa_rate', 'Aliquota CPA %', { min: 0, max: 10 }),
        f.num('ritenuta_rate', 'Aliquota ritenuta %', { min: 0, max: 30 }),
        f.num('vat_rate', 'Aliquota IVA %', { min: 0, max: 25 }),
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
