import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { PageHeaderComponent, TranslatePipe } from '@shared';

/** Generic "coming soon" page; the title is read from the route `data.titleKey`. */
@Component({
  selector: 'app-placeholder-page',
  styleUrl: './placeholder-page.component.scss',
  imports: [NzCardModule, NzEmptyModule, PageHeaderComponent, TranslatePipe],
  template: `
    <app-page-header [title]="titleKey() | translate" [subtitle]="'PLACEHOLDER.SUBTITLE' | translate" />
    <nz-card>
      <nz-empty [nzNotFoundContent]="'PLACEHOLDER.EMPTY' | translate" />
    </nz-card>
  `,
})
export class PlaceholderPageComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly titleKey = computed<string>(
    () => (this.route.snapshot.data['titleKey'] as string | undefined) ?? 'PLACEHOLDER.TITLE',
  );
}
