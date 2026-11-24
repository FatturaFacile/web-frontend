import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { catchError, of } from 'rxjs';
import { PLM_REVISION_STATUSES, PlmApiService, PlmItemRevision, PlmOption, PlmRevisionStatus, TranslateService } from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, REVISION_STATUS_COLORS } from './plm.util';

/** Revisions of the manufacturing items: the first one is released directly, later ones through a change order. */
@Component({
  selector: 'app-plm-revisions',
  styleUrl: './plm.scss',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'PLM.REVISIONS_TITLE' | translate" [subtitle]="'PLM.REVISIONS_SUBTITLE' | translate">
      <a nz-button routerLink="/plm">{{ 'PLM.ORDERS_TITLE' | translate }}</a>
      <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
    </app-page-header>

    <div class="toolbar">
      <nz-select style="width: 220px" nzAllowClear [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event); load()" [nzPlaceHolder]="'PLM.STATUS' | translate">
        @for (status of statuses; track status) {
          <nz-option [nzValue]="status" [nzLabel]="('PLM.REV_' + status.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="revisions()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'PLM.ITEM' | translate }}</th>
            <th>{{ 'PLM.REVISION' | translate }}</th>
            <th>{{ 'PLM.STATUS' | translate }}</th>
            <th>{{ 'PLM.CHANGE_SUMMARY' | translate }}</th>
            <th>{{ 'PLM.EFFECTIVE_FROM' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.item?.item_code }} {{ row.item?.name }}</td>
              <td>{{ row.revision }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(row.status)">{{ ('PLM.REV_' + row.status.toUpperCase()) | translate }}</nz-tag>
              </td>
              <td>{{ row.change_summary }}</td>
              <td>{{ row.effective_from ?? '' }}</td>
              <td>
                <div class="row-actions">
                  @if (row.status === 'draft') {
                    <button nz-button nzType="text" appIconAction="edit" (click)="openModal(row)"></button>
                    <button nz-button nzType="text" (click)="release(row)">{{ 'PLM.RELEASE' | translate }}</button>
                    <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'PLM.DELETE_CONFIRM' | translate" (nzOnConfirm)="remove(row)"></button>
                  }
                  @if (row.status === 'released') {
                    <button nz-button nzType="text" nz-popconfirm [nzPopconfirmTitle]="'PLM.OBSOLETE_CONFIRM' | translate" (nzOnConfirm)="obsolete(row)">{{ 'PLM.MAKE_OBSOLETE' | translate }}</button>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && revisions().length === 0) {
        <nz-empty [nzNotFoundContent]="'PLM.NO_REVISIONS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal appModalActions [(nzVisible)]="modalVisible" [nzTitle]="(editing() ? 'PLM.EDIT_REVISION' : 'PLM.NEW_REVISION') | translate" (nzOnCancel)="modalVisible.set(false)" (nzOnOk)="save()" okAction="save" [nzOkDisabled]="form.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          @if (!editing()) {
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'PLM.ITEM' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="mfg_item_id" nzShowSearch>
                  @for (item of items(); track item.id) {
                    <nz-option [nzValue]="item.id" [nzLabel]="item.label"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          }
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="rev-label">{{ 'PLM.REVISION' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="rev-label" formControlName="revision" maxlength="20" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="rev-effective">{{ 'PLM.EFFECTIVE_FROM' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="rev-effective" type="date" formControlName="effective_from" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzFor="rev-summary">{{ 'PLM.CHANGE_SUMMARY' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="rev-summary" rows="3" formControlName="change_summary" maxlength="2000"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class PlmRevisionsComponent implements OnInit {
  private readonly api = inject(PlmApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly statuses = PLM_REVISION_STATUSES;
  readonly revisions = signal<PlmItemRevision[]>([]);
  readonly items = signal<PlmOption[]>([]);
  readonly loading = signal(false);
  readonly modalVisible = signal(false);
  readonly editing = signal<PlmItemRevision | null>(null);
  readonly statusFilter = signal<PlmRevisionStatus | null>(null);

  readonly form = this.fb.group({
    mfg_item_id: ['', [Validators.required]],
    revision: ['', [Validators.required]],
    effective_from: [''],
    change_summary: [''],
  });

  ngOnInit(): void {
    this.load();
    this.api
      .getItemOptions()
      .pipe(catchError(() => of([])))
      .subscribe((items) => this.items.set(items));
  }

  load(): void {
    this.loading.set(true);
    this.api.getRevisions({ status: this.statusFilter() ?? undefined, per_page: 100 }).subscribe({
      next: (response) => {
        this.revisions.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('PLM.ACTION_ERROR'));
      },
    });
  }

  statusColor(status: string): string {
    return REVISION_STATUS_COLORS[status] ?? 'default';
  }

  openModal(revision: PlmItemRevision | null = null): void {
    this.editing.set(revision);
    this.form.reset({ mfg_item_id: revision?.mfg_item_id ?? '', revision: revision?.revision ?? '', effective_from: revision?.effective_from ?? '', change_summary: revision?.change_summary ?? '' });
    this.modalVisible.set(true);
  }

  save(): void {
    const value = this.form.getRawValue();
    const payload = { revision: value.revision, effective_from: blankToNull(value.effective_from), change_summary: blankToNull(value.change_summary) };
    const current = this.editing();
    const request = current ? this.api.updateRevision(current.id, payload) : this.api.createRevision({ ...payload, mfg_item_id: value.mfg_item_id });

    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('PLM.REVISION_SAVED'));
        this.modalVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  release(revision: PlmItemRevision): void {
    this.api.releaseRevision(revision.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PLM.RELEASED'));
        this.load();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  obsolete(revision: PlmItemRevision): void {
    this.api.obsoleteRevision(revision.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PLM.MADE_OBSOLETE'));
        this.load();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  remove(revision: PlmItemRevision): void {
    this.api.deleteRevision(revision.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PLM.DELETED'));
        this.load();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  private fail(error: unknown): void {
    this.message.error(apiErrorText(error) ?? this.translate.instant('PLM.ACTION_ERROR'));
  }
}
