import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { filter, map, startWith } from 'rxjs';
import { PermissionsService, SF_STATUSES, SfTransitionTarget, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { WORKSPACE_TABS } from './statutory-financials.routes';
import {
  LifecycleAction,
  routeDossierId,
  SfOutcome,
  standardColor,
  statusColor,
  statusStepIndex,
  STATUTORY_FINANCIALS_MODULE,
  tabOfUrl,
  validationColor,
  validationKey,
} from './statutory-financials.util';
import { WorkspaceStore } from './workspace.store';

/**
 * A dossier open: its header (title, tags, status steps, lifecycle actions) and a routed tab for each part of the work.
 * A locked or filed dossier is read-only.
 */
@Component({
  selector: 'app-sf-workspace',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSpinModule,
    NzStepsModule,
    NzTabsModule,
    NzTagModule,
    NzTooltipModule,
    PageHeaderComponent,
    RouterLink,
    RouterOutlet,
    TranslatePipe,
  ],
  styleUrl: './statutory-financials.scss',
  template: `
    <app-page-header [title]="'statutoryFinancials.workspace.title' | translate"></app-page-header>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }
    @if (failure(); as outcome) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="
          outcome.errorKey ?? 'statutoryFinancials.error.generic' | translate: outcome.params
        "
        [nzDescription]="outcome.detail"
        (nzOnClose)="failure.set(null)"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.dossier(); as dossier) {
        <nz-card class="main-card">
          <div class="toolbar">
            <div>
              <strong>{{ dossier.title }}</strong>
              <small class="muted">
                {{ dossier.fiscal_year?.year_code }}
                @if (dossier.filing_reference) {
                  · {{ 'statutoryFinancials.field.filingReference' | translate }}:
                  {{ dossier.filing_reference }}
                }
              </small>
            </div>
            <nz-tag [nzColor]="standardColor(dossier.accounting_standard)">
              {{ 'statutoryFinancials.standard.' + dossier.accounting_standard | translate }}
            </nz-tag>
            <nz-tag [nzColor]="statusColor(dossier.status)">
              {{ 'statutoryFinancials.status.' + dossier.status | translate }}
            </nz-tag>
            <nz-tag [nzColor]="validationColor(dossier.validation_status)">
              {{
                'statutoryFinancials.validation.' + validationKey(dossier.validation_status)
                  | translate
              }}
            </nz-tag>
            <span class="spacer"></span>
            <a nz-button routerLink="/statutory-financials">{{
              'statutoryFinancials.action.back' | translate
            }}</a>
            @for (action of store.actions(); track action.name) {
              <span
                nz-tooltip
                [nzTooltipTitle]="action.hintKey ? (action.hintKey | translate) : ''"
              >
                @if (action.name === 'file') {
                  <button
                    nz-button
                    nzType="primary"
                    type="button"
                    [disabled]="!allowed(action) || store.busy()"
                    (click)="openFiling()"
                  >
                    {{ 'statutoryFinancials.action.file' | translate }}
                  </button>
                } @else {
                  <button
                    nz-button
                    type="button"
                    nz-popconfirm
                    [nzType]="action.name === 'lock' ? 'primary' : 'default'"
                    [disabled]="!allowed(action) || store.busy()"
                    [nzPopconfirmTitle]="'statutoryFinancials.confirm.' + action.name | translate"
                    [nzOkText]="'statutoryFinancials.action.confirm' | translate"
                    [nzCancelText]="'statutoryFinancials.action.cancel' | translate"
                    (nzOnConfirm)="transition(action.target)"
                  >
                    {{ 'statutoryFinancials.action.' + action.name | translate }}
                  </button>
                }
              </span>
            }
          </div>

          <nz-steps class="steps-bar" nzSize="small" [nzCurrent]="stepIndex()">
            @for (status of statuses; track status) {
              <nz-step [nzTitle]="'statutoryFinancials.status.' + status | translate"></nz-step>
            }
          </nz-steps>

          @if (store.locked()) {
            <nz-alert
              nzType="info"
              nzShowIcon
              [nzMessage]="'statutoryFinancials.workspace.readOnly' | translate"
            ></nz-alert>
          }
        </nz-card>

        <nz-tabs [nzSelectedIndex]="tabIndex()" (nzSelectedIndexChange)="selectTab($event)">
          @for (tab of tabs; track tab) {
            <nz-tab [nzTitle]="'statutoryFinancials.tab.' + tab | translate"></nz-tab>
          }
        </nz-tabs>

        <router-outlet></router-outlet>
      }
    </nz-spin>

    <nz-modal
      [nzVisible]="filing()"
      [nzTitle]="'statutoryFinancials.filing.title' | translate"
      [nzOkText]="'statutoryFinancials.action.file' | translate"
      [nzCancelText]="'statutoryFinancials.action.cancel' | translate"
      [nzOkDisabled]="reference().trim() === '' || store.busy()"
      [nzOkLoading]="store.busy()"
      (nzOnOk)="file()"
      (nzOnCancel)="filing.set(false)"
    >
      <ng-container *nzModalContent>
        <label class="field" for="sf-filing-reference">
          <span>{{ 'statutoryFinancials.field.filingReference' | translate }} *</span>
          <input
            nz-input
            id="sf-filing-reference"
            maxlength="120"
            [ngModel]="reference()"
            (ngModelChange)="reference.set($event)"
          />
          <small class="muted">{{ 'statutoryFinancials.hint.filingReference' | translate }}</small>
        </label>
      </ng-container>
    </nz-modal>
  `,
})
export class WorkspaceComponent implements OnInit {
  protected readonly store = inject(WorkspaceStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly permissions = inject(PermissionsService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly tabs = WORKSPACE_TABS;
  protected readonly statuses = SF_STATUSES;
  protected readonly failure = signal<SfOutcome | null>(null);
  protected readonly filing = signal(false);
  protected readonly reference = signal('');

  protected readonly statusColor = statusColor;
  protected readonly standardColor = standardColor;
  protected readonly validationColor = validationColor;
  protected readonly validationKey = validationKey;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly tabIndex = computed(() => {
    const index = WORKSPACE_TABS.findIndex((tab) => tab === tabOfUrl(this.url()));
    return index < 0 ? 0 : index;
  });
  protected readonly stepIndex = computed(() => {
    const status = this.store.status();
    return status === null ? 0 : statusStepIndex(status);
  });

  private get id(): string {
    return routeDossierId(this.route) ?? '';
  }

  ngOnInit(): void {
    void this.store.load(this.id, this.i18n.currentLanguage());
  }

  /** A lifecycle action runs when its status allows it and the member can write. */
  protected allowed(action: LifecycleAction): boolean {
    return action.enabled && this.permissions.canWrite(STATUTORY_FINANCIALS_MODULE);
  }

  protected selectTab(index: number): void {
    const tab = WORKSPACE_TABS[index];
    if (tab !== undefined) {
      void this.router.navigate(['/statutory-financials', this.id, tab]);
    }
  }

  protected openFiling(): void {
    this.reference.set('');
    this.filing.set(true);
  }

  protected async file(): Promise<void> {
    await this.transition('filed', this.reference().trim());
    if (this.failure() === null) {
      this.filing.set(false);
    }
  }

  protected async transition(target: SfTransitionTarget, reference?: string): Promise<void> {
    const outcome = await this.store.transition(target, reference);
    this.failure.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('statutoryFinancials.message.transitioned'));
    }
  }
}
