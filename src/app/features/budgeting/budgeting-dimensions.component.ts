import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { AccountingApiService, GeneralLedgerApiService } from '@core';
import { TranslatePipe } from '@shared';
import { DimensionOption, loadAccounts, loadCostCenters } from './budgeting.util';

/**
 * The account, cost centre and project fields of a form. The group holds `account_id`, `cost_center_id` and `project_id`
 * controls; accounts and cost centres are offered from the ledger, the project is a UUID.
 */
@Component({
  selector: 'app-budgeting-dimensions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe, NzFormModule, NzInputModule, NzSelectModule],
  template: `
    <div [formGroup]="group()">
      @if (showAccount()) {
        <nz-form-item>
          <nz-form-label [nzRequired]="accountRequired()">{{ 'BUDGETING.ACCOUNT' | translate }}</nz-form-label>
          <nz-form-control>
            <nz-select formControlName="account_id" nzShowSearch nzAllowClear>
              @for (account of accounts(); track account.id) {
                <nz-option [nzValue]="account.id" [nzLabel]="account.label"></nz-option>
              }
            </nz-select>
          </nz-form-control>
        </nz-form-item>
      }
      <nz-form-item>
        <nz-form-label>{{ 'BUDGETING.COST_CENTER' | translate }}</nz-form-label>
        <nz-form-control>
          <nz-select formControlName="cost_center_id" nzShowSearch nzAllowClear>
            @for (center of costCenters(); track center.id) {
              <nz-option [nzValue]="center.id" [nzLabel]="center.label"></nz-option>
            }
          </nz-select>
        </nz-form-control>
      </nz-form-item>
      <nz-form-item>
        <nz-form-label>{{ 'BUDGETING.PROJECT_ID' | translate }}</nz-form-label>
        <nz-form-control [nzErrorTip]="'BUDGETING_CONTROL.PROJECT_INVALID' | translate"><input nz-input formControlName="project_id" /></nz-form-control>
      </nz-form-item>
    </div>
  `,
})
export class BudgetingDimensionsComponent implements OnInit {
  private readonly accounting = inject(AccountingApiService);
  private readonly ledger = inject(GeneralLedgerApiService);

  readonly group = input.required<FormGroup>();
  readonly showAccount = input(true);
  readonly accountRequired = input(false);

  readonly accounts = signal<DimensionOption[]>([]);
  readonly costCenters = signal<DimensionOption[]>([]);

  ngOnInit(): void {
    loadAccounts(this.accounting).subscribe((accounts) => this.accounts.set(accounts));
    loadCostCenters(this.ledger).subscribe((centers) => this.costCenters.set(centers));
  }
}
