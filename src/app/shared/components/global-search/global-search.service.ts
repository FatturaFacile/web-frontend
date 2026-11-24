import { Service, signal } from '@angular/core';

/** Open state of the global search command palette, shared by the layout, the header button and the Ctrl+K shortcut. */
@Service()
export class GlobalSearchService {
  readonly isOpen = signal(false);

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  toggle(): void {
    this.isOpen.update((open) => !open);
  }
}
