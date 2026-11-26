import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { PermissionsService } from '@core';
import { WbsNode } from './portfolio.models';
import { NODES } from './portfolio.testing';
import { ProjectKanbanComponent } from './project-kanban.component';

interface Call {
  method: string;
  url: string;
  body: unknown;
}

const CARDS: WbsNode[] = NODES.map((entry) => (entry.id === 'n11' ? { ...entry, isCritical: true } : entry));

/** The cards as the API holds them: a successful completion update is reflected by the next board load. */
let server: WbsNode[] = CARDS;

function answer(request: TestRequest, calls: Call[], fail: boolean): void {
  const { method, url, body } = request.request;
  calls.push({ method, url, body });

  if (url.includes('/translations/')) {
    request.flush({ translations: {} });
  } else if (method === 'GET' && url.endsWith('/projects/p1/kanban')) {
    request.flush({ data: server });
  } else if (method === 'PUT' && fail) {
    request.flush({ message: 'no' }, { status: 500, statusText: 'Server Error' });
  } else {
    if (method === 'PUT') {
      const nodeId = url.split('/').pop();
      const { percentComplete } = body as { percentComplete: number };
      server = server.map((entry) => (entry.id === nodeId ? { ...entry, percentComplete } : entry));
    }

    request.flush({ data: {} });
  }
}

async function settle(fixture: ComponentFixture<ProjectKanbanComponent>, http: HttpTestingController, calls: Call[], fail: boolean): Promise<void> {
  for (let round = 0; round < 3; round++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 20));

    for (const request of http.match(() => true)) {
      answer(request, calls, fail);
    }

    fixture.detectChanges();
  }
}

async function render(options: { canWrite?: boolean; failWrites?: boolean } = {}) {
  const { canWrite = true, failWrites = false } = options;

  server = CARDS;
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [ProjectKanbanComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'p1' }) }, paramMap: of(convertToParamMap({ id: 'p1' })) } },
      { provide: PermissionsService, useValue: { canWrite: () => canWrite, canRead: () => true } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(ProjectKanbanComponent);
  const http = TestBed.inject(HttpTestingController);
  const calls: Call[] = [];

  fixture.detectChanges();
  await settle(fixture, http, calls, failWrites);

  const element = fixture.nativeElement as HTMLElement;
  const ids = (column: string) =>
    [...element.querySelectorAll(`[data-testid="kb-column-${column}"] [data-testid^="kb-card-"]`)].map((card) => card.getAttribute('data-testid')?.replace('kb-card-', ''));

  return { fixture, component: fixture.componentInstance, calls, element, ids, settle: () => settle(fixture, http, calls, failWrites) };
}

function drop(target: Element, id: string): void {
  const event = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(event, 'dataTransfer', { value: { getData: () => id, setData: () => undefined } });
  target.dispatchEvent(event);
}

describe('ProjectKanbanComponent', () => {
  it('loads the cards of the project from the Kanban endpoint', async () => {
    const { calls } = await render();

    expect(calls.some((call) => call.method === 'GET' && call.url.endsWith('/projects/p1/kanban'))).toBe(true);
  });

  it('puts every task in the column its completion implies', async () => {
    const { ids } = await render();

    expect(ids('todo')).toEqual(['n11', 'n13']);
    expect(ids('inProgress')).toEqual(['n12']);
    expect(ids('done')).toEqual(['n2']);
  });

  it('counts the cards of each column', async () => {
    const { element } = await render();

    expect(element.querySelector('[data-testid="kb-count-todo"]')?.textContent?.trim()).toBe('2');
    expect(element.querySelector('[data-testid="kb-count-done"]')?.textContent?.trim()).toBe('1');
  });

  it('filters the cards by text, type and critical path', async () => {
    const { component, fixture, ids } = await render();

    component.search.set('build');
    fixture.detectChanges();

    expect(ids('inProgress')).toEqual(['n12']);
    expect(ids('todo')).toEqual([]);

    component.search.set('');
    component.nodeType.set('Milestone');
    fixture.detectChanges();

    expect(ids('todo')).toEqual(['n13']);

    component.nodeType.set(null);
    component.criticalOnly.set(true);
    fixture.detectChanges();

    expect(ids('todo')).toEqual(['n11']);
    expect(ids('done')).toEqual([]);
  });

  it('completes a task when its card is moved to the done column and reloads the board', async () => {
    const { component, calls, settle: flush } = await render();
    const card = CARDS.find((entry) => entry.id === 'n12') as WbsNode;

    void component.move(card, 'done');
    await flush();

    const put = calls.find((call) => call.method === 'PUT' && call.url.endsWith('/projects/p1/wbs-nodes/n12'));

    expect(put?.body).toEqual({ percentComplete: 100 });
    expect(calls.filter((call) => call.method === 'GET' && call.url.endsWith('/kanban')).length).toBeGreaterThan(1);
  });

  it('starts a task at 50 percent and reopens a done one at zero', async () => {
    const { component, calls, settle: flush } = await render();

    void component.move(CARDS.find((entry) => entry.id === 'n11') as WbsNode, 'inProgress');
    void component.move(CARDS.find((entry) => entry.id === 'n2') as WbsNode, 'todo');
    await flush();

    const bodies = calls.filter((call) => call.method === 'PUT').map((call) => call.body);

    expect(bodies).toContainEqual({ percentComplete: 50 });
    expect(bodies).toContainEqual({ percentComplete: 0 });
  });

  it('moves a card with the buttons for keyboard users', async () => {
    const { element, calls, settle: flush } = await render();

    (element.querySelector('[data-testid="kb-next-n11"]') as HTMLButtonElement).click();
    await flush();

    expect(calls.some((call) => call.method === 'PUT' && call.url.endsWith('/wbs-nodes/n11'))).toBe(true);
    expect(element.querySelector('[data-testid="kb-prev-n11"]')).not.toBeNull();
  });

  it('moves the card dropped on a column', async () => {
    const { element, calls, settle: flush } = await render();

    drop(element.querySelector('[data-testid="kb-column-done"]') as Element, 'n12');
    await flush();

    expect(calls.find((call) => call.method === 'PUT' && call.url.endsWith('/wbs-nodes/n12'))?.body).toEqual({ percentComplete: 100 });
  });

  it('ignores a drop on the column the card is already in', async () => {
    const { component, calls, settle: flush } = await render();
    const before = calls.length;

    await component.move(CARDS.find((entry) => entry.id === 'n2') as WbsNode, 'done');
    await flush();

    expect(calls.filter((call) => call.method === 'PUT')).toHaveLength(0);
    expect(calls.length).toBe(before);
  });

  it('puts the card back when the API refuses the move', async () => {
    const { component, ids, fixture, settle: flush } = await render({ failWrites: true });

    void component.move(CARDS.find((entry) => entry.id === 'n12') as WbsNode, 'done');
    await flush();
    fixture.detectChanges();

    expect(ids('inProgress')).toEqual(['n12']);
    expect(ids('done')).toEqual(['n2']);
  });

  it('is read-only for a reader', async () => {
    const { element, component, calls, settle: flush } = await render({ canWrite: false });

    expect(element.querySelector('[data-testid="kb-next-n11"]')).toBeNull();
    expect(element.querySelector('[data-testid="kb-card-n11"]')?.getAttribute('draggable')).toBe('false');

    await component.move(CARDS.find((entry) => entry.id === 'n12') as WbsNode, 'done');
    await flush();

    expect(calls.filter((call) => call.method === 'PUT')).toHaveLength(0);
  });
});
