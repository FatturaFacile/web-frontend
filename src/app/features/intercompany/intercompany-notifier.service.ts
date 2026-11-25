import { inject, Service } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { I18nService } from '@core';
import { IcOutcome } from './intercompany.util';

/** Shows the result of a write as a toast: the translated success text, or the translated refusal with the API detail. */
@Service()
export class IntercompanyNotifier {
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  /** Returns `outcome.ok` so a screen can close its form only on success. */
  report(outcome: IcOutcome, successKey = 'intercompany.common.saved'): boolean {
    if (outcome.ok) {
      this.message.success(this.i18n.translate(successKey));
      return true;
    }
    const text = this.i18n.translate(outcome.errorKey ?? 'intercompany.error.generic');
    this.message.error(
      outcome.detail && outcome.status === 422 ? `${text}: ${outcome.detail}` : text,
    );
    return false;
  }
}
