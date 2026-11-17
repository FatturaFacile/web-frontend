import { DecimalPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { ApplicationStage, CandidateApplicationCard } from '@core';
import { TranslatePipe } from '@shared';
import { CV_PARSE_ICONS, daysUntil, stageLabelKey } from '../shared/recruiting-labels';

/** Consent expiring within this many days shows a warning badge. */
export const CONSENT_WARNING_DAYS = 30;

@Component({
  selector: 'app-board-card',
  imports: [
    DecimalPipe,
    RouterLink,
    NzButtonModule,
    CdkMenu,
    CdkMenuItem,
    CdkMenuTrigger,
    NzTagModule,
    NzTooltipModule,
    TranslatePipe,
  ],
  template: `
    <article
      class="card"
      [class.card--anonymized]="card().is_anonymized"
      [attr.aria-label]="displayName()"
    >
      <header class="card__header">
        @if (card().is_anonymized) {
          <span class="card__name">{{ displayName() }}</span>
        } @else {
          <a class="card__name" [routerLink]="['/hr/recruiting/candidates', card().id]">{{
            displayName()
          }}</a>
        }
        <i
          [class]="parseIcon()"
          class="card__parse"
          role="img"
          [attr.aria-label]="'hr.recruiting.cvParse.' + card().cv_parse_status | translate"
          nz-tooltip
          [nzTooltipTitle]="'hr.recruiting.cvParse.' + card().cv_parse_status | translate"
        ></i>
      </header>

      @if (card().is_anonymized) {
        <nz-tag>{{ 'hr.recruiting.board.anonymized' | translate }}</nz-tag>
      } @else if (card().skills.length) {
        <ul class="card__skills" [attr.aria-label]="'hr.recruiting.board.skills' | translate">
          @for (skill of visibleSkills(); track skill) {
            <li>
              <nz-tag>{{ skill }}</nz-tag>
            </li>
          }
          @if (card().skills.length > visibleSkills().length) {
            <li>
              <nz-tag>+{{ card().skills.length - visibleSkills().length }}</nz-tag>
            </li>
          }
        </ul>
      }

      <footer class="card__footer">
        <span class="card__score">
          @if (card().average_score !== null) {
            {{ 'hr.recruiting.board.averageScore' | translate }}:
            <strong>{{ card().average_score | number: '1.1-1' }}</strong>
          } @else {
            {{ 'hr.recruiting.board.noScore' | translate }}
          }
        </span>
        @if (consentDays() !== null && consentDays()! <= consentWarningDays) {
          <nz-tag nzColor="warning" class="card__consent">
            {{ 'hr.recruiting.board.consentExpires' | translate: { days: consentDays()! } }}
          </nz-tag>
        }
        @if (!card().is_anonymized && targets().length) {
          <button
            nz-button
            nzSize="small"
            type="button"
            class="card__move"
            [attr.data-move-trigger]="card().id"
            [cdkMenuTriggerFor]="moveMenu"
            [attr.aria-disabled]="busy()"
            [attr.aria-label]="'hr.recruiting.board.moveToFor' | translate: { name: displayName() }"
          >
            {{ 'hr.recruiting.board.moveTo' | translate }}
          </button>
          <ng-template #moveMenu>
            <div class="move-menu" cdkMenu>
              @for (stage of targets(); track stage) {
                <button
                  type="button"
                  class="move-menu__item"
                  cdkMenuItem
                  (cdkMenuItemTriggered)="moveRequested.emit(stage)"
                >
                  {{ stageLabel(stage) | translate }}
                </button>
              }
            </div>
          </ng-template>
        }
      </footer>
    </article>
  `,
  styles: `
    .move-menu {
      display: flex;
      flex-direction: column;
      min-width: 180px;
      padding: 4px 0;
      background: #fff;
      border-radius: 6px;
      box-shadow: 0 6px 16px rgb(0 0 0 / 12%);
    }
    .move-menu__item {
      text-align: start;
      padding: 6px 12px;
      border: 0;
      background: transparent;
      cursor: pointer;
      color: rgb(0 0 0 / 88%);
    }
    .move-menu__item:hover,
    .move-menu__item:focus-visible {
      background: #e6f4ff;
      outline: 2px solid #1677ff;
      outline-offset: -2px;
    }
    :host {
      display: block;
    }
    .card {
      background: var(--ff-card-bg, #fff);
      border: 1px solid #d9d9d9;
      border-radius: 6px;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .card--anonymized {
      opacity: 0.8;
      background: #fafafa;
    }
    .card__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .card__name {
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .card__skills {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .card__skills nz-tag {
      margin: 0;
    }
    .card__footer {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      font-size: 12px;
    }
  `,
})
export class BoardCardComponent {
  readonly card = input.required<CandidateApplicationCard>();
  /** Valid "Move to..." targets for this card. */
  readonly targets = input<ApplicationStage[]>([]);
  readonly busy = input(false);
  /** Reference date for the consent badge (injected for deterministic tests). */
  readonly now = input<Date>(new Date());
  readonly moveRequested = output<ApplicationStage>();

  readonly consentWarningDays = CONSENT_WARNING_DAYS;
  readonly stageLabel = stageLabelKey;

  readonly displayName = computed(() => this.card().full_name);
  readonly visibleSkills = computed(() => this.card().skills.slice(0, 3));
  readonly parseIcon = computed(() => CV_PARSE_ICONS[this.card().cv_parse_status]);
  readonly consentDays = computed(() =>
    daysUntil(this.card().privacy_consent_expires_at, this.now()),
  );
}
