import { Directive, ElementRef, inject, OnInit } from '@angular/core';

@Directive({
  selector: '[appAutofocus]',
})
export class AutofocusDirective implements OnInit {
  private readonly el = inject(ElementRef);

  ngOnInit(): void {
    const htmlElement = this.el.nativeElement as HTMLElement;
    htmlElement.focus?.();
  }
}
