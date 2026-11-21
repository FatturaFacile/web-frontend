import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  addDays,
  alternativeWorkCenters,
  blockRect,
  bucketClass,
  bucketHeight,
  bucketLevel,
  bucketPercentage,
  bucketsByDate,
  dateToX,
  dayNumber,
  daySpan,
  droppedRange,
  formatIsoDate,
  isOverloaded,
  layoutRows,
  loadPercentage,
  maxLoad,
  overloadedBuckets,
  windowDays,
  xToDate,
} from './mrp-gantt.utils';
import { buildPeggingTree, rootDemandNodes } from './mrp-pegging.utils';
import { bucket, GANTT, PEGGING, proposal, typed } from './mrp.fixtures';
import {
  countEntries,
  errorDetail,
  formatQuantity,
  isEligible,
  isNewOrder,
  summarizeAction,
} from './mrp.utils';

describe('mrp.utils', () => {
  const rows = [
    typed('a', 'PlannedPurchaseRequisition'),
    typed('b', 'PlannedPurchaseRequisition', { status: 'Firm' }),
    typed('c', 'PlannedProductionOrder'),
    typed('d', 'PlannedSubcontractOrder'),
    typed('e', 'RescheduleIn_Expedite'),
    typed('f', 'PlannedProductionOrder', { status: 'Released' }),
  ];

  it('knows which proposals are new orders and which are advice', () => {
    expect(isNewOrder(rows[0])).toBe(true);
    expect(isNewOrder(rows[3])).toBe(true);
    expect(isNewOrder(rows[4])).toBe(false);
  });

  it('mirrors the server eligibility rules', () => {
    expect(isEligible(rows[0], 'firm')).toBe(true);
    expect(isEligible(rows[1], 'firm')).toBe(false);
    expect(isEligible(rows[1], 'release')).toBe(true);
    expect(isEligible(rows[5], 'release')).toBe(false);
    expect(isEligible(rows[4], 'release')).toBe(false);
    expect(isEligible(rows[4], 'dismiss')).toBe(true);
    expect(isEligible(rows[5], 'dismiss')).toBe(false);
  });

  it('summarises a mass release: requisitions, production orders and ineligible rows', () => {
    const summary = summarizeAction(rows, 'release');

    expect(summary).toEqual({
      action: 'release',
      selected: 6,
      eligible: 4,
      ineligible: 2,
      purchaseRequisitions: 2,
      productionOrders: 2,
    });
  });

  it('reads the detail of a problem or Laravel error', () => {
    const problem = new HttpErrorResponse({ status: 422, error: { detail: 'Proposal is not eligible', message: 'x' } });
    const laravel = new HttpErrorResponse({ status: 422, error: { message: 'The given data was invalid.' } });

    expect(errorDetail(problem)).toBe('Proposal is not eligible');
    expect(errorDetail(laravel)).toBe('The given data was invalid.');
    expect(errorDetail(new Error('boom'))).toBeNull();
  });

  it('formats decimal strings without trailing zeros', () => {
    expect(formatQuantity('20.0000')).toBe('20');
    expect(formatQuantity('12.5000')).toBe('12.5');
    expect(formatQuantity(null)).toBe('-');
  });

  it('orders count maps by count and drops zeros', () => {
    expect(countEntries({ a: 1, b: 3, c: 0 })).toEqual([
      { key: 'b', count: 3 },
      { key: 'a', count: 1 },
    ]);
    expect(countEntries(undefined)).toEqual([]);
  });

  it('keeps a plain proposal factory sane', () => {
    expect(proposal({ id: 'x' }).status).toBe('Proposed');
  });
});

describe('mrp-pegging.utils', () => {
  const tree = buildPeggingTree(PEGGING);

  it('puts the proposal at the top with an upstream and a downstream branch', () => {
    expect(tree.nodes).toHaveLength(1);
    expect(tree.nodes[0].children.map((node) => node.key)).toEqual(['group-upstream', 'group-downstream']);
  });

  it('maps upstream down to the root demands, recursively', () => {
    const upstream = tree.nodes[0].children[0];

    expect(upstream.children.map((node) => node.detail.sourceType)).toEqual(['sales_order_line', 'mrp_proposal']);
    expect(upstream.children[0].detail.isRootDemand).toBe(true);
    expect(upstream.children[0].isLeaf).toBe(true);

    const parent = upstream.children[1];

    expect(parent.detail.itemCode).toBe('BIKE');
    expect(parent.detail.isRootDemand).toBe(false);
    expect(parent.children[0].detail.sourceType).toBe('mps_line');
    expect(parent.children[0].detail.isRootDemand).toBe(true);
  });

  it('maps downstream components as nested children', () => {
    const downstream = tree.nodes[0].children[1];

    expect(downstream.children.map((node) => node.detail.itemCode)).toEqual(['TUBE']);
    expect(downstream.children[0].children.map((node) => node.detail.itemCode)).toEqual(['STEEL']);
    expect(downstream.children[0].children[0].isLeaf).toBe(true);
  });

  it('indexes every node by key and lists the root demands', () => {
    expect(Object.keys(tree.details).length).toBe(8);
    expect(rootDemandNodes(tree).map((detail) => detail.sourceType)).toEqual(['sales_order_line', 'mps_line']);
  });
});

describe('mrp-gantt.utils', () => {
  it('counts days without timezone drift', () => {
    expect(daySpan('2027-03-01', '2027-03-07')).toBe(7);
    expect(addDays('2027-03-28', 1)).toBe('2027-03-29');
    expect(addDays('2027-12-31', 1)).toBe('2028-01-01');
    expect(windowDays('2027-03-01', '2027-03-03')).toEqual(['2027-03-01', '2027-03-02', '2027-03-03']);
    expect(dayNumber('2027-03-02') - dayNumber('2027-03-01')).toBe(1);
  });

  it('maps a date to an x position and back', () => {
    expect(dateToX('2027-03-04', '2027-03-01', 40)).toBe(120);
    expect(xToDate(125, '2027-03-01', 40)).toBe('2027-03-04');
    expect(xToDate(119, '2027-03-01', 40)).toBe('2027-03-03');
  });

  it('sizes a block: first and last day are covered and the window clips it', () => {
    expect(blockRect({ start_date: '2027-03-01', end_date: '2027-03-02' }, '2027-03-01', '2027-03-07', 40)).toEqual({
      left: 0,
      width: 80,
    });
    expect(blockRect({ start_date: '2027-03-04', end_date: '2027-03-04' }, '2027-03-01', '2027-03-07', 40)).toEqual({
      left: 120,
      width: 40,
    });
    expect(blockRect({ start_date: '2027-02-27', end_date: '2027-03-02' }, '2027-03-01', '2027-03-07', 40)).toEqual({
      left: 0,
      width: 80,
    });
  });

  it('stacks overlapping blocks on separate rows', () => {
    const [first, second] = GANTT.work_centers[0].blocks;
    const overlapping = { ...second, id: 'blk-3', start_date: '2027-03-02', end_date: '2027-03-03' };
    const { rows, rowCount } = layoutRows([first, second, overlapping]);

    expect(rows['blk-1']).toBe(0);
    expect(rows['blk-3']).toBe(1);
    expect(rows['blk-2']).toBe(0);
    expect(rowCount).toBe(2);
  });

  it('computes load percentages', () => {
    expect(loadPercentage(500, 300)).toBe(166.67);
    expect(loadPercentage(0, 0)).toBe(0);
    expect(loadPercentage(10, 0)).toBe(999);
  });

  it('detects overload strictly above 100 %', () => {
    expect(isOverloaded(bucket('2027-03-01', 'D', 300, 300, '100.00'))).toBe(false);
    expect(isOverloaded(bucket('2027-03-01', 'D', 301, 300, '100.33'))).toBe(true);
    expect(isOverloaded(bucket('2027-03-01', 'D', 500, 300, '166.67'))).toBe(true);
  });

  it('falls back to the computed percentage when the served one is not a number', () => {
    expect(bucketPercentage({ ...bucket('2027-03-01', 'D', 150, 300, '50'), load_percentage: 'n/a' })).toBe(50);
  });

  it('selects the red class for overloaded buckets only', () => {
    expect(bucketClass(bucket('2027-03-01', 'D', 500, 300, '166.67'))).toBe('bucket--overload');
    expect(bucketClass(bucket('2027-03-01', 'D', 270, 300, '90.00'))).toBe('bucket--high');
    expect(bucketClass(bucket('2027-03-01', 'D', 150, 300, '50.00'))).toBe('bucket--ok');
    expect(bucketLevel(bucket('2027-03-01', 'D', 0, 300, '0'))).toBe('idle');
  });

  it('caps the histogram height at the ceiling', () => {
    expect(bucketHeight(bucket('2027-03-01', 'D', 900, 300, '300.00'))).toBe(1);
    expect(bucketHeight(bucket('2027-03-01', 'D', 150, 300, '75.00'))).toBe(0.5);
  });

  it('reports the overloaded buckets and the peak of a work centre', () => {
    const weld = GANTT.work_centers[0];

    expect(overloadedBuckets(weld)).toHaveLength(1);
    expect(maxLoad(weld)).toBe(166.67);
    expect(Object.keys(bucketsByDate(weld))).toEqual(['2027-03-01', '2027-03-02']);
  });

  it('computes the dates of a dropped block, keeping its span', () => {
    const block = { start_date: '2027-03-01', end_date: '2027-03-02' };

    // grabbed 10px into the block, dropped with the pointer 130px into the lane: starts on day 3 (2027-03-04)
    expect(droppedRange(block, 130, 10, '2027-03-01', 40)).toEqual({ start_date: '2027-03-04', end_date: '2027-03-05' });
    expect(droppedRange(block, 10, 10, '2027-03-01', 40)).toEqual({ start_date: '2027-03-01', end_date: '2027-03-02' });
  });

  it('lists only the alternatives of a work centre', () => {
    expect(alternativeWorkCenters(GANTT.work_centers, 'wc-a').map((center) => center.id)).toEqual(['wc-b']);
    expect(alternativeWorkCenters(GANTT.work_centers, 'wc-c')).toEqual([]);
    expect(alternativeWorkCenters(GANTT.work_centers, 'missing')).toEqual([]);
  });

  it('formats a local date without a timezone shift', () => {
    expect(formatIsoDate(new Date(2027, 2, 4))).toBe('2027-03-04');
  });
});
