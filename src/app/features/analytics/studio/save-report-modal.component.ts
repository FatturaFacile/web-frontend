import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  OnInit,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { SettingsApiService, StudioVisibility } from '@core';
import { TranslatePipe, RadioControlDirective } from '@shared';
import { VISIBILITY_KEYS } from './studio-keys';

export interface SaveReportChoice {
  name: string;
  description: string | null;
  visibility: StudioVisibility;
  sharedRoleIds: string[];
}

/** The Save report dialog: a name, a description and who can open the report (only me, some roles, the company). */
@Component({
  selector: 'app-save-report-modal',
  imports: [
    RadioControlDirective,
    FormsModule,
    NzButtonModule,
    NzInputModule,
    NzModalModule,
    NzRadioModule,
    NzSelectModule,
    TranslatePipe,
  ],
  template: `
    <nz-modal
      [nzVisible]="visible()"
      [nzTitle]="'ANALYTICS_STUDIO.SAVE_TITLE' | translate"
      [nzFooter]="footer"
      (nzOnCancel)="visible.set(false)"
      nzWidth="520px"
    >
      <ng-container *nzModalContent>
        @if (errorText(); as text) {
          <p class="error" role="alert">{{ text }}</p>
        }
        <div class="field">
          <label for="save-name">{{ 'ANALYTICS_STUDIO.SAVE_NAME' | translate }}</label>
          <input
            id="save-name"
            nz-input
            [ngModel]="name()"
            (ngModelChange)="name.set($event)"
            maxlength="150"
          />
        </div>
        <div class="field">
          <label for="save-description">{{
            'ANALYTICS_STUDIO.SAVE_DESCRIPTION' | translate
          }}</label>
          <textarea
            id="save-description"
            nz-input
            rows="2"
            [ngModel]="description()"
            (ngModelChange)="description.set($event)"
            maxlength="2000"
          ></textarea>
        </div>
        <fieldset class="field">
          <legend>{{ 'ANALYTICS_STUDIO.SAVE_VISIBILITY' | translate }}</legend>
          <nz-radio-group
            [ngModel]="visibility()"
            (ngModelChange)="visibility.set($event)"
            class="vertical"
          >
            @for (item of visibilities(); track item) {
              <label [attr.for]="'save-report-modal-field-' + $index" appRadioControl nz-radio [nzValue]="item">{{ visibilityKeys[item] | translate }}</label>
            }
          </nz-radio-group>
        </fieldset>
        @if (visibility() === 'role_shared') {
          <div class="field">
            <label for="save-roles">{{ 'ANALYTICS_STUDIO.SAVE_ROLES' | translate }}</label>
            <nz-select
              id="save-roles"
              nzMode="multiple"
              [ngModel]="roles()"
              (ngModelChange)="roles.set($event)"
            >
              @for (role of knownRoles(); track role) {
                <nz-option [nzValue]="role" [nzLabel]="role"></nz-option>
              }
            </nz-select>
          </div>
        }
      </ng-container>
      <ng-template #footer>
        <button nz-button type="button" (click)="visible.set(false)">
          {{ 'ANALYTICS_STUDIO.CANCEL' | translate }}
        </button>
        <button
          nz-button
          nzType="primary"
          type="button"
          [nzLoading]="saving()"
          [disabled]="!canConfirm()"
          (click)="confirm()"
          data-testid="save-confirm"
        >
          {{ 'ANALYTICS_STUDIO.SAVE_CONFIRM' | translate }}
        </button>
      </ng-template>
    </nz-modal>
  `,
  styles: [
    '.field{display:flex;flex-direction:column;gap:4px;margin-bottom:12px;border:0;padding:0}legend{font-weight:600}.vertical{display:flex;flex-direction:column;gap:6px}.error{color:#a8071a}',
  ],
})
export class SaveReportModalComponent implements OnInit {
  private readonly settingsApi = inject(SettingsApiService);

  readonly visible = model(false);
  readonly visibilities = input<StudioVisibility[]>(['private', 'role_shared', 'tenant_public']);
  readonly initial = input<SaveReportChoice | null>(null);
  readonly saving = input(false);
  readonly errorText = input<string | null>(null);
  readonly confirmed = output<SaveReportChoice>();

  protected readonly visibilityKeys = VISIBILITY_KEYS;
  readonly name = signal('');
  readonly description = signal('');
  readonly visibility = signal<StudioVisibility>('private');
  readonly roles = signal<string[]>([]);
  readonly knownRoles = signal<string[]>([]);
  readonly canConfirm = computed(
    () =>
      this.name().trim() !== '' && (this.visibility() !== 'role_shared' || this.roles().length > 0),
  );

  constructor() {
    effect(() => {
      if (this.visible()) {
        untracked(() => {
          const initial = this.initial();
          this.name.set(initial?.name ?? '');
          this.description.set(initial?.description ?? '');
          this.visibility.set(initial?.visibility ?? 'private');
          this.roles.set(initial?.sharedRoleIds ?? []);
        });
      }
    });
  }

  ngOnInit(): void {
    this.settingsApi.getTenantUsers().subscribe({
      next: (response) =>
        this.knownRoles.set([...new Set(response.data.map((user) => user.role))].sort()),
      error: () => this.knownRoles.set([]),
    });
  }

  confirm(): void {
    if (!this.canConfirm()) {
      return;
    }
    this.confirmed.emit({
      name: this.name().trim(),
      description: this.description().trim() === '' ? null : this.description().trim(),
      visibility: this.visibility(),
      sharedRoleIds: this.visibility() === 'role_shared' ? this.roles() : [],
    });
  }
}
