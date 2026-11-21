import { Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@shared';
import { NzInputModule } from 'ng-zorro-antd/input';
import {
  bandColor,
  coerceInput,
  confidenceBand,
  percent,
  withCell,
  withField,
} from './ai-cognitive.utils';

type Row = Record<string, unknown>;

/**
 * Edits the payload of a proposal by its shape: plain values become inputs (a number stays a number), a list of rows (quote
 * items, order lines) becomes a table of inputs, and anything else (the customer block, the details of an alert) is shown as
 * read-only text. Each field carries the confidence of the model next to it, so the reviewer knows where to look first.
 */
@Component({
  selector: 'app-ai-payload-editor',
  imports: [TranslatePipe, NzInputModule],
  template: `
    <div class="payload-editor" data-testid="payload-editor">
      @for (field of fields(); track field.key) {
        <div class="field">
          <label [attr.for]="'ai-field-' + field.key">{{
            'AI_COG.FIELD_' + field.key.toUpperCase() | translate
          }}</label>
          <input
            nz-input
            nzSize="small"
            [id]="'ai-field-' + field.key"
            [attr.data-testid]="'field-' + field.key"
            [value]="text(field.value)"
            [readonly]="readonly()"
            (input)="editField(field.key, $event)"
          />
          @if (score(field.key); as value) {
            <span class="pill" [attr.data-band]="band(value)">{{ percentOf(value) }}</span>
          }
        </div>
      }

      @for (list of lists(); track list.key) {
        <div class="field-list">
          <strong>{{ 'AI_COG.FIELD_' + list.key.toUpperCase() | translate }}</strong>
          @if (score(list.key); as value) {
            <span class="pill" [attr.data-band]="band(value)">{{ percentOf(value) }}</span>
          }
          <table class="rows" [attr.data-testid]="'rows-' + list.key">
            <thead>
              <tr>
                @for (column of list.columns; track column) {
                  <th scope="col">{{ 'AI_COG.FIELD_' + column.toUpperCase() | translate }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of list.rows; track $index; let index = $index) {
                <tr>
                  @for (column of list.columns; track column) {
                    <td>
                      <input
                        nz-input
                        nzSize="small"
                        [attr.aria-label]="'AI_COG.FIELD_' + column.toUpperCase() | translate"
                        [attr.data-testid]="'cell-' + list.key + '-' + index + '-' + column"
                        [value]="text(row[column])"
                        [readonly]="readonly()"
                        (input)="editCell(list.key, index, column, $event)"
                      />
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @for (block of blocks(); track block.key) {
        <div class="field">
          <span class="label">{{ 'AI_COG.FIELD_' + block.key.toUpperCase() | translate }}</span>
          <code class="readonly-block" [attr.data-testid]="'block-' + block.key">{{
            block.text
          }}</code>
        </div>
      }
    </div>
  `,
})
export class AiPayloadEditorComponent {
  readonly payload = input.required<Row>();
  readonly readonly = input(false);
  /** Confidence of the model per field, 0 to 1. */
  readonly confidences = input<Record<string, number>>({});
  readonly payloadChange = output<Row>();

  protected readonly fields = computed(() =>
    Object.entries(this.payload())
      .filter(
        ([, value]) => value === null || ['string', 'number', 'boolean'].includes(typeof value),
      )
      .map(([key, value]) => ({ key, value })),
  );

  protected readonly lists = computed(() =>
    Object.entries(this.payload())
      .filter(([, value]) => isRowList(value))
      .map(([key, value]) => {
        const rows = value as Row[];

        return { key, rows, columns: [...new Set(rows.flatMap((row) => Object.keys(row)))] };
      }),
  );

  protected readonly blocks = computed(() =>
    Object.entries(this.payload())
      .filter(([, value]) => value !== null && typeof value === 'object' && !isRowList(value))
      .map(([key, value]) => ({ key, text: JSON.stringify(value) })),
  );

  protected text(value: unknown): string {
    return value === null || value === undefined ? '' : String(value);
  }

  protected score(key: string): number | null {
    return this.confidences()[key] ?? null;
  }

  protected band(score: number): string {
    return confidenceBand(score);
  }

  protected percentOf(score: number): string {
    return percent(score);
  }

  protected bandColor(score: number): string {
    return bandColor(confidenceBand(score));
  }

  protected editField(key: string, event: Event): void {
    const raw = (event.target as HTMLInputElement).value;

    this.payloadChange.emit(withField(this.payload(), key, coerceInput(this.payload()[key], raw)));
  }

  protected editCell(listKey: string, row: number, column: string, event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const previous = ((this.payload()[listKey] as Row[])[row] ?? {})[column];

    this.payloadChange.emit(
      withCell(this.payload(), listKey, row, column, coerceInput(previous, raw)),
    );
  }
}

function isRowList(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((row) => row !== null && typeof row === 'object' && !Array.isArray(row))
  );
}
