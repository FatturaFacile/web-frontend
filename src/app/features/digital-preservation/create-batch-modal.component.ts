import { Component, inject, model, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { DigitalPreservationStore } from './digital-preservation.store';
import { DOCUMENT_CATEGORIES, JURISDICTIONS } from './digital-preservation.models';
import { apiMessage, toIsoDate } from './digital-preservation.utils';

/** Modal that starts a preservation batch (PdV) for a document category and period. */
@Component({
  selector: 'app-create-batch-modal',
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    NzButtonModule,
    NzDatePickerModule,
    NzFormModule,
    NzModalModule,
    NzSelectModule,
  ],
  template: `
    <nz-modal
      [nzVisible]="visible()"
      [nzTitle]="'PRESERVATION.RUN_BATCH' | translate"
      [nzFooter]="footer"
      (nzOnCancel)="visible.set(false)"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form" data-testid="create-batch-form">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="batch-category">{{
              'PRESERVATION.DOCUMENT_CATEGORY' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-select id="batch-category" formControlName="document_category">
                @for (category of categories; track category) {
                  <nz-option
                    [nzValue]="category"
                    [nzLabel]="'PRESERVATION.CATEGORY_' + category.toUpperCase() | translate"
                  ></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'PRESERVATION.PERIOD' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-range-picker formControlName="period"></nz-range-picker>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="batch-jurisdiction">{{
              'PRESERVATION.JURISDICTION' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-select id="batch-jurisdiction" formControlName="jurisdiction" nzAllowClear>
                @for (j of jurisdictions; track j) {
                  <nz-option
                    [nzValue]="j"
                    [nzLabel]="'PRESERVATION.JURISDICTION_' + j | translate"
                  ></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
      <ng-template #footer>
        <button nz-button type="button" (click)="visible.set(false)">
          {{ 'PRESERVATION.CANCEL' | translate }}
        </button>
        <button
          nz-button
          nzType="primary"
          type="button"
          data-testid="create-batch-submit"
          [disabled]="form.invalid"
          [nzLoading]="store.busy()"
          (click)="submit()"
        >
          {{ 'PRESERVATION.RUN_BATCH' | translate }}
        </button>
      </ng-template>
    </nz-modal>
  `,
})
export class CreateBatchModalComponent {
  protected readonly store = inject(DigitalPreservationStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  readonly visible = model(false);
  readonly created = output<string>();

  protected readonly categories = DOCUMENT_CATEGORIES;
  protected readonly jurisdictions = JURISDICTIONS;
  protected readonly form = inject(FormBuilder).nonNullable.group({
    document_category: ['active_invoices', Validators.required],
    period: [[] as Date[], Validators.required],
    jurisdiction: [''],
  });

  protected submit(): void {
    const { document_category, period, jurisdiction } = this.form.getRawValue();
    if (period.length !== 2) {
      return;
    }
    this.store
      .createBatch({
        document_category: document_category as never,
        period_from: toIsoDate(period[0]),
        period_to: toIsoDate(period[1]),
        ...(jurisdiction ? { jurisdiction: jurisdiction as never } : {}),
      })
      .subscribe({
        next: (res) => {
          this.message.success(this.i18n.instant('PRESERVATION.BATCH_CREATED'));
          this.visible.set(false);
          this.created.emit((res as { data: { id: string } }).data.id);
        },
        error: (err: unknown) =>
          this.message.error(apiMessage(err, this.i18n.instant('PRESERVATION.BATCH_FAILED'))),
      });
  }
}
