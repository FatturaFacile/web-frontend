import { DecimalPipe } from '@angular/common';
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
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  ESG_TARGET_SCOPES,
  EsgReductionTarget,
  EsgReductionTargetRequest,
  EsgTargetScope,
  EsgTargetStatus,
  SustainabilityApiService,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText } from './sustainability.util';

const STATUS_COLORS: Readonly<Record<EsgTargetStatus, string>> = {
  draft: 'default',
  active: 'blue',
  achieved: 'green',
  missed: 'red',
  cancelled: 'default',
};

/** Reduction targets against a frozen baseline, with progress and the linear path to the target year. */
@Component({
  selector: 'app-sustainability-targets',
  styleUrl: './sustainability.scss',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzProgressModule,
    NzSelectModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'SUSTAINABILITY.TARGETS_TITLE' | translate" [subtitle]="'SUSTAINABILITY.TARGETS_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
    </app-page-header>

    @for (target of targets(); track target.id) {
      <nz-card class="main-card" [nzTitle]="target.name" [nzExtra]="extra">
        <ng-template #extra>
          <nz-tag [nzColor]="statusColor(target.status)">{{ ('SUSTAINABILITY.TARGET_' + target.status.toUpperCase()) | translate }}</nz-tag>
        </ng-template>
        <p class="muted">
          {{ ('SUSTAINABILITY.TARGET_SCOPE_' + target.scope.toUpperCase()) | translate }}:
          -{{ target.reduction_percent | number: '1.0-2' }}% {{ 'SUSTAINABILITY.BY' | translate }} {{ target.target_year }}
          ({{ 'SUSTAINABILITY.BASELINE' | translate }} {{ target.baseline_year }})
        </p>
        @if (target.progress; as progress) {
          <nz-progress
            [nzPercent]="clamp(progress.progress_percent)"
            [nzStatus]="target.status === 'missed' ? 'exception' : target.status === 'achieved' ? 'success' : 'active'"
          ></nz-progress>
          <p>
            {{ 'SUSTAINABILITY.BASELINE_KG' | translate }}: <strong>{{ progress.baseline_co2e_kg | number: '1.0-2' }}</strong>
            | {{ 'SUSTAINABILITY.TARGET_KG' | translate }}: <strong>{{ progress.target_co2e_kg | number: '1.0-2' }}</strong>
            @if (progress.current_co2e_kg) {
              | {{ 'SUSTAINABILITY.CURRENT_KG' | translate }} ({{ progress.current_year }}): <strong>{{ progress.current_co2e_kg | number: '1.0-2' }}</strong>
            }
          </p>
          @if (progress.on_track !== null) {
            <nz-tag [nzColor]="progress.on_track ? 'green' : 'orange'">
              {{ (progress.on_track ? 'SUSTAINABILITY.ON_TRACK' : 'SUSTAINABILITY.OFF_TRACK') | translate }}
            </nz-tag>
            <span class="muted">{{ progress.reduction_achieved_percent }}% / {{ progress.expected_reduction_percent }}% {{ 'SUSTAINABILITY.EXPECTED' | translate }}</span>
          }
        } @else {
          <p class="muted">{{ 'SUSTAINABILITY.BASELINE_NOT_FROZEN' | translate }}</p>
        }
        <div class="toolbar" style="margin-top: 12px; margin-bottom: 0">
          @if (target.status === 'draft') {
            <button nz-button (click)="openEdit(target)">{{ 'SUSTAINABILITY.EDIT_TARGET' | translate }}</button>
            <button nz-button nzType="primary" (click)="activate(target)">{{ 'SUSTAINABILITY.ACTIVATE' | translate }}</button>
          }
          @if (target.status === 'active') {
            <button nz-button (click)="evaluate(target)">{{ 'SUSTAINABILITY.EVALUATE' | translate }}</button>
          }
          @if (target.status === 'draft' || target.status === 'active') {
            <button nz-button nzDanger nz-popconfirm [nzPopconfirmTitle]="'SUSTAINABILITY.CANCEL_TARGET_CONFIRM' | translate" (nzOnConfirm)="cancel(target)">
              {{ 'SUSTAINABILITY.CANCEL_TARGET' | translate }}
            </button>
          }
        </div>
      </nz-card>
    } @empty {
      @if (!loading()) {
        <nz-empty [nzNotFoundContent]="'SUSTAINABILITY.NO_TARGETS' | translate"></nz-empty>
      }
    }

    <nz-modal appModalActions
      [(nzVisible)]="modalVisible"
      [nzTitle]="(editingId() ? 'SUSTAINABILITY.EDIT_TARGET' : 'SUSTAINABILITY.NEW_TARGET') | translate"
      (nzOnCancel)="modalVisible.set(false)"
      (nzOnOk)="save()"
      okAction="save"
      [nzOkDisabled]="form.invalid"
    >
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'SUSTAINABILITY.NAME' | translate }}</nz-form-label>
            <nz-form-control><input nz-input formControlName="name" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'SUSTAINABILITY.SCOPE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="scope">
                @for (scope of scopes; track scope) {
                  <nz-option [nzValue]="scope" [nzLabel]="('SUSTAINABILITY.TARGET_SCOPE_' + scope.toUpperCase()) | translate"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'SUSTAINABILITY.BASELINE_YEAR' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="1990" max="2100" formControlName="baseline_year" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'SUSTAINABILITY.TARGET_YEAR' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="1991" max="2100" formControlName="target_year" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'SUSTAINABILITY.REDUCTION_PERCENT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="1" max="100" step="any" formControlName="reduction_percent" /></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class SustainabilityTargetsComponent implements OnInit {
  private readonly api = inject(SustainabilityApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly scopes = ESG_TARGET_SCOPES;
  readonly targets = signal<EsgReductionTarget[]>([]);
  readonly loading = signal(false);
  readonly modalVisible = signal(false);
  readonly editingId = signal<string | null>(null);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(190)]],
    scope: ['total' as EsgTargetScope, [Validators.required]],
    baseline_year: [new Date().getFullYear() - 1, [Validators.required, Validators.min(1990), Validators.max(2100)]],
    target_year: [2030, [Validators.required, Validators.min(1991), Validators.max(2100)]],
    reduction_percent: ['42', [Validators.required, Validators.min(0.01), Validators.max(100)]],
  });

  ngOnInit(): void {
    this.load();
  }

  statusColor(status: EsgTargetStatus): string {
    return STATUS_COLORS[status];
  }

  clamp(value: string | null): number {
    return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  }

  load(): void {
    this.loading.set(true);
    this.api.getTargets().subscribe({
      next: (response) => {
        this.targets.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('SUSTAINABILITY.ACTION_ERROR'));
      },
    });
  }

  openModal(): void {
    this.editingId.set(null);
    this.form.reset({ name: '', scope: 'total', baseline_year: new Date().getFullYear() - 1, target_year: 2030, reduction_percent: '42' });
    this.modalVisible.set(true);
  }

  openEdit(target: EsgReductionTarget): void {
    this.editingId.set(target.id);
    this.form.reset({
      name: target.name,
      scope: target.scope,
      baseline_year: target.baseline_year,
      target_year: target.target_year,
      reduction_percent: target.reduction_percent,
    });
    this.modalVisible.set(true);
  }

  save(): void {
    const value = this.form.getRawValue();
    const payload: EsgReductionTargetRequest = { ...value, reduction_percent: String(value.reduction_percent) };

    const id = this.editingId();
    const request = id === null ? this.api.createTarget(payload) : this.api.updateTarget(id, payload);
    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('SUSTAINABILITY.TARGET_SAVED'));
        this.modalVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('SUSTAINABILITY.ACTION_ERROR')),
    });
  }

  activate(target: EsgReductionTarget): void {
    this.run(this.api.activateTarget(target.id), 'SUSTAINABILITY.TARGET_ACTIVATED');
  }

  evaluate(target: EsgReductionTarget): void {
    this.run(this.api.evaluateTarget(target.id), 'SUSTAINABILITY.TARGET_EVALUATED');
  }

  cancel(target: EsgReductionTarget): void {
    this.run(this.api.cancelTarget(target.id), 'SUSTAINABILITY.TARGET_CANCELLED');
  }

  private run(request: ReturnType<SustainabilityApiService['activateTarget']>, successKey: string): void {
    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant(successKey));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('SUSTAINABILITY.ACTION_ERROR')),
    });
  }
}
