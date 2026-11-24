import { Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { DUNNING_CHANNELS, DunningChannel, CreditManagementApiService, DunningStrategy, TranslateService } from '@core';
import { IconActionDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, decimalOrNull } from './credit.util';

/** Dunning strategies: the ordered steps (days after the due date, channel, fee) applied to a collection case. */
@Component({
  selector: 'app-credit-strategies',
  styleUrl: './credit-management.scss',
  imports: [
    ReactiveFormsModule,
    IconActionDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'CREDIT.STRATEGIES_TITLE' | translate" [subtitle]="'CREDIT.STRATEGIES_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
    </app-page-header>

    <nz-card class="main-card">
      <nz-table #table [nzData]="strategies()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'CREDIT.NAME' | translate }}</th>
            <th>{{ 'CREDIT.DESCRIPTION' | translate }}</th>
            <th>{{ 'CREDIT.ACTIVE' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>
                {{ row.name }}
                @if (row.is_default) {
                  <nz-tag nzColor="blue">{{ 'CREDIT.DEFAULT' | translate }}</nz-tag>
                }
              </td>
              <td>{{ row.description }}</td>
              <td>{{ (row.is_active ? 'CREDIT.YES' : 'CREDIT.NO') | translate }}</td>
              <td>
                <div class="row-actions">
                  <button nz-button nzType="text" appIconAction="edit" (click)="openModal(row)"></button>
                  <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'CREDIT.DELETE_CONFIRM' | translate" (nzOnConfirm)="remove(row)"></button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && strategies().length === 0) {
        <nz-empty [nzNotFoundContent]="'CREDIT.NO_STRATEGIES' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal [(nzVisible)]="modalVisible" [nzTitle]="(editing() ? 'CREDIT.EDIT_STRATEGY' : 'CREDIT.NEW_STRATEGY') | translate" nzWidth="900px" (nzOnCancel)="modalVisible.set(false)" (nzOnOk)="save()" okAction="save" [nzOkDisabled]="form.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="strategy-name">{{ 'CREDIT.NAME' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="strategy-name" formControlName="name" maxlength="120" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="strategy-description">{{ 'CREDIT.DESCRIPTION' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="strategy-description" rows="2" maxlength="2000" formControlName="description"></textarea></nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label>{{ 'CREDIT.DEFAULT' | translate }}</nz-form-label>
              <nz-form-control><nz-switch formControlName="is_default"></nz-switch></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'CREDIT.ACTIVE' | translate }}</nz-form-label>
              <nz-form-control><nz-switch formControlName="is_active"></nz-switch></nz-form-control>
            </nz-form-item>
          </div>
          <h4>{{ 'CREDIT.STEPS' | translate }}</h4>
          <div formArrayName="steps">
            @for (step of steps.controls; track $index) {
              <div class="step-row" [formGroupName]="$index">
                <span>{{ $index + 1 }}</span>
                <input nz-input formControlName="name" maxlength="120" [attr.aria-label]="'CREDIT.NAME' | translate" [placeholder]="'CREDIT.NAME' | translate" />
                <input nz-input type="number" min="0" max="3650" formControlName="days_after_due" [attr.aria-label]="'CREDIT.DAYS_AFTER_DUE' | translate" [placeholder]="'CREDIT.DAYS_AFTER_DUE' | translate" />
                <nz-select formControlName="channel">
                  @for (channel of channels; track channel) {
                    <nz-option [nzValue]="channel" [nzLabel]="('CREDIT.CHANNEL_' + channel.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
                <input nz-input formControlName="template_key" maxlength="120" [attr.aria-label]="'CREDIT.TEMPLATE_KEY' | translate" [placeholder]="'CREDIT.TEMPLATE_KEY' | translate" />
                <input nz-input type="number" min="0" step="any" formControlName="fee_amount" [attr.aria-label]="'CREDIT.FEE' | translate" [placeholder]="'CREDIT.FEE' | translate" />
                <label [attr.for]="'credit-strategies-escalates-' + $index"><nz-switch [nzId]="'credit-strategies-escalates-' + $index" formControlName="escalates"></nz-switch> {{ 'CREDIT.ESCALATES' | translate }}</label>
                <button nz-button nzType="text" nzDanger type="button" appIconAction="delete" [disabled]="steps.length === 1" (click)="removeStep($index)"></button>
              </div>
            }
          </div>
          <button nz-button type="button" (click)="addStep()">{{ 'CREDIT.ADD_STEP' | translate }}</button>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class CreditStrategiesComponent implements OnInit {
  private readonly api = inject(CreditManagementApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly channels = DUNNING_CHANNELS;
  readonly strategies = signal<DunningStrategy[]>([]);
  readonly loading = signal(false);
  readonly modalVisible = signal(false);
  readonly editing = signal<DunningStrategy | null>(null);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(2000)]],
    is_default: [false],
    is_active: [true],
    steps: this.fb.array([this.newStep('', 7, 'email')]),
  });

  get steps() {
    return this.form.controls.steps;
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getStrategies().subscribe({
      next: (response) => {
        this.strategies.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('CREDIT.ACTION_ERROR'));
      },
    });
  }

  addStep(): void {
    this.steps.push(this.newStep('', 0, 'email'));
  }

  removeStep(index: number): void {
    this.steps.removeAt(index);
  }

  openModal(strategy: DunningStrategy | null = null): void {
    this.editing.set(strategy);
    this.form.patchValue({ name: strategy?.name ?? '', description: strategy?.description ?? '', is_default: strategy?.is_default ?? false, is_active: strategy?.is_active ?? true });
    this.steps.clear();
    this.modalVisible.set(true);
    if (strategy === null) {
      this.steps.push(this.newStep('', 7, 'email'));
      return;
    }
    // The list does not carry the steps: load them with the strategy.
    this.api.getStrategy(strategy.id).subscribe({
      next: (response) => {
        for (const step of response.data.steps ?? []) {
          this.steps.push(this.newStep(step.name, step.days_after_due, step.channel, step.template_key ?? '', step.fee_amount, step.escalates));
        }
      },
      error: () => this.message.error(this.translate.instant('CREDIT.ACTION_ERROR')),
    });
  }

  save(): void {
    const value = this.form.getRawValue();
    const payload = {
      name: value.name,
      description: blankToNull(value.description),
      is_default: value.is_default,
      is_active: value.is_active,
      steps: value.steps.map((step) => ({
        name: step.name,
        days_after_due: Number(step.days_after_due),
        channel: step.channel,
        template_key: blankToNull(step.template_key),
        fee_amount: decimalOrNull(step.fee_amount),
        escalates: step.escalates,
      })),
    };
    const current = this.editing();
    const request = current ? this.api.updateStrategy(current.id, payload) : this.api.createStrategy(payload);

    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('CREDIT.STRATEGY_SAVED'));
        this.modalVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('CREDIT.ACTION_ERROR')),
    });
  }

  remove(strategy: DunningStrategy): void {
    this.api.deleteStrategy(strategy.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CREDIT.DELETED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('CREDIT.ACTION_ERROR')),
    });
  }

  private newStep(name: string, days: number, channel: DunningChannel, templateKey = '', fee: string | null = null, escalates = false) {
    return this.fb.group({
      name: [name, [Validators.required, Validators.maxLength(120)]],
      days_after_due: [days, [Validators.required, Validators.min(0), Validators.max(3650)]],
      channel: [channel, [Validators.required]],
      template_key: [templateKey],
      fee_amount: this.fb.control<number | string | null>(fee === null ? null : Number(fee), [Validators.min(0)]),
      escalates: [escalates],
    });
  }
}
