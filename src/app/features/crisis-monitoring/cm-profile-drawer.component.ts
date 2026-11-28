import { Component, computed, inject, model, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { CrisisProfile, CrisisProfileMoneyKey, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { CrisisMonitoringStore } from './crisis-monitoring.store';
import {
  CRISIS_JURISDICTIONS,
  CRISIS_LEGAL_FORMS,
  PROFILE_ARREARS_FIELDS,
  PROFILE_MONEY_FIELDS,
  PROFILE_OVERRIDE_FIELDS,
} from './crisis-monitoring.util';

/** Profile and settings drawer: legal entity data, optional manual overrides, public creditor arrears and asset values. */
@Component({
  selector: 'app-cm-profile-drawer',
  imports: [
    FormsModule,
    TranslatePipe,
    NzButtonModule,
    NzDrawerModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzSwitchModule,
    NzTagModule,
  ],
  styleUrl: './crisis-monitoring.scss',
  template: `
    <nz-drawer
      [nzVisible]="open()"
      [nzWidth]="560"
      [nzTitle]="'crisis.profile.title' | translate"
      (nzOnClose)="open.set(false)"
    >
      <ng-container *nzDrawerContent>
        @if (draft(); as profile) {
          <div data-testid="cm-profile-form">
            <h4>{{ 'crisis.profile.section.entity' | translate }}</h4>
            <div class="cm-form-grid">
              <div class="cm-field">
                <label for="cm-profile-jurisdiction">
                  {{ 'crisis.profile.jurisdiction' | translate }}
                </label>
                <nz-select
                  nzId="cm-profile-jurisdiction"
                  [ngModel]="profile.jurisdiction"
                  (ngModelChange)="patch({ jurisdiction: $event })"
                >
                  @for (code of jurisdictions; track code) {
                    <nz-option
                      [nzValue]="code"
                      [nzLabel]="'crisis.jurisdiction.' + code | translate"
                    />
                  }
                </nz-select>
              </div>
              <div class="cm-field">
                <label for="cm-profile-ateco">{{ 'crisis.profile.atecoCode' | translate }}</label>
                <input
                  nz-input
                  id="cm-profile-ateco"
                  maxlength="12"
                  [ngModel]="profile.ateco_code ?? ''"
                  (ngModelChange)="patch({ ateco_code: $event === '' ? null : $event })"
                />
                @if (sectionLabel(); as label) {
                  <nz-tag data-testid="cm-profile-section">
                    {{ profile.ateco_section }} - {{ label | translate }}
                  </nz-tag>
                }
              </div>
              <div class="cm-field">
                <label for="cm-profile-legal">{{ 'crisis.profile.legalForm' | translate }}</label>
                <nz-select
                  nzId="cm-profile-legal"
                  [ngModel]="profile.legal_form"
                  (ngModelChange)="patch({ legal_form: $event })"
                >
                  @for (code of legalForms; track code) {
                    <nz-option
                      [nzValue]="code"
                      [nzLabel]="'crisis.legalForm.' + code | translate"
                    />
                  }
                </nz-select>
              </div>
              <div class="cm-field">
                <label for="cm-profile-employees">
                  {{ 'crisis.profile.employees' | translate }}
                </label>
                <nz-input-number
                  nzId="cm-profile-employees"
                  [nzMin]="0"
                  [nzStep]="1"
                  [ngModel]="profile.employees_count"
                  (ngModelChange)="patch({ employees_count: $event ?? 0 })"
                />
              </div>
              <div class="cm-field">
                <label for="cm-profile-going-concern">
                  {{ 'crisis.profile.goingConcernProbable' | translate }}
                </label>
                <nz-switch
                  nzId="cm-profile-going-concern"
                  [ngModel]="profile.going_concern_probable"
                  (ngModelChange)="patch({ going_concern_probable: $event })"
                />
              </div>
            </div>

            <h4>{{ 'crisis.profile.section.figures' | translate }}</h4>
            <div class="cm-form-grid">
              @for (key of moneyFields; track key) {
                <div class="cm-field">
                  <label [for]="'cm-profile-' + key">{{
                    'crisis.profile.' + key | translate
                  }}</label>
                  <input
                    nz-input
                    [id]="'cm-profile-' + key"
                    inputmode="decimal"
                    [ngModel]="profile[key] ?? ''"
                    (ngModelChange)="setMoney(key, $event)"
                  />
                </div>
              }
            </div>

            <h4>{{ 'crisis.profile.section.arrears' | translate }}</h4>
            <div class="cm-form-grid">
              @for (key of arrearsFields; track key) {
                <div class="cm-field">
                  <label [for]="'cm-profile-' + key">{{
                    'crisis.profile.' + key | translate
                  }}</label>
                  <input
                    nz-input
                    [id]="'cm-profile-' + key"
                    inputmode="decimal"
                    [ngModel]="profile[key] ?? ''"
                    (ngModelChange)="setMoney(key, $event)"
                  />
                </div>
              }
            </div>

            <h4>{{ 'crisis.profile.section.overrides' | translate }}</h4>
            <p class="cm-note">{{ 'crisis.profile.overridesHint' | translate }}</p>
            <div class="cm-form-grid">
              @for (key of overrideFields; track key) {
                <div class="cm-field">
                  <label [for]="'cm-profile-' + key">{{
                    'crisis.profile.' + key | translate
                  }}</label>
                  <input
                    nz-input
                    [id]="'cm-profile-' + key"
                    inputmode="decimal"
                    [ngModel]="profile[key] ?? ''"
                    (ngModelChange)="setMoney(key, $event)"
                  />
                </div>
              }
            </div>

            <div class="cm-actions">
              <button
                nz-button
                nzType="primary"
                [nzLoading]="store.saving()"
                data-testid="cm-save-profile"
                (click)="save()"
              >
                {{ 'crisis.profile.save' | translate }}
              </button>
              <button nz-button (click)="open.set(false)">
                {{ 'crisis.profile.cancel' | translate }}
              </button>
            </div>
          </div>
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class CmProfileDrawerComponent {
  protected readonly store = inject(CrisisMonitoringStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  readonly open = model(false);

  protected readonly jurisdictions = CRISIS_JURISDICTIONS;
  protected readonly legalForms = CRISIS_LEGAL_FORMS;
  protected readonly moneyFields = PROFILE_MONEY_FIELDS;
  protected readonly arrearsFields = PROFILE_ARREARS_FIELDS;
  protected readonly overrideFields = PROFILE_OVERRIDE_FIELDS;

  protected readonly draft = signal<CrisisProfile | null>(null);

  protected readonly sectionLabel = computed(() => {
    const section = this.draft()?.ateco_section ?? null;

    return (
      this.store.metadata()?.ateco_sections.find((entry) => entry.section === section)?.label_key ??
      null
    );
  });

  constructor() {
    effect(() => {
      const profile = this.store.profile();

      if (profile !== null && this.open()) {
        this.draft.set({ ...profile });
      }
    });
  }

  protected patch(patch: Partial<CrisisProfile>): void {
    this.draft.update((current) => (current === null ? current : { ...current, ...patch }));
  }

  protected setMoney(key: CrisisProfileMoneyKey, value: string): void {
    this.patch({ [key]: value.trim() === '' ? null : value.trim() } as Partial<CrisisProfile>);
  }

  protected async save(): Promise<void> {
    const profile = this.draft();

    if (profile === null) {
      return;
    }
    const outcome = await this.store.saveProfile(profile);

    if (outcome.ok) {
      this.open.set(false);
      this.message.success(this.i18n.translate('crisis.profile.saved'));
    } else {
      this.message.error(this.i18n.translate(outcome.error ?? 'crisis.error.generic'));
    }
  }
}
