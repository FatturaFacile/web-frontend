import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { CreditManagementApiService, CreditWorklistRow, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, statusColor } from './credit.util';

/** The open cases the collector has to act on, the ones with an action due first. */
@Component({
  selector: 'app-credit-worklist',
  styleUrl: './credit-management.scss',
  imports: [DecimalPipe, FormsModule, RouterLink, PageHeaderComponent, TranslatePipe, NzCardModule, NzEmptyModule, NzSwitchModule, NzTableModule, NzTagModule],
  template: `
    <app-page-header [title]="'CREDIT.WORKLIST_TITLE' | translate" [subtitle]="'CREDIT.WORKLIST_SUBTITLE' | translate"></app-page-header>

    <div class="toolbar">
      <label><nz-switch [ngModel]="mine()" (ngModelChange)="mine.set($event); load()"></nz-switch> {{ 'CREDIT.MY_CASES' | translate }}</label>
      <label><nz-switch [ngModel]="dueOnly()" (ngModelChange)="dueOnly.set($event); load()"></nz-switch> {{ 'CREDIT.DUE_ONLY' | translate }}</label>
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="rows()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'CREDIT.CASE_NUMBER' | translate }}</th>
            <th>{{ 'CREDIT.CUSTOMER' | translate }}</th>
            <th class="num">{{ 'CREDIT.OUTSTANDING' | translate }}</th>
            <th class="num">{{ 'CREDIT.DAYS_OVERDUE' | translate }}</th>
            <th>{{ 'CREDIT.NEXT_ACTION_ON' | translate }}</th>
            <th>{{ 'CREDIT.PRIORITY' | translate }}</th>
            <th>{{ 'CREDIT.STATUS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td><a [routerLink]="['/credit-management/cases', row.id]">{{ row.case_number }}</a></td>
              <td>{{ row.customer_name }}</td>
              <td class="num">{{ +row.outstanding_amount | number: '1.2-2' }} {{ row.currency }}</td>
              <td class="num" [class.row-overdue]="row.days_overdue > 0">{{ row.days_overdue }}</td>
              <td [class.row-overdue]="row.is_action_due">{{ row.next_action_on ?? '-' }}</td>
              <td><nz-tag [nzColor]="color(row.priority)">{{ ('CREDIT.PRIORITY_' + row.priority.toUpperCase()) | translate }}</nz-tag></td>
              <td><nz-tag [nzColor]="color(row.status)">{{ ('CREDIT.CASE_STATUS_' + row.status.toUpperCase()) | translate }}</nz-tag></td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && rows().length === 0) {
        <nz-empty [nzNotFoundContent]="'CREDIT.NO_WORKLIST' | translate"></nz-empty>
      }
    </nz-card>
  `,
})
export class CreditWorklistComponent implements OnInit {
  private readonly api = inject(CreditManagementApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly rows = signal<CreditWorklistRow[]>([]);
  readonly loading = signal(false);
  readonly mine = signal(false);
  readonly dueOnly = signal(false);

  ngOnInit(): void {
    this.load();
  }

  color(status: string): string {
    return statusColor(status);
  }

  load(): void {
    this.loading.set(true);
    this.api.getWorklist({ mine: this.mine() || undefined, due_only: this.dueOnly() || undefined }).subscribe({
      next: (response) => {
        this.rows.set(response.data);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.message.error(apiErrorText(error) ?? this.translate.instant('CREDIT.ACTION_ERROR'));
      },
    });
  }
}
