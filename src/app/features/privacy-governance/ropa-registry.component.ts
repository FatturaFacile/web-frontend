import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { I18nService, PgLegalBasis, PgRopaActivity, PrivacyGovernanceApiService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { PG_LEGAL_BASES, RopaEditorDrawerComponent } from './ropa-editor-drawer.component';
import {
  crossBorderKinds,
  legalBasisColor,
  pgErrorMessage,
  retentionParts,
} from './privacy-governance.helpers';

/** Record of processing activities (Art. 30 GDPR / Art. 12 nLPD): filterable register with legal basis, transfer and retention badges. */
@Component({
  selector: 'app-ropa-registry',
  imports: [
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    RopaEditorDrawerComponent,
    TranslatePipe,
  ],
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }
    .toolbar nz-select {
      min-width: 190px;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
  `,
  template: `
    <app-page-header
      [title]="'PRIVACY.ROPA.TITLE' | translate"
      [subtitle]="'PRIVACY.ROPA.SUBTITLE' | translate"
    >
      <button nz-button (click)="confirmSeedDefaults()" [nzLoading]="seeding()">
        <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
        {{ 'PRIVACY.ROPA.LOAD_TEMPLATES' | translate }}
      </button>
      <button nz-button nzType="primary" (click)="openEditor(null)">
        {{ 'PRIVACY.ROPA.NEW' | translate }}
      </button>
    </app-page-header>

    <nz-card>
      <div class="toolbar">
        <nz-select
          [ngModel]="legalBasis()"
          (ngModelChange)="legalBasis.set($event); load()"
          nzAllowClear
          [nzPlaceHolder]="'PRIVACY.ROPA.LEGAL_BASIS' | translate"
          [attr.aria-label]="'PRIVACY.ROPA.LEGAL_BASIS' | translate"
        >
          @for (basis of legalBases; track basis) {
            <nz-option [nzValue]="basis" [nzLabel]="'PRIVACY.LEGAL_BASIS.' + basis | translate" />
          }
        </nz-select>
        <nz-select
          [ngModel]="crossBorder()"
          (ngModelChange)="crossBorder.set($event); load()"
          nzAllowClear
          [nzPlaceHolder]="'PRIVACY.ROPA.CROSS_BORDER' | translate"
          [attr.aria-label]="'PRIVACY.ROPA.CROSS_BORDER' | translate"
        >
          <nz-option [nzValue]="1" [nzLabel]="'PRIVACY.ROPA.WITH_TRANSFERS' | translate" />
          <nz-option [nzValue]="0" [nzLabel]="'PRIVACY.ROPA.WITHOUT_TRANSFERS' | translate" />
        </nz-select>
        <nz-select
          [ngModel]="active()"
          (ngModelChange)="active.set($event); load()"
          nzAllowClear
          [nzPlaceHolder]="'PRIVACY.ROPA.STATUS' | translate"
          [attr.aria-label]="'PRIVACY.ROPA.STATUS' | translate"
        >
          <nz-option [nzValue]="1" [nzLabel]="'PRIVACY.COMMON.ACTIVE' | translate" />
          <nz-option [nzValue]="0" [nzLabel]="'PRIVACY.COMMON.INACTIVE' | translate" />
        </nz-select>
      </div>

      <nz-table
        #table
        [nzData]="items()"
        [nzLoading]="loading()"
        nzSize="middle"
        [nzShowPagination]="false"
      >
        <thead>
          <tr>
            <th>{{ 'PRIVACY.ROPA.CODE' | translate }}</th>
            <th>{{ 'PRIVACY.ROPA.NAME' | translate }}</th>
            <th>{{ 'PRIVACY.ROPA.LEGAL_BASIS' | translate }}</th>
            <th>{{ 'PRIVACY.ROPA.CROSS_BORDER' | translate }}</th>
            <th>{{ 'PRIVACY.ROPA.RETENTION' | translate }}</th>
            <th>{{ 'PRIVACY.ROPA.STATUS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.activity_code }}</td>
              <td>
                <strong>{{ row.activity_name }}</strong>
                <div>{{ row.purpose }}</div>
              </td>
              <td>
                <nz-tag [nzColor]="basisColor(row.legal_basis)">{{
                  'PRIVACY.LEGAL_BASIS.' + row.legal_basis | translate
                }}</nz-tag>
              </td>
              <td>
                <div class="tags">
                  @for (kind of kindsOf(row); track kind) {
                    <nz-tag [nzColor]="kind === 'third' ? 'red' : kind === 'eu' ? 'blue' : 'green'">
                      {{ 'PRIVACY.CROSS_BORDER.' + kind | translate }}
                    </nz-tag>
                  } @empty {
                    <nz-tag>{{ 'PRIVACY.CROSS_BORDER.NONE' | translate }}</nz-tag>
                  }
                </div>
              </td>
              <td>
                @if (retentionOf(row); as retention) {
                  <nz-tag nzColor="gold" [title]="row.retention_legal_reference ?? ''">
                    {{
                      'PRIVACY.ROPA.RETENTION_VALUE'
                        | translate: { years: retention.years, months: retention.months }
                    }}
                  </nz-tag>
                } @else {
                  <span>-</span>
                }
              </td>
              <td>
                <nz-tag [nzColor]="row.is_active ? 'green' : 'default'">
                  {{
                    (row.is_active ? 'PRIVACY.COMMON.ACTIVE' : 'PRIVACY.COMMON.INACTIVE')
                      | translate
                  }}
                </nz-tag>
              </td>
              <td>
                <button nz-button nzSize="small" (click)="openEditor(row)">
                  {{ 'PRIVACY.COMMON.EDIT' | translate }}
                </button>
                <button
                  nz-button
                  nzSize="small"
                  nzDanger
                  nz-popconfirm
                  [nzPopconfirmTitle]="'PRIVACY.ROPA.DELETE_CONFIRM' | translate"
                  (nzOnConfirm)="remove(row)"
                >
                  {{ 'PRIVACY.COMMON.DELETE' | translate }}
                </button>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="7">{{ 'PRIVACY.ROPA.EMPTY' | translate }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <app-ropa-editor-drawer [(visible)]="editorOpen" [activity]="editing()" (saved)="load()" />
  `,
})
export class RopaRegistryComponent implements OnInit {
  private readonly api = inject(PrivacyGovernanceApiService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly i18n = inject(I18nService);

  readonly legalBases = PG_LEGAL_BASES;
  readonly items = signal<PgRopaActivity[]>([]);
  readonly loading = signal(false);
  readonly seeding = signal(false);
  readonly legalBasis = signal<PgLegalBasis | null>(null);
  readonly crossBorder = signal<0 | 1 | null>(null);
  readonly active = signal<0 | 1 | null>(null);
  readonly editorOpen = signal(false);
  readonly editing = signal<PgRopaActivity | null>(null);

  readonly basisColor = legalBasisColor;
  readonly kindsOf = (row: PgRopaActivity) => crossBorderKinds(row.cross_border_transfers ?? []);
  readonly retentionOf = (row: PgRopaActivity) => retentionParts(row.retention_period_months);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api
      .getRopa({
        legal_basis: this.legalBasis() ?? '',
        cross_border: this.crossBorder() ?? '',
        is_active: this.active() ?? '',
        per_page: 100,
      })
      .subscribe({
        next: (response) => {
          this.items.set(response.data);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.message.error(
            pgErrorMessage(err, this.i18n.translate('PRIVACY.COMMON.LOAD_FAILED')),
          );
        },
      });
  }

  openEditor(row: PgRopaActivity | null): void {
    this.editing.set(row);
    this.editorOpen.set(true);
  }

  remove(row: PgRopaActivity): void {
    this.api.deleteRopa(row.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('PRIVACY.COMMON.DELETED'));
        this.load();
      },
      error: (err: unknown) =>
        this.message.error(pgErrorMessage(err, this.i18n.translate('PRIVACY.COMMON.SAVE_FAILED'))),
    });
  }

  confirmSeedDefaults(): void {
    this.modal.confirm({
      nzTitle: this.i18n.translate('PRIVACY.ROPA.SEED_CONFIRM_TITLE'),
      nzContent: this.i18n.translate('PRIVACY.ROPA.SEED_CONFIRM_BODY'),
      nzOkText: this.i18n.translate('PRIVACY.ROPA.LOAD_TEMPLATES'),
      nzCancelText: this.i18n.translate('PRIVACY.COMMON.CANCEL'),
      nzOnOk: () => this.seedDefaults(),
    });
  }

  private seedDefaults(): void {
    this.seeding.set(true);
    this.api.seedDefaults().subscribe({
      next: ({ data }) => {
        this.seeding.set(false);
        this.message.success(this.i18n.translate('PRIVACY.ROPA.SEED_DONE', { ...data }));
        this.load();
      },
      error: (err: unknown) => {
        this.seeding.set(false);
        this.message.error(pgErrorMessage(err, this.i18n.translate('PRIVACY.COMMON.SAVE_FAILED')));
      },
    });
  }
}
