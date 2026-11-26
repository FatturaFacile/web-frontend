import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  DcExclusion,
  DcExclusionPayload,
  DcPaymentPlan,
  DcPaymentPlanPayload,
  PermissionsService,
} from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { ArCustomerSelectComponent } from '../receivables/ar-customer-select.component';
import { DcExclusionDialogComponent } from './dc-exclusion-dialog.component';
import { DcFeedback } from './dc-feedback.service';
import { DcNoteDialogComponent } from './dc-note-dialog.component';
import { DcPlanDialogComponent } from './dc-plan-dialog.component';
import { DEBT_COLLECTION_MODULE, planStatusColor } from './debt-collection.util';
import { ExclusionsStore } from './exclusions.store';
import { DcLookupsStore } from './lookups.store';

/** Exclusions from the dunning queue (manual, dispute, legal hold) and the payment plans (piano di rientro). */
@Component({
  selector: 'app-dc-exclusions',
  imports: [
    FormsModule,
    MoneyPipe,
    TranslatePipe,
    ArCustomerSelectComponent,
    DcExclusionDialogComponent,
    DcNoteDialogComponent,
    DcPlanDialogComponent,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzPopconfirmModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
  ],
  providers: [ExclusionsStore],
  styleUrl: './debt-collection.scss',
  template: `
    <div class="toolbar">
      <div class="field wide">
        <span>{{ 'debtCollection.field.customer' | translate }}</span>
        <app-ar-customer-select
          [customerId]="store.customerId()"
          (customerChange)="store.setCustomer($event?.id ?? null)"
        />
      </div>
      <label
        nz-checkbox
        for="dc-ex-active-only"
        nzId="dc-ex-active-only"
        [ngModel]="store.activeOnly()"
        (ngModelChange)="store.setActiveOnly($event)"
      >
        {{ 'debtCollection.field.activeOnly' | translate }}
      </label>
      <button nz-button type="button" (click)="store.load()">
        {{ 'debtCollection.action.refresh' | translate }}
      </button>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" (click)="exclusionOpen.set(true)">
          {{ 'debtCollection.action.newExclusion' | translate }}
        </button>
        <button nz-button type="button" (click)="openPlan()">
          {{ 'debtCollection.action.newPlan' | translate }}
        </button>
      }
    </div>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate" />
    }

    <nz-spin [nzSpinning]="store.loading()">
      <h3 class="section-title">{{ 'debtCollection.exclusion.title' | translate }}</h3>
      <nz-table #exTable nzSize="small" [nzData]="store.exclusions()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th scope="col">{{ 'debtCollection.field.customer' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.exclusionType' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.reason' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.createdAt' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.releasedAt' | translate }}</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          @for (row of exTable.data; track row.id) {
            <tr>
              <th scope="row">{{ row.customer_name }}</th>
              <td>
                <nz-tag [nzColor]="row.type === 'manual' ? 'default' : 'red'">{{
                  'debtCollection.exclusionType.' + row.type | translate
                }}</nz-tag>
              </td>
              <td>
                {{ row.reason }}
                @if (row.notes) {
                  <small class="muted">{{ row.notes }}</small>
                }
              </td>
              <td>{{ row.created_at }}</td>
              <td>{{ row.released_at ?? '' }}</td>
              <td>
                @if (canWrite && !row.released_at) {
                  <button nz-button nzSize="small" type="button" (click)="releasing.set(row)">
                    {{ 'debtCollection.action.release' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!store.loading() && store.exclusions().length === 0) {
        <nz-empty [nzNotFoundContent]="'debtCollection.exclusion.empty' | translate" />
      }

      <h3 class="section-title">{{ 'debtCollection.plan.title' | translate }}</h3>
      <nz-table #planTable nzSize="small" [nzData]="store.plans()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th scope="col">{{ 'debtCollection.field.customer' | translate }}</th>
            <th scope="col" class="num">{{ 'debtCollection.field.total' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.startDate' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.endDate' | translate }}</th>
            <th scope="col" class="num">{{ 'debtCollection.plan.installments' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.status' | translate }}</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          @for (plan of planTable.data; track plan.id) {
            <tr>
              <th scope="row">{{ plan.customer_name }}</th>
              <td class="num">{{ plan.total_amount | money: plan.currency }}</td>
              <td>{{ plan.start_date }}</td>
              <td>{{ plan.end_date }}</td>
              <td class="num">{{ plan.installments.length }}</td>
              <td>
                <nz-tag [nzColor]="planTag(plan.status)">{{
                  'debtCollection.planStatus.' + plan.status | translate
                }}</nz-tag>
              </td>
              <td>
                @if (canWrite && plan.status === 'active') {
                  <div class="row-actions">
                    <button
                      nz-button
                      nzSize="small"
                      nzType="primary"
                      type="button"
                      (click)="transition(plan, 'complete')"
                    >
                      {{ 'debtCollection.action.completePlan' | translate }}
                    </button>
                    <button
                      nz-button
                      nzSize="small"
                      nzDanger
                      type="button"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'debtCollection.plan.defaultConfirm' | translate"
                      (nzOnConfirm)="transition(plan, 'default')"
                    >
                      {{ 'debtCollection.action.defaultPlan' | translate }}
                    </button>
                    <button
                      nz-button
                      nzSize="small"
                      type="button"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'debtCollection.plan.cancelConfirm' | translate"
                      (nzOnConfirm)="transition(plan, 'cancel')"
                    >
                      {{ 'debtCollection.action.cancelPlan' | translate }}
                    </button>
                  </div>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!store.loading() && store.plans().length === 0) {
        <nz-empty [nzNotFoundContent]="'debtCollection.plan.empty' | translate" />
      }
    </nz-spin>

    <app-dc-exclusion-dialog
      [open]="exclusionOpen()"
      [customerId]="store.customerId()"
      [saving]="store.saving()"
      (submitted)="createExclusion($event)"
      (closed)="exclusionOpen.set(false)"
    />
    <app-dc-note-dialog
      [open]="releasing() !== null"
      [saving]="store.saving()"
      (confirmed)="release($event)"
      (closed)="releasing.set(null)"
    />
    <app-dc-plan-dialog
      [open]="planOpen()"
      [customerId]="store.customerId()"
      [items]="store.items()"
      [saving]="store.saving()"
      (customerPicked)="store.loadItems($event)"
      (submitted)="createPlan($event)"
      (closed)="planOpen.set(false)"
    />
  `,
})
export class DcExclusionsComponent implements OnInit {
  protected readonly store = inject(ExclusionsStore);
  private readonly lookups = inject(DcLookupsStore);
  private readonly feedback = inject(DcFeedback);

  protected readonly canWrite = inject(PermissionsService).canWrite(DEBT_COLLECTION_MODULE);
  protected readonly exclusionOpen = signal(false);
  protected readonly planOpen = signal(false);
  protected readonly releasing = signal<DcExclusion | null>(null);
  protected readonly planTag = planStatusColor;

  ngOnInit(): void {
    void this.lookups.ensureLoaded();
    void this.store.load();
  }

  protected openPlan(): void {
    void this.store.loadItems(this.store.customerId());
    this.planOpen.set(true);
  }

  protected async createExclusion(payload: DcExclusionPayload): Promise<void> {
    if (
      this.feedback.report(
        await this.store.createExclusion(payload),
        'debtCollection.msg.exclusionCreated',
      )
    ) {
      this.exclusionOpen.set(false);
    }
  }

  protected async release(note: string): Promise<void> {
    const row = this.releasing();
    if (
      row &&
      this.feedback.report(
        await this.store.releaseExclusion(row.id, note),
        'debtCollection.msg.released',
      )
    ) {
      this.releasing.set(null);
    }
  }

  protected async createPlan(payload: DcPaymentPlanPayload): Promise<void> {
    if (
      this.feedback.report(await this.store.createPlan(payload), 'debtCollection.msg.planCreated')
    ) {
      this.planOpen.set(false);
    }
  }

  protected async transition(
    plan: DcPaymentPlan,
    action: 'complete' | 'default' | 'cancel',
  ): Promise<void> {
    this.feedback.report(
      await this.store.transitionPlan(plan.id, action),
      'debtCollection.msg.planUpdated',
    );
  }
}
