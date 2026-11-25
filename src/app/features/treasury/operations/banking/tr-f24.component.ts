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
import { Observable } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TreasuryBankingApiService } from '@core/api/treasury-banking-api.service';
import {
  F24Delegation,
  F24DelegationLine,
  F24DelegationStatus,
  F24Payload,
  F24Section,
  F24TaxCode,
  F24ValidationIssue,
} from '@core/models/treasury-banking.model';
import { TranslatePipe, downloadBlob } from '@shared';
import {
  F24_SECTIONS,
  apiErrorMessages,
  emptyF24Line,
  f24Balance,
  toIsoDate,
} from './treasury-banking.util';

const STATUS_COLORS: Record<F24DelegationStatus, string> = {
  draft: 'default',
  validated: 'blue',
  generated: 'green',
  paid: 'purple',
};

interface F24Form {
  id: string | null;
  taxpayer_fiscal_code: string;
  taxpayer_name: string;
  taxpayer_first_name: string;
  taxpayer_birth_date: Date | null;
  taxpayer_birth_place: string;
  taxpayer_birth_province: string;
  taxpayer_gender: string;
  payment_date: Date | null;
  lines: F24DelegationLine[];
}

const blankForm = (): F24Form => ({
  id: null,
  taxpayer_fiscal_code: '',
  taxpayer_name: '',
  taxpayer_first_name: '',
  taxpayer_birth_date: null,
  taxpayer_birth_place: '',
  taxpayer_birth_province: '',
  taxpayer_gender: '',
  payment_date: null,
  lines: [emptyF24Line()],
});

/**
 * Modello F24 telematico: delegations with Erario, INPS, Regioni, IMU and INAIL lines. Debits and compensated credits are
 * balanced live (exact cents) and again by the API on validation; the telematic file is generated only for a valid
 * delegation and kept with its SHA-256.
 */
@Component({
  selector: 'app-tr-f24',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDatePickerModule,
    NzDrawerModule,
    NzGridModule,
    NzInputModule,
    NzSelectModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <nz-card [nzTitle]="'tbk.f24.title' | translate">
      <button nz-button nzType="primary" type="button" (click)="open(null)" data-testid="new-f24">
        {{ 'tbk.f24.new' | translate }}
      </button>

      <nz-table #list [nzData]="delegations()" nzSize="small" class="list" [nzLoading]="loading()">
        <thead>
          <tr>
            <th>{{ 'tbk.f24.taxpayer' | translate }}</th>
            <th>{{ 'tbk.f24.paymentDate' | translate }}</th>
            <th>{{ 'tbk.f24.totalDebit' | translate }}</th>
            <th>{{ 'tbk.f24.totalCredit' | translate }}</th>
            <th>{{ 'tbk.f24.totalPayable' | translate }}</th>
            <th>{{ 'tbk.common.status' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of list.data; track row.id) {
            <tr>
              <td>
                {{ row.taxpayer_name }} <small>{{ row.taxpayer_fiscal_code }}</small>
              </td>
              <td>{{ row.payment_date }}</td>
              <td>{{ row.total_debit }}</td>
              <td>{{ row.total_credit }}</td>
              <td>{{ row.total_payable }}</td>
              <td>
                <nz-tag [nzColor]="color(row.status)">{{
                  'tbk.f24.status.' + row.status | translate
                }}</nz-tag>
              </td>
              <td>
                <button nz-button nzType="link" type="button" (click)="open(row.id)">
                  {{ 'tbk.common.open' | translate }}
                </button>
                @if (row.status === 'generated') {
                  <button nz-button nzType="link" type="button" (click)="download(row)">
                    {{ 'tbk.f24.download' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-drawer
      [nzVisible]="drawerOpen()"
      nzWidth="960"
      [nzTitle]="'tbk.f24.editor' | translate"
      (nzOnClose)="close()"
    >
      <ng-container *nzDrawerContent>
        @if (errors().length > 0) {
          <nz-alert
            class="gap"
            nzType="error"
            nzShowIcon
            [nzMessage]="'tbk.f24.invalid' | translate"
            [nzDescription]="issueList"
            data-testid="f24-errors"
          />
          <ng-template #issueList>
            <ul>
              @for (message of errors(); track message) {
                <li>{{ message }}</li>
              }
            </ul>
          </ng-template>
        }

        <div nz-row [nzGutter]="16">
          <div nz-col [nzXs]="24" [nzMd]="8">
            <label class="field" for="f24-cf"
              ><span>{{ 'tbk.f24.fiscalCode' | translate }}</span>
              <input
                nz-input
                id="f24-cf"
                maxlength="16"
                [disabled]="locked()"
                [ngModel]="form().taxpayer_fiscal_code"
                (ngModelChange)="set({ taxpayer_fiscal_code: ($event ?? '').toUpperCase() })"
                data-testid="cf"
            /></label>
          </div>
          <div nz-col [nzXs]="24" [nzMd]="8">
            <label class="field" for="f24-name"
              ><span>{{ 'tbk.f24.surname' | translate }}</span>
              <input
                nz-input
                id="f24-name"
                maxlength="60"
                [disabled]="locked()"
                [ngModel]="form().taxpayer_name"
                (ngModelChange)="set({ taxpayer_name: $event })"
            /></label>
          </div>
          <div nz-col [nzXs]="24" [nzMd]="8">
            <label class="field" for="f24-first"
              ><span>{{ 'tbk.f24.firstName' | translate }}</span>
              <input
                nz-input
                id="f24-first"
                maxlength="60"
                [disabled]="locked()"
                [ngModel]="form().taxpayer_first_name"
                (ngModelChange)="set({ taxpayer_first_name: $event })"
            /></label>
          </div>
          <div nz-col [nzXs]="24" [nzMd]="6">
            <label class="field" for="f24-birth"
              ><span>{{ 'tbk.f24.birthDate' | translate }}</span>
              <nz-date-picker
                nzId="f24-birth"
                nzFormat="yyyy-MM-dd"
                [nzDisabled]="locked()"
                [ngModel]="form().taxpayer_birth_date"
                (ngModelChange)="set({ taxpayer_birth_date: $event })"
            /></label>
          </div>
          <div nz-col [nzXs]="24" [nzMd]="6">
            <label class="field" for="f24-place"
              ><span>{{ 'tbk.f24.birthPlace' | translate }}</span>
              <input
                nz-input
                id="f24-place"
                [disabled]="locked()"
                [ngModel]="form().taxpayer_birth_place"
                (ngModelChange)="set({ taxpayer_birth_place: $event })"
            /></label>
          </div>
          <div nz-col [nzXs]="24" [nzMd]="4">
            <label class="field" for="f24-prov"
              ><span>{{ 'tbk.f24.province' | translate }}</span>
              <input
                nz-input
                id="f24-prov"
                maxlength="2"
                [disabled]="locked()"
                [ngModel]="form().taxpayer_birth_province"
                (ngModelChange)="set({ taxpayer_birth_province: ($event ?? '').toUpperCase() })"
            /></label>
          </div>
          <div nz-col [nzXs]="24" [nzMd]="8">
            <label class="field" for="f24-pay"
              ><span>{{ 'tbk.f24.paymentDate' | translate }}</span>
              <nz-date-picker
                nzId="f24-pay"
                nzFormat="yyyy-MM-dd"
                [nzDisabled]="locked()"
                [ngModel]="form().payment_date"
                (ngModelChange)="set({ payment_date: $event })"
                data-testid="pay-date"
            /></label>
          </div>
        </div>

        <nz-table
          #lineTable
          [nzData]="form().lines"
          [nzShowPagination]="false"
          nzSize="small"
          [nzScroll]="{ x: '900px' }"
        >
          <thead>
            <tr>
              <th>{{ 'tbk.f24.section' | translate }}</th>
              <th>{{ 'tbk.f24.taxCode' | translate }}</th>
              <th>{{ 'tbk.f24.institution' | translate }}</th>
              <th>{{ 'tbk.f24.reference' | translate }}</th>
              <th>{{ 'tbk.f24.period' | translate }}</th>
              <th>{{ 'tbk.f24.year' | translate }}</th>
              <th>{{ 'tbk.f24.debit' | translate }}</th>
              <th>{{ 'tbk.f24.credit' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (line of lineTable.data; track $index; let i = $index) {
              <tr>
                <td>
                  <nz-select
                    [nzDisabled]="locked()"
                    [ngModel]="line.section"
                    (ngModelChange)="patch(i, { section: $event, tax_code: '' })"
                    [attr.aria-label]="'tbk.f24.section' | translate"
                  >
                    @for (section of sections; track section) {
                      <nz-option
                        [nzValue]="section"
                        [nzLabel]="'tbk.f24.sectionName.' + section | translate"
                      />
                    }
                  </nz-select>
                </td>
                <td>
                  <nz-select
                    nzShowSearch
                    nzAllowClear
                    [nzDisabled]="locked()"
                    [ngModel]="line.tax_code"
                    (ngModelChange)="patch(i, { tax_code: $event ?? '' })"
                    [attr.aria-label]="'tbk.f24.taxCode' | translate"
                  >
                    @for (code of codesOf(line.section); track code.code) {
                      <nz-option
                        [nzValue]="code.code"
                        [nzLabel]="code.code + ' · ' + (code.translation_key | translate)"
                      />
                    }
                  </nz-select>
                </td>
                <td>
                  <input
                    nz-input
                    [disabled]="locked()"
                    [ngModel]="line.institution_code"
                    (ngModelChange)="patch(i, { institution_code: $event })"
                    [attr.aria-label]="'tbk.f24.institution' | translate"
                  />
                </td>
                <td>
                  <input
                    nz-input
                    [disabled]="locked()"
                    [ngModel]="line.reference_number"
                    (ngModelChange)="patch(i, { reference_number: $event })"
                    [attr.aria-label]="'tbk.f24.reference' | translate"
                  />
                </td>
                <td>
                  <input
                    nz-input
                    [disabled]="locked()"
                    [ngModel]="line.reference_period"
                    (ngModelChange)="patch(i, { reference_period: $event })"
                    [attr.aria-label]="'tbk.f24.period' | translate"
                  />
                </td>
                <td>
                  <input
                    nz-input
                    maxlength="4"
                    [disabled]="locked()"
                    [ngModel]="line.reference_year"
                    (ngModelChange)="patch(i, { reference_year: $event })"
                    [attr.aria-label]="'tbk.f24.year' | translate"
                  />
                </td>
                <td>
                  <input
                    nz-input
                    inputmode="decimal"
                    [disabled]="locked()"
                    [ngModel]="line.debit_amount"
                    (ngModelChange)="patch(i, { debit_amount: $event })"
                    [attr.aria-label]="'tbk.f24.debit' | translate"
                  />
                </td>
                <td>
                  <input
                    nz-input
                    inputmode="decimal"
                    [disabled]="locked()"
                    [ngModel]="line.credit_amount"
                    (ngModelChange)="patch(i, { credit_amount: $event })"
                    [attr.aria-label]="'tbk.f24.credit' | translate"
                  />
                </td>
                <td>
                  <button
                    nz-button
                    nzType="link"
                    nzDanger
                    type="button"
                    [disabled]="locked() || form().lines.length === 1"
                    (click)="removeLine(i)"
                  >
                    {{ 'tbk.common.remove' | translate }}
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
        <button
          nz-button
          type="button"
          class="add"
          [disabled]="locked()"
          (click)="addLine()"
          data-testid="add-f24-line"
        >
          {{ 'tbk.f24.addLine' | translate }}
        </button>

        <div nz-row [nzGutter]="16" class="totals">
          <div nz-col [nzSpan]="8">
            <nz-statistic
              [nzTitle]="'tbk.f24.totalDebit' | translate"
              [nzValue]="balance().debit"
              data-testid="total-debit"
            />
          </div>
          <div nz-col [nzSpan]="8">
            <nz-statistic
              [nzTitle]="'tbk.f24.totalCredit' | translate"
              [nzValue]="balance().credit"
              data-testid="total-credit"
            />
          </div>
          <div nz-col [nzSpan]="8">
            <nz-statistic
              [nzTitle]="'tbk.f24.totalPayable' | translate"
              [nzValue]="balance().payable"
              data-testid="total-payable"
            />
          </div>
        </div>

        @if (balance().creditExceedsDebit) {
          <nz-alert
            class="gap"
            nzType="error"
            nzShowIcon
            [nzMessage]="'tbk.f24.creditExceedsDebit' | translate"
            data-testid="credit-exceeds"
          />
        } @else if (balance().zeroBalance) {
          <nz-alert
            class="gap"
            nzType="info"
            nzShowIcon
            [nzMessage]="'tbk.f24.zeroBalance' | translate"
            data-testid="zero-balance"
          />
        } @else if (balance().balanced) {
          <nz-alert
            class="gap"
            nzType="success"
            nzShowIcon
            [nzMessage]="'tbk.f24.balanced' | translate"
            data-testid="balanced"
          />
        }

        <div class="actions">
          <button
            nz-button
            nzType="primary"
            type="button"
            [nzLoading]="busy()"
            [disabled]="locked() || !balance().balanced"
            (click)="save()"
            data-testid="save-f24"
          >
            {{ 'tbk.common.save' | translate }}
          </button>
          <button
            nz-button
            type="button"
            [nzLoading]="busy()"
            [disabled]="!form().id"
            (click)="validate()"
            data-testid="validate-f24"
          >
            {{ 'tbk.f24.validate' | translate }}
          </button>
          <button
            nz-button
            type="button"
            [nzLoading]="busy()"
            [disabled]="status() !== 'validated'"
            (click)="generate()"
            data-testid="generate-f24"
          >
            {{ 'tbk.f24.generate' | translate }}
          </button>
          <button
            nz-button
            type="button"
            [disabled]="status() !== 'generated' && status() !== 'paid'"
            (click)="downloadCurrent()"
          >
            {{ 'tbk.f24.download' | translate }}
          </button>
          <button
            nz-button
            type="button"
            [disabled]="status() !== 'generated'"
            (click)="markPaid()"
          >
            {{ 'tbk.f24.markPaid' | translate }}
          </button>
          <button
            nz-button
            nzDanger
            type="button"
            [disabled]="locked() || !form().id"
            (click)="remove()"
          >
            {{ 'tbk.common.delete' | translate }}
          </button>
        </div>
        @if (status(); as current) {
          <p>
            <nz-tag [nzColor]="color(current)">{{
              'tbk.f24.status.' + current | translate
            }}</nz-tag>
          </p>
        }
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    :host {
      display: block;
    }
    .list,
    .gap {
      margin-top: 16px;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 12px;
    }
    .add {
      margin-top: 12px;
    }
    .totals {
      margin-top: 16px;
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 16px;
    }
  `,
})
export class TrF24Component implements OnInit {
  private readonly api = inject(TreasuryBankingApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sections = F24_SECTIONS;
  protected readonly delegations = signal<F24Delegation[]>([]);
  protected readonly taxCodes = signal<F24TaxCode[]>([]);
  protected readonly form = signal<F24Form>(blankForm());
  protected readonly status = signal<F24DelegationStatus | null>(null);
  protected readonly drawerOpen = signal(false);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly errors = signal<string[]>([]);

  protected readonly balance = computed(() => f24Balance(this.form().lines));
  protected readonly locked = computed(
    () => this.status() === 'generated' || this.status() === 'paid',
  );

  ngOnInit(): void {
    this.api
      .getF24TaxCodes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => this.taxCodes.set(res.data));
    this.load();
  }

  protected color(status: F24DelegationStatus): string {
    return STATUS_COLORS[status];
  }

  protected codesOf(section: F24Section): F24TaxCode[] {
    return this.taxCodes().filter((code) => code.section === section);
  }

  protected open(id: string | null): void {
    this.errors.set([]);

    if (id === null) {
      this.form.set(blankForm());
      this.status.set(null);
      this.drawerOpen.set(true);

      return;
    }

    this.api
      .getF24Delegation(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        this.fill(res.data);
        this.drawerOpen.set(true);
      });
  }

  protected close(): void {
    this.drawerOpen.set(false);
  }

  protected set(change: Partial<F24Form>): void {
    this.form.update((form) => ({ ...form, ...change }));
  }

  protected patch(index: number, change: Partial<F24DelegationLine>): void {
    this.form.update((form) => ({
      ...form,
      lines: form.lines.map((line, i) => (i === index ? { ...line, ...change } : line)),
    }));
  }

  protected addLine(): void {
    this.form.update((form) => ({ ...form, lines: [...form.lines, emptyF24Line()] }));
  }

  protected removeLine(index: number): void {
    this.form.update((form) => ({ ...form, lines: form.lines.filter((_, i) => i !== index) }));
  }

  protected save(): void {
    const payload = this.payload();

    if (!payload) {
      return;
    }

    const id = this.form().id;
    const call = id
      ? this.api.updateF24Delegation(id, payload)
      : this.api.createF24Delegation(payload);

    this.run(call, (res) => {
      this.fill(res.data);
      this.load();
    });
  }

  protected validate(): void {
    const id = this.form().id;

    if (!id) {
      return;
    }

    this.busy.set(true);
    this.errors.set([]);
    this.api
      .validateF24Delegation(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.busy.set(false);
          this.errors.set(res.data.issues.map((issue: F24ValidationIssue) => issue.message));
          this.status.set(res.data.delegation.status);
          this.load();
        },
        error: (error: unknown) => {
          this.busy.set(false);
          this.errors.set(apiErrorMessages(error));
        },
      });
  }

  protected generate(): void {
    const id = this.form().id;

    if (id) {
      this.run(this.api.generateF24File(id), (res) => {
        this.fill(res.data);
        this.load();
      });
    }
  }

  protected markPaid(): void {
    const id = this.form().id;

    if (id) {
      this.run(this.api.markF24Paid(id), (res) => {
        this.fill(res.data);
        this.load();
      });
    }
  }

  protected remove(): void {
    const id = this.form().id;

    if (id) {
      this.run(this.api.deleteF24Delegation(id), () => {
        this.drawerOpen.set(false);
        this.load();
      });
    }
  }

  protected download(delegation: F24Delegation): void {
    this.api
      .downloadF24File(delegation.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((blob) =>
        downloadBlob(blob, delegation.file_name ?? `F24_${delegation.taxpayer_fiscal_code}.txt`),
      );
  }

  protected downloadCurrent(): void {
    const id = this.form().id;
    const delegation = this.delegations().find((row) => row.id === id);

    if (delegation) {
      this.download(delegation);
    }
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .getF24Delegations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.delegations.set(res.data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  private run<T>(call: Observable<T>, done: (value: T) => void): void {
    this.busy.set(true);
    this.errors.set([]);
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (value) => {
        this.busy.set(false);
        done(value);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.errors.set(apiErrorMessages(error));
      },
    });
  }

  private fill(delegation: F24Delegation): void {
    this.status.set(delegation.status);
    this.form.set({
      id: delegation.id,
      taxpayer_fiscal_code: delegation.taxpayer_fiscal_code,
      taxpayer_name: delegation.taxpayer_name,
      taxpayer_first_name: delegation.taxpayer_first_name ?? '',
      taxpayer_birth_date: delegation.taxpayer_birth_date
        ? new Date(`${delegation.taxpayer_birth_date}T00:00:00`)
        : null,
      taxpayer_birth_place: delegation.taxpayer_birth_place ?? '',
      taxpayer_birth_province: delegation.taxpayer_birth_province ?? '',
      taxpayer_gender: delegation.taxpayer_gender ?? '',
      payment_date: new Date(`${delegation.payment_date}T00:00:00`),
      lines: delegation.lines?.length ? delegation.lines : [emptyF24Line()],
    });
  }

  private payload(): F24Payload | null {
    const form = this.form();

    if (!form.payment_date) {
      return null;
    }

    return {
      taxpayer_fiscal_code: form.taxpayer_fiscal_code,
      taxpayer_name: form.taxpayer_name,
      taxpayer_first_name: form.taxpayer_first_name || null,
      taxpayer_birth_date: form.taxpayer_birth_date ? toIsoDate(form.taxpayer_birth_date) : null,
      taxpayer_birth_place: form.taxpayer_birth_place || null,
      taxpayer_birth_province: form.taxpayer_birth_province || null,
      taxpayer_gender: form.taxpayer_gender || null,
      payment_date: toIsoDate(form.payment_date),
      lines: form.lines.map((line) => ({ ...line, id: undefined })),
    };
  }
}
