import { Directive, ElementRef, effect, inject, input, Renderer2 } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import { ACTION_ICONS, ActionIconName } from './action-icon';

/**
 * Turns a button into an icon-only button: `<button nz-button appIconAction="save">`.
 * The text content is replaced by the icon; the translated label becomes tooltip and aria-label.
 */
@Directive({
  selector: 'button[appIconAction]',
})
export class IconActionDirective {
  readonly appIconAction = input.required<ActionIconName>();

  private readonly i18n = inject(I18nService);
  private readonly renderer = inject(Renderer2);
  private readonly button = inject<ElementRef<HTMLButtonElement>>(ElementRef).nativeElement;

  constructor() {
    this.renderer.addClass(this.button, 'app-icon-action');
    effect(() => {
      const definition = ACTION_ICONS[this.appIconAction()];
      const label = this.i18n.translate(definition.labelKey);
      this.renderer.setAttribute(this.button, 'title', label);
      this.renderer.setAttribute(this.button, 'aria-label', label);
      this.renderIcon(definition.icon);
    });
  }

  private renderIcon(iconClasses: string): void {
    this.button.querySelector('.app-icon-action__icon')?.remove();
    const icon = this.renderer.createElement('i');
    iconClasses.split(' ').forEach((c) => this.renderer.addClass(icon, c));
    this.renderer.addClass(icon, 'app-icon-action__icon');
    this.renderer.setAttribute(icon, 'aria-hidden', 'true');
    this.button.prepend(icon);
  }
}
