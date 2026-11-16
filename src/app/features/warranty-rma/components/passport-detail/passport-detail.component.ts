import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { EquipmentComponent } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { PassportStore } from '../../state/passport.store';
import { AddExtensionDialogComponent } from './add-extension-dialog.component';

/** Passport detail: warranty, care-pack extensions and component genealogy. */
@Component({
  selector: 'app-passport-detail',
  imports: [
    DatePipe,
    NgTemplateOutlet,
    RouterLink,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzSpinModule,
    NzTableModule,
    NzTabsModule,
    PageHeaderComponent,
    TranslatePipe,
    AddExtensionDialogComponent,
  ],
  templateUrl: './passport-detail.component.html',
  styles: `
    .pd-card {
      margin-top: 16px;
    }
    .pd-removed {
      color: var(--text-secondary, #595959);
    }
  `,
})
export class PassportDetailComponent {
  readonly store = inject(PassportStore);
  readonly extensionOpen = signal(false);

  constructor() {
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        const id = params.get('id');
        if (id) {
          this.store.loadPassport(id);
        }
      });
  }

  componentLabel(components: EquipmentComponent[], id: string | null): string {
    if (!id) {
      return '-';
    }
    const c = components.find((x) => x.id === id);
    return c ? `${c.position} - ${c.component_serial}` : id;
  }
}
