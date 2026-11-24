import { Component, input } from '@angular/core';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslatePipe } from '@shared';
import { StatusTag } from '../../utils/rma-status';

/** Status shown as colour + icon + text (never by colour alone). */
@Component({
  selector: 'app-rma-status-tag',
  imports: [NzTagModule, TranslatePipe],
  template: `<nz-tag [nzColor]="tag().color"
    ><i [class]="tag().icon" aria-hidden="true"></i>&nbsp;{{ tag().labelKey | translate }}</nz-tag
  >`,
})
export class StatusTagComponent {
  readonly tag = input.required<StatusTag>();
}
