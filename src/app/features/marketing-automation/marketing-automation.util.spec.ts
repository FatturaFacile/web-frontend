import { describe, expect, it } from 'vitest';
import { CatalogProduct, EmailBlock, JourneyStep } from '@core';
import {
  allowedActions,
  asMarketingLocale,
  auditReasonKey,
  blockingJourneyIssues,
  blueprintText,
  cleanCriteria,
  connect,
  edgeKindsOf,
  edgesOf,
  heatColor,
  heatNeedsLightText,
  insertItem,
  journeyIssues,
  localized,
  matrixGrid,
  missingLocales,
  moveItem,
  newBlock,
  newStep,
  parseRegions,
  problemOf,
  productBlockFromCatalog,
  rate,
  removeItem,
  removeStep,
  roiDisplay,
  setBlockText,
  setEntry,
  splitIsValid,
  uniqueStepKey,
  validationMessages,
} from './marketing-automation.util';

const step = (key: string, type: JourneyStep['type'], extra: Partial<JourneyStep> = {}): JourneyStep => ({
  step_key: key,
  type,
  config: {},
  next_step_key: null,
  true_step_key: null,
  false_step_key: null,
  is_entry: false,
  pos_x: 0,
  pos_y: 0,
  ...extra,
});

describe('localized texts', () => {
  it('falls back to Italian, English, German, French', () => {
    expect(localized({ it: 'Ciao', en: 'Hello' }, 'de')).toBe('Ciao');
    expect(localized({ en: 'Hello', fr: 'Salut' }, 'de')).toBe('Hello');
    expect(localized({ fr: 'Salut' }, 'de')).toBe('Salut');
    expect(localized({ de: 'Hallo', it: 'Ciao' }, 'de')).toBe('Hallo');
    expect(localized({ de: '', it: 'Ciao' }, 'de')).toBe('Ciao');
    expect(localized(undefined, 'it')).toBe('');
    expect(localized('plain', 'fr')).toBe('plain');
  });

  it('reads the seeded copy of a blueprint in the language of the user', () => {
    const blueprint = {
      id: '1',
      kind: 'segment_preset' as const,
      code: 'champions',
      texts: { it: { name: 'Campioni' }, en: { name: 'Champions' } },
      payload: {},
    };
    expect(blueprintText(blueprint, 'name', 'en')).toBe('Champions');
    expect(blueprintText(blueprint, 'name', 'de')).toBe('Campioni');
    expect(blueprintText(blueprint, 'description', 'it')).toBe('');
  });

  it('accepts only the four supported languages', () => {
    expect(asMarketingLocale('de-CH')).toBe('de');
    expect(asMarketingLocale('FR')).toBe('fr');
    expect(asMarketingLocale('es')).toBe('it');
    expect(asMarketingLocale(null)).toBe('it');
  });
});

describe('ROI display', () => {
  it('never turns a missing cost into a number', () => {
    expect(roiDisplay(null, 'no_cost')).toEqual({ kind: 'none', value: null });
    expect(roiDisplay(250, 'no_cost')).toEqual({ kind: 'none', value: null });
    expect(roiDisplay(null, 'computed')).toEqual({ kind: 'none', value: null });
  });

  it('flags a loss and shows a gain', () => {
    expect(roiDisplay(180, 'computed')).toEqual({ kind: 'value', value: 180 });
    expect(roiDisplay(-100, 'no_revenue')).toEqual({ kind: 'loss', value: -100 });
  });

  it('rates are percentages with one decimal and zero for an empty base', () => {
    expect(rate(1, 3)).toBe(33.3);
    expect(rate(5, 0)).toBe(0);
  });
});

describe('RFM matrix helpers', () => {
  it('always renders the 5 x 5 grid, with the most recent row on top', () => {
    const grid = matrixGrid([{ r: 5, f: 5, count: 7 }, { r: 1, f: 1, count: 2 }]);
    expect(grid).toHaveLength(5);
    expect(grid[0].map((cell) => cell.r)).toEqual([5, 5, 5, 5, 5]);
    expect(grid[0][4].count).toBe(7);
    expect(grid[4][0].count).toBe(2);
    expect(grid[2].every((cell) => cell.count === 0)).toBe(true);
  });

  it('colours cells by their share of the busiest one', () => {
    expect(heatColor(0, 10)).toBe('transparent');
    expect(heatColor(10, 10)).toBe('rgba(22, 119, 255, 1.00)');
    expect(heatColor(1, 100)).toBe('rgba(22, 119, 255, 0.12)');
    expect(heatNeedsLightText(9, 10)).toBe(true);
    expect(heatNeedsLightText(1, 10)).toBe(false);
  });

  it('drops empty filters and keeps the set ones', () => {
    expect(
      cleanCriteria({
        recency_days_min: 60,
        recency_days_max: null,
        frequency_min: 0,
        exclude_insolvent: true,
        max_overdue_balance: null,
        purchased_product_category_ids: [],
        purchased_window_months: { min: 10, max: null },
        locale: null,
        rfm_labels: ['champions'],
      }),
    ).toEqual({
      recency_days_min: 60,
      frequency_min: 0,
      exclude_insolvent: true,
      purchased_window_months: { min: 10 },
      rfm_labels: ['champions'],
    });
    expect(cleanCriteria({ purchased_window_months: { min: null, max: null } })).toEqual({});
  });

  it('splits regions into unique upper-case codes', () => {
    expect(parseRegions('ti, zh;MI  ti')).toEqual(['TI', 'ZH', 'MI']);
    expect(parseRegions('  ')).toEqual([]);
  });
});

describe('e-mail designer helpers', () => {
  it('creates blocks with empty texts in every language', () => {
    const heading = newBlock('heading');
    expect(heading.props['text']).toEqual({ it: '', de: '', fr: '', en: '' });
    expect(newBlock('product').props['product_id']).toBeNull();
    expect(newBlock('spacer').props['height']).toBe('20px');
    expect(newBlock('heading').id).not.toBe(heading.id);
  });

  it('imports image, description and price of a catalog product into the product block', () => {
    const product: CatalogProduct = {
      id: 'p1',
      sku: 'KIT-1',
      name: 'Kit ricambi',
      description: 'Guarnizioni e filtri',
      price: 249.9,
      currency: 'CHF',
      image_url: 'https://cdn.example.ch/kit.png',
    };
    const block = productBlockFromCatalog(product, 'de');

    expect(block.type).toBe('product');
    expect(block.props['price']).toBe(249.9);
    expect(block.props['currency']).toBe('CHF');
    expect(block.props['image_url']).toBe('https://cdn.example.ch/kit.png');
    expect(block.props['product_id']).toBe('p1');
    expect((block.props['name'] as Record<string, string>)['de']).toBe('Kit ricambi');
    expect((block.props['description'] as Record<string, string>)['it']).toBe('Guarnizioni e filtri');
  });

  it('keeps the translations already written when a product is re-imported', () => {
    const current = setBlockText(newBlock('product'), 'name', 'fr', 'Kit de pièces');
    const block = productBlockFromCatalog(
      { id: 'p2', sku: 'X', name: 'Neues Kit', description: null, price: 1, currency: 'CHF', image_url: null },
      'de',
      current,
    );

    const name = block.props['name'] as Record<string, string>;
    expect(name['de']).toBe('Neues Kit');
    expect(name['fr']).toBe('Kit de pièces');
    expect(block.id).toBe(current.id);
    expect(block.props['image_url']).toBe('');
  });

  it('moves, inserts and removes without mutating the list', () => {
    const items = ['a', 'b', 'c'];
    expect(moveItem(items, 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(items, 2, 0)).toEqual(['c', 'a', 'b']);
    expect(moveItem(items, 1, 1)).toEqual(['a', 'b', 'c']);
    expect(moveItem(items, 9, 0)).toEqual(['a', 'b', 'c']);
    expect(insertItem(items, 'x', 1)).toEqual(['a', 'x', 'b', 'c']);
    expect(insertItem(items, 'x', 99)).toEqual(['a', 'b', 'c', 'x']);
    expect(removeItem(items, 1)).toEqual(['a', 'c']);
    expect(items).toEqual(['a', 'b', 'c']);
  });

  it('sets one language of a text and leaves the others', () => {
    const block = setBlockText(newBlock('text'), 'text', 'de', 'Hallo');
    expect(block.props['text']).toEqual({ it: '', de: 'Hallo', fr: '', en: '' });
  });

  it('lists the languages in which a block is still empty', () => {
    const blocks: EmailBlock[] = [
      setBlockText(setBlockText(newBlock('text'), 'text', 'it', 'Ciao'), 'text', 'en', 'Hello'),
    ];
    expect(missingLocales(blocks)).toEqual(['de', 'fr']);
    expect(missingLocales([])).toEqual([]);
  });

  it('requires the A/B split to add up to 100 %', () => {
    expect(splitIsValid([])).toBe(true);
    expect(splitIsValid([{ percent: 50 }, { percent: 50 }])).toBe(true);
    expect(splitIsValid([{ percent: 60 }, { percent: 30 }])).toBe(false);
  });
});

describe('journey builder helpers', () => {
  it('creates steps with unique keys and the first one as entry', () => {
    const first = newStep('send_email', []);
    const second = newStep('send_email', [first]);

    expect(first.is_entry).toBe(true);
    expect(second.is_entry).toBe(false);
    expect(first.step_key).toBe('send_email_1');
    expect(second.step_key).toBe('send_email_2');
    expect(uniqueStepKey('wait', [step('wait_1', 'wait'), step('wait_2', 'wait')])).toBe('wait_3');
    expect(newStep('wait', []).config).toEqual({ days: 3 });
    expect(newStep('condition', []).config).toEqual({ type: 'clicked_not_ordered' });
  });

  it('lists the edges of the graph', () => {
    const steps = [
      step('a', 'send_email', { next_step_key: 'b', is_entry: true }),
      step('b', 'condition', { true_step_key: 'c', false_step_key: 'd' }),
      step('c', 'end'),
      step('d', 'end'),
    ];
    expect(edgesOf(steps)).toEqual([
      { from: 'a', to: 'b', kind: 'next' },
      { from: 'b', to: 'c', kind: 'true' },
      { from: 'b', to: 'd', kind: 'false' },
    ]);
  });

  it('offers the edges a step type supports', () => {
    expect(edgeKindsOf('condition')).toEqual(['true', 'false']);
    expect(edgeKindsOf('end')).toEqual([]);
    expect(edgeKindsOf('wait')).toEqual(['next']);
  });

  it('connects a step to another and never to itself', () => {
    const steps = [step('a', 'send_email'), step('b', 'end')];
    expect(connect(steps, 'a', 'next', 'b')[0].next_step_key).toBe('b');
    expect(connect(steps, 'a', 'next', 'a')[0].next_step_key).toBeNull();
    expect(connect(connect(steps, 'a', 'next', 'b'), 'a', 'next', null)[0].next_step_key).toBeNull();
  });

  it('removes a step with every edge that pointed at it and moves the entry', () => {
    const steps = [
      step('a', 'send_email', { next_step_key: 'b', is_entry: true }),
      step('b', 'condition', { true_step_key: 'c', false_step_key: 'a' }),
      step('c', 'end'),
    ];
    const rest = removeStep(steps, 'a');

    expect(rest.map((s) => s.step_key)).toEqual(['b', 'c']);
    expect(rest[0].false_step_key).toBeNull();
    expect(rest[0].is_entry).toBe(true);
    expect(rest.filter((s) => s.is_entry)).toHaveLength(1);
    expect(setEntry(steps, 'c').map((s) => s.is_entry)).toEqual([false, false, true]);
  });

  it('finds the problems of a journey before it is sent', () => {
    expect(journeyIssues([])).toEqual([{ issue: 'no_steps' }]);

    const broken = [
      step('a', 'send_email', { next_step_key: 'ghost' }),
      step('b', 'condition', { true_step_key: 'a' }),
      step('c', 'wait'),
    ];
    const issues = journeyIssues(broken).map((entry) => entry.issue);

    expect(issues).toContain('entry_missing');
    expect(issues).toContain('unknown_step');
    expect(issues).toContain('condition_branches');
    expect(issues).toContain('dead_end');
    expect(blockingJourneyIssues(broken)).toEqual(expect.arrayContaining(['entry_missing', 'unknown_step', 'condition_branches']));
  });

  it('accepts a valid journey and reports unreachable steps only as hints', () => {
    const valid = [
      step('mail', 'send_email', { is_entry: true, next_step_key: 'end' }),
      step('end', 'end'),
    ];
    expect(journeyIssues(valid)).toEqual([]);
    expect(blockingJourneyIssues(valid)).toEqual([]);

    const orphan = [...valid, step('lost', 'end')];
    expect(journeyIssues(orphan)).toEqual([{ issue: 'unreachable', step: 'lost' }]);
    expect(blockingJourneyIssues(orphan)).toEqual([]);
  });
});

describe('campaign lifecycle and API errors', () => {
  it('offers only the transitions the API allows', () => {
    expect(allowedActions('draft')).toEqual(['schedule', 'activate', 'archive']);
    expect(allowedActions('active')).toEqual(['pause', 'archive']);
    expect(allowedActions('paused')).toEqual(['activate', 'archive']);
    expect(allowedActions('completed')).toEqual(['archive']);
    expect(allowedActions('archived')).toEqual([]);
  });

  it('reads the code of a problem and the messages of a validation error', () => {
    expect(problemOf({ error: { code: 'sender_identity_required', status: 422 } })?.code).toBe('sender_identity_required');
    expect(problemOf({ error: { message: 'x' } })).toBeNull();
    expect(problemOf(null)).toBeNull();
    expect(validationMessages({ error: { errors: { name: ['required'], 'criteria.locale': ['invalid'] } } })).toEqual(['required', 'invalid']);
    expect(validationMessages(new Error('x'))).toEqual([]);
  });

  it('turns a known step-log reason into a seeded text key and leaves plain data alone', () => {
    expect(auditReasonKey('credit_blocked')).toBe('marketing.reason.credit_blocked');
    expect(auditReasonKey('72h')).toBeNull();
    expect(auditReasonKey(null)).toBeNull();
  });
});
