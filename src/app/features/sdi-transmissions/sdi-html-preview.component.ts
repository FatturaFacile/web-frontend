import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

/**
 * Shows the HTML rendering of a FatturaPA in a fully sandboxed iframe (no scripts, no same-origin access), loaded from
 * an object URL so the markup is never bound into the page itself.
 */
@Component({
  selector: 'app-sdi-html-preview',
  styles: ['iframe { width: 100%; height: 60vh; border: 1px solid var(--border-color, #d9d9d9); border-radius: 4px; background: #fff; }'],
  template: `
    @if (url(); as src) {
      <iframe sandbox="" [src]="src" [title]="title()" data-testid="sdi-preview-frame"></iframe>
    }
  `,
})
export class SdiHtmlPreviewComponent {
  private readonly sanitizer = inject(DomSanitizer);

  /** The rendered document, as a Blob (from the API) or as an HTML string. */
  readonly content = input.required<Blob | string | null>();
  readonly title = input('FatturaPA');

  private objectUrl: string | null = null;
  protected readonly url = signal<SafeResourceUrl | null>(null);
  protected readonly hasContent = computed(() => this.url() !== null);

  constructor() {
    effect(() => this.show(this.content()));
    inject(DestroyRef).onDestroy(() => this.release());
  }

  private show(content: Blob | string | null): void {
    this.release();

    if (content === null || content === '') {
      this.url.set(null);

      return;
    }

    const blob = new Blob([content], { type: 'text/html' });
    this.objectUrl = URL.createObjectURL(blob);
    // The URL was created here from API content and is only ever loaded inside a sandboxed iframe.
    this.url.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
  }

  private release(): void {
    if (this.objectUrl !== null) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
