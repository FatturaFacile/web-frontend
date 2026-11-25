import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { CpqProposal } from '@core';
import { TranslatePipe } from '@shared';
import { formatMoney, trimNumber } from './cpq-format';

/**
 * The technical-commercial proposal: the specification of the variant by step, the automatic inclusions, the scope of
 * supply, the dimensional and installation notes, the commercial conditions and, only when the API sent it, the
 * industrial breakdown. The texts are the ones of the model, in the language of the request.
 */
@Component({
  selector: 'app-cpq-proposal-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NzButtonModule,
    NzDescriptionsModule,
    NzDividerModule,
    NzDrawerModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    @if (dossier(); as doc) {
      <nz-drawer
        [nzVisible]="true"
        [nzWidth]="760"
        [nzTitle]="doc.texts.title ?? ('CPQ_CONFIGURATOR.PROPOSAL.TITLE' | translate)"
        (nzOnClose)="closed.emit()"
      >
        <ng-container *nzDrawerContent>
          <p class="meta">
            <nz-tag>{{ doc.product.model_code }}</nz-tag>
            <strong>{{ doc.product.model_name }}</strong>
            @if (doc.document.reference) {
              <span
                >· {{ 'CPQ_CONFIGURATOR.PROPOSAL.REFERENCE' | translate }}:
                <code>{{ doc.document.reference }}</code></span
              >
            }
            @if (doc.document.customer) {
              <span
                >· {{ 'CPQ_CONFIGURATOR.PROPOSAL.CUSTOMER' | translate }}:
                {{ doc.document.customer }}</span
              >
            }
          </p>
          @if (doc.texts.intro) {
            <p>{{ doc.texts.intro }}</p>
          }

          <nz-divider
            [nzText]="'CPQ_CONFIGURATOR.PROPOSAL.SPECIFICATION' | translate"
            nzOrientation="left"
          ></nz-divider>
          @for (group of doc.specification; track $index) {
            <nz-descriptions
              [nzTitle]="group.step ?? ''"
              nzBordered
              nzSize="small"
              [nzColumn]="1"
              class="group"
            >
              @for (row of group.rows; track row.label) {
                <nz-descriptions-item [nzTitle]="row.label">
                  {{ row.value }}{{ row.unit ? ' ' + row.unit : '' }}
                  @if (row.auto_included) {
                    <nz-tag nzColor="gold">{{
                      'CPQ_CONFIGURATOR.AUTO_INCLUDED' | translate
                    }}</nz-tag>
                  }
                </nz-descriptions-item>
              }
            </nz-descriptions>
          }

          @if (doc.auto_included.length > 0) {
            <nz-divider
              [nzText]="'CPQ_CONFIGURATOR.PROPOSAL.AUTO_INCLUDED' | translate"
              nzOrientation="left"
            ></nz-divider>
            <ul>
              @for (entry of doc.auto_included; track entry.characteristic_label) {
                <li>
                  <strong>{{ entry.characteristic_label }}</strong
                  >: {{ entry.value_label }} — {{ entry.message }}
                </li>
              }
            </ul>
          }

          @if (doc.bom.length > 0) {
            <nz-divider
              [nzText]="'CPQ_CONFIGURATOR.PROPOSAL.SCOPE_OF_SUPPLY' | translate"
              nzOrientation="left"
            ></nz-divider>
            <nz-table
              [nzData]="doc.bom"
              nzSize="small"
              [nzShowPagination]="false"
              [nzFrontPagination]="false"
            >
              <thead>
                <tr>
                  <th>{{ 'CPQ_CONFIGURATOR.COLUMN.CODE' | translate }}</th>
                  <th>{{ 'CPQ_CONFIGURATOR.COLUMN.DESCRIPTION' | translate }}</th>
                  <th class="num">{{ 'CPQ_CONFIGURATOR.COLUMN.QUANTITY' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (line of doc.bom; track line.item_code) {
                  <tr>
                    <td>{{ line.item_code }}</td>
                    <td>{{ line.name }}</td>
                    <td class="num">{{ trim(line.quantity) }} {{ line.uom }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          }

          @if (doc.dimensional_notes.length > 0 || doc.texts.installation) {
            <nz-divider
              [nzText]="'CPQ_CONFIGURATOR.PROPOSAL.DIMENSIONS' | translate"
              nzOrientation="left"
            ></nz-divider>
            <ul>
              @for (note of doc.dimensional_notes; track note) {
                <li>{{ note }}</li>
              }
            </ul>
            @if (doc.texts.installation) {
              <p>{{ doc.texts.installation }}</p>
            }
          }

          <nz-divider
            [nzText]="'CPQ_CONFIGURATOR.PROPOSAL.COMMERCIAL' | translate"
            nzOrientation="left"
          ></nz-divider>
          <div class="stats">
            <nz-statistic
              [nzTitle]="'CPQ_CONFIGURATOR.TOTAL.UNIT_PRICE' | translate"
              [nzValue]="money(doc.commercial.unit_price)"
            ></nz-statistic>
            <nz-statistic
              [nzTitle]="'CPQ_CONFIGURATOR.TOTAL.QUANTITY' | translate"
              [nzValue]="trim(doc.commercial.quantity)"
            ></nz-statistic>
            <nz-statistic
              [nzTitle]="'CPQ_CONFIGURATOR.PROPOSAL.TOTAL' | translate"
              [nzValue]="money(doc.commercial.total_price)"
            ></nz-statistic>
            <nz-statistic
              [nzTitle]="'CPQ_CONFIGURATOR.TOTAL.LEAD_TIME' | translate"
              [nzValue]="
                doc.commercial.lead_time_days + ' ' + ('CPQ_CONFIGURATOR.DAYS' | translate)
              "
            ></nz-statistic>
            <nz-statistic
              [nzTitle]="'CPQ_CONFIGURATOR.PROPOSAL.VALIDITY' | translate"
              [nzValue]="doc.document.valid_days + ' ' + ('CPQ_CONFIGURATOR.DAYS' | translate)"
            ></nz-statistic>
          </div>

          @if (doc.breakdown; as breakdown) {
            <nz-divider
              [nzText]="'CPQ_CONFIGURATOR.PROPOSAL.BREAKDOWN' | translate"
              nzOrientation="left"
            ></nz-divider>
            <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
              <nz-descriptions-item [nzTitle]="'CPQ_CONFIGURATOR.TOTAL.BOM_COST' | translate">{{
                money(breakdown.bom_cost)
              }}</nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'CPQ_CONFIGURATOR.TOTAL.ROUTING_COST' | translate">{{
                money(breakdown.routing_cost)
              }}</nz-descriptions-item>
              <nz-descriptions-item
                [nzTitle]="'CPQ_CONFIGURATOR.TOTAL.INDUSTRIAL_COST' | translate"
                >{{ money(breakdown.industrial_cost) }}</nz-descriptions-item
              >
              <nz-descriptions-item [nzTitle]="'CPQ_CONFIGURATOR.TOTAL.MARGIN' | translate"
                >{{ money(breakdown.margin_amount) }} ({{
                  trim(breakdown.margin_percent)
                }}
                %)</nz-descriptions-item
              >
            </nz-descriptions>
          }

          @for (clause of clauses(); track clause.key) {
            <nz-divider
              [nzText]="'CPQ_CONFIGURATOR.PROPOSAL.' + clause.key | translate"
              nzOrientation="left"
            ></nz-divider>
            <p>{{ clause.text }}</p>
          }

          <p class="hash">
            {{ 'CPQ_CONFIGURATOR.PROPOSAL.HASH' | translate }}: <code>{{ doc.product.hash }}</code>
          </p>
        </ng-container>
        <div *nzDrawerFooter class="footer">
          @if (canDownload()) {
            <button nz-button nzType="primary" (click)="download.emit()">
              {{ 'CPQ_CONFIGURATOR.PROPOSAL.DOWNLOAD_PDF' | translate }}
            </button>
          }
          <button nz-button (click)="closed.emit()">
            {{ 'CPQ_CONFIGURATOR.CLOSE' | translate }}
          </button>
        </div>
      </nz-drawer>
    }
  `,
  styles: `
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .group {
      margin-bottom: 12px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
    }
    .num {
      text-align: right;
    }
    .hash {
      color: #8c8c8c;
      font-size: 11px;
      margin-top: 16px;
      word-break: break-all;
    }
    .footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `,
})
export class CpqProposalDrawerComponent {
  readonly proposal = input<CpqProposal | null>(null);
  /** The PDF is of a confirmed configuration: offered only once there is an instance. */
  readonly canDownload = input(false);
  readonly closed = output<void>();
  readonly download = output<void>();

  readonly dossier = computed(() => this.proposal()?.dossier ?? null);
  readonly clauses = computed(() => {
    const texts = this.dossier()?.texts;
    if (!texts) {
      return [];
    }

    return [
      { key: 'DELIVERY', text: texts.delivery },
      { key: 'WARRANTY', text: texts.warranty },
      { key: 'TERMS', text: texts.terms },
    ].filter((clause): clause is { key: string; text: string } => !!clause.text);
  });

  money(value: number): string {
    return formatMoney(value, this.dossier()?.document.currency ?? 'EUR');
  }

  trim(value: number): string {
    return trimNumber(value);
  }
}
