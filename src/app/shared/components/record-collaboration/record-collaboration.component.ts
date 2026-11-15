import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { CollaborationApiService } from '@core/api/collaboration-api.service';
import type {
  CollaborationActivity,
  CollaborationComment,
  CollaborationMentionableUser,
  CollaborationTag,
} from '@core/models/collaboration.model';
import { TranslateService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

export type CollaborationTab = 'comments' | 'tags' | 'activity';

const ACTIVITY_LABEL_KEYS: Record<string, string> = {
  CREATED: 'COLLAB.ACTIVITY_CREATED',
  UPDATED: 'COLLAB.ACTIVITY_UPDATED',
  DELETED: 'COLLAB.ACTIVITY_DELETED',
};

/**
 * Comments with mentions, shared tags and the activity timeline of any record the API registers for collaboration
 * (contact, invoice, quote, product, project, supplier, employee, ...). Drop it on a record page with
 * `<app-record-collaboration recordType="contact" [recordId]="contact.id" />`.
 */
@Component({
  selector: 'app-record-collaboration',
  imports: [DatePipe, FormsModule, TranslatePipe],
  styles: `
    :host {
      display: block;
    }
    .rc-tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 12px;
      border-bottom: 1px solid var(--ant-color-border-secondary, #e5e5e5);
    }
    .rc-tab {
      padding: 6px 14px;
      border: 0;
      border-bottom: 2px solid transparent;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }
    .rc-tab[aria-selected='true'] {
      border-bottom-color: var(--ant-color-primary, #1677ff);
      color: var(--ant-color-primary, #1677ff);
    }
    .rc-list {
      margin: 0 0 12px;
      padding: 0;
      list-style: none;
    }
    .rc-item {
      padding: 8px 0;
      border-bottom: 1px solid var(--ant-color-border-secondary, #f0f0f0);
    }
    .rc-meta {
      font-size: 12px;
      opacity: 0.65;
    }
    .rc-body {
      margin: 4px 0;
      white-space: pre-wrap;
    }
    .rc-form {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .rc-actions {
      display: flex;
      gap: 8px;
    }
    .rc-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 12px;
    }
    .rc-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 4px;
      background: var(--rc-tag-color, #1677ff);
      color: #fff;
      font-size: 12px;
    }
    .rc-tag button {
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }
    .rc-empty {
      opacity: 0.65;
    }
  `,
  template: `
    <div class="rc-tabs" role="tablist" [attr.aria-label]="'COLLAB.PANEL_TITLE' | translate">
      @for (tab of tabs; track tab.id) {
        <button
          type="button"
          role="tab"
          class="rc-tab"
          [id]="'rc-tab-' + tab.id"
          [attr.aria-selected]="activeTab() === tab.id"
          [attr.aria-controls]="'rc-panel-' + tab.id"
          (click)="selectTab(tab.id)"
        >
          {{ tab.labelKey | translate }}
        </button>
      }
    </div>

    <div role="tabpanel" [id]="'rc-panel-' + activeTab()" [attr.aria-labelledby]="'rc-tab-' + activeTab()">
      @if (hasError()) {
        <p role="alert">{{ 'COLLAB.LOAD_ERROR' | translate }}</p>
      }

      @switch (activeTab()) {
        @case ('comments') {
          @if (comments().length === 0) {
            <p class="rc-empty">{{ 'COLLAB.COMMENT_EMPTY' | translate }}</p>
          } @else {
            <ul class="rc-list">
              @for (comment of comments(); track comment.id) {
                <li class="rc-item">
                  <div class="rc-meta">
                    {{ comment.author.name }} - {{ comment.created_at | date: 'medium' }}
                    @if (comment.edited_at) {
                      ({{ 'COLLAB.COMMENT_EDITED' | translate }})
                    }
                  </div>
                  @if (editingId() === comment.id) {
                    <div class="rc-form">
                      <textarea
                        class="ant-input"
                        rows="3"
                        [attr.aria-label]="'COLLAB.COMMENT_PLACEHOLDER' | translate"
                        [ngModel]="editBody()"
                        (ngModelChange)="editBody.set($event)"
                      ></textarea>
                      <div class="rc-actions">
                        <button type="button" class="ant-btn ant-btn-primary" [disabled]="editBody().trim() === ''" (click)="saveEdit(comment)">
                          {{ 'COLLAB.COMMENT_SAVE' | translate }}
                        </button>
                        <button type="button" class="ant-btn" (click)="cancelEdit()">{{ 'COLLAB.COMMENT_CANCEL' | translate }}</button>
                      </div>
                    </div>
                  } @else {
                    <p class="rc-body">{{ comment.body }}</p>
                    <div class="rc-actions">
                      @if (comment.can_edit) {
                        <button type="button" class="ant-btn ant-btn-link" (click)="startEdit(comment)">{{ 'COLLAB.COMMENT_EDIT' | translate }}</button>
                      }
                      @if (comment.can_delete) {
                        <button type="button" class="ant-btn ant-btn-link" (click)="deleteComment(comment)">{{ 'COLLAB.COMMENT_DELETE' | translate }}</button>
                      }
                    </div>
                  }
                </li>
              }
            </ul>
          }

          <div class="rc-form">
            <textarea
              class="ant-input"
              rows="3"
              [attr.aria-label]="'COLLAB.COMMENT_PLACEHOLDER' | translate"
              [placeholder]="'COLLAB.COMMENT_PLACEHOLDER' | translate"
              [ngModel]="newBody()"
              (ngModelChange)="newBody.set($event)"
            ></textarea>
            <label>
              <span class="rc-meta">{{ 'COLLAB.MENTION_LABEL' | translate }}</span>
              <select multiple class="ant-input" [ngModel]="newMentions()" (ngModelChange)="newMentions.set($event)">
                @for (user of mentionableUsers(); track user.id) {
                  <option [value]="user.id">{{ user.name }}</option>
                }
              </select>
            </label>
            <div class="rc-actions">
              <button type="button" class="ant-btn ant-btn-primary" [disabled]="!canSend()" (click)="sendComment()">
                {{ 'COLLAB.COMMENT_SEND' | translate }}
              </button>
            </div>
          </div>
        }
        @case ('tags') {
          @if (tags().length === 0) {
            <p class="rc-empty">{{ 'COLLAB.TAG_EMPTY' | translate }}</p>
          } @else {
            <div class="rc-tags">
              @for (tag of tags(); track tag.id) {
                <span class="rc-tag" [style.--rc-tag-color]="tag.color">
                  {{ tag.name }}
                  <button type="button" [attr.aria-label]="'COLLAB.TAG_REMOVE' | translate: { name: tag.name }" (click)="removeTag(tag)">x</button>
                </span>
              }
            </div>
          }
          <div class="rc-form">
            <input
              class="ant-input"
              list="rc-tag-suggestions"
              maxlength="60"
              [attr.aria-label]="'COLLAB.TAG_ADD_PLACEHOLDER' | translate"
              [placeholder]="'COLLAB.TAG_ADD_PLACEHOLDER' | translate"
              [ngModel]="newTag()"
              (ngModelChange)="newTag.set($event)"
              (keydown.enter)="addTag()"
            />
            <datalist id="rc-tag-suggestions">
              @for (tag of tagSuggestions(); track tag.id) {
                <option [value]="tag.name"></option>
              }
            </datalist>
            <div class="rc-actions">
              <button type="button" class="ant-btn ant-btn-primary" [disabled]="newTag().trim() === ''" (click)="addTag()">
                {{ 'COLLAB.TAG_ADD' | translate }}
              </button>
            </div>
          </div>
        }
        @case ('activity') {
          @if (activity().length === 0) {
            <p class="rc-empty">{{ 'COLLAB.ACTIVITY_EMPTY' | translate }}</p>
          } @else {
            <ul class="rc-list">
              @for (entry of activity(); track entry.id) {
                <li class="rc-item">
                  <div>{{ activityLabel(entry) | translate }}</div>
                  <div class="rc-meta">
                    {{ entry.actor?.name ?? ('COLLAB.ACTIVITY_SYSTEM' | translate) }} - {{ entry.occurred_at | date: 'medium' }}
                  </div>
                  @if (entry.changed_fields.length > 0) {
                    <div class="rc-meta">{{ 'COLLAB.ACTIVITY_FIELDS' | translate: { fields: entry.changed_fields.join(', ') } }}</div>
                  }
                </li>
              }
            </ul>
          }
        }
      }
    </div>
  `,
})
export class RecordCollaborationComponent {
  /** Record type key registered by the API, for example `contact` or `invoice`. */
  readonly recordType = input.required<string>();
  readonly recordId = input.required<string>();

  private readonly api = inject(CollaborationApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly tabs: readonly { id: CollaborationTab; labelKey: string }[] = [
    { id: 'comments', labelKey: 'COLLAB.TAB_COMMENTS' },
    { id: 'tags', labelKey: 'COLLAB.TAB_TAGS' },
    { id: 'activity', labelKey: 'COLLAB.TAB_ACTIVITY' },
  ];

  readonly activeTab = signal<CollaborationTab>('comments');
  readonly hasError = signal(false);
  readonly comments = signal<CollaborationComment[]>([]);
  readonly tags = signal<CollaborationTag[]>([]);
  readonly activity = signal<CollaborationActivity[]>([]);
  readonly mentionableUsers = signal<CollaborationMentionableUser[]>([]);
  readonly allTags = signal<CollaborationTag[]>([]);

  readonly newBody = signal('');
  readonly newMentions = signal<string[]>([]);
  readonly editingId = signal<string | null>(null);
  readonly editBody = signal('');
  readonly newTag = signal('');

  readonly canSend = computed(() => this.newBody().trim() !== '');
  readonly tagSuggestions = computed(() => {
    const attached = new Set(this.tags().map((tag) => tag.id));
    return this.allTags().filter((tag) => !attached.has(tag.id));
  });

  constructor() {
    effect(() => {
      const type = this.recordType();
      const id = this.recordId();
      untracked(() => this.load(type, id));
    });
  }

  selectTab(tab: CollaborationTab): void {
    this.activeTab.set(tab);

    if (tab === 'activity') {
      this.loadActivity();
    }
  }

  activityLabel(entry: CollaborationActivity): string {
    return ACTIVITY_LABEL_KEYS[entry.action] ?? 'COLLAB.ACTIVITY_UPDATED';
  }

  sendComment(): void {
    const body = this.newBody().trim();

    if (body === '') {
      return;
    }

    this.api.createComment(this.recordType(), this.recordId(), { body, mentions: this.newMentions() }).subscribe({
      next: (response) => {
        this.comments.update((list) => [response.data, ...list]);
        this.newBody.set('');
        this.newMentions.set([]);
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  startEdit(comment: CollaborationComment): void {
    this.editingId.set(comment.id);
    this.editBody.set(comment.body);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editBody.set('');
  }

  saveEdit(comment: CollaborationComment): void {
    const body = this.editBody().trim();

    if (body === '') {
      return;
    }

    this.api.updateComment(comment.id, { body, mentions: comment.mentions }).subscribe({
      next: (response) => {
        this.comments.update((list) => list.map((item) => (item.id === comment.id ? response.data : item)));
        this.cancelEdit();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  deleteComment(comment: CollaborationComment): void {
    this.api.deleteComment(comment.id).subscribe({
      next: () => this.comments.update((list) => list.filter((item) => item.id !== comment.id)),
      error: (error: unknown) => this.fail(error),
    });
  }

  addTag(): void {
    const name = this.newTag().trim();

    if (name === '') {
      return;
    }

    this.api.attachTag(this.recordType(), this.recordId(), { name }).subscribe({
      next: (response) => {
        this.tags.set(response.data);
        this.newTag.set('');
        this.loadAllTags();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  removeTag(tag: CollaborationTag): void {
    this.api.detachTag(this.recordType(), this.recordId(), tag.id).subscribe({
      next: () => this.tags.update((list) => list.filter((item) => item.id !== tag.id)),
      error: (error: unknown) => this.fail(error),
    });
  }

  private load(type: string, id: string): void {
    this.hasError.set(false);
    this.activity.set([]);
    this.cancelEdit();

    this.api.getComments(type, id).subscribe({
      next: (response) => this.comments.set(response.data),
      error: () => this.hasError.set(true),
    });
    this.api.getRecordTags(type, id).subscribe({
      next: (response) => this.tags.set(response.data),
      error: () => this.hasError.set(true),
    });
    this.api.getMentionableUsers().subscribe({
      next: (response) => this.mentionableUsers.set(response.data),
      error: () => this.mentionableUsers.set([]),
    });
    this.loadAllTags();

    if (this.activeTab() === 'activity') {
      this.loadActivity();
    }
  }

  private loadActivity(): void {
    this.api.getActivity(this.recordType(), this.recordId()).subscribe({
      next: (response) => this.activity.set(response.data),
      error: () => this.hasError.set(true),
    });
  }

  private loadAllTags(): void {
    this.api.getTags().subscribe({
      next: (response) => this.allTags.set(response.data),
      error: () => this.allTags.set([]),
    });
  }

  private fail(error: unknown): void {
    const body = error instanceof HttpErrorResponse ? (error.error as { detail?: string; message?: string } | null) : null;
    this.message.error(body?.detail || body?.message || this.translate.instant('COLLAB.ACTION_ERROR'));
  }
}
