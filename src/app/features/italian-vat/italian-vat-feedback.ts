import { NzMessageService } from 'ng-zorro-antd/message';
import { I18nService } from '@core';
import { problemIssue, problemKey } from './italian-vat.util';

/**
 * Shows the translated rule violation of a failed request. Other failures (network, 5xx, authorisation) are already
 * reported by the global error interceptor, so only the stable rule codes of the module are handled here.
 */
export function reportProblem(error: unknown, i18n: I18nService, message: NzMessageService): void {
  const issue = problemIssue(error);
  if (issue) {
    message.error(i18n.translate(problemKey(issue), issue.params));
  }
}
