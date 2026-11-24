import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ConsolidationGroup, GeneralLedgerConsolidationApiService, PermissionsService } from '@core';
import { IconActionDirective, TranslatePipe } from '@shared';
import { GlErrorAlertComponent } from '../shared/gl-error-alert.component';
import { GlConsolidationAccountMappingsComponent } from './gl-consolidation-account-mappings.component';
import { GlConsolidationAcquisitionsComponent } from './gl-consolidation-acquisitions.component';
import { GlConsolidationDividendsComponent } from './gl-consolidation-dividends.component';
import { GlConsolidationGroupFormComponent } from './gl-consolidation-group-form.component';
import { GlConsolidationMembersComponent } from './gl-consolidation-members.component';
import { GlConsolidationReconciliationComponent } from './gl-consolidation-reconciliation.component';
import { GlConsolidationRelationsComponent } from './gl-consolidation-relations.component';
import { GlConsolidationRunsComponent } from './gl-consolidation-runs.component';
import { GlConsolidationTransactionsComponent } from './gl-consolidation-transactions.component';

/** One consolidation group: its configuration, members, intercompany relations, inputs, reconciliation and runs. */
@Component({
  selector: 'app-gl-consolidation-group-detail',
  styleUrl: './gl-consolidation.scss',
  imports: [
    RouterLink,
    IconActionDirective,
    NzButtonModule,
    NzCardModule,
    NzTabsModule,
    NzTagModule,
    GlConsolidationAccountMappingsComponent,
    GlConsolidationAcquisitionsComponent,
    GlConsolidationDividendsComponent,
    GlConsolidationGroupFormComponent,
    GlConsolidationMembersComponent,
    GlConsolidationReconciliationComponent,
    GlConsolidationRelationsComponent,
    GlConsolidationRunsComponent,
    GlConsolidationTransactionsComponent,
    GlErrorAlertComponent,
    TranslatePipe,
  ],
  template: `
    <app-gl-error-alert [error]="error()" />
    <div class="toolbar">
      <a nz-button routerLink="/general-ledger/consolidation">{{ 'GL.CONS_BACK_TO_GROUPS' | translate }}</a>
    </div>
    @if (group(); as current) {
      <nz-card [nzTitle]="current.name">
        <div class="summary-grid">
          <div>
            <span class="muted">{{ 'GL.CONS_GROUP_CURRENCY' | translate }}</span>
            <div>{{ current.group_currency }}</div>
          </div>
          <div>
            <span class="muted">{{ 'GL.CONS_GOODWILL_METHOD' | translate }}</span>
            <div>
              {{ 'GL.CONS_GW_METHOD_' + current.goodwill_method?.toUpperCase() | translate }}
              @if (current.goodwill_amortisation_years) {
                ({{ current.goodwill_amortisation_years }})
              }
            </div>
          </div>
          <div>
            <span class="muted">{{ 'GL.CONS_ELIMINATION_POLICY' | translate }}</span>
            <div>{{ 'GL.CONS_POLICY_' + current.elimination_difference_policy?.toUpperCase() | translate }}</div>
          </div>
          <div>
            <span class="muted">{{ 'GL.STATUS' | translate }}</span>
            <div>
              <nz-tag [nzColor]="current.is_active ? 'green' : 'default'">{{ (current.is_active ? 'GL.CONS_ACTIVE' : 'GL.CONS_INACTIVE') | translate }}</nz-tag>
            </div>
          </div>
        </div>
        @if (canWrite) {
          <button nz-button type="button" appIconAction="edit" (click)="formOpen.set(true)"></button>
        }
      </nz-card>

      <nz-tabs nzType="card">
        <nz-tab [nzTitle]="'GL.CONS_TAB_MEMBERS' | translate">
          <ng-template nz-tab><app-gl-consolidation-members [group]="current" (changed)="reload()" /></ng-template>
        </nz-tab>
        <nz-tab [nzTitle]="'GL.CONS_TAB_RELATIONS' | translate">
          <ng-template nz-tab><app-gl-consolidation-relations [group]="current" (changed)="reload()" /></ng-template>
        </nz-tab>
        <nz-tab [nzTitle]="'GL.CONS_TAB_ACCOUNT_MAPPINGS' | translate">
          <ng-template nz-tab><app-gl-consolidation-account-mappings [group]="current" /></ng-template>
        </nz-tab>
        <nz-tab [nzTitle]="'GL.CONS_TAB_ACQUISITIONS' | translate">
          <ng-template nz-tab><app-gl-consolidation-acquisitions [group]="current" /></ng-template>
        </nz-tab>
        <nz-tab [nzTitle]="'GL.CONS_TAB_TRANSACTIONS' | translate">
          <ng-template nz-tab><app-gl-consolidation-transactions [group]="current" /></ng-template>
        </nz-tab>
        <nz-tab [nzTitle]="'GL.CONS_TAB_DIVIDENDS' | translate">
          <ng-template nz-tab><app-gl-consolidation-dividends [group]="current" /></ng-template>
        </nz-tab>
        <nz-tab [nzTitle]="'GL.CONS_TAB_RECONCILIATION' | translate">
          <ng-template nz-tab><app-gl-consolidation-reconciliation [group]="current" /></ng-template>
        </nz-tab>
        <nz-tab [nzTitle]="'GL.CONS_TAB_RUNS' | translate">
          <ng-template nz-tab><app-gl-consolidation-runs [group]="current" /></ng-template>
        </nz-tab>
      </nz-tabs>

      <app-gl-consolidation-group-form [open]="formOpen()" [group]="current" (saved)="onSaved()" (closed)="formOpen.set(false)" />
    }
  `,
})
export class GlConsolidationGroupDetailComponent implements OnInit {
  private readonly api = inject(GeneralLedgerConsolidationApiService);
  private readonly route = inject(ActivatedRoute);
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  /** Group id; read from the route (`:id`) when the page is not given one. */
  readonly id = input<string>();

  protected readonly groupId = computed(() => this.id() ?? this.route.snapshot.paramMap.get('id') ?? '');
  protected readonly group = signal<ConsolidationGroup | null>(null);
  protected readonly error = signal<unknown>(null);
  protected readonly formOpen = signal(false);

  ngOnInit(): void {
    this.reload();
  }

  protected onSaved(): void {
    this.formOpen.set(false);
    this.reload();
  }

  protected reload(): void {
    const id = this.groupId();
    if (!id) {
      return;
    }
    this.api.getGroup(id).subscribe({
      next: (res) => this.group.set(res.data ?? null),
      error: (err: unknown) => this.error.set(err),
    });
  }
}
