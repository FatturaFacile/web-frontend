import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PermissionsService, ResourceApiService, ResourceRow, unwrapResponse } from '@core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { Observable, of } from 'rxjs';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ResourceDetailComponent } from './resource-detail.component';
import { ResourceFormComponent } from './resource-form.component';
import { ResourceLabelsService } from './resource-labels.service';
import { ResourceLookupService, ResourceOption } from './resource-lookup.service';
import { ResourceAction, ResourceColumn, ResourceField, ResourcePanelConfig } from './resource-panel.types';
import { getByPath, isPathResolvable, resolvePath, rowIdAliases } from './resource-panel.utils';

interface ActiveForm {
  action: ResourceAction;
  row: ResourceRow | null;
}

/** Generic list / report panel with create form, row actions and toolbar actions driven by a config. */
@Component({
  selector: 'app-resource-panel',
  imports: [
    FormsModule,
    RouterLink,
    NzButtonModule,
    NzDrawerModule,
    NzEmptyModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    ResourceDetailComponent,
    ResourceFormComponent,
    TranslatePipe,
  ],
  templateUrl: './resource-panel.component.html',
})
export class ResourcePanelComponent implements OnInit {
  private readonly api = inject(ResourceApiService);
  private readonly lookups = inject(ResourceLookupService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly permissions = inject(PermissionsService);
  protected readonly labels = inject(ResourceLabelsService);

  readonly config = input.required<ResourcePanelConfig>();
  /** Values of path placeholders fixed by the host page (for example the `{id}` of a detail page). */
  readonly context = input<Record<string, unknown>>({});

  protected readonly rows = signal<ResourceRow[]>([]);
  protected readonly total = signal<number | null>(null);
  protected readonly report = signal<unknown>(null);
  protected readonly loading = signal(false);
  protected readonly pageIndex = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly filters = signal<Record<string, unknown>>({});
  protected readonly scopeValue = signal<string | null>(null);
  protected readonly form = signal<ActiveForm | null>(null);
  protected readonly result = signal<unknown>(null);
  protected readonly resultOpen = signal(false);

  protected readonly canWrite = computed(() => this.permissions.canWrite(this.config().module));
  protected readonly scopeField = computed(() => this.config().list.scope ?? null);
  protected readonly scopeOptions = signal<ResourceOption[]>([]);
  protected readonly filterLookups = signal<Record<string, ResourceOption[]>>({});
  /** A panel without a list endpoint (an empty `list.path`): only its toolbar actions are offered. */
  protected readonly toolbarOnly = computed(() => this.config().list.path === '');
  protected readonly isReport = computed(() => this.config().list.report === true);
  protected readonly scopeSources = computed(() => {
    const scope = this.scopeField();
    return { ...this.context(), ...(scope ? { [scope.key]: this.scopeValue() } : {}) };
  });
  protected readonly ready = computed(() => isPathResolvable(this.config().list.path, this.scopeSources()));
  protected readonly visibleToolbar = computed(() =>
    (this.config().toolbar ?? []).filter((action) => this.isAllowed(action)),
  );

  ngOnInit(): void {
    this.scopeOptionsStream().subscribe((options) => this.scopeOptions.set(options));
    for (const filter of this.config().list.filters ?? []) {
      if (filter.lookup) {
        this.lookups
          .options(filter.lookup)
          .subscribe((options) => this.filterLookups.update((all) => ({ ...all, [filter.key]: options })));
      }
    }
    if (!this.config().list.manual) {
      this.load();
    }
  }

  protected scopeOptionsStream(): Observable<ResourceOption[]> {
    const scope = this.config().list.scope;
    if (scope?.lookup) {
      return this.lookups.options(scope.lookup);
    }
    return of((scope?.options ?? []).map((value) => ({ value, label: this.labels.value(value) })));
  }

  protected filterOptions(field: ResourceField): ResourceOption[] {
    if (field.lookup) {
      return this.filterLookups()[field.key] ?? [];
    }
    return (field.options ?? []).map((value) => ({ value, label: this.labels.value(value) }));
  }

  protected setScope(value: string | null): void {
    this.scopeValue.set(value);
    this.pageIndex.set(1);
    this.load();
  }

  protected setFilter(key: string, value: unknown): void {
    this.filters.update((current) => ({ ...current, [key]: value }));
    this.pageIndex.set(1);
    if (!this.config().list.manual) {
      this.load();
    }
  }

  protected onQueryParams(params: NzTableQueryParams): void {
    if (params.pageIndex !== this.pageIndex() || params.pageSize !== this.pageSize()) {
      this.pageIndex.set(params.pageIndex);
      this.pageSize.set(params.pageSize);
      this.load();
    }
  }

  protected load(): void {
    const list = this.config().list;
    if (this.toolbarOnly()) {
      return;
    }
    if (!this.ready()) {
      this.rows.set([]);
      this.report.set(null);
      return;
    }
    const path = resolvePath(list.path, this.scopeSources());
    this.loading.set(true);
    const query = list.report ? { ...this.filters() } : { ...this.filters(), page: this.pageIndex(), per_page: this.pageSize() };
    this.api.list(path, query).subscribe({
      next: (result) => {
        this.rows.set(result.rows);
        this.total.set(result.total);
        this.report.set(list.report ? result.raw : null);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.rows.set([]);
        this.loading.set(false);
        this.notifyError(err);
      },
    });
  }

  protected isAllowed(action: ResourceAction, row?: ResourceRow): boolean {
    if (action.method !== 'GET' && !this.canWrite()) {
      return false;
    }
    return !row || !action.visible || action.visible(row);
  }

  protected rowActions(row: ResourceRow): ResourceAction[] {
    return (this.config().rowActions ?? []).filter((action) => this.isAllowed(action, row));
  }

  protected run(action: ResourceAction, row: ResourceRow | null = null): void {
    if (action.fields && action.fields.length > 0) {
      this.form.set({ action, row: row ?? (action.prefill ? this.reportRecord() : null) });
      return;
    }
    const execute = () => this.execute(action, row, action.body ?? {});
    if (action.confirmKey) {
      this.modal.confirm({
        nzTitle: this.labels.text(action.confirmKey),
        nzOkDanger: action.danger === true,
        nzOkText: this.labels.text('RES.ACTION.CONFIRM'),
        nzCancelText: this.labels.text('RES.ACTION.CANCEL'),
        nzOnOk: execute,
      });
      return;
    }
    execute();
  }

  private reportRecord(): ResourceRow | null {
    const data = unwrapResponse(this.report());
    return typeof data === 'object' && data !== null && !Array.isArray(data) ? (data as ResourceRow) : null;
  }

  protected view(row: ResourceRow): void {
    const path = this.config().detailPath;
    if (!path) {
      return;
    }
    this.api.request('GET', resolvePath(path, row, this.scopeSources(), rowIdAliases(path, row))).subscribe({
      next: (data) => this.showResult(data),
      error: (err: unknown) => this.notifyError(err),
    });
  }

  protected saveFn(): (body: Record<string, unknown>) => Observable<unknown> {
    const active = this.form();
    return (body) => (active ? this.request(active.action, active.row, body) : of(null));
  }

  protected onSaved(result: unknown): void {
    const active = this.form();
    this.form.set(null);
    this.message.success(this.labels.text('RES.MSG.DONE'));
    this.lookups.clear();
    if (active?.action.showResult) {
      this.showResult(result);
    }
    this.load();
  }

  protected cellText(row: ResourceRow, column: ResourceColumn): string {
    const value = getByPath(row, column.key);
    if (value === null || value === undefined) {
      return '';
    }
    if (column.type === 'datetime') {
      return String(value).replace('T', ' ').slice(0, 16);
    }
    if (column.type === 'date') {
      return String(value).slice(0, 10);
    }
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }

  protected cellValue(row: ResourceRow, column: ResourceColumn): unknown {
    return getByPath(row, column.key);
  }

  protected linkOf(row: ResourceRow): string {
    return resolvePath(this.config().rowLink?.route ?? '', row);
  }

  protected rowKey(index: number, row: ResourceRow): string {
    return String(row['id'] ?? index);
  }

  private execute(action: ResourceAction, row: ResourceRow | null, body: Record<string, unknown>): void {
    this.request(action, row, body).subscribe({
      next: (result) => {
        if (!action.download) {
          this.message.success(this.labels.text('RES.MSG.DONE'));
        }
        if (action.showResult) {
          this.showResult(result);
        }
        this.load();
      },
      error: (err: unknown) => this.notifyError(err),
    });
  }

  private request(action: ResourceAction, row: ResourceRow | null, body: Record<string, unknown>): Observable<unknown> {
    const scope = this.scopeSources();
    const path = resolvePath(action.path, row, scope, body, rowIdAliases(action.path, row));
    const pathOnly = [...action.path.matchAll(/\{(\w+)}/g)].map((m) => m[1]).filter((key) => !row?.[key] && !scope[key]);
    body = Object.fromEntries(Object.entries(body).filter(([key]) => !pathOnly.includes(key)));
    if (action.download) {
      return new Observable((subscriber) => {
        this.api.blob(action.method, path, action.method === 'GET' ? undefined : body, action.method === 'GET' ? body : undefined).subscribe({
          next: (blob) => {
            this.saveBlob(blob, action.key);
            subscriber.next(blob);
            subscriber.complete();
          },
          error: (err: unknown) => subscriber.error(err),
        });
      });
    }
    if (action.method === 'GET') {
      return this.api.request('GET', path, undefined, body);
    }
    return this.api.request(action.method, path, body);
  }

  private saveBlob(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private showResult(data: unknown): void {
    this.result.set(data);
    this.resultOpen.set(true);
  }

  private notifyError(err: unknown): void {
    const status = err instanceof Object && 'status' in err ? Number(err.status) : 0;
    const key = status === 403 ? 'RES.ERR.FORBIDDEN' : status === 404 ? 'RES.ERR.NOT_FOUND' : status === 409 ? 'RES.ERR.CONFLICT' : 'RES.ERR.REQUEST_FAILED';
    const detail = err instanceof Object && 'error' in err && err.error instanceof Object && 'message' in err.error ? String(err.error.message) : '';
    this.message.error(detail && status !== 403 ? detail : this.labels.text(key));
  }
}
