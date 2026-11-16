import axe, { AxeResults, ImpactValue, Result, RunOptions } from 'axe-core';

/** The rule sets that make up WCAG 2.2 Level AA (every A and AA success criterion up to 2.2). */
export const WCAG_22_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] as const;

/**
 * jsdom has no layout engine, so three rules cannot give a reliable answer there and are left to other checks:
 * - `color-contrast`: the colour tokens are verified for both themes by src/design-tokens/ff.tokens.spec.ts;
 * - `target-size`: the 24px minimum is a token (--ff-a11y-target-min) checked by the same spec and applied in _a11y.scss;
 * - `region`: isolated component fixtures are not whole pages with landmarks (the page-level spec covers them).
 */
const JSDOM_UNSUPPORTED_RULES: RunOptions['rules'] = {
  'color-contrast': { enabled: false },
  'target-size': { enabled: false },
  region: { enabled: false },
};

export function auditAccessibility(
  context: Element | Document,
  options: RunOptions = {},
): Promise<AxeResults> {
  return axe.run(context, {
    runOnly: { type: 'tag', values: [...WCAG_22_AA_TAGS] },
    rules: { ...JSDOM_UNSUPPORTED_RULES, ...options.rules },
    ...options,
  });
}

function describeViolation(violation: Result): string {
  const impact: ImpactValue | undefined = violation.impact;
  const targets = violation.nodes
    .map((node) => `    ${node.target.join(' ')}\n    ${node.html}`)
    .join('\n');
  return `[${impact ?? 'unknown'}] ${violation.id}: ${violation.help}\n${targets}`;
}

/** The readable list of the violations, empty when the audit is clean. Use it as the message of the assertion. */
export function formatViolations(results: AxeResults): string {
  return results.violations.map(describeViolation).join('\n\n');
}
