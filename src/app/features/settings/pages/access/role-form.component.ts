import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CustomRole, I18nService, MemberModuleLevels, SaveCustomRolePayload } from '@core';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { systemRoleLabel } from './access-ui.util';
import { ModuleLevelsEditorComponent } from './module-levels-editor.component';

/** Name, description, base system role and the level of every module of a custom role. */
@Component({
  selector: 'app-role-form',
  imports: [FormsModule, NzButtonModule, NzInputModule, NzSelectModule, ModuleLevelsEditorComponent, TranslatePipe],
  template: `
    <label for="role-name">{{ 'access.roles.name' | translate }}</label>
    <input
      id="role-name"
      nz-input
      class="mb-3"
      maxlength="120"
      autocomplete="off"
      [ngModel]="name()"
      (ngModelChange)="name.set($event)"
    />

    <label for="role-description">{{ 'access.roles.description' | translate }}</label>
    <textarea
      id="role-description"
      nz-input
      class="mb-3"
      rows="2"
      maxlength="500"
      [ngModel]="description()"
      (ngModelChange)="description.set($event)"
    ></textarea>

    <label for="role-base">{{ 'access.roles.baseRole' | translate }}</label>
    <nz-select id="role-base" class="mb-1 w-100" [ngModel]="baseRole()" (ngModelChange)="baseRole.set($event)">
      @for (value of baseRoles(); track value) {
        <nz-option [nzValue]="value" [nzLabel]="roleLabel(value)" />
      }
    </nz-select>
    <p class="text-xs mb-3">{{ 'access.roles.baseRoleHint' | translate }}</p>

    <h4>{{ 'memberAccess.modulesTitle' | translate }}</h4>
    <p class="text-xs">{{ 'access.roles.modulesHint' | translate }}</p>
    <app-module-levels-editor [modules]="modules()" [(value)]="levels" />

    <div class="mt-3">
      <button
        nz-button
        nzType="primary"
        type="button"
        data-test="save-role"
        [nzLoading]="saving()"
        [disabled]="!canSave()"
        (click)="submit()"
      >
        {{ 'memberAccess.save' | translate }}
      </button>
    </div>
  `,
})
export class RoleFormComponent {
  private readonly i18n = inject(I18nService);

  readonly role = input<CustomRole | null>(null);
  readonly baseRoles = input.required<readonly string[]>();
  readonly modules = input.required<readonly string[]>();
  readonly saving = input(false);
  readonly saved = output<SaveCustomRolePayload>();

  protected readonly name = linkedSignal(() => this.role()?.name ?? '');
  protected readonly description = linkedSignal(() => this.role()?.description ?? '');
  protected readonly baseRole = linkedSignal(() => this.role()?.base_role ?? this.baseRoles()[0] ?? 'member');
  protected readonly levels = linkedSignal<MemberModuleLevels>(() => ({ ...(this.role()?.modules ?? {}) }));

  protected readonly canSave = computed(() => !this.saving() && this.name().trim() !== '');

  protected roleLabel(role: string): string {
    return systemRoleLabel(this.i18n, role);
  }

  protected submit(): void {
    const modules: MemberModuleLevels = {};
    for (const module of this.modules()) {
      modules[module] = this.levels()[module] ?? 'default';
    }
    this.saved.emit({
      name: this.name().trim(),
      description: this.description().trim() || null,
      base_role: this.baseRole(),
      modules,
    });
  }
}
