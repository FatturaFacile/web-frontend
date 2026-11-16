import { Component, inject, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService, MemberModuleLevels, ModuleAccessLevel } from '@core';
import { TranslatePipe } from '@shared';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { moduleLabel } from './access-ui.util';

const LEVELS: readonly ModuleAccessLevel[] = ['default', 'blocked', 'read', 'write'];

/** One level (follow the base role, blocked, read, write) for every module. */
@Component({
  selector: 'app-module-levels-editor',
  imports: [FormsModule, NzSelectModule, TranslatePipe],
  template: `
    <div class="levels">
      @for (module of modules(); track module) {
        <div class="level-row" data-test="module-row">
          <span>{{ label(module) }}</span>
          <nz-select
            class="level-select"
            [attr.data-module]="module"
            [ngModel]="value()[module] ?? 'default'"
            (ngModelChange)="set(module, $event)"
          >
            @for (level of levels; track level) {
              <nz-option [nzValue]="level" [nzLabel]="'memberAccess.levels.' + level | translate" />
            }
          </nz-select>
        </div>
      }
    </div>
  `,
  styles: `
    .levels {
      max-height: 280px;
      overflow-y: auto;
    }
    .level-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 4px 0;
    }
    .level-select {
      width: 200px;
    }
  `,
})
export class ModuleLevelsEditorComponent {
  private readonly i18n = inject(I18nService);

  readonly modules = input.required<readonly string[]>();
  readonly value = model<MemberModuleLevels>({});
  protected readonly levels = LEVELS;

  protected label(module: string): string {
    return moduleLabel(this.i18n, module);
  }

  protected set(module: string, level: ModuleAccessLevel): void {
    this.value.update((current) => ({ ...current, [module]: level }));
  }
}
