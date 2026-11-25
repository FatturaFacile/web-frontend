import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CCV_PARTNER_TYPES,
  CcvConvention,
  CcvConventionPayload,
  PermissionsService,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { ConventionFormComponent } from './convention-form.component';
import { ConventionsStore } from './conventions.store';
import {
  CcvOutcome,
  CORPORATE_CONVENTIONS_MODULE,
  conventionStatusColor,
} from './corporate-conventions.util';

/**
 * The conventions: filters by country, partner type, status and text, quick lifecycle actions on every row, and the drawer with the
 * tabbed form (partner, eligibility, discount matrix, split billing).
 */
@Component({
  selector: 'app-ccv-conventions',
  imports: [
    ConventionFormComponent,
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [ConventionsStore],
  styleUrl: './corporate-conventions.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.CORPORATE_CONVENTIONS' | translate"></app-page-header>

    <div class="toolbar">
      <label class="field" for="ccv-f-q">
        <span>{{ 'corporateConventions.field.search' | translate }}</span>
        <input
          nz-input
          id="ccv-f-q"
          [ngModel]="store.filters().q ?? ''"
          (ngModelChange)="onSearch($event)"
        />
      </label>
      <label class="field" for="ccv-f-country">
        <span>{{ 'corporateConventions.field.country' | translate }}</span>
        <nz-select
          nzId="ccv-f-country"
          nzAllowClear
          [ngModel]="store.filters().country_code || null"
          (ngModelChange)="store.setFilters({ country_code: $event ?? '' })"
        >
          <nz-option nzValue="IT" nzLabel="IT"></nz-option>
          <nz-option nzValue="CH" nzLabel="CH"></nz-option>
        </nz-select>
      </label>
      <label class="field" for="ccv-f-type">
        <span>{{ 'corporateConventions.field.partnerType' | translate }}</span>
        <nz-select
          nzId="ccv-f-type"
          nzAllowClear
          [ngModel]="store.filters().partner_type || null"
          (ngModelChange)="store.setFilters({ partner_type: $event ?? '' })"
        >
          @for (type of partnerTypes; track type) {
            <nz-option
              [nzValue]="type"
              [nzLabel]="'corporateConventions.partnerType.' + type | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="ccv-f-status">
        <span>{{ 'corporateConventions.field.status' | translate }}</span>
        <nz-select
          nzId="ccv-f-status"
          nzAllowClear
          [ngModel]="store.filters().status || null"
          (ngModelChange)="store.setFilters({ status: $event ?? '' })"
        >
          @for (status of store.statuses(); track status) {
            <nz-option
              [nzValue]="status"
              [nzLabel]="'corporateConventions.status.' + status | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" (click)="openCreate()">
          {{ 'corporateConventions.action.newConvention' | translate }}
        </button>
      }
    </div>

    @if (feedback(); as failure) {
      <nz-alert
        nzType="error"
        nzShowIcon
        nzCloseable
        class="form-alert"
        [nzMessage]="failure.errorKey ?? '' | translate: failure.params"
        [nzDescription]="failure.detail"
        (nzOnClose)="feedback.set(null)"
      ></nz-alert>
    }
    @if (store.error(); as key) {
      <nz-alert
        nzType="error"
        nzShowIcon
        class="form-alert"
        [nzMessage]="key | translate"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #table
        nzSize="middle"
        nzFrontPagination="false"
        [nzData]="store.conventions()"
        [nzTotal]="store.total()"
        [nzPageIndex]="store.page()"
        [nzPageSize]="store.pageSize()"
        (nzPageIndexChange)="store.setPage($event)"
      >
        <thead>
          <tr>
            <th>{{ 'corporateConventions.column.convention' | translate }}</th>
            <th>{{ 'corporateConventions.column.partner' | translate }}</th>
            <th>{{ 'corporateConventions.column.type' | translate }}</th>
            <th>{{ 'corporateConventions.column.validity' | translate }}</th>
            <th>{{ 'corporateConventions.column.enrolled' | translate }}</th>
            <th>{{ 'corporateConventions.column.status' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (convention of table.data; track convention.id) {
            <tr>
              <td>
                <strong>{{ convention.name }}</strong>
                <div class="muted">
                  {{ convention.code }} · {{ convention.country_code }}/{{ convention.currency }}
                </div>
              </td>
              <td>{{ convention.partner_company_name }}</td>
              <td>
                {{ 'corporateConventions.partnerType.' + convention.partner_type | translate }}
              </td>
              <td>
                {{ convention.valid_from | date: 'shortDate' }}
                @if (convention.valid_to) {
                  – {{ convention.valid_to | date: 'shortDate' }}
                }
              </td>
              <td>
                {{ convention.enrolled_employees_count ?? 0 }}
                <span class="muted"
                  >+ {{ convention.enrolled_family_count ?? 0 }}
                  {{ 'corporateConventions.label.family' | translate }}</span
                >
              </td>
              <td>
                <nz-tag [nzColor]="statusColor(convention)">{{
                  'corporateConventions.status.' + convention.status | translate
                }}</nz-tag>
              </td>
              <td class="row-actions">
                <a
                  [href]="convention.landing_path"
                  target="_blank"
                  rel="noopener"
                  nz-button
                  nzSize="small"
                >
                  {{ 'corporateConventions.action.landing' | translate }}
                </a>
                @if (canWrite) {
                  <button nz-button nzSize="small" type="button" (click)="openEdit(convention)">
                    {{ 'corporateConventions.action.edit' | translate }}
                  </button>
                  @if (convention.status === 'DRAFT' || convention.status === 'SUSPENDED') {
                    <button
                      nz-button
                      nzSize="small"
                      nzType="primary"
                      type="button"
                      (click)="transition(convention, 'ACTIVE')"
                    >
                      {{ 'corporateConventions.action.activate' | translate }}
                    </button>
                  }
                  @if (convention.status === 'ACTIVE') {
                    <button
                      nz-button
                      nzSize="small"
                      type="button"
                      (click)="transition(convention, 'SUSPENDED')"
                    >
                      {{ 'corporateConventions.action.suspend' | translate }}
                    </button>
                  }
                  @if (convention.status === 'ACTIVE' || convention.status === 'SUSPENDED') {
                    <button
                      nz-button
                      nzSize="small"
                      type="button"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'corporateConventions.confirm.expire' | translate"
                      [nzOkText]="'corporateConventions.action.confirm' | translate"
                      [nzCancelText]="'corporateConventions.action.cancel' | translate"
                      (nzOnConfirm)="transition(convention, 'EXPIRED')"
                    >
                      {{ 'corporateConventions.action.expire' | translate }}
                    </button>
                  }
                  @if (convention.has_contract_document) {
                    <button
                      nz-button
                      nzSize="small"
                      type="button"
                      (click)="downloadContract(convention)"
                    >
                      {{ 'corporateConventions.action.contract' | translate }}
                    </button>
                  }
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'corporateConventions.confirm.delete' | translate"
                    [nzOkText]="'corporateConventions.action.confirm' | translate"
                    [nzCancelText]="'corporateConventions.action.cancel' | translate"
                    (nzOnConfirm)="remove(convention)"
                  >
                    {{ 'corporateConventions.action.delete' | translate }}
                  </button>
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="7">
                <nz-empty
                  [nzNotFoundContent]="'corporateConventions.empty.conventions' | translate"
                ></nz-empty>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>

    <nz-drawer
      [nzVisible]="drawerOpen()"
      [nzWidth]="980"
      [nzTitle]="'corporateConventions.section.convention' | translate"
      (nzOnClose)="closeDrawer()"
    >
      <ng-container *nzDrawerContent>
        <app-ccv-convention-form
          [convention]="editing()"
          [lookups]="store.lookups()"
          [stats]="store.identifierStats()"
          [importResult]="store.importPreview()"
          [saving]="store.saving()"
          [error]="formError()"
          (submitted)="save($event)"
          (cancelled)="closeDrawer()"
          (importRequested)="importList($event)"
          (contractSelected)="uploadContract($event)"
          (logoSelected)="uploadLogo($event)"
        ></app-ccv-convention-form>
      </ng-container>
    </nz-drawer>
  `,
})
export class ConventionsComponent implements OnInit {
  protected readonly store = inject(ConventionsStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly permissions = inject(PermissionsService);

  protected readonly canWrite = this.permissions.canWrite(CORPORATE_CONVENTIONS_MODULE);
  protected readonly partnerTypes = CCV_PARTNER_TYPES;

  protected readonly drawerOpen = signal(false);
  protected readonly editing = signal<CcvConvention | null>(null);
  protected readonly formError = signal<CcvOutcome | null>(null);
  protected readonly feedback = signal<CcvOutcome | null>(null);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly statusColor = (convention: CcvConvention): string =>
    conventionStatusColor(convention.status);

  ngOnInit(): void {
    void this.store.init();
  }

  protected onSearch(term: string): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => void this.store.setFilters({ q: term }), 350);
  }

  protected openCreate(): void {
    this.store.closeDetail();
    this.editing.set(null);
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  protected async openEdit(convention: CcvConvention): Promise<void> {
    this.formError.set(null);
    const outcome = await this.store.open(convention.id);
    if (!outcome.ok) {
      this.feedback.set(outcome);
      return;
    }
    this.editing.set(this.store.detail());
    this.drawerOpen.set(true);
  }

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
    this.editing.set(null);
    this.store.closeDetail();
  }

  protected async save(payload: CcvConventionPayload): Promise<void> {
    const current = this.editing();
    const outcome =
      current === null
        ? await this.store.create(payload)
        : await this.store.update(current.id, payload);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('corporateConventions.notification.saved'));
      this.formError.set(null);
      if (current === null) {
        // A new convention stays open so the employee list, the contract and the logo can be added.
        this.editing.set(this.store.detail());
      } else {
        this.closeDrawer();
      }
    } else {
      this.formError.set(outcome);
    }
  }

  protected async importList(request: { identifiers: string[]; dryRun: boolean }): Promise<void> {
    const current = this.editing();
    if (current === null) {
      return;
    }
    const outcome = await this.store.importIdentifiers(
      current.id,
      request.identifiers,
      request.dryRun,
    );
    if (outcome.ok) {
      if (!request.dryRun) {
        this.message.success(this.i18n.instant('corporateConventions.notification.listImported'));
      }
      this.formError.set(null);
    } else {
      this.formError.set(outcome);
    }
  }

  protected async uploadContract(file: File): Promise<void> {
    const current = this.editing();
    if (current !== null) {
      this.reportUpload(await this.store.uploadContract(current.id, file));
    }
  }

  protected async uploadLogo(file: File): Promise<void> {
    const current = this.editing();
    if (current !== null) {
      this.reportUpload(await this.store.uploadLogo(current.id, file));
    }
  }

  protected async transition(
    convention: CcvConvention,
    status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED',
  ): Promise<void> {
    const outcome = await this.store.transition(convention.id, status);
    if (outcome.ok) {
      this.feedback.set(null);
      this.message.success(this.i18n.instant('corporateConventions.notification.statusChanged'));
    } else {
      this.feedback.set(outcome);
    }
  }

  protected async remove(convention: CcvConvention): Promise<void> {
    const outcome = await this.store.remove(convention.id);
    if (outcome.ok) {
      this.feedback.set(null);
      this.message.success(this.i18n.instant('corporateConventions.notification.deleted'));
    } else {
      this.feedback.set(outcome);
    }
  }

  protected async downloadContract(convention: CcvConvention): Promise<void> {
    const outcome = await this.store.downloadContract(convention.id, convention.code);
    this.feedback.set(outcome.ok ? null : outcome);
  }

  private reportUpload(outcome: CcvOutcome): void {
    if (outcome.ok) {
      this.formError.set(null);
      this.editing.set(this.store.detail());
      this.message.success(this.i18n.instant('corporateConventions.notification.fileUploaded'));
    } else {
      this.formError.set(outcome);
    }
  }
}
