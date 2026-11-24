import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ACCESS_AUDIT_TYPES, AccessApiService, AccessAuditEvent, AccessAuditType, I18nService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AccessNavComponent } from './access-nav.component';
import { reportAccessError } from './access-ui.util';

const PAGE_SIZE = 20;

/** Who changed what in users, roles, teams, delegations, invitations, imports and plan, newest first. */
@Component({
  selector: 'app-access-audit',
  imports: [
    AccessNavComponent,
    DatePipe,
    FormsModule,
    NzCardModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'access.audit.title' | translate" [subtitle]="'access.audit.subtitle' | translate" />
    <app-access-nav />
    <nz-card>
      <div class="mb-3">
        <nz-select
          class="audit-filter"
          nzAllowClear
          data-test="audit-type"
          [nzPlaceHolder]="'access.audit.allTypes' | translate"
          [ngModel]="type()"
          (ngModelChange)="filter($event)"
        >
          @for (value of types; track value) {
            <nz-option [nzValue]="value" [nzLabel]="'access.audit.types.' + value | translate" />
          }
        </nz-select>
      </div>
      <nz-table
        [nzData]="events()"
        [nzLoading]="loading()"
        [nzFrontPagination]="false"
        [nzTotal]="total()"
        [nzPageIndex]="page()"
        [nzPageSize]="pageSize"
        (nzPageIndexChange)="goTo($event)"
      >
        <thead>
          <tr>
            <th>{{ 'access.audit.when' | translate }}</th>
            <th>{{ 'access.audit.type' | translate }}</th>
            <th>{{ 'access.audit.event' | translate }}</th>
            <th>{{ 'access.audit.actor' | translate }}</th>
            <th>{{ 'access.audit.details' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (event of events(); track event.id) {
            <tr data-test="audit-row">
              <td>{{ event.created_at | date: 'medium' }}</td>
              <td>
                <nz-tag>{{ 'access.audit.types.' + event.type | translate }}</nz-tag>
              </td>
              <td>{{ event.event }}</td>
              <td>{{ event.actor?.name ?? '-' }}</td>
              <td>
                <code class="audit-values">{{ summary(event) }}</code>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="5">{{ 'access.audit.empty' | translate }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
  styles: `
    .audit-filter {
      width: 260px;
    }
    .audit-values {
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 12px;
    }
  `,
})
export class AccessAuditComponent implements OnInit {
  private readonly api = inject(AccessApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly types = ACCESS_AUDIT_TYPES;
  protected readonly pageSize = PAGE_SIZE;
  protected readonly events = signal<AccessAuditEvent[]>([]);
  protected readonly type = signal<AccessAuditType | null>(null);
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);

  ngOnInit(): void {
    this.load();
  }

  protected filter(type: AccessAuditType | null): void {
    this.type.set(type ?? null);
    this.page.set(1);
    this.load();
  }

  protected goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  /** What changed, in short: the new values, or the old ones when nothing new was recorded. */
  protected summary(event: AccessAuditEvent): string {
    const values = event.new_values ?? event.old_values;
    return values && Object.keys(values).length > 0 ? JSON.stringify(values) : '';
  }

  private load(): void {
    this.loading.set(true);
    this.api.getAudit({ type: this.type(), per_page: PAGE_SIZE, page: this.page() }).subscribe({
      next: (res) => {
        this.events.set(res.data);
        this.total.set(res.meta?.total ?? res.data.length);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        reportAccessError(err, this.message, this.i18n);
      },
    });
  }
}
