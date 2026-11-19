import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { I18nService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { Observable } from 'rxjs';
import { ActionFormComponent, ActionFormConfig } from '../hr/shared/action-form/action-form.component';
import { CrudTableComponent } from '../hr/shared/crud/crud-table.component';
import { reportHttpError, saveBlob } from '../hr/shared/hr-http.util';
import { HubTab } from './hub.types';
import { HubValueComponent } from './hub-value.component';

/** One tab of a hub page: the widget that fits its kind. */
@Component({
  selector: 'app-hub-panel',
  imports: [ActionFormComponent, CrudTableComponent, HubValueComponent, NzButtonModule, TranslatePipe],
  styles: [
    '.hint { margin-bottom: var(--space-3); color: var(--text-secondary); } .result { margin-top: var(--space-4); } .file { margin-bottom: var(--space-3); display: block; }',
  ],
  template: `
    @let t = tab();
    @if (t.hint) {
      <p class="hint">{{ t.hint | translate }}</p>
    }
    @switch (t.kind) {
      @case ('crud') {
        <app-crud-table [config]="crudConfig()" />
      }
      @case ('report') {
        @if (hasFields()) {
          <app-action-form [config]="formConfig()" (submitted)="result.set($event)" />
        } @else {
          <button nz-button type="button" (click)="refresh()">{{ 'COMMON.REFRESH' | translate }}</button>
        }
        <div class="result"><app-hub-value [value]="result()" /></div>
      }
      @case ('form') {
        <app-action-form [config]="formConfig()" [canWrite]="canWrite()" (submitted)="result.set($event)" />
        @if (result() !== null) {
          <div class="result"><app-hub-value [value]="result()" /></div>
        }
      }
      @case ('download') {
        <app-action-form [config]="formConfig()" (submitted)="saveFile($event)" />
      }
      @case ('upload') {
        <label class="file">
          <span>{{ 'COMMON.FILE' | translate }}</span>
          <input type="file" [attr.accept]="accept()" (change)="pick($event)" />
        </label>
        <app-action-form [config]="formConfig()" [canWrite]="canWrite()" (submitted)="result.set($event)" />
        @if (result() !== null) {
          <div class="result"><app-hub-value [value]="result()" /></div>
        }
      }
    }
  `,
})
export class HubPanelComponent {
  readonly tab = input.required<HubTab>();

  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private file: File | null = null;

  protected readonly result = signal<unknown>(null);
  protected readonly crudConfig = computed(() => {
    const t = this.tab();
    return t.kind === 'crud' ? t.config : (null as never);
  });
  protected readonly hasFields = computed(() => {
    const t = this.tab();
    return t.kind === 'report' && (t.filters?.length ?? 0) > 0;
  });
  protected readonly canWrite = computed(() => {
    const t = this.tab();
    return (t.kind === 'form' || t.kind === 'upload') && (t.canWrite ?? true);
  });
  protected readonly accept = computed(() => {
    const t = this.tab();
    return t.kind === 'upload' ? (t.accept ?? null) : null;
  });
  protected readonly formConfig = computed<ActionFormConfig>(() => {
    const t = this.tab();
    switch (t.kind) {
      case 'report':
        return { fields: t.filters ?? [], submitLabelKey: 'COMMON.SHOW', successKey: 'COMMON.UPDATED', submit: (p) => t.load(p) };
      case 'form':
        return { fields: t.fields, submitLabelKey: t.submitLabel, successKey: 'COMMON.COMPLETED', resetOnSuccess: t.resetOnSuccess, submit: (p) => t.submit(p) };
      case 'download':
        return {
          fields: t.fields,
          submitLabelKey: t.buttonLabel,
          successKey: 'COMMON.DOWNLOAD_READY',
          submit: (p) => t.download(p) as Observable<unknown>,
        };
      case 'upload':
        return {
          fields: t.fields,
          submitLabelKey: t.buttonLabel,
          successKey: 'COMMON.FILE_UPLOADED',
          validate: () => (this.file ? null : 'COMMON.SELECT_FILE'),
          submit: (p) => t.upload(Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])), this.file as File),
        };
      default:
        return { fields: [], submitLabelKey: '', submit: () => new Observable() };
    }
  });

  constructor() {
    effect(() => {
      const t = this.tab();
      if (t.kind === 'report' && !t.filters?.length) {
        untracked(() => this.refresh());
      }
    });
  }

  protected refresh(): void {
    const t = this.tab();
    if (t.kind === 'report') {
      t.load({}).subscribe({
        next: (value) => this.result.set(value),
        error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
      });
    }
  }

  protected pick(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.item(0) ?? null;
  }

  protected saveFile(blob: unknown): void {
    const t = this.tab();
    if (t.kind === 'download' && blob instanceof Blob) {
      saveBlob(blob, t.fileName);
    }
  }
}

/** A page made of tabs, each one a list, a report, a form, a download or an upload bound to endpoints of the module. */
@Component({
  selector: 'app-hub-page',
  imports: [HubPanelComponent, NzCardModule, NzTabsModule, PageHeaderComponent, TranslatePipe],
  template: `
    <app-page-header [title]="title() | translate" [subtitle]="subtitle() | translate" />
    <nz-card>
      <nz-tabs [nzSelectedIndex]="selected()" (nzSelectedIndexChange)="selected.set($event)">
        @for (t of tabs(); track t.title) {
          <nz-tab [nzTitle]="t.title | translate">
            <ng-template nzTabContent>
              <app-hub-panel [tab]="t" />
            </ng-template>
          </nz-tab>
        }
      </nz-tabs>
    </nz-card>
  `,
})
export class HubPageComponent {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly tabs = input.required<HubTab[]>();
  protected readonly selected = signal(0);
}
