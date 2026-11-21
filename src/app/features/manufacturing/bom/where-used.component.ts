import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { BomItemPickerComponent } from './bom-item-picker.component';
import { MassReplaceInput, WhereUsedStore } from './where-used.store';

const pathText = (path: string[] | string): string => (Array.isArray(path) ? path.join(' › ') : path);
const entryLabel = (entry: Record<string, unknown>): string =>
  String(entry['bom_number'] ?? entry['bom_id'] ?? '');

/**
 * Where-used impact analyzer: search an item, see the upward tree of every assembly that consumes it (down to the top-level
 * products) and replace it with a substitute across all BOMs, always previewing with a dry run first.
 */
@Component({
  selector: 'app-where-used',
  providers: [WhereUsedStore],
  imports: [
    DecimalPipe,
    NgTemplateOutlet,
    FormsModule,
    PageHeaderComponent,
    TranslatePipe,
    BomItemPickerComponent,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzInputModule,
    NzTableModule,
    NzTagModule,
  ],
  styles: `
    .row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 16px }
    .grow { flex: 1 1 280px }
    .replace { margin-top: 24px }
    .results { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 16px }
    .num { text-align: right; font-variant-numeric: tabular-nums }
  `,
  template: `
    <app-page-header
      [title]="'MFG_BOM.WHERE_USED_TITLE' | translate"
      [subtitle]="'MFG_BOM.WHERE_USED_SUBTITLE' | translate"
    ></app-page-header>

    <div class="row">
      <div class="grow">
        <app-bom-item-picker placeholder="MFG_BOM.SEARCH_ITEM" [(value)]="itemId"></app-bom-item-picker>
      </div>
      <button nz-button nzType="primary" type="button" data-testid="analyze" [disabled]="!itemId() || store.loading()" [nzLoading]="store.loading()" (click)="analyze()">
        {{ 'MFG_BOM.ANALYZE' | translate }}
      </button>
    </div>

    @if (store.implosion(); as implosion) {
      @if (store.parents().length === 0) {
        <nz-empty [nzNotFoundContent]="'MFG_BOM.NO_PARENTS' | translate"></nz-empty>
      } @else {
        <nz-card [nzTitle]="'MFG_BOM.UPWARD_TREE' | translate">
          <p data-testid="impact-summary">
            {{ 'MFG_BOM.IMPACT_SUMMARY' | translate: { parents: store.parents().length, top: store.topLevel().length } }}
          </p>
          <nz-table nzSize="small" [nzData]="store.parents()" [nzFrontPagination]="false" [nzShowPagination]="false">
            <thead>
              <tr>
                <th scope="col">{{ 'MFG_BOM.COL_PARENT' | translate }}</th>
                <th scope="col">{{ 'MFG_BOM.COL_PATH' | translate }}</th>
                <th scope="col" class="num">{{ 'MFG_BOM.COL_COEFFICIENT' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (parent of store.parents(); track $index) {
                <tr [attr.data-testid]="'parent-' + parent.parent_item_code">
                  <td>
                    <span [style.padding-left.px]="(parent.level - 1) * 20">
                      <strong>{{ parent.parent_item_code }}</strong>
                      @if (parent.is_top_level) {
                        <nz-tag nzColor="blue">{{ 'MFG_BOM.TOP_LEVEL' | translate }}</nz-tag>
                      }
                    </span>
                  </td>
                  <td>{{ path(parent.path) }}</td>
                  <td class="num">{{ parent.cumulative_coefficient | number: '1.0-6' }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-card>
      }

      <nz-card class="replace" [nzTitle]="'MFG_BOM.MASS_REPLACE' | translate">
        <div class="row">
          <div class="grow">
            <app-bom-item-picker placeholder="MFG_BOM.SUBSTITUTE_ITEM" [(value)]="substituteId"></app-bom-item-picker>
          </div>
          <input
            nz-input
            class="grow"
            [placeholder]="'MFG_BOM.REPLACE_REASON' | translate"
            [attr.aria-label]="'MFG_BOM.REPLACE_REASON' | translate"
            [ngModel]="reason()"
            (ngModelChange)="reason.set($event)"
            data-testid="replace-reason"
          />
          <input
            nz-input
            type="date"
            [attr.aria-label]="'MFG_BOM.EFFECTIVE_FROM' | translate"
            [ngModel]="effectiveFrom()"
            (ngModelChange)="effectiveFrom.set($event)"
          />
        </div>
        <div class="row">
          <button nz-button type="button" data-testid="dry-run" [disabled]="!formValid() || store.replacing()" (click)="dryRun()">
            {{ 'MFG_BOM.DRY_RUN' | translate }}
          </button>
          <button nz-button nzType="primary" nzDanger type="button" data-testid="run-replace" [disabled]="!store.canRun()" (click)="run()">
            {{ 'MFG_BOM.RUN_REPLACE' | translate }}
          </button>
        </div>

        @if (store.dryRun(); as preview) {
          <nz-alert
            nzType="info"
            nzShowIcon
            data-testid="dry-run-result"
            [nzMessage]="'MFG_BOM.DRY_RUN_RESULT' | translate: { replaced: preview.replaced.length, skipped: preview.skipped.length }"
          ></nz-alert>
          <ng-container [ngTemplateOutlet]="outcome" [ngTemplateOutletContext]="{ $implicit: preview }"></ng-container>
        }
        @if (store.result(); as done) {
          <nz-alert
            nzType="success"
            nzShowIcon
            data-testid="replace-result"
            [nzMessage]="'MFG_BOM.REPLACE_DONE' | translate: { replaced: done.replaced.length, skipped: done.skipped.length }"
          ></nz-alert>
          <ng-container [ngTemplateOutlet]="outcome" [ngTemplateOutletContext]="{ $implicit: done }"></ng-container>
        }
      </nz-card>
    }

    <ng-template #outcome let-data>
      <div class="results">
        <div>
          <h4>{{ 'MFG_BOM.REPLACED' | translate }}</h4>
          <ul>
            @for (entry of data.replaced; track $index) {
              <li>{{ label(entry) }}</li>
            }
          </ul>
        </div>
        <div>
          <h4>{{ 'MFG_BOM.SKIPPED' | translate }}</h4>
          <ul>
            @for (entry of data.skipped; track $index) {
              <li>{{ label(entry) }}@if (entry.reason) { — {{ entry.reason }} }</li>
            }
          </ul>
        </div>
      </div>
    </ng-template>
  `,
})
export class WhereUsedComponent {
  protected readonly store = inject(WhereUsedStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly itemId = signal<string | null>(null);
  protected readonly substituteId = signal<string | null>(null);
  protected readonly reason = signal('');
  protected readonly effectiveFrom = signal<string | null>(null);
  protected readonly formValid = computed(
    () => !!this.substituteId() && this.substituteId() !== this.store.itemId() && this.reason().trim().length > 0,
  );

  constructor() {
    // Keeps the store aware of the form, so a dry run made with other inputs stops enabling the replace.
    effect(() => this.store.setInput(this.input()));
  }

  protected path = pathText;
  protected label = entryLabel;

  protected analyze(): void {
    const id = this.itemId();
    if (!id) {
      return;
    }
    this.store
      .search(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => this.message.error(this.i18n.instant('MFG_BOM.ANALYZE_ERROR')) });
  }

  protected dryRun(): void {
    this.store
      .runDry(this.input())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => this.message.error(this.i18n.instant('MFG_BOM.REPLACE_ERROR')) });
  }

  protected run(): void {
    this.store
      .run(this.input())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => this.message.error(this.i18n.instant('MFG_BOM.REPLACE_ERROR')) });
  }

  private input(): MassReplaceInput {
    return {
      substituteItemId: this.substituteId() ?? '',
      reason: this.reason().trim(),
      effectiveFrom: this.effectiveFrom() || null,
    };
  }
}
