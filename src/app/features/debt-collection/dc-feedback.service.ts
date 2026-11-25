import { inject, Service } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { TranslateService } from '@core';
import { DcOutcome } from './debt-collection.util';

/** Shows the result of a write as a toast: the translated success text, or the translated refusal of the API. */
@Service()
export class DcFeedback {
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  /** Returns `true` when the write succeeded so the caller can close its dialog. */
  report(
    outcome: DcOutcome,
    successKey: string | null = null,
    params?: Record<string, string | number>,
  ): boolean {
    if (outcome.ok) {
      if (successKey) {
        this.message.success(this.i18n.translate(successKey, params));
      }
      return true;
    }
    const text = this.i18n.translate(outcome.errorKey ?? 'debtCollection.error.generic');
    const generic = outcome.errorKey === null || outcome.errorKey.endsWith('.generic');
    this.message.error(generic && outcome.detail ? outcome.detail : text);
    return false;
  }
}
