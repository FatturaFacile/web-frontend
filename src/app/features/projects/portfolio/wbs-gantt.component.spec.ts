import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { BaselineNodeDates } from './portfolio.models';
import { DEPENDENCIES, NODES } from './portfolio.testing';
import { flattenTree } from './portfolio.utils';
import { GanttDragEvent, WbsGanttComponent } from './wbs-gantt.component';

describe('WbsGanttComponent', () => {
  let fixture: ComponentFixture<WbsGanttComponent>;
  let element: HTMLElement;
  const previews: GanttDragEvent[] = [];
  const commits: string[] = [];
  const nudges: GanttDragEvent[] = [];
  let cancels = 0;

  function mouse(type: string, clientX: number, init: MouseEventInit = {}): MouseEvent {
    return new MouseEvent(type, { bubbles: true, cancelable: true, clientX, ...init });
  }

  function bar(id: string): SVGGElement {
    return element.querySelector(`[data-testid="gantt-bar-${id}"]`) as SVGGElement;
  }

  async function render(inputs: { editable?: boolean; baseline?: Map<string, BaselineNodeDates> } = {}): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [WbsGanttComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    previews.length = 0;
    commits.length = 0;
    nudges.length = 0;
    cancels = 0;
    fixture = TestBed.createComponent(WbsGanttComponent);
    fixture.componentRef.setInput('rows', flattenTree(NODES, new Set(['n1'])));
    fixture.componentRef.setInput('nodes', NODES);
    fixture.componentRef.setInput('dependencies', DEPENDENCIES);
    fixture.componentRef.setInput('dayWidth', 24);
    fixture.componentRef.setInput('editable', inputs.editable ?? true);

    if (inputs.baseline !== undefined) {
      fixture.componentRef.setInput('baseline', inputs.baseline);
    }

    fixture.componentInstance.dragPreview.subscribe((event) => previews.push(event));
    fixture.componentInstance.dragCommit.subscribe((id) => commits.push(id));
    fixture.componentInstance.dragCancel.subscribe(() => cancels++);
    fixture.componentInstance.nudge.subscribe((event) => nudges.push(event));
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => render());

  it('draws a bar for every visible row and a diamond for the milestone', () => {
    expect(element.querySelectorAll('[data-testid^="gantt-bar-"]')).toHaveLength(5);
    expect(bar('n13').querySelector('polygon')).not.toBeNull();
    expect(bar('n12').querySelector('polygon')).toBeNull();
  });

  it('leaves out the bars of collapsed rows and the arrows that end on them', async () => {
    fixture.componentRef.setInput('rows', flattenTree(NODES, new Set()));
    fixture.detectChanges();

    expect(element.querySelectorAll('[data-testid^="gantt-bar-"]')).toHaveLength(2);
    expect(element.querySelectorAll('path.link')).toHaveLength(0);
  });

  it('draws an arrow per dependency between visible bars', () => {
    expect(element.querySelectorAll('path.link')).toHaveLength(2);
  });

  it('highlights critical bars and the arrows between them', async () => {
    const critical = NODES.map((node) => (['n11', 'n12'].includes(node.id) ? { ...node, isCritical: true } : node));
    fixture.componentRef.setInput('rows', flattenTree(critical, new Set(['n1'])));
    fixture.detectChanges();

    expect(bar('n11').classList.contains('critical')).toBe(true);
    expect(bar('n12').classList.contains('critical')).toBe(true);
    expect(bar('n13').classList.contains('critical')).toBe(false);
    expect(element.querySelectorAll('path.link.critical')).toHaveLength(1);
  });

  it('overlays the dates of the selected baseline under the bars and marks the late ones', async () => {
    await render({ baseline: new Map([['n12', { nodeId: 'n12', startDate: '2027-01-05', endDate: '2027-01-09' }]]) });

    expect(element.querySelector('[data-testid="gantt-baseline-n12"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="gantt-baseline-n11"]')).toBeNull();
    // Build ends on 13 Jan against 9 Jan in the baseline.
    expect(bar('n12').classList.contains('late')).toBe(true);
    expect(bar('n11').classList.contains('late')).toBe(false);
  });

  it('shows the progress of a bar as a share of its width', () => {
    const progress = bar('n12').querySelector('.progress') as SVGRectElement;
    const shape = bar('n12').querySelector('.shape') as SVGRectElement;

    expect(Number(progress.getAttribute('width'))).toBeCloseTo(Number(shape.getAttribute('width')) / 2);
  });

  it('reports a drag as previews while it moves and a commit on release', () => {
    bar('n12').dispatchEvent(mouse('pointerdown', 100));
    bar('n12').dispatchEvent(mouse('pointermove', 148));
    bar('n12').dispatchEvent(mouse('pointermove', 148));
    bar('n12').dispatchEvent(mouse('pointerup', 148));

    // 48 px at 24 px a day is two days, reported once.
    expect(previews).toEqual([{ nodeId: 'n12', mode: 'move', deltaDays: 2 }]);
    expect(commits).toEqual(['n12']);
    expect(cancels).toBe(0);
  });

  it('reports a leftward drag as negative days', () => {
    bar('n12').dispatchEvent(mouse('pointerdown', 200));
    bar('n12').dispatchEvent(mouse('pointermove', 152));
    bar('n12').dispatchEvent(mouse('pointerup', 152));

    expect(previews.at(-1)?.deltaDays).toBe(-2);
  });

  it('resizes from the handle at the end of the bar', () => {
    const handle = element.querySelector('[data-testid="gantt-handle-n12"]') as SVGRectElement;

    handle.dispatchEvent(mouse('pointerdown', 100));
    handle.dispatchEvent(mouse('pointermove', 124));
    handle.dispatchEvent(mouse('pointerup', 124));

    expect(previews).toEqual([{ nodeId: 'n12', mode: 'resize', deltaDays: 1 }]);
    expect(commits).toEqual(['n12']);
  });

  it('cancels a click that did not move the bar and a drag that the browser interrupts', () => {
    bar('n12').dispatchEvent(mouse('pointerdown', 100));
    bar('n12').dispatchEvent(mouse('pointerup', 100));

    expect(cancels).toBe(1);
    expect(commits).toEqual([]);

    bar('n12').dispatchEvent(mouse('pointerdown', 100));
    bar('n12').dispatchEvent(mouse('pointercancel', 100));

    expect(cancels).toBe(2);
  });

  it('moves a bar one day with the arrow keys and its end with shift', () => {
    bar('n12').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    bar('n12').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true }));
    bar('n12').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(nudges).toEqual([
      { nodeId: 'n12', mode: 'move', deltaDays: 1 },
      { nodeId: 'n12', mode: 'resize', deltaDays: -1 },
    ]);
  });

  it('does not let a parent (summary) bar be dragged or focused', () => {
    bar('n1').dispatchEvent(mouse('pointerdown', 100));
    bar('n1').dispatchEvent(mouse('pointermove', 200));
    bar('n1').dispatchEvent(mouse('pointerup', 200));
    bar('n1').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(previews).toEqual([]);
    expect(commits).toEqual([]);
    expect(nudges).toEqual([]);
    expect(bar('n1').getAttribute('tabindex')).toBeNull();
    expect(bar('n12').getAttribute('tabindex')).toBe('0');
  });

  it('is read-only when not editable', async () => {
    await render({ editable: false });

    bar('n12').dispatchEvent(mouse('pointerdown', 100));
    bar('n12').dispatchEvent(mouse('pointermove', 200));
    bar('n12').dispatchEvent(mouse('pointerup', 200));

    expect(previews).toEqual([]);
    expect(element.querySelector('[data-testid="gantt-handle-n12"]')).toBeNull();
  });

  it('keeps the timeline range while a bar is dragged', () => {
    const before = fixture.componentInstance.scale();

    bar('n12').dispatchEvent(mouse('pointerdown', 100));
    fixture.componentRef.setInput('nodes', NODES.map((node) => (node.id === 'n12' ? { ...node, endDate: '2027-03-30' } : node)));

    expect(fixture.componentInstance.scale()).toEqual(before);

    bar('n12').dispatchEvent(mouse('pointerup', 100));

    expect(fixture.componentInstance.scale().endDay).toBeGreaterThan(before.endDay);
  });
});
