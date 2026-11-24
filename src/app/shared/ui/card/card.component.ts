import { Component, input } from '@angular/core';

let nextCardId = 0;

/** A surface that groups related content. With a `heading` the card is a labelled region. */
@Component({
  selector: 'app-card',
  template: `
    <section class="card" [attr.aria-labelledby]="heading() ? titleId : null">
      @if (heading()) {
        <h3 class="title" [id]="titleId">{{ heading() }}</h3>
      }
      <ng-content />
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .card {
      padding: var(--ff-density-card-padding);
      background: var(--ff-color-surface);
      color: var(--ff-color-text);
      border: 1px solid var(--ff-color-border);
      border-radius: var(--ff-radius-lg);
      box-shadow: var(--ff-shadow-card);
    }

    .title {
      margin: 0 0 var(--ff-space-3);
      font-size: var(--ff-font-size-lg);
    }
  `,
})
export class CardComponent {
  readonly heading = input<string>();
  protected readonly titleId = `app-card-title-${++nextCardId}`;
}
