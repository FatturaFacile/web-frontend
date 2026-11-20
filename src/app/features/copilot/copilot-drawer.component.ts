import { Component, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { CopilotMessageComponent } from './copilot-message.component';
import { CopilotStore } from './copilot.store';

/** Slide-over Copilot chat. Opens with Ctrl/Cmd + K or from the header. */
@Component({
  selector: 'app-copilot-drawer',
  imports: [FormsModule, NzAlertModule, NzButtonModule, NzDrawerModule, NzSelectModule, NzTagModule, TranslatePipe, CopilotMessageComponent],
  host: { '(document:keydown)': 'onKeydown($event)' },
  template: `
    <nz-drawer
      [nzVisible]="store.isOpen()"
      nzPlacement="right"
      nzWidth="min(520px, 100vw)"
      [nzTitle]="titleTpl"
      (nzOnClose)="store.close()"
    >
      <ng-template #titleTpl>
        <div class="cp-title">
          <span>{{ 'COPILOT.TITLE' | translate }}</span>
          <nz-tag nzColor="processing" data-testid="copilot-context-badge">
            {{ 'COPILOT.CONTEXT' | translate }}: {{ store.contextLabel() ?? store.context().route }}
          </nz-tag>
        </div>
      </ng-template>
      <ng-container *nzDrawerContent>
        <div class="cp-root">
          <div class="cp-history">
            <nz-select
              class="cp-select"
              nzSize="small"
              nzAllowClear
              [nzPlaceHolder]="'COPILOT.HISTORY' | translate"
              [ngModel]="store.activeConversationId()"
              (ngModelChange)="onSelect($event)"
              [attr.aria-label]="'COPILOT.HISTORY' | translate"
            >
              @for (c of store.conversations(); track c.id) {
                <nz-option [nzValue]="c.id" [nzLabel]="c.title || c.id" />
              }
            </nz-select>
            <button nz-button nzSize="small" type="button" (click)="store.newConversation()" data-testid="copilot-new">
              {{ 'COPILOT.NEW' | translate }}
            </button>
            @if (store.activeConversationId(); as id) {
              <button nz-button nzSize="small" nzDanger type="button" (click)="store.deleteConversation(id)" data-testid="copilot-delete">
                {{ 'COPILOT.DELETE' | translate }}
              </button>
            }
          </div>

          <div #scroller class="cp-messages" role="log" aria-live="polite">
            @if (store.messages().length === 0) {
              <p class="cp-hint">{{ 'COPILOT.EMPTY' | translate }}</p>
              <div class="cp-starters">
                @for (key of store.starterPromptKeys(); track key) {
                  <button type="button" class="cp-chip" (click)="sendKey(key)" data-testid="copilot-starter">{{ key | translate }}</button>
                }
              </div>
            }
            @for (m of store.messages(); track m.id) {
              <app-copilot-message [message]="m" />
            }
            @if (store.activeTool(); as tool) {
              <p class="cp-hint">{{ 'COPILOT.WORKING' | translate }} ({{ tool }})</p>
            }
          </div>

          @if (store.errorKey(); as key) {
            <nz-alert nzType="error" nzShowIcon [nzMessage]="key | translate" data-testid="copilot-error" />
          }

          <form class="cp-input" (submit)="onSubmit($event)">
            <textarea
              class="cp-textarea"
              rows="2"
              [ngModel]="draft()"
              (ngModelChange)="draft.set($event)"
              name="prompt"
              [placeholder]="'COPILOT.PLACEHOLDER' | translate"
              [attr.aria-label]="'COPILOT.PLACEHOLDER' | translate"
              (keydown.enter)="onEnter($event)"
              data-testid="copilot-input"
            ></textarea>
            @if (store.isStreaming()) {
              <button nz-button type="button" (click)="store.cancelStreaming()" data-testid="copilot-stop">
                {{ 'COPILOT.STOP' | translate }}
              </button>
            } @else {
              <button nz-button nzType="primary" type="submit" [disabled]="draft().trim() === ''" data-testid="copilot-send">
                {{ 'COPILOT.SEND' | translate }}
              </button>
            }
          </form>
        </div>
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    .cp-title {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .cp-root {
      display: flex;
      flex-direction: column;
      height: 100%;
      gap: 8px;
    }
    .cp-history {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .cp-select {
      flex: 1;
      min-width: 0;
    }
    .cp-messages {
      flex: 1;
      overflow-y: auto;
    }
    .cp-hint {
      opacity: 0.7;
    }
    .cp-starters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .cp-chip {
      border: 1px solid var(--ff-color-border-subtle);
      border-radius: 16px;
      padding: 4px 12px;
      background: var(--ff-color-surface-raised);
      color: inherit;
      cursor: pointer;
      font: inherit;
    }
    .cp-chip:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }
    .cp-input {
      display: flex;
      gap: 8px;
      align-items: flex-end;
    }
    .cp-textarea {
      flex: 1;
      resize: none;
      padding: 6px 8px;
      border: 1px solid var(--ff-color-border-subtle);
      border-radius: 6px;
      background: transparent;
      color: inherit;
      font: inherit;
    }
  `,
})
export class CopilotDrawerComponent {
  protected readonly store = inject(CopilotStore);
  protected readonly draft = signal('');
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly i18n = inject(I18nService);

  constructor() {
    // Keep the newest content in view while streaming.
    effect(() => {
      this.store.messages();
      const el = this.scroller()?.nativeElement;
      if (el) {
        queueMicrotask(() => (el.scrollTop = el.scrollHeight));
      }
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.store.toggle();
    }
  }

  onEnter(event: Event): void {
    const e = event as KeyboardEvent;
    if (!e.shiftKey && !e.isComposing) {
      e.preventDefault();
      this.send(this.draft());
    }
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    this.send(this.draft());
  }

  onSelect(id: string | null): void {
    if (id) {
      void this.store.selectConversation(id);
    } else {
      this.store.newConversation();
    }
  }

  sendKey(key: string): void {
    this.send(this.i18n.translate(key));
  }

  send(text: string): void {
    if (text.trim() === '') return;
    this.draft.set('');
    void this.store.send(text);
  }
}
