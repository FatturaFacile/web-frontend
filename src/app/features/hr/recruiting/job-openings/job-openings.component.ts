import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { debounceTime, distinctUntilChanged, Observable, Subject } from 'rxjs';
import {
  I18nService,
  JOB_OPENING_STATUSES,
  JobOpening,
  JobOpeningStatus,
  RecruitingApiService,
  RecruitingEnvelope,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { recruitingErrorKey } from '../shared/recruiting-errors';
import { OPENING_STATUS_COLORS } from '../shared/recruiting-labels';
import { JobOpeningFormDrawerComponent } from './job-opening-form-drawer.component';

interface DepartmentOption {
  id: string;
  name: string;
}

@Component({
  selector: 'app-job-openings',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    NzButtonModule,
    NzCardModule,
    CdkMenu,
    CdkMenuItem,
    CdkMenuTrigger,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
    JobOpeningFormDrawerComponent,
  ],
  templateUrl: './job-openings.component.html',
  styleUrl: './job-openings.component.scss',
})
export class JobOpeningsComponent implements OnInit {
  private readonly api = inject(RecruitingApiService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  readonly statuses = JOB_OPENING_STATUSES;
  readonly statusColors = OPENING_STATUS_COLORS;

  readonly loading = signal(false);
  readonly loadError = signal(false);
  readonly openings = signal<JobOpening[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(1);
  readonly pageSize = signal(25);
  readonly status = signal<JobOpeningStatus | null>(null);
  readonly departmentId = signal<string | null>(null);
  readonly search = signal('');
  readonly busyId = signal<string | null>(null);

  readonly drawerOpen = signal(false);
  readonly editing = signal<JobOpening | null>(null);

  /** Departments seen in loaded openings (no dedicated departments endpoint in the contract). */
  private readonly knownDepartments = signal<Record<string, string>>({});
  readonly departments = computed<DepartmentOption[]>(() =>
    Object.entries(this.knownDepartments())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  private readonly search$ = new Subject<string>();

  constructor() {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => {
        this.pageIndex.set(1);
        this.load();
      });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api
      .listJobOpenings({
        status: this.status() ?? undefined,
        department_id: this.departmentId() ?? undefined,
        search: this.search().trim() || undefined,
        page: this.pageIndex(),
        per_page: this.pageSize(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.openings.set(res.data);
          this.total.set(res.meta.total);
          this.rememberDepartments(res.data);
          this.loading.set(false);
        },
        error: () => {
          this.openings.set([]);
          this.loadError.set(true);
          this.loading.set(false);
        },
      });
  }

  titleOf(opening: JobOpening): string {
    const first = opening.published_languages[0];
    return (first && opening.translations[first]?.title) || opening.position_title;
  }

  onQueryParams(params: NzTableQueryParams): void {
    if (params.pageIndex === this.pageIndex() && params.pageSize === this.pageSize()) {
      return;
    }
    this.pageIndex.set(params.pageIndex);
    this.pageSize.set(params.pageSize);
    this.load();
  }

  onStatusChange(value: JobOpeningStatus | null): void {
    this.status.set(value);
    this.pageIndex.set(1);
    this.load();
  }

  onDepartmentChange(value: string | null): void {
    this.departmentId.set(value);
    this.pageIndex.set(1);
    this.load();
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.search.set(value);
    this.search$.next(value.trim());
  }

  create(): void {
    this.editing.set(null);
    this.drawerOpen.set(true);
  }

  edit(opening: JobOpening): void {
    this.editing.set(opening);
    this.drawerOpen.set(true);
  }

  canEdit(opening: JobOpening): boolean {
    return opening.status !== 'closed_filled' && opening.status !== 'cancelled';
  }

  canPublish(opening: JobOpening): boolean {
    return (
      opening.status === 'draft' ||
      opening.status === 'published' ||
      opening.status === 'internal_only'
    );
  }

  publish(opening: JobOpening, internalOnly: boolean): void {
    this.run(
      opening,
      this.api.publishJobOpening(opening.id, internalOnly),
      'hr.recruiting.openings.published',
    );
  }

  close(opening: JobOpening, outcome: 'filled' | 'cancelled'): void {
    this.modal.confirm({
      nzTitle: this.i18n.translate('hr.recruiting.openings.closeConfirmTitle'),
      nzContent: this.i18n.translate(
        outcome === 'filled'
          ? 'hr.recruiting.openings.closeFilledConfirm'
          : 'hr.recruiting.openings.closeCancelledConfirm',
      ),
      nzOkText: this.i18n.translate('common.actions.confirm'),
      nzCancelText: this.i18n.translate('common.actions.cancel'),
      nzOnOk: () => {
        this.run(
          opening,
          this.api.closeJobOpening(opening.id, { outcome }),
          'hr.recruiting.openings.closed',
        );
      },
    });
  }

  onSaved(): void {
    this.load();
  }

  private run(
    opening: JobOpening,
    request$: Observable<RecruitingEnvelope<JobOpening>>,
    successKey: string,
  ): void {
    if (this.busyId()) {
      return;
    }
    this.busyId.set(opening.id);
    request$.subscribe({
      next: (res) => {
        this.busyId.set(null);
        this.openings.update((list) => list.map((o) => (o.id === res.data.id ? res.data : o)));
        this.message.success(this.i18n.translate(successKey));
      },
      error: (err: unknown) => {
        this.busyId.set(null);
        this.message.error(this.i18n.translate(recruitingErrorKey(err)));
      },
    });
  }

  private rememberDepartments(list: JobOpening[]): void {
    const additions: Record<string, string> = {};
    for (const o of list) {
      if (o.department_id && o.department_name) {
        additions[o.department_id] = o.department_name;
      }
    }
    if (Object.keys(additions).length) {
      this.knownDepartments.update((curr) => ({ ...curr, ...additions }));
    }
  }
}
