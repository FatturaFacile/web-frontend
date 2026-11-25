import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  TND_PARTICIPATION_MODES,
  TND_PARTNER_ROLES,
  TndEligibility,
  TndParticipationDetail,
  TndParticipationMode,
  TndParticipationPayload,
  TndPartner,
} from '@core';
import { TranslatePipe } from '@shared';
import {
  criterionLabel,
  decisionColor,
  issueKey,
  metShare,
  recommendationKey,
  severityColor,
} from './tender-management.util';

/**
 * Go/No-Go matrix (Mod 169): the tender requirements against the company data and the qualification vault, the solo-versus-
 * association recommendation with the exact quota and SOA gap, and the editor of the partner companies of the dossier.
 */
@Component({
  selector: 'app-tnd-go-no-go-matrix',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzInputModule,
    NzProgressModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <div class="head">
      <button nz-button nzType="primary" type="button" [disabled]="busy()" (click)="evaluate.emit()">
        {{ 'tenderManagement.action.evaluate' | translate }}
      </button>
    </div>

    @if (eligibility(); as result) {
      <section class="summary" [attr.aria-label]="'tenderManagement.matrix.summary' | translate">
        <nz-progress
          nzType="circle"
          [nzPercent]="result.overall_score"
          [nzWidth]="96"
          [nzStrokeColor]="scoreColor()"
        ></nz-progress>
        <div>
          <nz-tag [nzColor]="decisionColor(result.decision)">
            {{ 'tenderManagement.enum.decision.' + result.decision | translate }}
          </nz-tag>
          <p class="share">
            {{ 'tenderManagement.matrix.metShare' | translate: { share: share() } }}
          </p>
          <nz-alert
            [nzType]="result.can_bid_solo ? 'success' : 'warning'"
            nzShowIcon
            [nzMessage]="recommendation() | translate: recommendationParams()"
            [nzDescription]="'tenderManagement.enum.participationMode.' + result.recommended_mode | translate"
          ></nz-alert>
        </div>
      </section>

      <nz-table #table nzSize="small" [nzData]="result.criteria" [nzFrontPagination]="false">
        <thead>
          <tr>
            <th scope="col">{{ 'tenderManagement.matrix.criterion' | translate }}</th>
            <th scope="col">{{ 'tenderManagement.matrix.category' | translate }}</th>
            <th scope="col" class="num">{{ 'tenderManagement.matrix.required' | translate }}</th>
            <th scope="col" class="num">{{ 'tenderManagement.matrix.available' | translate }}</th>
            <th scope="col" class="num">{{ 'tenderManagement.matrix.gap' | translate }}</th>
            <th scope="col" class="num">{{ 'tenderManagement.matrix.score' | translate }}</th>
            <th scope="col">{{ 'tenderManagement.matrix.outcome' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.key) {
            <tr [class.unmet]="!row.met">
              <th scope="row">{{ label(row.key).key | translate: label(row.key).params }}</th>
              <td>{{ 'tenderManagement.matrix.categories.' + row.category | translate }}</td>
              <td class="num">{{ row.required ?? '–' }}</td>
              <td class="num">{{ row.available ?? '–' }}</td>
              <td class="num">{{ row.gap ?? '–' }}</td>
              <td class="num">{{ row.score }}/{{ row.weight }}</td>
              <td>
                <nz-tag [nzColor]="row.met ? 'green' : 'red'">
                  {{ (row.met ? 'tenderManagement.matrix.met' : 'tenderManagement.matrix.unmet') | translate }}
                </nz-tag>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="7"><nz-empty></nz-empty></td>
            </tr>
          }
        </tbody>
      </nz-table>

      @if (!result.can_bid_solo) {
        <section class="gaps">
          <h3>{{ 'tenderManagement.matrix.gapsTitle' | translate }}</h3>
          <ul>
            @if (result.gaps.turnover_gap) {
              <li>
                {{ 'tenderManagement.compliance.turnover_gap' | translate: { gap: result.gaps.turnover_gap } }}
              </li>
            }
            @if (result.gaps.similar_projects_gap) {
              <li>
                {{ 'tenderManagement.matrix.similarProjectsGap' | translate: { gap: result.gaps.similar_projects_gap } }}
              </li>
            }
            @if (result.gaps.rti_quota_percentage_suggested) {
              <li>
                {{ 'tenderManagement.matrix.suggestedQuota' | translate: { quota: result.gaps.rti_quota_percentage_suggested } }}
              </li>
            }
          </ul>
          @if (unmetSoa().length > 0) {
            <nz-table #soaTable nzSize="small" [nzData]="unmetSoa()" [nzFrontPagination]="false">
              <thead>
                <tr>
                  <th scope="col">{{ 'tenderManagement.field.soaCategory' | translate }}</th>
                  <th scope="col">{{ 'tenderManagement.matrix.required' | translate }}</th>
                  <th scope="col">{{ 'tenderManagement.matrix.available' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (gap of soaTable.data; track gap.category) {
                  <tr>
                    <th scope="row">{{ gap.category }}</th>
                    <td>{{ gap.required_classification }}</td>
                    <td>{{ gap.available_classification ?? '–' }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          }
          @if (result.gaps.missing_certifications.length > 0) {
            <p>
              {{ 'tenderManagement.matrix.missingCertifications' | translate }}
              @for (type of result.gaps.missing_certifications; track type) {
                <nz-tag nzColor="red">{{ 'tenderManagement.enum.vaultDocType.' + type | translate }}</nz-tag>
              }
            </p>
          }
        </section>
      }

      @if (result.issues.length > 0) {
        <section class="issues">
          @for (issue of result.issues; track $index) {
            <nz-tag [nzColor]="severityColor(issue.severity)">
              {{ issueText(issue) | translate: issue.params ?? {} }}
            </nz-tag>
          }
        </section>
      }
    } @else {
      <nz-empty [nzNotFoundContent]="'tenderManagement.empty.eligibility' | translate"></nz-empty>
    }

    <section class="partners">
      <h3>{{ 'tenderManagement.matrix.participationTitle' | translate }}</h3>
      <div class="partner-top">
        <label class="field" for="tnd-mode">
          <span>{{ 'tenderManagement.field.participationMode' | translate }}</span>
          <nz-select nzId="tnd-mode" [ngModel]="mode()" (ngModelChange)="mode.set($event)">
            @for (value of modes; track value) {
              <nz-option [nzValue]="value" [nzLabel]="'tenderManagement.enum.participationMode.' + value | translate"></nz-option>
            }
          </nz-select>
        </label>
        @if (mode() !== 'SingleCompany') {
          <label class="field" for="tnd-quota">
            <span>{{ 'tenderManagement.field.rtiQuota' | translate }}</span>
            <input nz-input id="tnd-quota" type="number" min="0" max="100" step="0.01" [ngModel]="quota()" (ngModelChange)="quota.set($event)" />
          </label>
        }
      </div>

      @if (mode() !== 'SingleCompany') {
        @for (partner of partners(); track $index; let i = $index) {
          <div class="partner-row">
            <input nz-input [attr.aria-label]="'tenderManagement.field.partnerName' | translate" [ngModel]="partner.name" (ngModelChange)="patchPartner(i, { name: $event })" />
            <input nz-input [attr.aria-label]="'tenderManagement.field.vatNumber' | translate" [ngModel]="partner.vat_number ?? ''" (ngModelChange)="patchPartner(i, { vat_number: $event })" />
            <nz-select [nzPlaceHolder]="'tenderManagement.field.partnerRole' | translate" [ngModel]="partner.role" (ngModelChange)="patchPartner(i, { role: $event })">
              @for (role of roles; track role) {
                <nz-option [nzValue]="role" [nzLabel]="'tenderManagement.enum.partnerRole.' + role | translate"></nz-option>
              }
            </nz-select>
            <input nz-input type="number" min="0" max="100" step="0.01" [attr.aria-label]="'tenderManagement.field.partnerQuota' | translate" [ngModel]="partner.quota_percentage ?? ''" (ngModelChange)="patchPartner(i, { quota_percentage: $event })" />
            <nz-select nzMode="tags" [nzPlaceHolder]="'tenderManagement.field.partnerSoa' | translate" [ngModel]="partner.soa_categories ?? []" (ngModelChange)="patchPartner(i, { soa_categories: $event })"></nz-select>
            <button nz-button nzDanger type="button" (click)="removePartner(i)">
              {{ 'tenderManagement.action.remove' | translate }}
            </button>
          </div>
        }
        <button nz-button type="button" (click)="addPartner()">
          {{ 'tenderManagement.action.addPartner' | translate }}
        </button>
      }
      <button nz-button nzType="primary" type="button" [disabled]="busy()" (click)="save()">
        {{ 'tenderManagement.action.save' | translate }}
      </button>
    </section>
  `,
  styles: `
    .head {
      margin-bottom: 12px;
    }
    .summary {
      display: flex;
      gap: 24px;
      align-items: center;
      margin-bottom: 16px;
    }
    .share {
      margin: 8px 0;
    }
    .num {
      text-align: right;
    }
    tr.unmet th,
    tr.unmet td {
      background: rgba(255, 77, 79, 0.06);
    }
    .gaps,
    .issues,
    .partners {
      margin-top: 16px;
    }
    .partner-top {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 220px;
    }
    .partner-row {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 0.7fr 2fr auto;
      gap: 8px;
      margin-bottom: 8px;
    }
  `,
})
export class GoNoGoMatrixComponent {
  readonly eligibility = input<TndEligibility | null>(null);
  readonly detail = input<TndParticipationDetail | null>(null);
  readonly busy = input(false);
  readonly evaluate = output<void>();
  readonly saved = output<TndParticipationPayload>();

  protected readonly modes = TND_PARTICIPATION_MODES;
  protected readonly roles = TND_PARTNER_ROLES;
  protected readonly mode = signal<TndParticipationMode>('SingleCompany');
  protected readonly quota = signal<string | number | null>(null);
  protected readonly partners = signal<TndPartner[]>([]);

  protected readonly decisionColor = decisionColor;
  protected readonly severityColor = severityColor;
  protected readonly label = criterionLabel;

  protected readonly share = computed(() => metShare(this.eligibility()?.criteria ?? []));
  protected readonly recommendation = computed(() => {
    const result = this.eligibility();
    return result ? recommendationKey(result) : 'tenderManagement.compliance.solo_eligible';
  });
  protected readonly recommendationParams = computed(() => ({
    quota: this.eligibility()?.gaps.rti_quota_percentage_suggested ?? '',
  }));
  protected readonly unmetSoa = computed(() => (this.eligibility()?.gaps.soa ?? []).filter((gap) => !gap.met));
  protected readonly scoreColor = computed(() => {
    const decision = this.eligibility()?.decision;
    return decision ? ({ go: '#52c41a', conditional: '#fa8c16', no_go: '#f5222d' } as const)[decision] : '#1677ff';
  });

  constructor() {
    effect(() => {
      const detail = this.detail();
      if (!detail) {
        return;
      }
      this.mode.set(detail.participation_mode);
      this.quota.set(detail.rti_quota_percentage);
      this.partners.set((detail.partner_companies ?? []).map((partner) => ({ ...partner })));
    });
  }

  protected issueText(issue: { code: string }): string {
    return issueKey(issue);
  }

  protected addPartner(): void {
    this.partners.update((list) => [...list, { name: '', vat_number: '', role: 'mandante', quota_percentage: null, soa_categories: [] }]);
  }

  protected removePartner(index: number): void {
    this.partners.update((list) => list.filter((_, i) => i !== index));
  }

  protected patchPartner(index: number, patch: Partial<TndPartner>): void {
    this.partners.update((list) => list.map((partner, i) => (i === index ? { ...partner, ...patch } : partner)));
  }

  protected save(): void {
    const single = this.mode() === 'SingleCompany';
    this.saved.emit({
      participation_mode: this.mode(),
      rti_quota_percentage: single ? null : this.quota(),
      partner_companies: single ? [] : this.partners().filter((partner) => partner.name.trim() !== ''),
    });
  }
}
