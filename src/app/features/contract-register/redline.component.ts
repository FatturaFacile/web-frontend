import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  ContractDocumentVersionResource,
  ContractKind,
  ContractRegisterApiService,
  ContractVersionComment,
  ContractVersionComparison,
} from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';

/**
 * Redline view of a contract text: pick two versions, read the line diff (added and removed lines) and discuss the
 * newer version with line comments that can be resolved.
 */
@Component({
  selector: 'app-contract-redline',
  styleUrl: './redline.component.scss',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <nz-card [nzTitle]="'CONTRACT_REDLINE.TITLE' | translate">
      @if (versions().length < 2) {
        <nz-empty [nzNotFoundContent]="'CONTRACT_REDLINE.NEED_TWO_VERSIONS' | translate" />
      } @else {
        <div class="redline-pickers">
          <label for="redline-field-2">
            {{ 'CONTRACT_REDLINE.FROM' | translate }}
            <nz-select nzId="redline-field-2" [(ngModel)]="from" data-test="from">
              @for (v of versions(); track v.id) {
                <nz-option [nzValue]="v.version_no" [nzLabel]="'v' + v.version_no" />
              }
            </nz-select>
          </label>
          <label for="redline-field">
            {{ 'CONTRACT_REDLINE.TO' | translate }}
            <nz-select nzId="redline-field" [(ngModel)]="to" data-test="to">
              @for (v of versions(); track v.id) {
                <nz-option [nzValue]="v.version_no" [nzLabel]="'v' + v.version_no" />
              }
            </nz-select>
          </label>
          <button nz-button nzType="primary" type="button" data-test="compare" [nzLoading]="comparing()" (click)="compare()">
            <span nz-icon nzType="edit"></span>{{ 'CONTRACT_REDLINE.COMPARE' | translate }}
          </button>
        </div>
      }

      @if (errorKey()) {
        <nz-alert nzType="error" nzShowIcon [nzMessage]="errorKey() | translate" />
      }

      @if (comparison(); as c) {
        <p class="redline-summary" data-test="summary">
          <nz-tag nzColor="green">+{{ c.added }}</nz-tag>
          <nz-tag nzColor="red">-{{ c.removed }}</nz-tag>
        </p>
        <div class="redline-diff" data-test="diff">
          @for (line of c.lines; track $index) {
            <div class="redline-line" [class]="'redline-' + line.type">
              <span class="redline-marker">{{ line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ' }}</span>
              <span class="redline-text">{{ line.text }}</span>
            </div>
          }
        </div>
      }
    </nz-card>

    @if (commentVersion(); as version) {
      <nz-card class="redline-comments" [nzTitle]="'CONTRACT_REDLINE.COMMENTS' | translate: { version: version.version_no }">
        @for (comment of comments(); track comment.id) {
          <div class="redline-comment" [class.redline-comment-resolved]="comment.status === 'resolved'">
            @if (comment.line_number) {
              <nz-tag>{{ 'CONTRACT_REDLINE.LINE' | translate }} {{ comment.line_number }}</nz-tag>
            }
            <span>{{ comment.body }}</span>
            @if (comment.status === 'open') {
              <button nz-button nzSize="small" type="button" data-test="resolve" (click)="resolve(comment)">
                <span nz-icon nzType="check"></span>{{ 'CONTRACT_REDLINE.RESOLVE' | translate }}
              </button>
            } @else {
              <nz-tag nzColor="default">{{ 'CONTRACT_REDLINE.RESOLVED' | translate }}</nz-tag>
            }
          </div>
        } @empty {
          <nz-empty [nzNotFoundContent]="'CONTRACT_REDLINE.NO_COMMENTS' | translate" />
        }
        <form [formGroup]="commentForm" (ngSubmit)="addComment()" class="redline-new-comment">
          <textarea nz-input rows="2" formControlName="body" [placeholder]="'CONTRACT_REDLINE.NEW_COMMENT' | translate"></textarea>
          <nz-input-number formControlName="line_number" [nzMin]="1" [nzPlaceHolder]="'CONTRACT_REDLINE.LINE' | translate" />
          <button nz-button nzType="primary" type="submit" data-test="add-comment" [disabled]="commentForm.invalid">
            {{ 'CONTRACT_REDLINE.ADD_COMMENT' | translate }}
          </button>
        </form>
      </nz-card>
    }
  `,
})
export class ContractRedlineComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ContractRegisterApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly versions = signal<ContractDocumentVersionResource[]>([]);
  protected readonly comparison = signal<ContractVersionComparison | null>(null);
  protected readonly comments = signal<ContractVersionComment[]>([]);
  protected readonly comparing = signal(false);
  protected readonly errorKey = signal('');
  protected from: number | null = null;
  protected to: number | null = null;
  protected readonly commentForm = this.fb.group({
    body: ['', [Validators.required, Validators.maxLength(5000)]],
    line_number: this.fb.control<number | null>(null),
  });

  /** The newer of the two compared versions: the one the comments belong to. */
  protected readonly commentVersion = computed(() => {
    const target = this.comparison()?.to;
    return this.versions().find((v) => v.version_no === target) ?? null;
  });

  private kind: ContractKind = 'customer';
  private contractId = '';

  ngOnInit(): void {
    const params = this.route.snapshot.paramMap;
    this.kind = params.get('kind') === 'supplier' ? 'supplier' : 'customer';
    this.contractId = params.get('id') ?? '';
    this.api
      .getDocumentVersions(this.kind, this.contractId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const ordered = [...res.data].sort((a, b) => a.version_no - b.version_no);
          this.versions.set(ordered);
          if (ordered.length >= 2) {
            this.from = ordered[ordered.length - 2].version_no;
            this.to = ordered[ordered.length - 1].version_no;
          }
        },
        error: () => this.errorKey.set('CONTRACT_REDLINE.LOAD_FAILED'),
      });
  }

  protected compare(): void {
    if (this.from === null || this.to === null) {
      return;
    }
    this.comparing.set(true);
    this.errorKey.set('');
    this.api
      .compareDocumentVersions(this.kind, this.contractId, this.from, this.to)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.comparison.set(res.data);
          this.comparing.set(false);
          this.loadComments();
        },
        error: () => {
          this.comparing.set(false);
          this.errorKey.set('CONTRACT_REDLINE.COMPARE_FAILED');
        },
      });
  }

  protected addComment(): void {
    const version = this.commentVersion();
    if (!version || this.commentForm.invalid) {
      return;
    }
    const value = this.commentForm.getRawValue();
    this.api
      .addVersionComment(version.id, { body: value.body, line_number: value.line_number })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.comments.update((list) => [...list, res.data]);
          this.commentForm.reset({ body: '', line_number: null });
        },
        error: () => this.errorKey.set('CONTRACT_REDLINE.COMMENT_FAILED'),
      });
  }

  protected resolve(comment: ContractVersionComment): void {
    this.api
      .resolveVersionComment(comment.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.comments.update((list) => list.map((c) => (c.id === comment.id ? res.data : c))),
        error: () => this.errorKey.set('CONTRACT_REDLINE.COMMENT_FAILED'),
      });
  }

  private loadComments(): void {
    const version = this.commentVersion();
    if (!version) {
      return;
    }
    this.api
      .getVersionComments(version.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (res) => this.comments.set(res.data) });
  }
}
