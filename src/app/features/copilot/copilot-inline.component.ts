import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import type { EntityCitation } from './copilot.models';
import type { InlineToken } from './markdown';

/** Renders inline Markdown tokens: text, emphasis, links, regulatory citation badges and entity chips. */
@Component({
  selector: 'app-copilot-inline',
  imports: [NzTagModule, NzTooltipModule],
  template: `@for (token of tokens(); track $index) {
    @switch (token.kind) {
      @case ('text') {
        {{ token.text }}
      }
      @case ('strong') {
        <strong><app-copilot-inline [tokens]="token.children" /></strong>
      }
      @case ('em') {
        <em><app-copilot-inline [tokens]="token.children" /></em>
      }
      @case ('code') {
        <code>{{ token.text }}</code>
      }
      @case ('link') {
        <a [href]="token.href" target="_blank" rel="noopener noreferrer"><app-copilot-inline [tokens]="token.children" /></a>
      }
      @case ('regulatory') {
        <nz-tag
          class="cp-citation"
          nzColor="blue"
          nz-tooltip
          [nzTooltipTitle]="token.citation.title ?? token.citation.section_ref ?? ''"
          data-testid="copilot-citation"
          >{{ token.label }}</nz-tag
        >
      }
      @case ('entity') {
        <button type="button" class="cp-entity" data-testid="copilot-entity-chip" (click)="open(token.citation)">{{ token.label }}</button>
      }
    }
  }`,
  styles: `
    :host { display: contents; }
    code { padding: 0 4px; border-radius: 4px; background: var(--ff-color-surface-raised); font-size: 0.9em; }
    .cp-entity { border: 1px solid var(--ff-color-border-subtle); border-radius: 12px; padding: 0 8px; background: var(--ff-color-primary-subtle); color: inherit; cursor: pointer; font: inherit; font-size: 0.9em; }
    .cp-entity:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
  `,
})
export class CopilotInlineComponent {
  readonly tokens = input.required<InlineToken[]>();
  private readonly router = inject(Router);

  open(citation: EntityCitation): void {
    if (citation.route) {
      void this.router.navigateByUrl(citation.route);
    }
  }
}
