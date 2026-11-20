import { Component, computed, input } from '@angular/core';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { CopilotActionCardComponent } from './copilot-action-card.component';
import { CopilotMarkdownComponent } from './copilot-markdown.component';
import { CopilotVisualizationComponent } from './copilot-visualization.component';
import type { CopilotMessage, RegulatoryCitation } from './copilot.models';

/** One chat bubble: Markdown with citation badges and entity chips, analytics widget and action card. */
@Component({
  selector: 'app-copilot-message',
  imports: [NzTagModule, CopilotMarkdownComponent, CopilotVisualizationComponent, CopilotActionCardComponent],
  host: {
    '[class.cp-user]': 'isUser()',
    '[attr.data-testid]': 'testId()',
  },
  template: `
    <div class="cp-bubble">
      @if (isUser()) {
        <span class="cp-plain">{{ message().content_markdown }}</span>
      } @else {
        <app-copilot-markdown [source]="message().content_markdown" [citations]="message().citations" />
        @if (message().streaming && message().content_markdown === '') {
          <span class="cp-dots" aria-hidden="true">…</span>
        }
        @if (extraCitations().length > 0) {
          <div class="cp-sources">
            @for (c of extraCitations(); track c.label) {
              <nz-tag nzColor="blue" data-testid="copilot-citation">{{ c.label }}</nz-tag>
            }
          </div>
        }
        @if (message().visualization; as viz) {
          <app-copilot-visualization [viz]="viz" />
        }
        @if (message().proposed_action) {
          <app-copilot-action-card [message]="message()" />
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: flex;
      margin-bottom: 12px;
    }
    :host(.cp-user) {
      justify-content: flex-end;
    }
    .cp-bubble {
      max-width: 92%;
      padding: 8px 12px;
      border-radius: 10px;
      background: var(--ff-color-surface-raised);
    }
    :host(.cp-user) .cp-bubble {
      background: var(--ff-color-primary-subtle);
    }
    .cp-plain {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .cp-sources {
      margin-top: 4px;
    }
  `,
})
export class CopilotMessageComponent {
  readonly message = input.required<CopilotMessage>();

  protected readonly isUser = computed(() => this.message().role === 'user');
  protected readonly testId = computed(() => `copilot-message-${this.message().role}`);

  /** Regulatory citations the text does not reference inline. */
  protected readonly extraCitations = computed<RegulatoryCitation[]>(() => {
    const text = this.message().content_markdown;
    const stripped = (label: string): string => label.replace(/^\[|\]$/g, '');

    return this.message()
      .citations.filter((c): c is RegulatoryCitation => c.type === 'regulatory')
      .filter((c) => !text.includes(`[${stripped(c.label)}]`));
  });
}
