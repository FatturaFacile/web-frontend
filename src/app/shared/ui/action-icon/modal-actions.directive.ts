import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  inject,
  input,
  OnInit,
  TemplateRef,
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzModalComponent } from 'ng-zorro-antd/modal';
import { ActionIconName } from './action-icon';
import { IconActionDirective } from './icon-action.directive';

/** Footer of a modal whose buttons are icons: the translated label is the tooltip of the button. */
@Component({
  selector: 'app-modal-actions-footer',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [NzButtonModule, IconActionDirective],
  template: `
    <ng-template #footer>
      <button
        nz-button
        type="button"
        [appIconAction]="cancelAction()"
        [disabled]="!!modal().nzCancelDisabled"
        (click)="modal().triggerCancel()"
      ></button>
      <button
        nz-button
        type="button"
        nzType="primary"
        [appIconAction]="okAction()"
        [nzDanger]="!!modal().nzOkDanger"
        [nzLoading]="!!modal().nzOkLoading"
        [disabled]="!!modal().nzOkDisabled"
        (click)="modal().triggerOk()"
      ></button>
    </ng-template>
  `,
})
export class ModalActionsFooterComponent {
  readonly modal = input.required<NzModalComponent>();
  readonly okAction = input.required<ActionIconName>();
  readonly cancelAction = input.required<ActionIconName>();
  readonly footer = viewChild.required<TemplateRef<{}>>('footer');
}

/**
 * Shared behaviour of every `<nz-modal>`: the footer buttons are icons (with a translated tooltip)
 * and the modal can neither be closed by the Esc key nor by a click on the mask, so that the user
 * never loses the entered data by accident. Use `okAction` to choose the icon of the OK button.
 * A modal that sets its own `nzFooter` (also `null`) keeps it.
 */
@Directive({
  selector: 'nz-modal',
})
export class ModalActionsDirective implements OnInit {
  readonly okAction = input<ActionIconName>('confirm');
  readonly cancelAction = input<ActionIconName>('cancel');

  private readonly modal = inject(NzModalComponent);
  private readonly container = inject(ViewContainerRef);

  ngOnInit(): void {
    this.modal.nzKeyboard = false;
    this.modal.nzMaskClosable = false;
    if (this.modal.nzFooter !== undefined) {
      return;
    }
    const footer = this.container.createComponent(ModalActionsFooterComponent);
    footer.setInput('modal', this.modal);
    footer.setInput('okAction', this.okAction());
    footer.setInput('cancelAction', this.cancelAction());
    footer.changeDetectorRef.detectChanges();
    this.modal.nzFooter = footer.instance.footer();
  }
}
