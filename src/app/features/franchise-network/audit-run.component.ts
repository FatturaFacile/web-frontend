import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { FRN_AUDIT_CATEGORIES, FrnCriterion, PermissionsService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { AuditRunStore } from './audit-run.store';
import { FRANCHISE_NETWORK_AUDIT_MODULE, FrnOutcome, toNumber } from './franchise-network.util';

/**
 * The inspection checklist of a store, built for a tablet: large score buttons per criterion, a note and photos for each,
 * grouped by category (signage, cleanliness, visual merchandising, layout, stock and pricing). Save as a draft while walking the
 * store, submit at the end: the server scores it and opens a corrective action for every weak criterion.
 */
@Component({
  selector: 'app-frn-audit-run',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzInputModule,
    NzPopconfirmModule,
    NzSpinModule,
    NzTagModule,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
  ],
  providers: [AuditRunStore],
  styleUrl: './franchise-network.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.FRANCHISE_NETWORK_AUDIT_RUN' | translate"></app-page-header>

    <div class="toolbar">
      <a nz-button routerLink="/franchise-network/audits">{{ 'franchiseNetwork.action.back' | translate }}</a>
      <span class="spacer"></span>
      @if (store.audit(); as audit) {
        @if (editable()) {
          <button nz-button type="button" [nzLoading]="store.saving()" (click)="saveDraft()">
            {{ 'franchiseNetwork.action.saveDraft' | translate }}
          </button>
          <button
            nz-button
            nzType="primary"
            type="button"
            nz-popconfirm
            [nzPopconfirmTitle]="'franchiseNetwork.confirm.submitAudit' | translate"
            [nzOkText]="'franchiseNetwork.action.confirm' | translate"
            [nzCancelText]="'franchiseNetwork.action.cancel' | translate"
            (nzOnConfirm)="submit()"
          >
            {{ 'franchiseNetwork.action.submitAudit' | translate }}
          </button>
        }
        <nz-tag [nzColor]="audit.status === 'submitted' ? 'green' : 'gold'">{{ 'franchiseNetwork.auditStatus.' + audit.status | translate }}</nz-tag>
      }
    </div>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }
    @if (feedback(); as failure) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="failure.errorKey ?? 'franchiseNetwork.error.generic' | translate: failure.params"
        [nzDescription]="failure.detail ?? null"
        (nzOnClose)="feedback.set(null)"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.audit(); as audit) {
        <nz-card class="main-card">
          <strong>{{ audit.store_code }} {{ audit.store_name }}</strong> · {{ audit.audited_on }}
          @if (audit.status === 'submitted') {
            <p>
              <nz-tag [nzColor]="audit.passed ? 'green' : 'red'">{{ audit.score_percent }}%</nz-tag>
              {{ (audit.passed ? 'franchiseNetwork.field.passed' : 'franchiseNetwork.field.failed') | translate }}
              · {{ audit.score }} / {{ audit.max_score }}
            </p>
          }
        </nz-card>

        @if (store.template(); as template) {
          @for (category of categories; track category) {
            @if (criteriaOf(category).length > 0) {
              <nz-card class="main-card" [nzTitle]="'franchiseNetwork.category.' + category | translate">
                @for (criterion of criteriaOf(category); track criterion.code) {
                  <div class="criterion">
                    <strong>{{ criterion.label }}</strong>
                    @if (criterion.critical) {
                      <nz-tag nzColor="red">{{ 'franchiseNetwork.field.critical' | translate }}</nz-tag>
                    }
                    @if (criterion.hint) {
                      <small class="muted">{{ criterion.hint }}</small>
                    }
                    <div class="scores" role="group" [attr.aria-label]="criterion.label">
                      @for (value of scale(criterion); track value) {
                        <button
                          nz-button
                          class="score-button"
                          type="button"
                          [nzType]="store.answers()[criterion.code]?.score === value ? 'primary' : 'default'"
                          [disabled]="!editable()"
                          [attr.aria-pressed]="store.answers()[criterion.code]?.score === value"
                          (click)="store.setScore(criterion.code, value)"
                        >
                          {{ value }}
                        </button>
                      }
                    </div>
                    <textarea
                      nz-input
                      rows="2"
                      [disabled]="!editable()"
                      [ngModel]="store.answers()[criterion.code]?.notes ?? ''"
                      (ngModelChange)="store.setNote(criterion.code, $event)"
                      [attr.aria-label]="'franchiseNetwork.field.notes' | translate"
                    ></textarea>
                    @if (editable()) {
                      <label class="field" [for]="'frn-photo-' + criterion.code">
                        <span>{{ 'franchiseNetwork.action.addPhoto' | translate }}</span>
                        <input
                          [id]="'frn-photo-' + criterion.code"
                          type="file"
                          accept="image/*"
                          capture="environment"
                          (change)="upload($event, criterion.code)"
                        />
                      </label>
                    }
                    <div class="photos">
                      @for (photo of photosOf(criterion.code); track photo.id) {
                        <figure>
                          @if (store.previews()[photo.id]; as url) {
                            <img [src]="url" [alt]="photo.caption ?? photo.original_name" />
                          }
                          <figcaption>{{ photo.caption ?? photo.original_name }}</figcaption>
                          @if (editable()) {
                            <button nz-button nzSize="small" nzDanger type="button" (click)="removePhoto(photo.id)">
                              {{ 'franchiseNetwork.action.remove' | translate }}
                            </button>
                          }
                        </figure>
                      }
                    </div>
                  </div>
                }
              </nz-card>
            }
          }
        } @else {
          <nz-empty [nzNotFoundContent]="'franchiseNetwork.empty.template' | translate"></nz-empty>
        }

        <nz-card class="main-card" [nzTitle]="'franchiseNetwork.field.notes' | translate">
          <textarea
            nz-input
            rows="3"
            [disabled]="!editable()"
            [ngModel]="store.notes()"
            (ngModelChange)="store.setNotes($event)"
            [attr.aria-label]="'franchiseNetwork.field.notes' | translate"
          ></textarea>
        </nz-card>

        @if ((audit.actions ?? []).length > 0) {
          <nz-card class="main-card" [nzTitle]="'franchiseNetwork.section.openActions' | translate">
            @for (action of audit.actions ?? []; track action.id) {
              <p>
                <nz-tag [nzColor]="action.status === 'done' ? 'green' : 'orange'">{{ 'franchiseNetwork.actionStatus.' + action.status | translate }}</nz-tag>
                {{ action.criterion_code }} · {{ action.description }} · {{ action.due_date }}
              </p>
            }
          </nz-card>
        }
      }
    </nz-spin>
  `,
})
export class AuditRunComponent implements OnInit {
  protected readonly store = inject(AuditRunStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);

  protected readonly canAudit = inject(PermissionsService).canWrite(FRANCHISE_NETWORK_AUDIT_MODULE);
  protected readonly categories = FRN_AUDIT_CATEGORIES;
  protected readonly feedback = signal<FrnOutcome | null>(null);

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.store.releasePreviews());
    void this.store.load(this.route.snapshot.paramMap.get('id') ?? '');
  }

  protected editable(): boolean {
    return this.canAudit && this.store.audit()?.status === 'draft';
  }

  protected criteriaOf(category: string): FrnCriterion[] {
    return (this.store.template()?.criteria ?? []).filter((criterion) => criterion.category === category);
  }

  protected scale(criterion: FrnCriterion): number[] {
    return Array.from({ length: toNumber(criterion.max_score) + 1 }, (_, index) => index);
  }

  protected photosOf(code: string) {
    return (this.store.audit()?.photos ?? []).filter((photo) => photo.criterion_code === code);
  }

  protected async saveDraft(): Promise<void> {
    const outcome = await this.store.saveDraft();
    this.report(outcome, 'franchiseNetwork.notification.saved');
  }

  protected async submit(): Promise<void> {
    const outcome = await this.store.submit();
    this.report(outcome, 'franchiseNetwork.notification.auditSubmitted');
  }

  protected async upload(event: Event, code: string): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);
    if (!file) {
      return;
    }
    const outcome = await this.store.addPhoto(file, code, null);
    input.value = '';
    this.report(outcome, 'franchiseNetwork.notification.photoAdded');
  }

  protected async removePhoto(photoId: string): Promise<void> {
    this.report(await this.store.removePhoto(photoId), null);
  }

  private report(outcome: FrnOutcome, successKey: string | null): void {
    this.feedback.set(outcome.ok ? null : outcome);
    if (outcome.ok && successKey !== null) {
      this.message.success(this.i18n.instant(successKey));
    }
  }
}
