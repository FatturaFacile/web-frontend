import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { PlatformApiService, RecycleBinRecord, RecycleBinType, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

/** Deleted records of the company: restore them or destroy them for good (owners and administrators). */
@Component({
  selector: 'app-recycle-bin',
  imports: [DatePipe, FormsModule, PageHeaderComponent, TranslatePipe, NzButtonModule, NzCardModule, NzEmptyModule, NzPopconfirmModule, NzSelectModule, NzTableModule],
  template: `
    <app-page-header [title]="'PLATFORM.RECYCLE_BIN' | translate" [subtitle]="'PLATFORM.RECYCLE_BIN_SUBTITLE' | translate"></app-page-header>

    <nz-card>
      <div class="toolbar">
        <nz-select style="width: 280px" [ngModel]="selectedType()" (ngModelChange)="selectType($event)" [attr.aria-label]="'PLATFORM.RECORD_TYPE' | translate">
          @for (entry of types(); track entry.type) {
            <nz-option [nzValue]="entry.type" [nzLabel]="('PLATFORM.TYPE_' + entry.type.toUpperCase() | translate) + ' (' + entry.count + ')'"></nz-option>
          }
        </nz-select>
      </div>

      <nz-table #table [nzData]="records()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'PLATFORM.RECORD' | translate }}</th>
            <th>{{ 'PLATFORM.DELETED_AT' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.label }}</td>
              <td>{{ row.deleted_at | date: 'medium' }}</td>
              <td class="actions">
                <button nz-button nzSize="small" type="button" (click)="restore(row)">{{ 'PLATFORM.RESTORE' | translate }}</button>
                @if (row.purgeable) {
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'PLATFORM.DESTROY_CONFIRM' | translate"
                    (nzOnConfirm)="destroy(row)"
                  >
                    {{ 'PLATFORM.DESTROY' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && records().length === 0) {
        <nz-empty [nzNotFoundContent]="'PLATFORM.RECYCLE_BIN_EMPTY' | translate"></nz-empty>
      }
    </nz-card>
  `,
  styles: `
    .toolbar {
      margin-bottom: 16px;
    }
    .actions {
      display: flex;
      gap: 8px;
    }
  `,
})
export class RecycleBinComponent implements OnInit {
  private readonly api = inject(PlatformApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly types = signal<RecycleBinType[]>([]);
  readonly selectedType = signal<string | null>(null);
  readonly records = signal<RecycleBinRecord[]>([]);
  readonly loading = signal(false);

  ngOnInit(): void {
    this.loadTypes();
  }

  selectType(type: string): void {
    this.selectedType.set(type);
    this.loadRecords();
  }

  restore(row: RecycleBinRecord): void {
    this.api.restoreRecord(row.type, row.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PLATFORM.RESTORED'));
        this.refresh();
      },
      error: (err: unknown) => this.showError(err),
    });
  }

  destroy(row: RecycleBinRecord): void {
    this.api.destroyRecord(row.type, row.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PLATFORM.DESTROYED'));
        this.refresh();
      },
      error: (err: unknown) => this.showError(err),
    });
  }

  private refresh(): void {
    this.loadTypes();
  }

  private loadTypes(): void {
    this.api.getRecycleBinTypes().subscribe((res) => {
      this.types.set(res.data);
      const current = this.selectedType();
      if (current === null || !res.data.some((entry) => entry.type === current)) {
        this.selectedType.set(res.data[0]?.type ?? null);
      }
      this.loadRecords();
    });
  }

  private loadRecords(): void {
    const type = this.selectedType();
    if (type === null) {
      this.records.set([]);
      return;
    }
    this.loading.set(true);
    this.api.getRecycleBin(type, 1, 100).subscribe({
      next: (res) => {
        this.records.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** A 422 is not shown by the global error interceptor: show its first message here. */
  private showError(err: unknown): void {
    if (err instanceof HttpErrorResponse && err.status === 422) {
      const body = err.error as { message?: string } | null;
      this.message.error(body?.message ?? this.translate.instant('PLATFORM.ACTION_FAILED'));
    }
  }
}
