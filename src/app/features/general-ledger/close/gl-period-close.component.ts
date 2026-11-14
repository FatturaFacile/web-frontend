import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AccountingApiService,
  CloseChecklist,
  CloseTask,
  CloseTaskStatus,
  GeneralLedgerApiService,
  GlFiscalPeriod,
  I18nService,
  PermissionsService,
} from '@core';
import { TranslatePipe, IconActionDirective, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';

@Component({
  selector: 'app-gl-period-close',
  styleUrl: './gl-period-close.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    IconActionDirective,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  templateUrl: './gl-period-close.component.html',
})
export class GlPeriodCloseComponent implements OnInit {
  private readonly api = inject(GeneralLedgerApiService);
  private readonly accountingApi = inject(AccountingApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  protected readonly periods = signal<GlFiscalPeriod[]>([]);
  protected readonly periodId = signal<string | null>(null);
  protected readonly checklist = signal<CloseChecklist | null>(null);
  protected readonly loading = signal(false);
  protected readonly blockingMessage = signal<string | null>(null);
  protected readonly isClosed = computed(() => this.checklist()?.status === 'closed');

  protected newTitle = '';
  protected newBlocking = true;

  ngOnInit(): void {
    this.api.getFiscalYears().subscribe({
      next: (res) => {
        const all = (res.data ?? []).flatMap((year) => year.periods ?? []);
        this.periods.set(all);
      },
    });
  }

  protected selectPeriod(id: string | null): void {
    this.periodId.set(id);
    this.blockingMessage.set(null);
    this.checklist.set(null);
    if (id) {
      this.loadChecklist(id);
    }
  }

  protected setTaskStatus(task: CloseTask, status: CloseTaskStatus): void {
    const id = this.periodId();
    if (!id) {
      return;
    }
    this.api.setCloseTaskStatus(id, task.id, status).subscribe({ next: () => this.loadChecklist(id) });
  }

  protected addTask(): void {
    const id = this.periodId();
    if (!id || !this.newTitle.trim()) {
      return;
    }
    this.api.addCloseTask(id, { title: this.newTitle.trim(), is_blocking: this.newBlocking }).subscribe({
      next: () => {
        this.newTitle = '';
        this.loadChecklist(id);
      },
    });
  }

  protected closePeriod(): void {
    const id = this.periodId();
    if (!id) {
      return;
    }
    this.blockingMessage.set(null);
    this.accountingApi.closeFiscalPeriod(id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('GL.PERIOD_CLOSED'));
        this.loadChecklist(id);
      },
      error: (err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 409) {
          this.blockingMessage.set((err.error as { message?: string } | null)?.message ?? err.message);
          this.loadChecklist(id);
        }
      },
    });
  }

  protected reopenPeriod(): void {
    const id = this.periodId();
    if (id) {
      this.accountingApi.reopenFiscalPeriod(id).subscribe({ next: () => this.loadChecklist(id) });
    }
  }

  private loadChecklist(id: string): void {
    this.loading.set(true);
    this.api.getCloseChecklist(id).subscribe({
      next: (res) => {
        this.checklist.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
