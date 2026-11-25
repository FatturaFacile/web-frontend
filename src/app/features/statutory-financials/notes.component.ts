import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PermissionsService, SfNotesTableName, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { NotesStore } from './notes.store';
import {
  MaturityEdit,
  NotesMaturityComponent,
  NotesRowsTableComponent,
} from './notes-tables.component';
import {
  isDecimal,
  isFallback,
  MATURITY_BUCKETS,
  MATURITY_GROUPS,
  NOTES_ADDABLE_TABLES,
  routeDossierId,
  rowsAreValid,
  SfOutcome,
  STATUTORY_FINANCIALS_MODULE,
  visibleNarrativeSections,
  visibleNotesTables,
} from './statutory-financials.util';
import { WorkspaceStore } from './workspace.store';

type Row = Record<string, unknown>;

/** One empty list, so an input bound to a missing table keeps the same value between change detections. */
const NO_ROWS: Row[] = [];

/**
 * The Nota Integrativa / Anhang workspace: populate the quantitative tables from the subledgers, edit the tables and the
 * narrative sections the standard calls for, and save what was edited.
 */
@Component({
  selector: 'app-sf-notes',
  imports: [
    FormsModule,
    NotesMaturityComponent,
    NotesRowsTableComponent,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCollapseModule,
    NzEmptyModule,
    NzInputModule,
    NzSpinModule,
    NzSwitchModule,
    NzTagModule,
    TranslatePipe,
  ],
  providers: [NotesStore],
  styleUrl: './statutory-financials.scss',
  template: `
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

    <div class="toolbar">
      <button
        nz-button
        nzType="primary"
        type="button"
        [disabled]="readOnly() || store.populating()"
        [nzLoading]="store.populating()"
        (click)="populate()"
      >
        {{ 'statutoryFinancials.action.populateNotes' | translate }}
      </button>
      <div class="field">
        <span id="sf-overwrite-label">{{
          'statutoryFinancials.field.overwriteNarrative' | translate
        }}</span>
        <nz-switch
          aria-labelledby="sf-overwrite-label"
          [disabled]="readOnly()"
          [ngModel]="overwrite()"
          (ngModelChange)="overwrite.set($event)"
        ></nz-switch>
      </div>
      <span class="spacer"></span>
      <button
        nz-button
        type="button"
        [disabled]="!store.dirty() || store.saving()"
        (click)="store.discard()"
      >
        {{ 'statutoryFinancials.action.discard' | translate }}
      </button>
      <button
        nz-button
        nzType="primary"
        type="button"
        [disabled]="readOnly() || !store.dirty() || !valid() || store.saving()"
        [nzLoading]="store.saving()"
        (click)="save()"
      >
        {{ 'statutoryFinancials.action.save' | translate }}
      </button>
    </div>

    <nz-spin [nzSpinning]="store.loading()">
      @if (!store.populated()) {
        <nz-empty [nzNotFoundContent]="'statutoryFinancials.empty.notes' | translate"></nz-empty>
      } @else {
        @if (sourceEntries().length > 0) {
          <nz-alert
            class="feedback"
            nzType="info"
            nzShowIcon
            [nzMessage]="'statutoryFinancials.notes.sources' | translate"
            [nzDescription]="sourcesTemplate"
          ></nz-alert>
          <ng-template #sourcesTemplate>
            <ul>
              @for (entry of sourceEntries(); track entry[0]) {
                <li>
                  <strong>{{ 'statutoryFinancials.notes.table.' + entry[0] | translate }}</strong>:
                  {{ entry[1] }}
                </li>
              }
            </ul>
          </ng-template>
        }

        @for (name of tableNames(); track name) {
          <nz-card
            class="main-card"
            [nzTitle]="'statutoryFinancials.notes.table.' + name | translate"
          >
            <div class="actions">
              @if (fallback(name)) {
                <nz-tag nzColor="orange">{{
                  'statutoryFinancials.notes.fallback' | translate
                }}</nz-tag>
              }
              @if (manual(name)) {
                <nz-tag nzColor="blue">{{ 'statutoryFinancials.notes.manual' | translate }}</nz-tag>
              }
              @if (store.sources()[name]; as source) {
                <nz-tag>{{ source }}</nz-tag>
              }
            </div>
            @if (name === 'maturity') {
              <app-sf-notes-maturity
                [table]="tableData(name)"
                [readOnly]="readOnly()"
                (changed)="editMaturity($event)"
              ></app-sf-notes-maturity>
            } @else {
              <app-sf-notes-rows-table
                [name]="name"
                [rows]="rowsOf(name)"
                [totals]="totalsOf(name)"
                [addable]="addable(name)"
                [readOnly]="readOnly()"
                (rowsChange)="store.setRows(name, $event)"
              ></app-sf-notes-rows-table>
            }
          </nz-card>
        }

        @if (sections().length > 0) {
          <h3 class="section-title">{{ 'statutoryFinancials.notes.narrative' | translate }}</h3>
          <nz-collapse>
            @for (section of sections(); track section.key) {
              <nz-collapse-panel [nzHeader]="section.title" [nzActive]="false">
                <div class="actions">
                  @if (section.edited || edited(section.key)) {
                    <nz-tag nzColor="blue">{{
                      'statutoryFinancials.notes.edited' | translate
                    }}</nz-tag>
                  }
                </div>
                <textarea
                  nz-input
                  rows="8"
                  [attr.aria-label]="section.title"
                  [disabled]="readOnly()"
                  [ngModel]="section.body"
                  (ngModelChange)="store.setSectionBody(section.key, $event)"
                ></textarea>
              </nz-collapse-panel>
            }
          </nz-collapse>
        }
      }
    </nz-spin>
  `,
})
export class NotesComponent implements OnInit {
  protected readonly store = inject(NotesStore);
  private readonly workspace = inject(WorkspaceStore);
  private readonly route = inject(ActivatedRoute);
  private readonly permissions = inject(PermissionsService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly failure = signal<SfOutcome | null>(null);
  protected readonly overwrite = signal(false);

  protected readonly readOnly = computed(
    () => !this.permissions.canWrite(STATUTORY_FINANCIALS_MODULE) || this.workspace.locked(),
  );
  /** Only the tables the standard lists, in its order. */
  protected readonly tableNames = computed(() =>
    visibleNotesTables(this.workspace.standardLookup()),
  );
  /** Only the narrative sections the standard lists, in its order. */
  protected readonly sections = computed(() =>
    visibleNarrativeSections(this.workspace.standardLookup(), this.store.sections()),
  );
  protected readonly sourceEntries = computed(() => Object.entries(this.store.sources()));
  /** Every edited table holds valid decimals. */
  protected readonly valid = computed(() =>
    this.store.dirtyTables().every((name) => {
      const table = (this.store.tables() as Record<string, Row | undefined>)[name];
      if (name === 'maturity') {
        return MATURITY_GROUPS.every((group) =>
          MATURITY_BUCKETS.every((bucket) => {
            const value = (table?.[group] as Record<string, unknown> | undefined)?.[bucket];
            return value === undefined || isDecimal(String(value));
          }),
        );
      }
      return rowsAreValid(name, (table?.['rows'] as Row[] | undefined) ?? []);
    }),
  );

  private get id(): string {
    return routeDossierId(this.route) ?? '';
  }

  ngOnInit(): void {
    void this.store.load(this.id);
  }

  protected tableData(name: SfNotesTableName): Row | null {
    return (
      ((this.store.tables() as Record<string, Row | undefined>)[name] as Row | undefined) ?? null
    );
  }

  protected rowsOf(name: SfNotesTableName): Row[] {
    return (this.tableData(name)?.['rows'] as Row[] | undefined) ?? NO_ROWS;
  }

  protected totalsOf(name: SfNotesTableName): Row | null {
    return (this.tableData(name)?.['totals'] as Row | undefined) ?? null;
  }

  protected addable(name: SfNotesTableName): boolean {
    return NOTES_ADDABLE_TABLES.includes(name);
  }

  protected fallback(name: SfNotesTableName): boolean {
    return isFallback(this.tableData(name) as { fallback?: boolean } | null);
  }

  protected manual(name: SfNotesTableName): boolean {
    return this.tableData(name)?.['manual'] === true;
  }

  protected edited(key: string): boolean {
    return this.store.dirtySections().includes(key);
  }

  protected editMaturity(edit: MaturityEdit): void {
    this.store.setMaturity(edit.group, edit.bucket, edit.value);
  }

  protected async populate(): Promise<void> {
    const outcome = await this.store.populate(this.id, this.overwrite());
    this.finish(outcome, 'populated');
    if (outcome.ok) {
      await this.workspace.refresh();
    }
  }

  protected async save(): Promise<void> {
    const outcome = await this.store.save(this.id);
    this.finish(outcome, 'saved');
    if (outcome.ok) {
      await this.workspace.refresh();
    }
  }

  private finish(outcome: SfOutcome, done: string): void {
    this.failure.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      this.message.success(this.i18n.instant(`statutoryFinancials.message.${done}`));
    }
  }
}
