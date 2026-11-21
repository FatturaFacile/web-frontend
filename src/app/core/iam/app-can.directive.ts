import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import { PermissionStore } from './permission.store';

/**
 * Structural directive: renders the template only while the user holds the permission key.
 *
 *     <button *appCan="'invoicing.invoices.approve'">Approve</button>
 *
 * Deny by default: nothing renders until the permission snapshot is loaded.
 */
@Directive({ selector: '[appCan]', standalone: true })
export class AppCanDirective {
  private readonly store = inject(PermissionStore);
  private readonly templateRef = inject<TemplateRef<unknown>>(TemplateRef);
  private readonly viewContainer = inject(ViewContainerRef);

  readonly appCan = input.required<string | readonly string[]>();

  private shown = false;

  constructor() {
    effect(() => {
      const wanted = this.appCan();
      const keys = typeof wanted === 'string' ? [wanted] : wanted;
      const allowed = this.store.hasAnyPermission(keys);

      if (allowed && !this.shown) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.shown = true;
      } else if (!allowed && this.shown) {
        this.viewContainer.clear();
        this.shown = false;
      }
    });
  }
}
