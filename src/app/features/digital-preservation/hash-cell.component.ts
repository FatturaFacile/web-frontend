import { Component, computed, inject, input, signal } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { shortHash } from './digital-preservation.utils';

/** A SHA-256 digest, truncated, with a copy-to-clipboard button. */
@Component({
  selector: 'app-hash-cell',
  imports: [TranslatePipe],
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    code {
      font-size: 12px;
    }
    button {
      border: 0;
      background: transparent;
      cursor: pointer;
      padding: 2px 4px;
      color: inherit;
    }
  `,
  template: `
    @if (hash()) {
      <code [title]="hash()!" data-testid="hash-short">{{ short() }}</code>
      <button
        type="button"
        data-testid="hash-copy"
        [attr.aria-label]="'PRESERVATION.COPY_HASH' | translate"
        (click)="copy()"
      >
        <i [class]="copied() ? 'fa-solid fa-check' : 'fa-regular fa-copy'" aria-hidden="true"></i>
      </button>
    } @else {
      <span>—</span>
    }
  `,
})
export class HashCellComponent {
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  readonly hash = input<string | null | undefined>(null);
  protected readonly copied = signal(false);
  protected readonly short = computed(() => shortHash(this.hash()));

  protected copy(): void {
    const value = this.hash();
    if (!value) {
      return;
    }
    navigator.clipboard.writeText(value).then(
      () => {
        this.copied.set(true);
        this.message.success(this.i18n.instant('PRESERVATION.HASH_COPIED'));
        setTimeout(() => this.copied.set(false), 1500);
      },
      () => this.message.error(this.i18n.instant('PRESERVATION.COPY_FAILED')),
    );
  }
}
