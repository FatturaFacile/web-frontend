import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService, MemberModuleLevels, ModuleAccessLevel, SaveTenantMemberPayload } from '@core';
import { TranslatePipe } from '@shared';
import { roleSelection, selectionPayload } from '../access/access-ui.util';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';

const LEVELS: readonly ModuleAccessLevel[] = ['default', 'blocked', 'read', 'write'];

/** Turns a code such as `fiscal_retail` into `Fiscal retail` when it has no translation. */
function humanize(code: string): string {
  const text = code.replace(/[_.-]+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Role and module access of a member: the role gives the baseline, and for every module the access can follow
 * the role (default), be closed (blocked), or be limited to reading or opened to writing.
 */
@Component({
  selector: 'app-member-access-form',
  imports: [FormsModule, NzButtonModule, NzInputModule, NzSelectModule, TranslatePipe],
  template: `
    @if (showEmail()) {
      <label for="ma-email">{{ 'memberAccess.email' | translate }}</label>
      <input
        id="ma-email"
        nz-input
        type="email"
        class="mb-3"
        maxlength="255"
        autocomplete="off"
        [ngModel]="email()"
        (ngModelChange)="email.set($event)"
      />
    }

    <label for="ma-role">{{ 'memberAccess.role' | translate }}</label>
    <nz-select
      id="ma-role"
      class="mb-3 w-100"
      [ngModel]="role()"
      (ngModelChange)="role.set($event)"
    >
      @for (value of roles(); track value) {
        <nz-option [nzValue]="value" [nzLabel]="roleLabel(value)" />
      }
      @for (custom of customRoles(); track custom.id) {
        <nz-option [nzValue]="'custom:' + custom.id" [nzLabel]="custom.name" />
      }
    </nz-select>

    <h4>{{ 'memberAccess.modulesTitle' | translate }}</h4>
    <p class="text-xs">{{ 'memberAccess.modulesHint' | translate }}</p>
    <div class="member-access-modules">
      @for (module of modules(); track module) {
        <div class="member-access-module" data-test="module-row">
          <span class="member-access-module-name">{{ moduleLabel(module) }}</span>
          <nz-select
            class="member-access-module-level"
            [attr.data-module]="module"
            [ngModel]="levels()[module] ?? 'default'"
            (ngModelChange)="setLevel(module, $event)"
          >
            @for (level of levelOptions; track level) {
              <nz-option [nzValue]="level" [nzLabel]="'memberAccess.levels.' + level | translate" />
            }
          </nz-select>
        </div>
      }
    </div>

    <div class="mt-3">
      <button
        nz-button
        nzType="primary"
        type="button"
        data-test="save-member"
        [nzLoading]="saving()"
        [disabled]="!canSave()"
        (click)="submit()"
      >
        {{ submitLabelKey() | translate }}
      </button>
    </div>
  `,
  styles: `
    .member-access-modules {
      max-height: 320px;
      overflow-y: auto;
    }
    .member-access-module {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 4px 0;
    }
    .member-access-module-level {
      width: 200px;
    }
  `,
})
export class MemberAccessFormComponent {
  private readonly i18n = inject(I18nService);

  readonly roles = input.required<readonly string[]>();
  readonly modules = input.required<readonly string[]>();
  readonly initialRole = input<string>('member');
  readonly initialModules = input<MemberModuleLevels>({});
  /** Custom roles the member can hold, listed after the system roles. */
  readonly customRoles = input<readonly { id: string; name: string }[]>([]);
  readonly initialCustomRoleId = input<string | null>(null);
  readonly showEmail = input(false);
  readonly saving = input(false);
  readonly submitLabelKey = input('memberAccess.save');
  readonly saved = output<SaveTenantMemberPayload>();

  protected readonly levelOptions = LEVELS;
  protected readonly email = signal('');
  /** A system role key, or `custom:<id>` for a custom role. */
  protected readonly role = linkedSignal<string>(() => roleSelection(this.initialRole(), this.initialCustomRoleId()));
  protected readonly levels = linkedSignal<MemberModuleLevels>(() => ({ ...this.initialModules() }));

  protected readonly canSave = computed(() => !this.saving() && (!this.showEmail() || this.email().trim() !== ''));

  protected roleLabel(role: string): string {
    return this.translated(`adminAccess.roles.${role}`) ?? humanize(role);
  }

  protected moduleLabel(module: string): string {
    return this.translated(`memberAccess.module.${module}`) ?? humanize(module);
  }

  protected setLevel(module: string, level: ModuleAccessLevel): void {
    this.levels.update((current) => ({ ...current, [module]: level }));
  }

  protected submit(): void {
    const modules: MemberModuleLevels = {};
    for (const module of this.modules()) {
      modules[module] = this.levels()[module] ?? 'default';
    }
    this.saved.emit({
      ...(this.showEmail() ? { email: this.email().trim() } : {}),
      ...selectionPayload(this.role()),
      modules,
    });
  }

  /** The translation, or `null` when the key has none (the service then returns the key itself). */
  private translated(key: string): string | null {
    const text = this.i18n.translate(key);
    return text === key ? null : text;
  }
}
