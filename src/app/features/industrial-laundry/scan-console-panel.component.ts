import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ILR_DIRECTIONS, IlrDirection, IlrScanSession } from '@core';
import { TranslatePipe } from '@shared';
import { IlrOutcome, netWeight, parseReads, severityColor } from './industrial-laundry.util';
import { RabcConsoleStore } from './rabc-console.store';

/**
 * The scan console: submits a roll cage read at a tunnel gate (the EPC list of the UHF reader, the weighing, the direction),
 * live or simulated by typing the tags, and shows what the API did with it: the net weight, the delivery note, the tags it
 * accepted and refused and the alerts it raised.
 */
@Component({
  selector: 'app-ilr-scan-console-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  styleUrl: './industrial-laundry.scss',
  template: `
    <nz-card class="main-card" [nzTitle]="'industrialLaundry.section.scanConsole' | translate">
      @if (feedback(); as failure) {
        <nz-alert
          class="feedback"
          nzType="error"
          nzShowIcon
          nzCloseable
          [nzMessage]="(failure.errorKey ?? 'industrialLaundry.error.generic') | translate: failure.params"
          [nzDescription]="failure.detail ?? undefined"
          (nzOnClose)="feedback.set(null)"
        ></nz-alert>
      }

      <div class="form-grid">
        <label class="field" for="ilr-scan-gate">
          <span>{{ 'industrialLaundry.field.gateAntenna' | translate }}</span>
          <input nz-input id="ilr-scan-gate" maxlength="60" [ngModel]="gate()" (ngModelChange)="gate.set($event)" />
        </label>
        <label class="field" for="ilr-scan-cage">
          <span>{{ 'industrialLaundry.field.rollCage' | translate }}</span>
          <input
            nz-input
            id="ilr-scan-cage"
            list="ilr-scan-cages"
            maxlength="60"
            [ngModel]="barcode()"
            (ngModelChange)="setBarcode($event)"
          />
          <datalist id="ilr-scan-cages">
            @for (cage of store.cages(); track cage.id) {
              <option [value]="cage.barcode">{{ cage.label }}</option>
            }
          </datalist>
        </label>
        <label class="field" for="ilr-scan-direction">
          <span>{{ 'industrialLaundry.field.direction' | translate }}</span>
          <nz-select id="ilr-scan-direction" nzId="ilr-scan-direction" [ngModel]="direction()" (ngModelChange)="direction.set($event)">
            @for (item of directions; track item) {
              <nz-option [nzValue]="item" [nzLabel]="'industrialLaundry.scanDirection.' + item | translate"></nz-option>
            }
          </nz-select>
        </label>
        <label class="field wide" for="ilr-scan-customer">
          <span>{{ 'industrialLaundry.field.customer' | translate }}</span>
          <nz-select id="ilr-scan-customer" nzId="ilr-scan-customer" nzAllowClear nzShowSearch [ngModel]="customerId()" (ngModelChange)="customerId.set($event)">
            @for (customer of store.customers(); track customer.id) {
              <nz-option [nzValue]="customer.id" [nzLabel]="customer.name"></nz-option>
            }
          </nz-select>
        </label>
        <label class="field" for="ilr-scan-gross">
          <span>{{ 'industrialLaundry.field.grossWeight' | translate }}</span>
          <input nz-input id="ilr-scan-gross" inputmode="decimal" [ngModel]="gross()" (ngModelChange)="gross.set($event)" />
        </label>
        <label class="field" for="ilr-scan-tare">
          <span>{{ 'industrialLaundry.field.tareWeight' | translate }}</span>
          <input nz-input id="ilr-scan-tare" inputmode="decimal" [ngModel]="tare()" (ngModelChange)="tare.set($event)" />
        </label>
        <div class="field">
          <span>{{ 'industrialLaundry.field.netWeight' | translate }}</span>
          <strong>{{ net() === null ? '—' : net() + ' kg' }}</strong>
        </div>
      </div>

      <label class="field" for="ilr-scan-reads">
        <span>{{ 'industrialLaundry.field.reads' | translate }}</span>
        <textarea
          nz-input
          id="ilr-scan-reads"
          class="reads-box"
          rows="6"
          [ngModel]="readsText()"
          (ngModelChange)="readsText.set($event)"
        ></textarea>
      </label>
      <p class="hint">{{ 'industrialLaundry.hint.reads' | translate }} ({{ readsCount() }})</p>

      <label nz-checkbox for="ilr-scan-gen-ddt" nzId="ilr-scan-gen-ddt" [ngModel]="generateDdt()" (ngModelChange)="generateDdt.set($event)">
        {{ 'industrialLaundry.field.generateDdt' | translate }}
      </label>
      <div class="toolbar">
        <span class="spacer"></span>
        <button nz-button nzType="primary" type="button" [disabled]="!canSubmit() || store.saving()" [nzLoading]="store.saving()" (click)="submit()">
          {{ 'industrialLaundry.action.submitScan' | translate }}
        </button>
      </div>

      @if (store.lastScan(); as scan) {
        <div class="card-head">
          <h3>{{ 'industrialLaundry.section.scanResult' | translate }}</h3>
          <span class="chips">
            <nz-tag nzColor="green">{{ 'industrialLaundry.field.accepted' | translate }}: {{ scan.accepted_count }}</nz-tag>
            <nz-tag [nzColor]="scan.rejected_count > 0 ? 'orange' : 'default'">{{ 'industrialLaundry.field.rejected' | translate }}: {{ scan.rejected_count }}</nz-tag>
            @if (scan.net_weight_kg !== null) {
              <nz-tag nzColor="blue">{{ 'industrialLaundry.field.netWeight' | translate }}: {{ scan.net_weight_kg }} kg</nz-tag>
            }
            @if (scan.generated_ddt_number) {
              <nz-tag nzColor="purple">{{ 'industrialLaundry.field.ddt' | translate }}: {{ scan.generated_ddt_number }}</nz-tag>
            }
          </span>
        </div>
        @for (alert of scan.alerts; track $index) {
          <nz-alert
            class="feedback"
            nzShowIcon
            [nzType]="alert.severity === 'blocking' ? 'error' : 'warning'"
            [nzMessage]="'industrialLaundry.finding.' + alert.code | translate: alert.params ?? {}"
            [nzDescription]="alert.epc ?? undefined"
          ></nz-alert>
        }
        @if (scan.rejected_reads.length > 0) {
          <nz-table nzSize="small" [nzData]="scan.rejected_reads" [nzShowPagination]="false">
            <thead>
              <tr>
                <th scope="col">{{ 'industrialLaundry.field.epc' | translate }}</th>
                <th scope="col">{{ 'industrialLaundry.field.reason' | translate }}</th>
                <th scope="col" class="num">{{ 'industrialLaundry.field.rssi' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (read of scan.rejected_reads; track $index) {
                <tr>
                  <th scope="row" class="mono">{{ read.epc }}</th>
                  <td>{{ 'industrialLaundry.rejection.' + read.reason | translate }}</td>
                  <td class="num">{{ read.rssi }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
      }
    </nz-card>

    <nz-card class="main-card" [nzTitle]="'industrialLaundry.section.recentScans' | translate">
      <nz-table nzSize="small" [nzData]="store.sessions()" [nzPageSize]="10">
        <thead>
          <tr>
            <th scope="col">{{ 'industrialLaundry.field.scannedAt' | translate }}</th>
            <th scope="col">{{ 'industrialLaundry.field.rollCage' | translate }}</th>
            <th scope="col">{{ 'industrialLaundry.field.direction' | translate }}</th>
            <th scope="col">{{ 'industrialLaundry.field.customer' | translate }}</th>
            <th scope="col" class="num">{{ 'industrialLaundry.field.netWeight' | translate }}</th>
            <th scope="col" class="num">{{ 'industrialLaundry.field.accepted' | translate }}</th>
            <th scope="col" class="num">{{ 'industrialLaundry.field.rejected' | translate }}</th>
            <th scope="col">{{ 'industrialLaundry.field.ddt' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (session of store.sessions(); track session.id) {
            <tr>
              <td>{{ session.scanned_at.slice(0, 16).replace('T', ' ') }}</td>
              <td>{{ session.roll_cage_barcode }}</td>
              <td>
                <nz-tag [nzColor]="session.direction === 'inbound_soil' ? 'orange' : 'green'">
                  {{ 'industrialLaundry.scanDirection.' + session.direction | translate }}
                </nz-tag>
              </td>
              <td>{{ session.customer?.name }}</td>
              <td class="num">{{ session.net_weight_kg }}</td>
              <td class="num">{{ session.accepted_count }}</td>
              <td class="num">
                <nz-tag [nzColor]="alertColor(session)">{{ session.rejected_count }}</nz-tag>
              </td>
              <td>{{ session.generated_ddt_number }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
})
export class ScanConsolePanelComponent {
  protected readonly store = inject(RabcConsoleStore);
  protected readonly directions: readonly IlrDirection[] = ILR_DIRECTIONS;
  protected readonly feedback = signal<IlrOutcome | null>(null);
  protected readonly gate = signal('GATE-01');
  protected readonly barcode = signal('');
  protected readonly direction = signal<IlrDirection>('inbound_soil');
  protected readonly customerId = signal<string | null>(null);
  protected readonly gross = signal('');
  protected readonly tare = signal('');
  protected readonly readsText = signal('');
  protected readonly generateDdt = signal(true);

  protected readonly net = computed(() => netWeight(this.gross(), this.tare()));
  protected readonly readsCount = computed(() => parseReads(this.readsText()).length);
  protected readonly canSubmit = computed(
    () => this.gate().trim() !== '' && this.barcode().trim() !== '' && this.readsCount() > 0,
  );

  protected setBarcode(value: string): void {
    this.barcode.set(value);
    const tare = this.store.tareOf()(value.trim());
    if (tare !== null) {
      this.tare.set(tare);
    }
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) {
      return;
    }
    const outcome = await this.store.scan({
      gate_antenna_id: this.gate().trim(),
      roll_cage_barcode: this.barcode().trim(),
      direction: this.direction(),
      reads: parseReads(this.readsText()),
      gross_weight_kg: this.gross().trim() === '' ? null : this.gross().trim(),
      roll_cage_tare_weight_kg: this.tare().trim() === '' ? null : this.tare().trim(),
      contact_id: this.customerId(),
      generate_ddt: this.generateDdt(),
    });
    this.feedback.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      this.readsText.set('');
      this.gross.set('');
    }
  }

  protected alertColor(session: IlrScanSession): string {
    return session.alerts.some((alert) => alert.severity === 'blocking') ? severityColor('blocking') : session.rejected_count > 0 ? 'orange' : 'default';
  }
}
