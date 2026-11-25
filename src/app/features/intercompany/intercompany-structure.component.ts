import { Component, effect, inject, untracked } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { IcMirrorMode, IcPartyRole, IcRateType, IcStandard, PermissionsService } from '@core';
import { TranslatePipe } from '@shared';
import { IntercompanyContextStore } from './intercompany-context.store';
import { IntercompanyNotifier } from './intercompany-notifier.service';
import { IntercompanyStructureStore } from './intercompany-structure.store';
import { enumKey, IC_MODULE, IC_STANDARDS } from './intercompany.util';

/** Group structure and ownership matrix, mirror settings, counterpart contacts and the period rates of the consolidation. */
@Component({
  selector: 'app-intercompany-structure',
  styleUrl: './intercompany.scss',
  providers: [IntercompanyStructureStore],
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <nz-card [nzTitle]="'intercompany.structure.ownership' | translate" class="section">
      <p class="muted">{{ 'intercompany.structure.ownershipHint' | translate }}</p>
      <nz-table
        #members
        nzSize="small"
        [nzData]="ctx.members()"
        [nzShowPagination]="false"
        [nzScroll]="{ x: '720px' }"
      >
        <thead>
          <tr>
            <th>{{ 'intercompany.structure.entity' | translate }}</th>
            <th>{{ 'intercompany.structure.holder' | translate }}</th>
            <th class="num">{{ 'intercompany.structure.ownership' | translate }} %</th>
            <th>{{ 'intercompany.structure.method' | translate }}</th>
            <th>{{ 'intercompany.structure.basis' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (member of members.data; track member.id) {
            <tr>
              <td>
                {{ member.name }}
                @if (member.is_parent) {
                  <nz-tag nzColor="blue">{{ 'intercompany.structure.parent' | translate }}</nz-tag>
                }
              </td>
              <td>{{ member.holder_tenant_id ? ctx.memberName(member.holder_tenant_id) : '-' }}</td>
              <td class="num">{{ member.ownership_percentage }}</td>
              <td>{{ enumKey('consolidationMethod', member.consolidation_method) | translate }}</td>
              <td>{{ member.consolidation_basis ?? '-' }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (ctx.groupId(); as groupId) {
        <a [routerLink]="['/general-ledger/consolidation', groupId]">{{
          'intercompany.structure.editInLedger' | translate
        }}</a>
      }
    </nz-card>

    <nz-card [nzTitle]="'intercompany.structure.settings' | translate" class="section">
      <form [formGroup]="settingsForm" (ngSubmit)="saveSettings()">
        <div class="form-row">
          <div>
            <label for="ic-mirror-mode">{{
              'intercompany.structure.mirrorMode' | translate
            }}</label>
            <nz-select id="ic-mirror-mode" formControlName="mirror_mode" class="select-sm">
              @for (mode of mirrorModes; track mode) {
                <nz-option [nzValue]="mode" [nzLabel]="enumKey('mirrorMode', mode) | translate" />
              }
            </nz-select>
          </div>
          <div>
            <label for="ic-standard">{{
              'intercompany.structure.defaultStandard' | translate
            }}</label>
            <nz-select id="ic-standard" formControlName="default_standard" class="select-sm">
              @for (standard of standards; track standard) {
                <nz-option
                  [nzValue]="standard"
                  [nzLabel]="enumKey('standard', standard) | translate"
                />
              }
            </nz-select>
          </div>
          <div>
            <label for="ic-amount-tol">{{
              'intercompany.structure.amountTolerance' | translate
            }}</label>
            <input
              id="ic-amount-tol"
              nz-input
              formControlName="amount_tolerance"
              inputmode="decimal"
            />
          </div>
          <div>
            <label for="ic-date-tol">{{
              'intercompany.structure.dateTolerance' | translate
            }}</label>
            <input
              id="ic-date-tol"
              nz-input
              type="number"
              min="0"
              formControlName="date_tolerance_days"
            />
          </div>
        </div>
        <div class="toolbar">
          <nz-switch formControlName="auto_mirror" />
          <span>{{ 'intercompany.structure.autoMirror' | translate }}</span>
          <nz-switch formControlName="sync_payments" />
          <span>{{ 'intercompany.structure.syncPayments' | translate }}</span>
          <nz-switch formControlName="netting_enabled" />
          <span>{{ 'intercompany.structure.nettingEnabled' | translate }}</span>
          <span class="spacer"></span>
          @if (canWrite) {
            <button
              nz-button
              nzType="primary"
              type="submit"
              [disabled]="settingsForm.invalid"
              [nzLoading]="store.saving()"
            >
              {{ 'intercompany.common.save' | translate }}
            </button>
          }
        </div>
      </form>
    </nz-card>

    <nz-card [nzTitle]="'intercompany.structure.partyLinks' | translate" class="section">
      <p class="muted">{{ 'intercompany.structure.partyLinksHint' | translate }}</p>
      <nz-table #links nzSize="small" [nzData]="store.partyLinks()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>{{ 'intercompany.structure.entity' | translate }}</th>
            <th>{{ 'intercompany.structure.counterparty' | translate }}</th>
            <th>{{ 'intercompany.structure.role' | translate }}</th>
            <th>{{ 'intercompany.structure.contact' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (link of links.data; track link.id) {
            <tr>
              <td>{{ link.entity_name ?? ctx.memberName(link.entity_tenant_id) }}</td>
              <td>{{ link.counterparty_name ?? ctx.memberName(link.counterparty_tenant_id) }}</td>
              <td>{{ enumKey('partyRole', link.role) | translate }}</td>
              <td>{{ link.contact_id }}</td>
              <td>
                @if (canWrite) {
                  <button
                    nz-button
                    nzDanger
                    nzSize="small"
                    type="button"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'intercompany.common.confirmDelete' | translate"
                    (nzOnConfirm)="removeLink(link.id)"
                  >
                    {{ 'intercompany.common.delete' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (canWrite) {
        <form [formGroup]="linkForm" (ngSubmit)="addLink()" class="form-row">
          <div>
            <label for="ic-link-entity">{{ 'intercompany.structure.entity' | translate }}</label>
            <nz-select id="ic-link-entity" formControlName="entity_tenant_id" class="select-md">
              @for (member of ctx.members(); track member.id) {
                <nz-option [nzValue]="member.member_tenant_id" [nzLabel]="member.name" />
              }
            </nz-select>
          </div>
          <div>
            <label for="ic-link-cp">{{ 'intercompany.structure.counterparty' | translate }}</label>
            <nz-select id="ic-link-cp" formControlName="counterparty_tenant_id" class="select-md">
              @for (member of ctx.members(); track member.id) {
                <nz-option [nzValue]="member.member_tenant_id" [nzLabel]="member.name" />
              }
            </nz-select>
          </div>
          <div>
            <label for="ic-link-role">{{ 'intercompany.structure.role' | translate }}</label>
            <nz-select id="ic-link-role" formControlName="role" class="select-sm">
              @for (role of roles; track role) {
                <nz-option [nzValue]="role" [nzLabel]="enumKey('partyRole', role) | translate" />
              }
            </nz-select>
          </div>
          <div>
            <label for="ic-link-contact">{{ 'intercompany.structure.contact' | translate }}</label>
            <input id="ic-link-contact" nz-input formControlName="contact_id" />
          </div>
          <button nz-button nzType="primary" type="submit" [disabled]="linkForm.invalid">
            {{ 'intercompany.common.add' | translate }}
          </button>
        </form>
      }
    </nz-card>

    <nz-card [nzTitle]="'intercompany.structure.periodRates' | translate" class="section">
      <p class="muted">{{ 'intercompany.structure.periodRatesHint' | translate }}</p>
      <div class="toolbar">
        <label for="ic-rate-filter">{{ 'intercompany.structure.rateType' | translate }}</label>
        <nz-select
          id="ic-rate-filter"
          class="select-sm"
          nzAllowClear
          [ngModel]="store.rateFilters().rate_type"
          (ngModelChange)="filterRates($event)"
        >
          @for (type of rateTypes; track type) {
            <nz-option [nzValue]="type" [nzLabel]="enumKey('rateType', type) | translate" />
          }
        </nz-select>
      </div>
      <nz-table #rates nzSize="small" [nzData]="store.rates()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>{{ 'intercompany.structure.currency' | translate }}</th>
            <th>{{ 'intercompany.structure.rateType' | translate }}</th>
            <th>{{ 'intercompany.structure.periodEnd' | translate }}</th>
            <th class="num">{{ 'intercompany.structure.rate' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (rate of rates.data; track rate.id) {
            <tr>
              <td>{{ rate.currency }} / {{ rate.group_currency }}</td>
              <td>{{ enumKey('rateType', rate.rate_type) | translate }}</td>
              <td>{{ rate.period_end }}</td>
              <td class="num">{{ rate.rate }}</td>
              <td>
                @if (canWrite) {
                  <button
                    nz-button
                    nzDanger
                    nzSize="small"
                    type="button"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'intercompany.common.confirmDelete' | translate"
                    (nzOnConfirm)="removeRate(rate.id)"
                  >
                    {{ 'intercompany.common.delete' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (canWrite) {
        <form [formGroup]="rateForm" (ngSubmit)="saveRate()" class="form-row">
          <div>
            <label for="ic-rate-currency">{{
              'intercompany.structure.currency' | translate
            }}</label>
            <input id="ic-rate-currency" nz-input formControlName="currency" maxlength="3" />
          </div>
          <div>
            <label for="ic-rate-type">{{ 'intercompany.structure.rateType' | translate }}</label>
            <nz-select id="ic-rate-type" formControlName="rate_type" class="select-sm">
              @for (type of rateTypes; track type) {
                <nz-option [nzValue]="type" [nzLabel]="enumKey('rateType', type) | translate" />
              }
            </nz-select>
          </div>
          <div>
            <label for="ic-rate-end">{{ 'intercompany.structure.periodEnd' | translate }}</label>
            <input id="ic-rate-end" nz-input type="date" formControlName="period_end" />
          </div>
          <div>
            <label for="ic-rate-value">{{ 'intercompany.structure.rate' | translate }}</label>
            <input id="ic-rate-value" nz-input formControlName="rate" inputmode="decimal" />
          </div>
          <button nz-button nzType="primary" type="submit" [disabled]="rateForm.invalid">
            {{ 'intercompany.common.save' | translate }}
          </button>
        </form>
      }
    </nz-card>
  `,
})
export class IntercompanyStructureComponent {
  protected readonly ctx = inject(IntercompanyContextStore);
  protected readonly store = inject(IntercompanyStructureStore);
  private readonly notifier = inject(IntercompanyNotifier);
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly canWrite = inject(PermissionsService).canWrite(IC_MODULE);

  protected readonly enumKey = enumKey;
  protected readonly mirrorModes: IcMirrorMode[] = ['draft', 'confirmed'];
  protected readonly standards: readonly IcStandard[] = IC_STANDARDS;
  protected readonly roles: IcPartyRole[] = ['customer', 'supplier'];
  protected readonly rateTypes: IcRateType[] = ['closing', 'average', 'historical'];

  protected readonly settingsForm = this.fb.group({
    mirror_mode: ['draft' as IcMirrorMode, Validators.required],
    auto_mirror: [false],
    sync_payments: [true],
    netting_enabled: [false],
    amount_tolerance: ['0.0000', [Validators.required, Validators.pattern(/^\d+(\.\d{1,4})?$/)]],
    date_tolerance_days: [0, [Validators.required, Validators.min(0)]],
    default_standard: ['fer30' as IcStandard, Validators.required],
  });

  protected readonly linkForm = this.fb.group({
    entity_tenant_id: ['', Validators.required],
    counterparty_tenant_id: ['', Validators.required],
    contact_id: ['', Validators.required],
    role: ['customer' as IcPartyRole, Validators.required],
  });

  protected readonly rateForm = this.fb.group({
    currency: ['', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]],
    rate_type: ['closing' as IcRateType, Validators.required],
    period_end: ['', Validators.required],
    rate: ['', [Validators.required, Validators.pattern(/^\d+(\.\d{1,8})?$/)]],
  });

  constructor() {
    effect(() => {
      const groupId = this.ctx.groupId();
      if (groupId !== null) {
        untracked(() => void this.store.load(groupId).then(() => this.patchSettings()));
      }
    });
  }

  private patchSettings(): void {
    const settings = this.store.settings();
    if (settings !== null) {
      this.settingsForm.patchValue(settings);
    }
  }

  protected async saveSettings(): Promise<void> {
    const groupId = this.ctx.groupId();
    if (groupId !== null && this.settingsForm.valid) {
      this.notifier.report(await this.store.saveSettings(groupId, this.settingsForm.getRawValue()));
    }
  }

  protected async addLink(): Promise<void> {
    const groupId = this.ctx.groupId();
    if (
      groupId !== null &&
      this.linkForm.valid &&
      this.notifier.report(await this.store.addPartyLink(groupId, this.linkForm.getRawValue()))
    ) {
      this.linkForm.patchValue({ contact_id: '' });
    }
  }

  protected async removeLink(id: string): Promise<void> {
    this.notifier.report(await this.store.removePartyLink(id), 'intercompany.common.deleted');
  }

  protected async saveRate(): Promise<void> {
    const groupId = this.ctx.groupId();
    if (groupId === null || !this.rateForm.valid) {
      return;
    }
    const value = this.rateForm.getRawValue();
    this.notifier.report(
      await this.store.saveRate(groupId, { ...value, currency: value.currency.toUpperCase() }),
    );
  }

  protected async removeRate(id: string): Promise<void> {
    this.notifier.report(await this.store.removeRate(id), 'intercompany.common.deleted');
  }

  protected async filterRates(rateType: IcRateType | null): Promise<void> {
    const groupId = this.ctx.groupId();
    if (groupId !== null) {
      await this.store.filterRates(groupId, rateType ? { rate_type: rateType } : {});
    }
  }
}
