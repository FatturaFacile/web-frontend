import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { DC_LOCALES, DcTemplate, PermissionsService } from '@core';
import { TranslatePipe } from '@shared';
import { DcFeedback } from './dc-feedback.service';
import { DEBT_COLLECTION_MODULE } from './debt-collection.util';
import { DcLookupsStore } from './lookups.store';
import { SettingsStore } from './settings.store';

/** The `{{placeholders}}` a template body uses, in order of appearance and without duplicates. */
export function placeholdersOf(text: string): string[] {
  return [
    ...new Set([...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((match) => match[1] ?? '')),
  ].filter(Boolean);
}

/** Notice templates per code, language and jurisdiction. Editing a global template saves a tenant override of it. */
@Component({
  selector: 'app-dc-templates',
  imports: [
    FormsModule,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  styleUrl: './debt-collection.scss',
  template: `
    <div class="toolbar">
      <label class="field" for="dc-t-code">
        <span>{{ 'debtCollection.template.code' | translate }}</span>
        <nz-select
          nzId="dc-t-code"
          nzAllowClear
          [nzPlaceHolder]="'debtCollection.action.all' | translate"
          [ngModel]="store.templateFilter().code"
          (ngModelChange)="store.setTemplateFilter({ code: $event ?? null })"
        >
          @for (code of lookups.lookups().template_codes; track code) {
            <nz-option [nzValue]="code" [nzLabel]="code" />
          }
        </nz-select>
      </label>
      <label class="field" for="dc-t-locale">
        <span>{{ 'debtCollection.field.locale' | translate }}</span>
        <nz-select
          nzId="dc-t-locale"
          nzAllowClear
          [nzPlaceHolder]="'debtCollection.action.all' | translate"
          [ngModel]="store.templateFilter().locale"
          (ngModelChange)="store.setTemplateFilter({ locale: $event ?? null })"
        >
          @for (value of locales; track value) {
            <nz-option [nzValue]="value" [nzLabel]="'debtCollection.locale.' + value | translate" />
          }
        </nz-select>
      </label>
    </div>

    <nz-table #table nzSize="small" [nzData]="store.templates()" [nzShowPagination]="false">
      <thead>
        <tr>
          <th scope="col">{{ 'debtCollection.template.code' | translate }}</th>
          <th scope="col">{{ 'debtCollection.field.locale' | translate }}</th>
          <th scope="col">{{ 'debtCollection.field.jurisdiction' | translate }}</th>
          <th scope="col">{{ 'debtCollection.template.subject' | translate }}</th>
          <th scope="col"></th>
        </tr>
      </thead>
      <tbody>
        @for (template of table.data; track template.id) {
          <tr>
            <th scope="row">
              <span class="mono">{{ template.code }}</span>
              @if (template.is_global) {
                <nz-tag>{{ 'debtCollection.rate.global' | translate }}</nz-tag>
              } @else {
                <nz-tag nzColor="blue">{{ 'debtCollection.template.override' | translate }}</nz-tag>
              }
            </th>
            <td>{{ 'debtCollection.locale.' + template.locale | translate }}</td>
            <td>{{ 'debtCollection.jurisdiction.' + template.jurisdiction | translate }}</td>
            <td>{{ template.subject }}</td>
            <td>
              <button nz-button nzSize="small" type="button" (click)="edit(template)">
                {{
                  canWrite
                    ? ('debtCollection.action.edit' | translate)
                    : ('debtCollection.action.details' | translate)
                }}
              </button>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>
    @if (store.templates().length === 0) {
      <nz-empty [nzNotFoundContent]="'debtCollection.template.empty' | translate" />
    }

    <nz-modal
      nzWidth="760px"
      [nzVisible]="editing() !== null"
      [nzTitle]="'debtCollection.template.editor' | translate"
      [nzOkText]="'debtCollection.action.save' | translate"
      [nzCancelText]="'debtCollection.action.cancel' | translate"
      [nzOkDisabled]="!canWrite || subject().trim() === '' || body().trim() === ''"
      [nzOkLoading]="store.saving()"
      (nzOnOk)="save()"
      (nzOnCancel)="editing.set(null)"
    >
      <ng-container *nzModalContent>
        @if (editing(); as template) {
          @if (template.is_global && canWrite) {
            <nz-alert
              class="feedback"
              nzType="info"
              nzShowIcon
              [nzMessage]="'debtCollection.template.overrideHint' | translate"
            />
          }
          <div class="stack">
            <label class="field" for="dc-t-subject">
              <span>{{ 'debtCollection.template.subject' | translate }}</span>
              <input
                nz-input
                id="dc-t-subject"
                maxlength="255"
                [disabled]="!canWrite"
                [ngModel]="subject()"
                (ngModelChange)="subject.set($event)"
              />
            </label>
            <label class="field" for="dc-t-body">
              <span>{{ 'debtCollection.template.body' | translate }}</span>
              <textarea
                nz-input
                id="dc-t-body"
                rows="14"
                [disabled]="!canWrite"
                [ngModel]="body()"
                (ngModelChange)="body.set($event)"
              ></textarea>
            </label>
            <div>
              <span class="muted">{{ 'debtCollection.template.placeholders' | translate }}</span>
              <div class="inline-tags">
                @for (name of placeholders(); track name) {
                  <nz-tag class="mono">{{ tag(name) }}</nz-tag>
                }
              </div>
            </div>
          </div>
        }
      </ng-container>
    </nz-modal>
  `,
})
export class DcTemplatesComponent {
  protected readonly store = inject(SettingsStore);
  protected readonly lookups = inject(DcLookupsStore);
  private readonly feedback = inject(DcFeedback);

  protected readonly canWrite = inject(PermissionsService).canWrite(DEBT_COLLECTION_MODULE);
  protected readonly locales = DC_LOCALES;

  protected readonly editing = signal<DcTemplate | null>(null);
  protected readonly subject = signal('');
  protected readonly body = signal('');
  protected readonly placeholders = computed(() =>
    placeholdersOf(`${this.subject()}\n${this.body()}`),
  );

  protected tag(name: string): string {
    return `{{${name}}}`;
  }

  protected edit(template: DcTemplate): void {
    this.subject.set(template.subject);
    this.body.set(template.body);
    this.editing.set(template);
  }

  protected async save(): Promise<void> {
    const template = this.editing();
    if (!template) {
      return;
    }
    if (
      this.feedback.report(
        await this.store.saveTemplate(template.id, this.subject(), this.body()),
        'debtCollection.msg.saved',
      )
    ) {
      this.editing.set(null);
    }
  }
}
