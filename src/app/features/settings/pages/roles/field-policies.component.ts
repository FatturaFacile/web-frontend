import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FieldKind, FieldPolicyEntry, FieldVisibility } from '@core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TranslatePipe } from '@shared';

/** Fields the policies can protect, offered as suggestions (the server accepts any resource and field name). */
export const KNOWN_FIELDS: readonly { resource: string; field: string; kind: FieldKind }[] = [
  { resource: 'hr.employee', field: 'base_annual_salary', kind: 'amount' },
  { resource: 'hr.employee', field: 'hourly_cost_rate', kind: 'amount' },
  { resource: 'hr.employee', field: 'iban', kind: 'iban' },
  { resource: 'crm.contact', field: 'iban', kind: 'iban' },
  { resource: 'inventory.product', field: 'cost_price', kind: 'amount' },
];

/** Per role field policies: for each protected field Visible, Masked (shown as `•••` / a partial IBAN) or Hidden (omitted). */
@Component({
  selector: 'app-field-policies',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NzButtonModule, NzIconModule, NzInputModule, NzSelectModule, NzTableModule, TranslatePipe],
  template: `
    <nz-table [nzData]="policies()" [nzFrontPagination]="false" nzSize="small" [nzShowPagination]="false">
      <thead>
        <tr>
          <th>{{ 'IAM.FIELD_RESOURCE' | translate }}</th>
          <th>{{ 'IAM.FIELD_NAME' | translate }}</th>
          <th>{{ 'IAM.FIELD_KIND' | translate }}</th>
          <th>{{ 'IAM.FIELD_VISIBILITY' | translate }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        @for (policy of policies(); track policy.resource + policy.field; let i = $index) {
          <tr>
            <td>{{ policy.resource }}</td>
            <td>{{ policy.field }}</td>
            <td>{{ 'IAM.KIND_' + policy.kind.toUpperCase() | translate }}</td>
            <td>
              <nz-select [ngModel]="policy.visibility" (ngModelChange)="setVisibility(i, $event)" [nzDisabled]="readonly()" [attr.data-testid]="'visibility-' + i">
                <nz-option nzValue="visible" [nzLabel]="'IAM.VISIBILITY_VISIBLE' | translate"></nz-option>
                <nz-option nzValue="masked" [nzLabel]="'IAM.VISIBILITY_MASKED' | translate"></nz-option>
                <nz-option nzValue="hidden" [nzLabel]="'IAM.VISIBILITY_HIDDEN' | translate"></nz-option>
              </nz-select>
            </td>
            <td>
              <button nz-button nzType="text" nzDanger [disabled]="readonly()" (click)="remove(i)" [attr.aria-label]="'IAM.REMOVE' | translate">
                <span nz-icon nzType="delete"></span>
              </button>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>

    @if (!readonly()) {
      <div class="add">
        <nz-select [(ngModel)]="candidate" [nzPlaceHolder]="'IAM.FIELD_ADD' | translate" nzShowSearch style="min-width: 320px" data-testid="field-candidate">
          @for (known of available(); track known.resource + known.field) {
            <nz-option [nzValue]="known.resource + '|' + known.field" [nzLabel]="known.resource + ' · ' + known.field"></nz-option>
          }
        </nz-select>
        <button nz-button nzType="primary" [disabled]="!candidate" (click)="add()">
          <span nz-icon nzType="plus"></span> {{ 'IAM.ADD' | translate }}
        </button>
      </div>
    }
  `,
  styles: ['.add { display: flex; gap: 8px; margin-top: 12px; }'],
})
export class FieldPoliciesComponent {
  readonly policies = model<FieldPolicyEntry[]>([]);
  readonly readonly = input(false);

  protected candidate: string | null = null;

  protected available(): typeof KNOWN_FIELDS {
    const taken = new Set(this.policies().map((p) => `${p.resource}|${p.field}`));
    return KNOWN_FIELDS.filter((known) => !taken.has(`${known.resource}|${known.field}`));
  }

  protected add(): void {
    const known = KNOWN_FIELDS.find((k) => `${k.resource}|${k.field}` === this.candidate);
    if (known) {
      this.policies.update((list) => [...list, { ...known, visibility: 'masked' }]);
    }
    this.candidate = null;
  }

  protected setVisibility(index: number, visibility: FieldVisibility): void {
    this.policies.update((list) => list.map((p, i) => (i === index ? { ...p, visibility } : p)));
  }

  protected remove(index: number): void {
    this.policies.update((list) => list.filter((_, i) => i !== index));
  }
}
