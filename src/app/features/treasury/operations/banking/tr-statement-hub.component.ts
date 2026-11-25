import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzUploadFile, NzUploadModule } from 'ng-zorro-antd/upload';
import { BankingApiService } from '@core/api/banking-api.service';
import { TreasuryBankingApiService } from '@core/api/treasury-banking-api.service';
import { BankStatement } from '@core/models/banking.model';
import {
  CsvField,
  CsvMapping,
  CsvProfile,
  OpenBankingConnection,
  OpenBankingStatus,
  OpenBankingSyncRun,
  SmartReconciliationLine,
  StatementFormat,
  StatementImportSummary,
} from '@core/models/treasury-banking.model';
import { TranslatePipe } from '@shared';
import {
  CSV_FIELDS,
  apiErrorMessages,
  emptyCsvMapping,
  isCsvMappingReady,
  isStatementFile,
  toIsoDate,
} from './treasury-banking.util';

const FORMATS: StatementFormat[] = ['auto', 'camt053', 'camt054', 'cbi', 'csv'];

/**
 * Statement imports (camt.053, camt.054, CBI, CSV with a saved or inline column mapping), the PSD2 / SIX bLink
 * connections with on-demand synchronisation, and the imported batches with their parsed entries.
 */
@Component({
  selector: 'app-tr-statement-hub',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDatePickerModule,
    NzDrawerModule,
    NzGridModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzStatisticModule,
    NzSwitchModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    NzUploadModule,
    TranslatePipe,
  ],
  template: `
    <nz-tabs>
      <nz-tab [nzTitle]="'tbk.hub.tab.upload' | translate">
        <nz-card [nzTitle]="'tbk.hub.upload.title' | translate">
          <div nz-row [nzGutter]="16">
            <div nz-col [nzXs]="24" [nzMd]="8">
              <label class="field" for="hub-format"
                ><span>{{ 'tbk.hub.format' | translate }}</span>
                <nz-select
                  nzId="hub-format"
                  [ngModel]="format()"
                  (ngModelChange)="format.set($event)"
                  data-testid="format"
                >
                  @for (code of formats; track code) {
                    <nz-option
                      [nzValue]="code"
                      [nzLabel]="'tbk.hub.formatName.' + code | translate"
                    />
                  }
                </nz-select>
              </label>
            </div>
            <div nz-col [nzXs]="24" [nzMd]="8" class="switch">
              <nz-switch
                [ngModel]="autoReconcile()"
                (ngModelChange)="autoReconcile.set($event)"
                data-testid="auto-reconcile"
              />
              <span>{{ 'tbk.hub.autoReconcile' | translate }}</span>
            </div>
          </div>

          @if (format() === 'csv') {
            <nz-card
              nzType="inner"
              class="gap"
              [nzTitle]="'tbk.hub.csv.title' | translate"
              data-testid="csv-mapping"
            >
              <div nz-row [nzGutter]="16">
                <div nz-col [nzXs]="24" [nzMd]="12">
                  <label class="field" for="hub-profile"
                    ><span>{{ 'tbk.hub.csv.profile' | translate }}</span>
                    <nz-select
                      nzId="hub-profile"
                      nzAllowClear
                      [ngModel]="profileId()"
                      (ngModelChange)="pickProfile($event)"
                    >
                      @for (profile of profiles(); track profile.id) {
                        <nz-option [nzValue]="profile.id" [nzLabel]="profile.name" />
                      }
                    </nz-select>
                  </label>
                </div>
              </div>
              <div nz-row [nzGutter]="16">
                <div nz-col [nzXs]="24" [nzMd]="8">
                  <label class="field" for="csv-iban"
                    ><span>{{ 'tbk.hub.csv.iban' | translate }}</span>
                    <input
                      nz-input
                      id="csv-iban"
                      [ngModel]="mapping().account_iban"
                      (ngModelChange)="patchMapping({ account_iban: $event })"
                      data-testid="csv-iban"
                  /></label>
                </div>
                <div nz-col [nzXs]="12" [nzMd]="4">
                  <label class="field" for="csv-ccy"
                    ><span>{{ 'tbk.hub.csv.currency' | translate }}</span>
                    <input
                      nz-input
                      id="csv-ccy"
                      maxlength="3"
                      [ngModel]="mapping().currency"
                      (ngModelChange)="patchMapping({ currency: ($event ?? '').toUpperCase() })"
                  /></label>
                </div>
                <div nz-col [nzXs]="12" [nzMd]="4">
                  <label class="field" for="csv-delim"
                    ><span>{{ 'tbk.hub.csv.delimiter' | translate }}</span>
                    <input
                      nz-input
                      id="csv-delim"
                      maxlength="1"
                      [ngModel]="mapping().delimiter"
                      (ngModelChange)="patchMapping({ delimiter: $event })"
                  /></label>
                </div>
                <div nz-col [nzXs]="12" [nzMd]="4">
                  <label class="field" for="csv-date"
                    ><span>{{ 'tbk.hub.csv.dateFormat' | translate }}</span>
                    <input
                      nz-input
                      id="csv-date"
                      [ngModel]="mapping().date_format"
                      (ngModelChange)="patchMapping({ date_format: $event })"
                  /></label>
                </div>
                <div nz-col [nzXs]="12" [nzMd]="2">
                  <label class="field" for="csv-dec"
                    ><span>{{ 'tbk.hub.csv.decimal' | translate }}</span>
                    <input
                      nz-input
                      id="csv-dec"
                      maxlength="1"
                      [ngModel]="mapping().decimal_separator"
                      (ngModelChange)="patchMapping({ decimal_separator: $event })"
                  /></label>
                </div>
                <div nz-col [nzXs]="12" [nzMd]="2">
                  <label class="field" for="csv-th"
                    ><span>{{ 'tbk.hub.csv.thousands' | translate }}</span>
                    <input
                      nz-input
                      id="csv-th"
                      maxlength="1"
                      [ngModel]="mapping().thousands_separator ?? ''"
                      (ngModelChange)="patchMapping({ thousands_separator: $event || null })"
                  /></label>
                </div>
              </div>
              <div class="switch">
                <nz-switch
                  [ngModel]="mapping().has_header"
                  (ngModelChange)="patchMapping({ has_header: $event })"
                />
                <span>{{ 'tbk.hub.csv.hasHeader' | translate }}</span>
              </div>
              <p class="hint">
                {{
                  (mapping().has_header
                    ? 'tbk.hub.csv.columnsHeaderHint'
                    : 'tbk.hub.csv.columnsPositionHint'
                  ) | translate
                }}
              </p>
              <div nz-row [nzGutter]="16">
                @for (field of csvFields; track field) {
                  <div nz-col [nzXs]="24" [nzSm]="12" [nzMd]="8">
                    <label class="field" [for]="'csv-col-' + field"
                      ><span>{{ 'tbk.hub.csv.field.' + field | translate }}</span>
                      <input
                        nz-input
                        [id]="'csv-col-' + field"
                        [ngModel]="mapping().columns[field] ?? ''"
                        (ngModelChange)="patchColumn(field, $event)"
                        [attr.data-testid]="'csv-col-' + field"
                    /></label>
                  </div>
                }
              </div>
              <div class="profile-save">
                <input
                  nz-input
                  [placeholder]="'tbk.hub.csv.profileName' | translate"
                  [ngModel]="profileName()"
                  (ngModelChange)="profileName.set($event)"
                  data-testid="profile-name"
                />
                <button
                  nz-button
                  type="button"
                  [disabled]="!csvReady() || profileName().trim() === ''"
                  (click)="saveProfile()"
                  data-testid="save-profile"
                >
                  {{ 'tbk.hub.csv.saveProfile' | translate }}
                </button>
              </div>
            </nz-card>
          }

          <nz-spin [nzSpinning]="importing()" [nzTip]="'tbk.hub.importing' | translate">
            <nz-upload
              class="drop"
              nzType="drag"
              [nzShowUploadList]="false"
              [nzBeforeUpload]="beforeUpload"
              nzAccept=".xml,.txt,.cbi,.csv,.dat"
            >
              <p class="ant-upload-drag-icon"><nz-icon nzType="inbox" /></p>
              <p class="ant-upload-text">{{ 'tbk.hub.upload.hint' | translate }}</p>
            </nz-upload>
          </nz-spin>

          @if (importErrors().length > 0 || importKeys().length > 0) {
            <nz-alert
              class="gap"
              nzType="error"
              nzShowIcon
              [nzMessage]="'tbk.hub.importFailed' | translate"
              [nzDescription]="importErrorList"
              data-testid="import-error"
            />
            <ng-template #importErrorList>
              <ul>
                @for (key of importKeys(); track key) {
                  <li>{{ key | translate }}</li>
                }
                @for (message of importErrors(); track message) {
                  <li>{{ message }}</li>
                }
              </ul>
            </ng-template>
          }
        </nz-card>

        @if (summary(); as s) {
          <nz-card
            class="gap"
            [nzTitle]="'tbk.hub.summary.title' | translate"
            data-testid="import-summary"
          >
            <p>
              <nz-tag nzColor="blue">{{ s.format }}</nz-tag> <strong>{{ s.account_iban }}</strong> ·
              {{ s.statement_date }} · {{ s.currency }}
            </p>
            <div nz-row [nzGutter]="16">
              <div nz-col [nzSpan]="6">
                <nz-statistic
                  [nzTitle]="'tbk.hub.summary.entries' | translate"
                  [nzValue]="s.entries"
                />
              </div>
              <div nz-col [nzSpan]="6">
                <nz-statistic
                  [nzTitle]="'tbk.hub.summary.stored' | translate"
                  [nzValue]="s.stored"
                />
              </div>
              <div nz-col [nzSpan]="6">
                <nz-statistic
                  [nzTitle]="'tbk.hub.summary.duplicates' | translate"
                  [nzValue]="s.duplicates"
                />
              </div>
              <div nz-col [nzSpan]="6">
                <nz-statistic
                  [nzTitle]="'tbk.hub.summary.reconciled' | translate"
                  [nzValue]="s.reconciled"
                />
              </div>
            </div>
          </nz-card>
        }
      </nz-tab>

      <nz-tab [nzTitle]="'tbk.hub.tab.openBanking' | translate">
        @if (obStatus(); as st) {
          <nz-alert
            class="gap"
            [nzType]="st.available ? 'success' : 'warning'"
            nzShowIcon
            [nzMessage]="'tbk.hub.ob.driver.' + st.driver | translate"
            [nzDescription]="
              (st.available ? 'tbk.hub.ob.available' : 'tbk.hub.ob.unavailable') | translate
            "
            data-testid="ob-status"
          />
        }
        <nz-card [nzTitle]="'tbk.hub.ob.connections' | translate">
          <div class="consent">
            <input
              nz-input
              [placeholder]="'tbk.hub.ob.ibanPlaceholder' | translate"
              [ngModel]="newIban()"
              (ngModelChange)="newIban.set($event)"
              data-testid="consent-iban"
            />
            <button
              nz-button
              nzType="primary"
              type="button"
              [disabled]="newIban().trim() === ''"
              (click)="connect()"
              data-testid="connect"
            >
              {{ 'tbk.hub.ob.connect' | translate }}
            </button>
          </div>
          <div class="range">
            <nz-date-picker
              nzFormat="yyyy-MM-dd"
              [ngModel]="from()"
              (ngModelChange)="from.set($event)"
              [nzPlaceHolder]="'tbk.hub.ob.from' | translate"
            />
            <nz-date-picker
              nzFormat="yyyy-MM-dd"
              [ngModel]="to()"
              (ngModelChange)="to.set($event)"
              [nzPlaceHolder]="'tbk.hub.ob.to' | translate"
            />
          </div>
          <nz-table #conns [nzData]="connections()" nzSize="small" [nzShowPagination]="false">
            <thead>
              <tr>
                <th>IBAN</th>
                <th>{{ 'tbk.hub.ob.provider' | translate }}</th>
                <th>{{ 'tbk.common.status' | translate }}</th>
                <th>{{ 'tbk.hub.ob.lastSync' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (c of conns.data; track c.id) {
                <tr>
                  <td>{{ c.iban }}</td>
                  <td>{{ c.driver }}</td>
                  <td>
                    <nz-tag [nzColor]="c.is_active ? 'green' : 'default'">{{
                      (c.is_active ? 'tbk.hub.ob.active' : 'tbk.hub.ob.inactive') | translate
                    }}</nz-tag>
                  </td>
                  <td>
                    @if (c.last_sync; as run) {
                      {{ run.finished_at ?? run.started_at }} · {{ run.imported }}/{{ run.fetched }}
                    }
                  </td>
                  <td>
                    <button
                      nz-button
                      type="button"
                      [nzLoading]="syncing() === c.id"
                      [disabled]="!c.is_active"
                      (click)="sync(c)"
                      [attr.data-testid]="'sync-' + c.id"
                    >
                      {{ 'tbk.hub.ob.sync' | translate }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
          @if (syncErrors().length > 0) {
            <nz-alert
              class="gap"
              nzType="error"
              nzShowIcon
              [nzMessage]="syncErrors()[0]"
              data-testid="sync-error"
            />
          }
        </nz-card>
        <nz-card class="gap" [nzTitle]="'tbk.hub.ob.runs' | translate">
          <nz-table #runTable [nzData]="runs()" nzSize="small" [nzShowPagination]="false">
            <thead>
              <tr>
                <th>{{ 'tbk.hub.ob.period' | translate }}</th>
                <th>{{ 'tbk.hub.ob.fetched' | translate }}</th>
                <th>{{ 'tbk.hub.ob.imported' | translate }}</th>
                <th>{{ 'tbk.hub.ob.duplicates' | translate }}</th>
                <th>{{ 'tbk.common.status' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (r of runTable.data; track r.id) {
                <tr>
                  <td>{{ r.from_date }} → {{ r.to_date }}</td>
                  <td>{{ r.fetched }}</td>
                  <td>{{ r.imported }}</td>
                  <td>{{ r.duplicates }}</td>
                  <td>
                    <nz-tag
                      [nzColor]="
                        r.status === 'completed' ? 'green' : r.status === 'failed' ? 'red' : 'blue'
                      "
                      >{{ 'tbk.hub.ob.run.' + r.status | translate }}</nz-tag
                    >
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-card>
      </nz-tab>

      <nz-tab [nzTitle]="'tbk.hub.tab.batches' | translate">
        <nz-card [nzTitle]="'tbk.hub.batches.title' | translate">
          <nz-table #stmts [nzData]="statements()" nzSize="small" [nzLoading]="loadingBatches()">
            <thead>
              <tr>
                <th>{{ 'tbk.hub.batches.date' | translate }}</th>
                <th>IBAN</th>
                <th>{{ 'tbk.hub.format' | translate }}</th>
                <th>{{ 'tbk.hub.batches.entries' | translate }}</th>
                <th>{{ 'tbk.common.status' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (s of stmts.data; track s.id) {
                <tr>
                  <td>{{ s.statement_date }}</td>
                  <td>{{ s.account_iban }}</td>
                  <td>
                    <nz-tag>{{ s.source_format }}</nz-tag>
                  </td>
                  <td>{{ s.total_entries ?? 0 }}</td>
                  <td>
                    <nz-tag>{{ s.status }}</nz-tag>
                  </td>
                  <td>
                    <button nz-button nzType="link" type="button" (click)="inspect(s)">
                      {{ 'tbk.hub.batches.inspect' | translate }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-card>
        <nz-drawer
          [nzVisible]="inspecting() !== null"
          nzWidth="860"
          [nzTitle]="'tbk.hub.batches.entriesTitle' | translate"
          (nzOnClose)="inspecting.set(null)"
        >
          <ng-container *nzDrawerContent>
            <nz-table #lineTable [nzData]="lines()" nzSize="small" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{{ 'tbk.hub.batches.date' | translate }}</th>
                  <th>{{ 'tbk.hub.batches.amount' | translate }}</th>
                  <th>{{ 'tbk.hub.batches.counterparty' | translate }}</th>
                  <th>{{ 'tbk.hub.batches.description' | translate }}</th>
                  <th>{{ 'tbk.common.status' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (l of lineTable.data; track l.id) {
                  <tr>
                    <td>{{ l.line_number }}</td>
                    <td>{{ l.booking_date }}</td>
                    <td>{{ l.direction === 'debit' ? '-' : '' }}{{ l.amount }} {{ l.currency }}</td>
                    <td>{{ l.counterpart_name }}</td>
                    <td>{{ l.description }}</td>
                    <td>
                      <nz-tag [nzColor]="l.reconciled ? 'green' : 'orange'">{{
                        (l.reconciled ? 'tbk.smart.reconciled' : 'tbk.smart.open') | translate
                      }}</nz-tag>
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </ng-container>
        </nz-drawer>
      </nz-tab>
    </nz-tabs>
  `,
  styles: `
    :host {
      display: block;
    }
    .gap {
      margin-top: 16px;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 12px;
    }
    .switch {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .hint {
      color: rgba(0, 0, 0, 0.55);
    }
    .profile-save,
    .consent,
    .range {
      display: flex;
      gap: 8px;
      margin: 12px 0;
    }
    .drop {
      margin-top: 16px;
      display: block;
    }
  `,
})
export class TrStatementHubComponent implements OnInit {
  private readonly api = inject(TreasuryBankingApiService);
  private readonly banking = inject(BankingApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly formats = FORMATS;
  protected readonly csvFields: CsvField[] = CSV_FIELDS;

  protected readonly format = signal<StatementFormat>('auto');
  protected readonly autoReconcile = signal(true);
  protected readonly mapping = signal<CsvMapping>(emptyCsvMapping());
  protected readonly profiles = signal<CsvProfile[]>([]);
  protected readonly profileId = signal<string | null>(null);
  protected readonly profileName = signal('');
  protected readonly importing = signal(false);
  protected readonly importErrors = signal<string[]>([]);
  protected readonly importKeys = signal<string[]>([]);
  protected readonly summary = signal<StatementImportSummary | null>(null);

  protected readonly obStatus = signal<OpenBankingStatus | null>(null);
  protected readonly connections = signal<OpenBankingConnection[]>([]);
  protected readonly runs = signal<OpenBankingSyncRun[]>([]);
  protected readonly newIban = signal('');
  protected readonly from = signal<Date | null>(null);
  protected readonly to = signal<Date | null>(null);
  protected readonly syncing = signal<string | null>(null);
  protected readonly syncErrors = signal<string[]>([]);

  protected readonly statements = signal<BankStatement[]>([]);
  protected readonly loadingBatches = signal(false);
  protected readonly inspecting = signal<BankStatement | null>(null);
  protected readonly lines = signal<SmartReconciliationLine[]>([]);

  protected readonly csvReady = computed(() => isCsvMappingReady(this.mapping()));

  protected readonly beforeUpload = (file: NzUploadFile): boolean => {
    this.handle(file as unknown as File);

    return false;
  };

  ngOnInit(): void {
    this.refreshProfiles();
    this.refreshOpenBanking();
    this.refreshBatches();
  }

  /** Rejects unsupported or oversized files, and an incomplete CSV mapping, before they reach the API. */
  handle(file: File): void {
    this.summary.set(null);
    this.importErrors.set([]);
    this.importKeys.set([]);

    if (!isStatementFile(file)) {
      this.importKeys.set([this.invalidFileKey]);

      return;
    }

    if (this.format() === 'csv' && !this.profileId() && !this.csvReady()) {
      this.importKeys.set([this.incompleteMappingKey]);

      return;
    }

    this.importing.set(true);
    this.api
      .importStatement(file, {
        format: this.format(),
        autoReconcile: this.autoReconcile(),
        csvProfileId: this.profileId(),
        csv: this.format() === 'csv' ? this.mapping() : null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.importing.set(false);
          this.summary.set(res.data);
          this.refreshBatches();
        },
        error: (error: unknown) => {
          this.importing.set(false);
          const messages = apiErrorMessages(error);
          this.importErrors.set(messages);
          this.importKeys.set(messages.length > 0 ? [] : [this.failureKey]);
        },
      });
  }

  protected readonly invalidFileKey = 'tbk.hub.invalidFile';
  protected readonly incompleteMappingKey = 'tbk.hub.csv.incomplete';
  protected readonly failureKey = 'tbk.hub.importFailed';

  protected patchMapping(change: Partial<CsvMapping>): void {
    this.profileId.set(null);
    this.mapping.update((mapping) => ({ ...mapping, ...change }));
  }

  protected patchColumn(field: CsvField, value: string): void {
    this.profileId.set(null);
    this.mapping.update((mapping) => ({
      ...mapping,
      columns: { ...mapping.columns, [field]: value },
    }));
  }

  protected pickProfile(id: string | null): void {
    this.profileId.set(id);
    const profile = this.profiles().find((p) => p.id === id);

    if (profile) {
      this.mapping.set({ ...profile });
    }
  }

  protected saveProfile(): void {
    this.api
      .saveCsvProfile(this.profileName().trim(), this.mapping())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.profileName.set('');
          this.refreshProfiles();
        },
        error: (error: unknown) => this.importErrors.set(apiErrorMessages(error)),
      });
  }

  protected connect(): void {
    this.api
      .createOpenBankingConsent(this.newIban().trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.newIban.set('');
          this.refreshOpenBanking();
        },
        error: (error: unknown) => this.syncErrors.set(apiErrorMessages(error)),
      });
  }

  protected sync(connection: OpenBankingConnection): void {
    this.syncing.set(connection.id);
    this.syncErrors.set([]);
    const from = this.from();
    const to = this.to();

    this.api
      .syncOpenBanking(connection.id, {
        from: from ? toIsoDate(from) : null,
        to: to ? toIsoDate(to) : null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.syncing.set(null);
          this.refreshOpenBanking();
          this.refreshBatches();
        },
        error: (error: unknown) => {
          this.syncing.set(null);
          this.syncErrors.set(apiErrorMessages(error));
          this.refreshOpenBanking();
        },
      });
  }

  protected inspect(statement: BankStatement): void {
    this.inspecting.set(statement);
    this.api
      .getSmartLines({ status: 'all', statement_id: statement.id, per_page: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => this.lines.set(res.data));
  }

  private refreshProfiles(): void {
    this.api
      .getCsvProfiles()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => this.profiles.set(res.data));
  }

  private refreshOpenBanking(): void {
    this.api
      .getOpenBankingStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => this.obStatus.set(res.data));
    this.api
      .getOpenBankingConnections()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => this.connections.set(res.data));
    this.api
      .getOpenBankingSyncRuns()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => this.runs.set(res.data));
  }

  private refreshBatches(): void {
    this.loadingBatches.set(true);
    this.banking
      .getBankStatements({ per_page: 50 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.statements.set(res.data);
          this.loadingBatches.set(false);
        },
        error: () => this.loadingBatches.set(false),
      });
  }
}
