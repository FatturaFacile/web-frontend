import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ConsolidationGroup, GeneralLedgerConsolidationApiService, I18nService, PermissionsService } from '@core';
import { IconActionDirective, TranslatePipe } from '@shared';
import { GlErrorAlertComponent } from '../shared/gl-error-alert.component';
import { GlConsolidationGroupFormComponent } from './gl-consolidation-group-form.component';

/** Consolidation groups of the active entity (the parent): list, create, edit and delete. */
@Component({
  selector: 'app-gl-consolidation-groups',
  styleUrl: './gl-consolidation.scss',
  imports: [
    RouterLink,
    IconActionDirective,
    NzButtonModule,
    NzCardModule,
    NzPopconfirmModule,
    NzTableModule,
    NzTagModule,
    GlConsolidationGroupFormComponent,
    GlErrorAlertComponent,
    TranslatePipe,
  ],
  template: `
    <app-gl-error-alert [error]="error()" />
    <nz-card>
      <div class="toolbar">
        <span class="muted">{{ 'GL.CONS_GROUPS_HINT' | translate }}</span>
        <span class="spacer"></span>
        @if (canWrite) {
          <button nz-button nzType="primary" type="button" (click)="openCreate()" appIconAction="create"></button>
        }
      </div>
      <nz-table #table nzSize="small" [nzData]="groups()" [nzLoading]="loading()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>{{ 'GL.COL_NAME' | translate }}</th>
            <th>{{ 'GL.CONS_GROUP_CURRENCY' | translate }}</th>
            <th>{{ 'GL.CONS_MEMBERS' | translate }}</th>
            <th>{{ 'GL.CONS_GOODWILL_METHOD' | translate }}</th>
            <th>{{ 'GL.STATUS' | translate }}</th>
            <th>{{ 'GL.COL_ACTIONS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (group of table.data; track group.id) {
            <tr>
              <td>
                <a [routerLink]="['/general-ledger/consolidation', group.id]">{{ group.name }}</a>
              </td>
              <td>{{ group.group_currency }}</td>
              <td>{{ group.members?.length ?? 0 }}</td>
              <td>{{ 'GL.CONS_GW_METHOD_' + group.goodwill_method.toUpperCase() | translate }}</td>
              <td>
                <nz-tag [nzColor]="group.is_active ? 'green' : 'default'">{{ (group.is_active ? 'GL.CONS_ACTIVE' : 'GL.CONS_INACTIVE') | translate }}</nz-tag>
              </td>
              <td>
                <div class="actions">
                  <a nz-button nzSize="small" [routerLink]="['/general-ledger/consolidation', group.id]">{{ 'GL.CONS_OPEN' | translate }}</a>
                  @if (canWrite) {
                    <button nz-button nzSize="small" type="button" appIconAction="edit" (click)="openEdit(group)"></button>
                    <button
                      nz-button
                      nzSize="small"
                      nzDanger
                      type="button"
                      appIconAction="delete"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'GL.CONFIRM_DELETE' | translate"
                      (nzOnConfirm)="remove(group)"
                    ></button>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <app-gl-consolidation-group-form [open]="formOpen()" [group]="editing()" (saved)="onSaved()" (closed)="formOpen.set(false)" />
  `,
})
export class GlConsolidationGroupsComponent {
  private readonly api = inject(GeneralLedgerConsolidationApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  protected readonly groups = signal<ConsolidationGroup[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<unknown>(null);
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<ConsolidationGroup | null>(null);

  constructor() {
    this.load();
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  protected openEdit(group: ConsolidationGroup): void {
    this.editing.set(group);
    this.formOpen.set(true);
  }

  protected onSaved(): void {
    this.formOpen.set(false);
    this.load();
  }

  protected remove(group: ConsolidationGroup): void {
    this.api.deleteGroup(group.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('GL.CONS_DELETED'));
        this.load();
      },
      error: (err: unknown) => this.error.set(err),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api.getGroups().subscribe({
      next: (res) => {
        this.groups.set(res.data ?? []);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(err);
        this.loading.set(false);
      },
    });
  }
}
