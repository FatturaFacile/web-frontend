import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ILR_RISK_ZONES, IlrRiskZone, IlrWashBatch } from '@core';
import { TranslatePipe } from '@shared';
import { certificationColor, IlrOutcome, scalarParams, severityColor } from './industrial-laundry.util';
import { RabcConsoleStore } from './rabc-console.store';

/**
 * UNI EN 14065 RABC: opens wash batches from the soiled roll cages received, and certifies them from what the wash line
 * measured. The batch log is the hygiene traceability record.
 */
@Component({
  selector: 'app-ilr-batch-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  styleUrl: './industrial-laundry.scss',
  template: `
    <nz-card class="main-card" [nzTitle]="'industrialLaundry.section.newBatch' | translate">
      @if (feedback(); as failure) {
        <nz-alert
          class="feedback"
          nzType="error"
          nzShowIcon
          nzCloseable
          [nzMessage]="(failure.errorKey ?? 'industrialLaundry.error.generic') | translate: failure.params"
          [nzDescription]="failure.detail ?? null"
          (nzOnClose)="feedback.set(null)"
        ></nz-alert>
      }
      <div class="form-grid">
        <label class="field" for="ilr-batch-program">
          <span>{{ 'industrialLaundry.field.program' | translate }}</span>
          <nz-select id="ilr-batch-program" [ngModel]="program()" (ngModelChange)="program.set($event)">
            @for (item of store.programs(); track item.code) {
              <nz-option [nzValue]="item.code" [nzLabel]="'industrialLaundry.program.' + item.code | translate"></nz-option>
            }
          </nz-select>
        </label>
        <label class="field" for="ilr-batch-zone">
          <span>{{ 'industrialLaundry.field.riskZone' | translate }}</span>
          <nz-select id="ilr-batch-zone" [ngModel]="zone()" (ngModelChange)="zone.set($event)">
            @for (item of zones; track item) {
              <nz-option [nzValue]="item" [nzLabel]="'industrialLaundry.rabcRiskZone.' + item | translate"></nz-option>
            }
          </nz-select>
        </label>
        <label class="field" for="ilr-batch-operator">
          <span>{{ 'industrialLaundry.field.operator' | translate }}</span>
          <input nz-input id="ilr-batch-operator" maxlength="160" [ngModel]="operator()" (ngModelChange)="operator.set($event)" />
        </label>
        <label class="field wide" for="ilr-batch-sessions">
          <span>{{ 'industrialLaundry.field.soiledCages' | translate }}</span>
          <nz-select id="ilr-batch-sessions" nzMode="multiple" [ngModel]="sessionIds()" (ngModelChange)="sessionIds.set($event)">
            @for (session of store.soiledSessions(); track session.id) {
              <nz-option [nzValue]="session.id" [nzLabel]="sessionLabel(session.roll_cage_barcode, session.net_weight_kg, session.contact_id)"></nz-option>
            }
          </nz-select>
        </label>
      </div>
      @if (selectedProgram(); as selected) {
        <p class="hint">
          {{ 'industrialLaundry.hint.programTargets' | translate }}: {{ selected.target_temperature_c }} °C · {{ selected.min_hold_minutes }} min
          @if (selected.min_chemical_dosing_ml_per_kg !== null) {
            · {{ selected.min_chemical_dosing_ml_per_kg }} ml/kg
          }
        </p>
      }
      <div class="toolbar">
        <span class="spacer"></span>
        <button nz-button nzType="primary" type="button" [disabled]="!canCreate() || store.saving()" [nzLoading]="store.saving()" (click)="create()">
          {{ 'industrialLaundry.action.createBatch' | translate }}
        </button>
      </div>
    </nz-card>

    <nz-card class="main-card" [nzTitle]="'industrialLaundry.section.batchLog' | translate">
      <nz-table nzSize="small" [nzData]="store.batches()" [nzPageSize]="10">
        <thead>
          <tr>
            <th scope="col">{{ 'industrialLaundry.field.batchCode' | translate }}</th>
            <th scope="col">{{ 'industrialLaundry.field.program' | translate }}</th>
            <th scope="col">{{ 'industrialLaundry.field.riskZone' | translate }}</th>
            <th scope="col" class="num">{{ 'industrialLaundry.field.targetMeasured' | translate }}</th>
            <th scope="col" class="num">{{ 'industrialLaundry.field.netWeight' | translate }}</th>
            <th scope="col">{{ 'industrialLaundry.field.status' | translate }}</th>
            <th scope="col">{{ 'industrialLaundry.field.violations' | translate }}</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          @for (batch of store.batches(); track batch.id) {
            <tr>
              <th scope="row">{{ batch.batch_code }}</th>
              <td>{{ 'industrialLaundry.program.' + batch.disinfection_thermal_chem_program_code | translate }}</td>
              <td>{{ 'industrialLaundry.rabcRiskZone.' + batch.rabc_risk_zone | translate }}</td>
              <td class="num">
                {{ batch.target_temperature_c }} °C / {{ batch.target_hold_minutes }} min
                <div class="hint">{{ batch.measured_temperature_c ?? '—' }} °C / {{ batch.measured_hold_minutes ?? '—' }} min</div>
              </td>
              <td class="num">{{ batch.load_net_weight_kg }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(batch.rabc_control_status)">
                  {{ 'industrialLaundry.certificationStatus.' + batch.rabc_control_status | translate }}
                </nz-tag>
                @if (batch.certified_at) {
                  <div class="hint">{{ batch.certified_at.slice(0, 16).replace('T', ' ') }}</div>
                }
              </td>
              <td>
                <div class="chips">
                  @for (violation of batch.violations; track $index) {
                    <nz-tag [nzColor]="severityColor(violation.severity)">{{ 'industrialLaundry.finding.' + violation.code | translate: scalarParams(violation.params) }}</nz-tag>
                  }
                </div>
              </td>
              <td>
                @if (batch.rabc_control_status === 'pending') {
                  <button nz-button nzSize="small" type="button" (click)="openCertify(batch)">
                    {{ 'industrialLaundry.action.certify' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (store.batches().length === 0) {
        <nz-empty [nzNotFoundContent]="'industrialLaundry.empty.batches' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal
      [nzVisible]="certifying() !== null"
      [nzTitle]="'industrialLaundry.section.certifyBatch' | translate"
      [nzOkText]="'industrialLaundry.action.certify' | translate"
      [nzCancelText]="'industrialLaundry.action.cancel' | translate"
      [nzOkDisabled]="verifier().trim() === ''"
      [nzOkLoading]="store.saving()"
      (nzOnOk)="certify()"
      (nzOnCancel)="certifying.set(null)"
    >
      <ng-container *nzModalContent>
        @if (modalFailure(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="(failure.errorKey ?? 'industrialLaundry.error.generic') | translate: failure.params"
            [nzDescription]="failure.detail ?? null"
          ></nz-alert>
        }
        <div class="form-grid">
          <label class="field" for="ilr-cert-temp">
            <span>{{ 'industrialLaundry.field.temperature' | translate }}</span>
            <input nz-input id="ilr-cert-temp" inputmode="decimal" [ngModel]="temperature()" (ngModelChange)="temperature.set($event)" />
          </label>
          <label class="field" for="ilr-cert-hold">
            <span>{{ 'industrialLaundry.field.holdMinutes' | translate }}</span>
            <input nz-input id="ilr-cert-hold" inputmode="numeric" [ngModel]="hold()" (ngModelChange)="hold.set($event)" />
          </label>
          <label class="field" for="ilr-cert-dosing">
            <span>{{ 'industrialLaundry.field.chemicalDosing' | translate }}</span>
            <input nz-input id="ilr-cert-dosing" inputmode="decimal" [ngModel]="dosing()" (ngModelChange)="dosing.set($event)" />
          </label>
          <label class="field" for="ilr-cert-cfu">
            <span>{{ 'industrialLaundry.field.cfu' | translate }}</span>
            <input nz-input id="ilr-cert-cfu" inputmode="decimal" [ngModel]="cfu()" (ngModelChange)="cfu.set($event)" />
          </label>
          <label class="field" for="ilr-cert-verifier">
            <span>{{ 'industrialLaundry.field.verifier' | translate }}</span>
            <input nz-input id="ilr-cert-verifier" maxlength="160" [ngModel]="verifier()" (ngModelChange)="verifier.set($event)" />
          </label>
        </div>
        <p class="hint">{{ 'industrialLaundry.hint.certify' | translate }}</p>
      </ng-container>
    </nz-modal>
  `,
})
export class BatchPanelComponent {
  protected readonly store = inject(RabcConsoleStore);
  protected readonly zones: readonly IlrRiskZone[] = ILR_RISK_ZONES;
  protected readonly feedback = signal<IlrOutcome | null>(null);
  protected readonly modalFailure = signal<IlrOutcome | null>(null);
  protected readonly program = signal<string | null>(null);
  protected readonly zone = signal<IlrRiskZone>('standard');
  protected readonly operator = signal('');
  protected readonly sessionIds = signal<string[]>([]);
  protected readonly certifying = signal<IlrWashBatch | null>(null);
  protected readonly temperature = signal('');
  protected readonly hold = signal('');
  protected readonly dosing = signal('');
  protected readonly cfu = signal('');
  protected readonly verifier = signal('');
  protected readonly statusColor = certificationColor;
  protected readonly severityColor = severityColor;
  protected readonly scalarParams = scalarParams;

  protected readonly selectedProgram = computed(() => {
    const code = this.program();
    return code === null ? null : (this.store.program()(code) ?? null);
  });
  protected readonly canCreate = computed(() => this.program() !== null && this.sessionIds().length > 0);

  protected sessionLabel(barcode: string, net: string | number | null, customerId: string | null): string {
    return `${barcode} · ${net ?? '—'} kg · ${this.store.customerName()(customerId)}`;
  }

  protected async create(): Promise<void> {
    const program = this.program();
    if (program === null || !this.canCreate()) {
      return;
    }
    const outcome = await this.store.createBatch({
      program_code: program,
      rabc_risk_zone: this.zone(),
      scan_session_ids: this.sessionIds(),
      operator_name: this.operator().trim() === '' ? null : this.operator().trim(),
    });
    this.feedback.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      this.sessionIds.set([]);
    }
  }

  protected openCertify(batch: IlrWashBatch): void {
    this.temperature.set(batch.measured_temperature_c?.toString() ?? '');
    this.hold.set(batch.measured_hold_minutes?.toString() ?? '');
    this.dosing.set(batch.measured_chemical_dosing_ml_per_kg?.toString() ?? '');
    this.cfu.set(batch.microbiological_cfu_per_25cm2?.toString() ?? '');
    this.verifier.set(batch.verifier_name ?? '');
    this.modalFailure.set(null);
    this.certifying.set(batch);
  }

  protected async certify(): Promise<void> {
    const batch = this.certifying();
    if (batch === null || this.verifier().trim() === '') {
      return;
    }
    const outcome = await this.store.certify(batch.id, {
      measured_temperature_c: this.optional(this.temperature()),
      measured_hold_minutes: this.hold().trim() === '' ? null : Number.parseInt(this.hold(), 10),
      measured_chemical_dosing_ml_per_kg: this.optional(this.dosing()),
      microbiological_cfu_per_25cm2: this.optional(this.cfu()),
      verifier_name: this.verifier().trim(),
    });
    if (outcome.ok) {
      this.certifying.set(null);
    } else {
      this.modalFailure.set(outcome);
    }
  }

  private optional(value: string): string | null {
    return value.trim() === '' ? null : value.trim();
  }
}
