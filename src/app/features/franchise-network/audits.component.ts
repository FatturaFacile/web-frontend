import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PermissionsService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { AuditsStore } from './audits.store';
import { FRANCHISE_NETWORK_AUDIT_MODULE, FrnOutcome } from './franchise-network.util';

/** Store audits: history and trend per store, the corrective actions to close, and the start of a new visit. */
@Component({
  selector: 'app-frn-audits',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
  ],
  providers: [AuditsStore],
  styleUrl: './franchise-network.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.FRANCHISE_NETWORK_AUDITS' | translate"></app-page-header>

    <div class="toolbar">
      <label class="field" for="frn-au-store">
        <span>{{ 'franchiseNetwork.field.store' | translate }}</span>
        <nz-select
          nzId="frn-au-store"
          nzAllowClear
          nzShowSearch
          [ngModel]="store.storeFilter()"
          (ngModelChange)="store.setStoreFilter($event)"
        >
          @for (option of store.stores(); track option.id) {
            <nz-option [nzValue]="option.id" [nzLabel]="option.code + ' ' + option.name"></nz-option>
          }
        </nz-select>
      </label>
      <span class="spacer"></span>
      @if (canAudit) {
        <button nz-button nzType="primary" type="button" (click)="openStart()">
          {{ 'franchiseNetwork.action.startAudit' | translate }}
        </button>
      }
    </div>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }
    @if (feedback(); as failure) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="failure.errorKey ?? 'franchiseNetwork.error.generic' | translate: failure.params"
        [nzDescription]="failure.detail ?? undefined"
        (nzOnClose)="feedback.set(null)"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-card class="main-card" [nzTitle]="'franchiseNetwork.section.auditHistory' | translate">
        <nz-table #table nzSize="small" [nzData]="store.audits()" [nzShowPagination]="false" [nzScroll]="{ x: '800px' }">
          <thead>
            <tr>
              <th scope="col">{{ 'franchiseNetwork.field.auditedOn' | translate }}</th>
              <th scope="col">{{ 'franchiseNetwork.field.store' | translate }}</th>
              <th scope="col">{{ 'franchiseNetwork.field.status' | translate }}</th>
              <th scope="col" class="num">{{ 'franchiseNetwork.field.score' | translate }}</th>
              <th scope="col">{{ 'franchiseNetwork.field.result' | translate }}</th>
              <th scope="col">{{ 'franchiseNetwork.field.actions' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of table.data; track row.id) {
              <tr>
                <th scope="row">{{ row.audited_on }}</th>
                <td>{{ row.store_code }} <small class="muted">{{ row.store_name }}</small></td>
                <td>
                  <nz-tag [nzColor]="row.status === 'submitted' ? 'green' : 'gold'">{{ 'franchiseNetwork.auditStatus.' + row.status | translate }}</nz-tag>
                </td>
                <td class="num">
                  @if (row.status === 'submitted') {
                    <nz-tag [nzColor]="row.passed ? 'green' : 'red'">{{ row.score_percent }}%</nz-tag>
                  } @else {
                    —
                  }
                </td>
                <td>
                  @if (row.passed !== null) {
                    <nz-tag [nzColor]="row.passed ? 'green' : 'red'">{{ (row.passed ? 'franchiseNetwork.field.passed' : 'franchiseNetwork.field.failed') | translate }}</nz-tag>
                  }
                </td>
                <td class="row-actions">
                  <a nz-button nzSize="small" [routerLink]="['/franchise-network/audits', row.id]">
                    {{ (row.status === 'draft' ? 'franchiseNetwork.action.continueAudit' : 'franchiseNetwork.action.openAudit') | translate }}
                  </a>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6">
                  <nz-empty [nzNotFoundContent]="'franchiseNetwork.empty.audits' | translate"></nz-empty>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'franchiseNetwork.section.openActions' | translate">
        <nz-table #actions nzSize="small" [nzData]="store.actions()" [nzShowPagination]="false">
          <thead>
            <tr>
              <th scope="col">{{ 'franchiseNetwork.field.criterion' | translate }}</th>
              <th scope="col">{{ 'franchiseNetwork.field.description' | translate }}</th>
              <th scope="col">{{ 'franchiseNetwork.field.dueDate' | translate }}</th>
              <th scope="col">{{ 'franchiseNetwork.field.actions' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (action of actions.data; track action.id) {
              <tr>
                <th scope="row">{{ action.criterion_code }}</th>
                <td>{{ action.description }}</td>
                <td>
                  {{ action.due_date }}
                  @if (action.overdue) {
                    <nz-tag nzColor="red">{{ 'franchiseNetwork.field.overdue' | translate }}</nz-tag>
                  }
                </td>
                <td>
                  @if (canAudit) {
                    <button nz-button nzSize="small" type="button" (click)="complete(action.id)">
                      {{ 'franchiseNetwork.action.completeAction' | translate }}
                    </button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4">
                  <nz-empty [nzNotFoundContent]="'franchiseNetwork.empty.actions' | translate"></nz-empty>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    </nz-spin>

    <nz-drawer
      [nzVisible]="drawerOpen()"
      [nzWidth]="480"
      [nzTitle]="'franchiseNetwork.action.startAudit' | translate"
      (nzOnClose)="drawerOpen.set(false)"
    >
      <ng-container *nzDrawerContent>
        <form [formGroup]="form" class="form" (ngSubmit)="start()">
          <label class="field" for="frn-au-new-store">
            <span>{{ 'franchiseNetwork.field.store' | translate }}</span>
            <nz-select nzId="frn-au-new-store" formControlName="store_id" nzShowSearch>
              @for (option of store.stores(); track option.id) {
                <nz-option [nzValue]="option.id" [nzLabel]="option.code + ' ' + option.name"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="frn-au-template">
            <span>{{ 'franchiseNetwork.field.template' | translate }}</span>
            <nz-select nzId="frn-au-template" formControlName="template_id">
              @for (template of store.templates(); track template.id) {
                <nz-option [nzValue]="template.id" [nzLabel]="template.label"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="frn-au-date">
            <span>{{ 'franchiseNetwork.field.auditedOn' | translate }}</span>
            <input nz-input id="frn-au-date" type="date" formControlName="audited_on" />
          </label>
          <div class="actions">
            <button nz-button nzType="primary" type="submit" [nzLoading]="store.saving()" [disabled]="form.invalid">
              {{ 'franchiseNetwork.action.startAudit' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>
  `,
})
export class AuditsComponent implements OnInit {
  protected readonly store = inject(AuditsStore);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly router = inject(Router);

  protected readonly canAudit = inject(PermissionsService).canWrite(FRANCHISE_NETWORK_AUDIT_MODULE);

  protected readonly drawerOpen = signal(false);
  protected readonly feedback = signal<FrnOutcome | null>(null);

  protected readonly form = this.fb.group({
    store_id: ['', Validators.required],
    template_id: ['', Validators.required],
    audited_on: [''],
  });

  ngOnInit(): void {
    void this.store.load();
  }

  protected openStart(): void {
    this.form.reset();
    this.drawerOpen.set(true);
  }

  protected async start(): Promise<void> {
    const value = this.form.getRawValue();
    const result = await this.store.start({ ...value, audited_on: value.audited_on || null });
    if (result.audit) {
      this.drawerOpen.set(false);
      await this.router.navigate(['/franchise-network/audits', result.audit.id]);
    } else {
      this.feedback.set(result.outcome);
      this.drawerOpen.set(false);
    }
  }

  protected async complete(id: string): Promise<void> {
    const outcome = await this.store.completeAction(id, null);
    this.feedback.set(outcome.ok ? null : outcome);
  }
}
