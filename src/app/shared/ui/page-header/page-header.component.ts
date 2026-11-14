import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  styleUrl: './page-header.component.scss',
  templateUrl: './page-header.component.html',
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
}
