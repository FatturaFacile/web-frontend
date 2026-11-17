import { Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  FUND_TYPES,
  NATURA_CODES,
  serverErrorMessage,
  WITHHOLDING_REASONS,
  WITHHOLDING_TYPES,
} from '@core';
import { TranslatePipe } from '@shared';

/**
 * Invoice-level Italian fiscal fields of the drawer (issue #286): split payment, reverse charge, VAT payability,
 * cassa, ritenuta, ENASARCO and stamp duty payer. It renders controls owned by the drawer form, so server
 * errors bound by `applyServerErrors` show up here.
 */
@Component({
  selector: 'app-invoice-fiscal-section',
  imports: [
    ReactiveFormsModule,
    NzAlertModule,
    NzCheckboxModule,
    NzFormModule,
    NzInputNumberModule,
    NzSelectModule,
    TranslatePipe,
  ],
  templateUrl: './invoice-fiscal-section.component.html',
  styleUrl: './invoice-fiscal-section.component.scss',
})
export class InvoiceFiscalSectionComponent {
  /** The drawer form (it holds the controls created by `createFiscalControls`). */
  readonly form = input.required<FormGroup>();
  /** Tenant in regime forfettario: ritenuta, split payment and reverse charge are locked. */
  readonly forfettario = input(false);

  protected readonly fundTypes = FUND_TYPES;
  protected readonly withholdingTypes = WITHHOLDING_TYPES;
  protected readonly reasons = WITHHOLDING_REASONS;
  protected readonly naturaCodes = NATURA_CODES;

  protected error(path: string): string | null {
    return serverErrorMessage(this.form(), path);
  }
}
