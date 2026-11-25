import { Component, computed, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslatePipe } from '@shared';
import { PreviewStore } from './preview.store';
import {
  formatAmount,
  jurisdictionOf,
  routeDossierId,
  validationColor,
} from './statutory-financials.util';

/**
 * The official TEBENI / ministerial preview: the taxonomy header, every section as a table with the XBRL element of each
 * row, the notes, the validation summary and an excerpt of the XBRL instance.
 */
@Component({
  selector: 'app-sf-preview',
  imports: [
    NzAlertModule,
    NzCardModule,
    NzDescriptionsModule,
    NzEmptyModule,
    NzSpinModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  providers: [PreviewStore],
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

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.preview(); as preview) {
        <nz-card class="main-card" [nzTitle]="preview.title">
          <nz-descriptions nzBordered nzSize="small" [nzColumn]="{ xs: 1, md: 2 }">
            <nz-descriptions-item [nzTitle]="'statutoryFinancials.field.standard' | translate">
              {{ 'statutoryFinancials.standard.' + preview.standard | translate }}
              <small class="muted">{{ preview.legal_reference }}</small>
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'statutoryFinancials.preview.currency' | translate">{{
              preview.currency
            }}</nz-descriptions-item>
            <nz-descriptions-item
              [nzTitle]="'statutoryFinancials.preview.taxonomyVersion' | translate"
              >{{ preview.taxonomy.version }}</nz-descriptions-item
            >
            <nz-descriptions-item [nzTitle]="'statutoryFinancials.preview.prefix' | translate">
              <span class="mono">{{ preview.taxonomy.prefix }}</span>
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'statutoryFinancials.preview.namespace' | translate">
              <span class="mono">{{ preview.taxonomy.namespace }}</span>
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'statutoryFinancials.preview.entryPoint' | translate">
              <span class="mono">{{ preview.taxonomy.entry_point }}</span>
            </nz-descriptions-item>
          </nz-descriptions>
        </nz-card>

        @for (section of preview.sections; track section.statement) {
          <nz-card class="main-card" [nzTitle]="section.title">
            <nz-table
              class="statement-table"
              nzSize="small"
              [nzData]="section.rows"
              [nzFrontPagination]="false"
              [nzShowPagination]="false"
              [nzScroll]="{ x: '720px' }"
            >
              <caption class="visually-hidden">
                {{
                  section.title
                }}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{{ 'statutoryFinancials.statement.line' | translate }}</th>
                  <th scope="col">{{ 'statutoryFinancials.preview.element' | translate }}</th>
                  <th scope="col" class="num">
                    {{ 'statutoryFinancials.statement.current' | translate }}
                  </th>
                  @if (preview.has_comparative) {
                    <th scope="col" class="num">
                      {{ 'statutoryFinancials.statement.comparative' | translate }}
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of section.rows; track row.code) {
                  <tr [class.rounding-row]="row.is_rounding">
                    <th scope="row" [class.strong]="row.is_total">
                      <span class="line-label" [style.padding-left.px]="row.level * 20">{{
                        row.label
                      }}</span>
                    </th>
                    <td>
                      <span class="mono">{{ row.xbrl_element }}</span>
                    </td>
                    <td class="num" [class.strong]="row.is_total">{{ amount(row.amount) }}</td>
                    @if (preview.has_comparative) {
                      <td class="num" [class.strong]="row.is_total">
                        {{ amount(row.comparative_amount) }}
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-card>
        }

        @if (preview.notes; as notes) {
          <nz-card class="main-card" [nzTitle]="'statutoryFinancials.tab.notes' | translate">
            <p>
              @for (name of tableNames(); track name) {
                <nz-tag>{{ 'statutoryFinancials.notes.table.' + name | translate }}</nz-tag>
              }
            </p>
            <ul>
              @for (section of notes.sections; track section.key) {
                <li>{{ section.title }}</li>
              }
            </ul>
          </nz-card>
        }

        @if (preview.validation; as report) {
          <nz-card
            class="main-card"
            [nzTitle]="'statutoryFinancials.section.validation' | translate"
          >
            <div class="stats-grid">
              <div>
                <nz-tag [nzColor]="color(report.status)">{{
                  'statutoryFinancials.validation.' + report.status | translate
                }}</nz-tag>
              </div>
              <nz-statistic
                [nzTitle]="'statutoryFinancials.validation.count.errors' | translate"
                [nzValue]="report.errors.length"
              ></nz-statistic>
              <nz-statistic
                [nzTitle]="'statutoryFinancials.validation.count.warnings' | translate"
                [nzValue]="report.warnings.length"
              ></nz-statistic>
              <nz-statistic
                [nzTitle]="'statutoryFinancials.validation.count.facts' | translate"
                [nzValue]="report.facts"
              ></nz-statistic>
            </div>
          </nz-card>
        }

        <nz-card
          class="main-card"
          [nzTitle]="'statutoryFinancials.preview.xbrlExcerpt' | translate"
        >
          @if (preview.xbrl_truncated) {
            <nz-alert
              class="feedback"
              nzType="info"
              nzShowIcon
              [nzMessage]="'statutoryFinancials.preview.truncated' | translate"
            ></nz-alert>
          }
          <pre
            class="xbrl-excerpt"
            tabindex="0"
            [attr.aria-label]="'statutoryFinancials.preview.xbrlExcerpt' | translate"
            >{{ preview.xbrl_excerpt }}</pre>
        </nz-card>
      } @else if (!store.loading() && !store.error()) {
        <nz-empty [nzNotFoundContent]="'statutoryFinancials.empty.preview' | translate"></nz-empty>
      }
    </nz-spin>
  `,
})
export class PreviewComponent implements OnInit {
  protected readonly store = inject(PreviewStore);
  private readonly route = inject(ActivatedRoute);

  protected readonly color = validationColor;
  protected readonly tableNames = computed(() =>
    Object.keys(this.store.preview()?.notes?.tables ?? {}),
  );

  ngOnInit(): void {
    void this.store.load(routeDossierId(this.route) ?? '');
  }

  protected amount(value: string | null | undefined): string {
    const preview = this.store.preview();
    return formatAmount(value, jurisdictionOf(preview?.standard), preview?.scale ?? 2);
  }
}
