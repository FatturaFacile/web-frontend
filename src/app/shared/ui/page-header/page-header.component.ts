import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  template: `
    <div class="page-header">
      <h2 class="page-title">{{ title() }}</h2>
      @if (subtitle()) {
        <p class="page-subtitle">{{ subtitle() }}</p>
      }
    </div>
  `,
  styles: `
    .page-header {
      margin-bottom: 24px;
    }
    .page-title {
      font-size: 20px;
      font-weight: 600;
      color: var(--text-primary, #0f172a);
      margin: 0;
      letter-spacing: -0.02em;
    }
    .page-subtitle {
      font-size: 14px;
      color: var(--text-secondary, #64748b);
      margin-top: 4px;
      margin-bottom: 0;
    }
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
}
