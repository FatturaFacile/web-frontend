import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe, RadioControlDirective } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { CpqQuotesApiService } from './cpq-quotes-api.service';
import { QuoteDetail, QuoteStatus, RevisionDiff } from './cpq-quotes.models';
import { DiffRow, diffRows } from './cpq-quotes.diff';

const STATUS_COLOR: Partial<Record<QuoteStatus, string>> = {
  draft: 'default',
  sent: 'blue',
  viewed: 'cyan',
  negotiating: 'gold',
  accepted: 'green',
  converted: 'green',
  rejected: 'red',
  expired: 'orange',
  superseded: 'default',
};

/**
 * Revision history and visual diff (`/cpq-quotes/:id/compare`): a timeline of every revision of the quote (.01, .02, ...) with
 * its status, and the structural diff of any two of them, side by side or unified: added and removed sections and lines,
 * modified quantity, price, discount and optionality, and the net and gross variance.
 */
@Component({
  selector: 'app-quote-revision-compare',
  imports: [
    RadioControlDirective,
    FormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzRadioModule,
    NzSelectModule,
    NzSpinModule,
    NzTagModule,
    NzTimelineModule,
    TranslatePipe,
  ],
  template: `
    <nz-card [nzTitle]="'CPQ_QUOTES.HISTORY_TITLE' | translate">
      <div class="layout">
        <aside class="timeline" data-test="timeline">
          <nz-timeline>
            @for (rev of revisions(); track rev.id) {
              <nz-timeline-item [nzColor]="color(rev.status)">
                <a [routerLink]="['/cpq-quotes', rev.id]" data-test="revision">{{
                  rev.quote_number
                }}</a>
                <nz-tag>{{ 'CPQ_QUOTES.STATUS_' + rev.status.toUpperCase() | translate }}</nz-tag>
                <div class="when">{{ rev.issued_at ?? '' }}</div>
              </nz-timeline-item>
            }
          </nz-timeline>
        </aside>

        <section class="main">
          <div class="pick">
            <label for="cmp-from">{{ 'CPQ_QUOTES.COMPARE_FROM' | translate }}</label>
            <nz-select
              id="cmp-from"
              [ngModel]="fromId()"
              (ngModelChange)="fromId.set($event)"
              data-test="from"
            >
              @for (rev of revisions(); track rev.id) {
                <nz-option [nzValue]="rev.id" [nzLabel]="rev.quote_number" />
              }
            </nz-select>
            <label for="cmp-to">{{ 'CPQ_QUOTES.COMPARE_TO' | translate }}</label>
            <nz-select
              id="cmp-to"
              [ngModel]="toId()"
              (ngModelChange)="toId.set($event)"
              data-test="to"
            >
              @for (rev of revisions(); track rev.id) {
                <nz-option [nzValue]="rev.id" [nzLabel]="rev.quote_number" />
              }
            </nz-select>
            <button
              nz-button
              nzType="primary"
              type="button"
              data-test="compare"
              [disabled]="!canCompare()"
              [nzLoading]="loading()"
              (click)="compare()"
            >
              {{ 'CPQ_QUOTES.COMPARE' | translate }}
            </button>
            <nz-radio-group
              [ngModel]="layout()"
              (ngModelChange)="layout.set($event)"
              data-test="layout"
            >
              <label for="quote-revision-compare-unified" appRadioControl nz-radio-button nzValue="unified">{{
                'CPQ_QUOTES.VIEW_UNIFIED' | translate
              }}</label>
              <label for="quote-revision-compare-side" appRadioControl nz-radio-button nzValue="side">{{ 'CPQ_QUOTES.VIEW_SIDE' | translate }}</label>
            </nz-radio-group>
          </div>

          @if (error()) {
            <nz-alert
              nzType="error"
              nzShowIcon
              data-test="error"
              [nzMessage]="'CPQ_QUOTES.ERROR' | translate"
            />
          }

          <nz-spin [nzSpinning]="loading()">
            @if (diff(); as d) {
              @if (rows().length === 0) {
                <nz-alert
                  nzType="info"
                  nzShowIcon
                  data-test="identical"
                  [nzMessage]="'CPQ_QUOTES.NO_CHANGES' | translate"
                />
              }

              @if (layout() === 'unified') {
                <div class="rows" data-test="unified">
                  @for (row of rows(); track $index) {
                    <div class="row" [class]="'row ' + row.kind" [attr.data-kind]="row.kind">
                      <span class="sign">{{ sign(row.kind) }}</span>
                      <span class="scope">{{ 'CPQ_QUOTES.DIFF_' + row.scope | translate }}</span>
                      <span class="label">{{ row.label }}</span>
                      @for (change of row.changes; track change.field) {
                        <span class="change" data-test="change"
                          >{{ 'CPQ_QUOTES.FIELD_' + change.field.toUpperCase() | translate }}:
                          {{ change.from }} → {{ change.to }}</span
                        >
                      }
                    </div>
                  }
                </div>
              } @else {
                <div class="side" data-test="side">
                  <div class="col" data-test="side-from">
                    <h4>{{ d.from }}</h4>
                    @for (row of rows(); track $index) {
                      @if (row.kind !== 'added') {
                        <div [class]="'row ' + row.kind" [attr.data-kind]="row.kind">
                          {{ row.label }}
                          @for (c of row.changes; track c.field) {
                            <span>{{ c.from }}</span>
                          }
                        </div>
                      }
                    }
                  </div>
                  <div class="col" data-test="side-to">
                    <h4>{{ d.to }}</h4>
                    @for (row of rows(); track $index) {
                      @if (row.kind !== 'removed') {
                        <div [class]="'row ' + row.kind" [attr.data-kind]="row.kind">
                          {{ row.label }}
                          @for (c of row.changes; track c.field) {
                            <span>{{ c.to }}</span>
                          }
                        </div>
                      }
                    }
                  </div>
                </div>
              }

              <table class="totals" data-test="totals">
                <thead>
                  <tr>
                    <th></th>
                    <th>{{ d.from }}</th>
                    <th>{{ d.to }}</th>
                    <th>{{ 'CPQ_QUOTES.DELTA' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (key of totalKeys; track key) {
                    <tr [attr.data-total]="key">
                      <td>{{ 'CPQ_QUOTES.TOTAL_' + key.toUpperCase() | translate }}</td>
                      <td>{{ d.totals[key].from }}</td>
                      <td>{{ d.totals[key].to }}</td>
                      <td
                        [class.up]="
                          d.totals[key].delta.startsWith('-') === false &&
                          d.totals[key].delta !== '0.00'
                        "
                        [class.down]="d.totals[key].delta.startsWith('-')"
                      >
                        {{ d.totals[key].delta }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </nz-spin>
        </section>
      </div>
    </nz-card>
  `,
  styles: `
    .layout {
      display: grid;
      grid-template-columns: 240px 1fr;
      gap: 24px;
    }
    .pick {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 4px 8px;
      border-left: 3px solid transparent;
    }
    .row.added {
      background: rgb(82 196 26 / 10%);
      border-color: #52c41a;
    }
    .row.removed {
      background: rgb(255 77 79 / 10%);
      border-color: #ff4d4f;
    }
    .row.modified {
      background: rgb(250 173 20 / 10%);
      border-color: #faad14;
    }
    .side {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .totals {
      margin-top: 16px;
      width: 100%;
    }
    .up {
      color: #52c41a;
    }
    .down {
      color: #ff4d4f;
    }
    @media (max-width: 720px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class QuoteRevisionCompareComponent implements OnInit {
  private readonly api = inject(CpqQuotesApiService);
  private readonly route = inject(ActivatedRoute);

  protected readonly revisions = signal<QuoteDetail[]>([]);
  protected readonly fromId = signal<string | null>(null);
  protected readonly toId = signal<string | null>(null);
  protected readonly diff = signal<RevisionDiff | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly layout = signal<'unified' | 'side'>('unified');
  protected readonly totalKeys = ['net', 'tax', 'gross'] as const;

  protected readonly canCompare = computed(
    () => this.fromId() !== null && this.toId() !== null && this.fromId() !== this.toId(),
  );
  protected readonly rows = computed<DiffRow[]>(() =>
    this.diff() === null ? [] : diffRows(this.diff() as RevisionDiff),
  );

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.loading.set(true);
    this.api.get(id).subscribe({
      next: (res) => {
        const root = res.data.root_quote_id ?? res.data.id;
        this.api.list({ root_quote_id: root, per_page: 100 }).subscribe({
          next: (page) => {
            const sorted = [...page.data.items].sort((a, b) => a.revision - b.revision);
            this.revisions.set(sorted);
            const current = sorted.findIndex((r) => r.id === id);
            this.toId.set(sorted[current]?.id ?? null);
            this.fromId.set(current > 0 ? sorted[current - 1].id : null);
            this.loading.set(false);
            if (this.canCompare()) {
              this.compare();
            }
          },
          error: () => this.fail(),
        });
      },
      error: () => this.fail(),
    });
  }

  protected compare(): void {
    const from = this.fromId();
    const to = this.toId();
    if (from === null || to === null) {
      return;
    }
    this.loading.set(true);
    this.error.set(false);
    this.api.compare(from, to).subscribe({
      next: (res) => {
        this.diff.set(res.data);
        this.loading.set(false);
      },
      error: () => this.fail(),
    });
  }

  protected color(status: QuoteStatus): string {
    return STATUS_COLOR[status] ?? 'default';
  }

  protected sign(kind: DiffRow['kind']): string {
    return kind === 'added' ? '+' : kind === 'removed' ? '−' : '~';
  }

  private fail(): void {
    this.loading.set(false);
    this.error.set(true);
  }
}
