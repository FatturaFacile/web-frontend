import { Component, computed, input } from '@angular/core';
import { CopilotInlineComponent } from './copilot-inline.component';
import type { CopilotCitation } from './copilot.models';
import { parseMarkdown } from './markdown';

/** Sanitized Markdown view: the source is parsed to tokens and rendered by bindings, never as HTML. */
@Component({
  selector: 'app-copilot-markdown',
  imports: [CopilotInlineComponent],
  template: `@for (block of blocks(); track $index) {
    @switch (block.kind) {
      @case ('paragraph') {
        <p><app-copilot-inline [tokens]="block.children" /></p>
      }
      @case ('heading') {
        <p class="cp-heading"><strong><app-copilot-inline [tokens]="block.children" /></strong></p>
      }
      @case ('list') {
        @if (block.ordered) {
          <ol>
            @for (item of block.items; track $index) {
              <li><app-copilot-inline [tokens]="item" /></li>
            }
          </ol>
        } @else {
          <ul>
            @for (item of block.items; track $index) {
              <li><app-copilot-inline [tokens]="item" /></li>
            }
          </ul>
        }
      }
      @case ('code') {
        <pre><code>{{ block.text }}</code></pre>
      }
      @case ('quote') {
        <blockquote><app-copilot-inline [tokens]="block.children" /></blockquote>
      }
      @case ('table') {
        <table>
          <thead>
            <tr>
              @for (cell of block.header; track $index) {
                <th><app-copilot-inline [tokens]="cell" /></th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of block.rows; track $index) {
              <tr>
                @for (cell of row; track $index) {
                  <td><app-copilot-inline [tokens]="cell" /></td>
                }
              </tr>
            }
          </tbody>
        </table>
      }
      @case ('rule') {
        <hr />
      }
    }
  }`,
  styles: `
    :host { display: block; overflow-wrap: anywhere; }
    p, ul, ol, pre, blockquote, table { margin: 0 0 8px; }
    pre { overflow-x: auto; padding: 8px; border-radius: 6px; background: var(--ff-color-surface-raised); }
    blockquote { padding-left: 8px; border-left: 3px solid var(--ff-color-border-subtle); }
    table { border-collapse: collapse; }
    th, td { padding: 2px 8px; border: 1px solid var(--ff-color-border-subtle); text-align: left; }
  `,
})
export class CopilotMarkdownComponent {
  readonly source = input.required<string>();
  readonly citations = input<readonly CopilotCitation[]>([]);

  protected readonly blocks = computed(() => parseMarkdown(this.source(), this.citations()));
}
