import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { PermissionsService } from '@core';
import { DEPENDENCIES, ganttPayload, NODES } from './portfolio.testing';
import { ProjectWorkspaceComponent } from './project-workspace.component';

interface Call {
  method: string;
  url: string;
  body: unknown;
}

function answer(request: TestRequest, calls: Call[]): void {
  const { method, url, body } = request.request;
  calls.push({ method, url, body });

  if (url.includes('/translations/')) {
    request.flush({ translations: {} });
  } else if (method === 'GET' && url.includes('/gantt')) {
    request.flush({ data: ganttPayload() });
  } else if (method === 'GET' && url.endsWith('/baselines')) {
    request.flush({ data: [{ id: 'b1', projectId: 'p1', baselineNumber: 1, name: 'Kick-off', capturedAt: '2027-01-01' }] });
  } else {
    request.flush({ data: {} });
  }
}

async function settle(fixture: ComponentFixture<ProjectWorkspaceComponent>, http: HttpTestingController, calls: Call[]): Promise<void> {
  for (let round = 0; round < 3; round++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 20));

    for (const request of http.match(() => true)) {
      answer(request, calls);
    }

    fixture.detectChanges();
  }
}

async function render(canWrite = true) {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [ProjectWorkspaceComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'p1' }) }, paramMap: of(convertToParamMap({ id: 'p1' })) } },
      { provide: PermissionsService, useValue: { canWrite: () => canWrite, canRead: () => true } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(ProjectWorkspaceComponent);
  const http = TestBed.inject(HttpTestingController);
  const calls: Call[] = [];

  fixture.detectChanges();
  await settle(fixture, http, calls);

  const element = fixture.nativeElement as HTMLElement;

  return { fixture, http, calls, element, settle: () => settle(fixture, http, calls) };
}

function drag(target: Element, from: number, to: number): void {
  const fire = (type: string, x: number) => target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x }));

  fire('pointerdown', from);
  fire('pointermove', to);
  fire('pointerup', to);
}

describe('ProjectWorkspaceComponent', () => {
  it('loads the Gantt and the baselines of the project', async () => {
    const { calls } = await render();

    expect(calls.some((call) => call.method === 'GET' && call.url.endsWith('/projects/p1/gantt'))).toBe(true);
    expect(calls.some((call) => call.method === 'GET' && call.url.endsWith('/projects/p1/baselines'))).toBe(true);
  });

  it('lists the WBS tree with its codes and the Gantt bars side by side', async () => {
    const { element } = await render();

    expect(element.querySelector('[data-testid="ws-split"]')).not.toBeNull();
    expect(element.querySelectorAll('[data-testid^="ws-row-"]')).toHaveLength(NODES.length);
    expect(element.querySelector('[data-testid="ws-row-n12"]')?.textContent).toContain('1.2');
    expect(element.querySelector('[data-testid="ws-row-n12"]')?.textContent).toContain('Build');
    expect(element.querySelectorAll('[data-testid^="gantt-bar-"]')).toHaveLength(NODES.length);
  });

  it('collapses a parent and hides its children from both panes', async () => {
    const { fixture, element } = await render();

    (element.querySelector('[data-testid="ws-toggle-n1"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="ws-row-n11"]')).toBeNull();
    expect(element.querySelector('[data-testid="gantt-bar-n11"]')).toBeNull();
    expect(element.querySelector('[data-testid="ws-row-n1"]')).not.toBeNull();
  });

  it('toggles all the branches from the toolbar', async () => {
    const { fixture, element } = await render();

    (element.querySelector('[data-testid="ws-toggle-all"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(element.querySelectorAll('[data-testid^="ws-row-"]')).toHaveLength(2);

    (element.querySelector('[data-testid="ws-toggle-all"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(element.querySelectorAll('[data-testid^="ws-row-"]')).toHaveLength(NODES.length);
  });

  it('shows the roll-up of a parent in its row', async () => {
    const { element } = await render();
    const cells = element.querySelector('[data-testid="ws-row-n1"]')?.querySelectorAll('.ws-num');

    expect(cells?.[0].textContent?.trim()).toBe('120');
  });

  it('lists the dependencies and deletes one', async () => {
    const { element, calls, settle: flush } = await render();

    expect(element.querySelectorAll('[data-testid^="ws-dep-d"]').length).toBeGreaterThanOrEqual(DEPENDENCIES.length);

    (element.querySelector('[data-testid="ws-dep-delete-d1"]') as HTMLButtonElement).click();
    await flush();

    expect(calls.some((call) => call.method === 'DELETE' && call.url.endsWith('/projects/p1/dependencies/d1'))).toBe(true);
  });

  it('keeps the add dependency button disabled until both ends are chosen', async () => {
    const { element } = await render();

    expect((element.querySelector('[data-testid="ws-dep-add"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('previews the cascade while a bar is dragged and saves, recalculates and reloads on drop', async () => {
    const { fixture, element, calls, settle: flush } = await render();
    const before = calls.length;

    drag(element.querySelector('[data-testid="gantt-bar-n11"]') as Element, 100, 148);
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="ws-preview"]')).not.toBeNull();

    await flush();

    const sent = calls.slice(before);

    expect(sent.some((call) => call.method === 'PUT' && call.url.endsWith('/projects/p1/wbs-nodes/n11'))).toBe(true);
    expect(sent.some((call) => call.method === 'POST' && call.url.endsWith('/projects/p1/cpm/recalculate'))).toBe(true);
    expect(sent.filter((call) => call.method === 'GET' && call.url.includes('/gantt')).length).toBeGreaterThan(0);
  });

  it('moves a task a day with the keyboard', async () => {
    const { element, calls, settle: flush } = await render();

    element.querySelector('[data-testid="gantt-bar-n11"]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await flush();

    const put = calls.find((call) => call.method === 'PUT' && call.url.endsWith('/wbs-nodes/n11'));

    expect(put?.body).toEqual({ startDate: '2027-01-05', endDate: '2027-01-09' });
  });

  it('recalculates the critical path from the toolbar', async () => {
    const { element, calls, settle: flush } = await render();

    (element.querySelector('[data-testid="ws-recalculate"]') as HTMLButtonElement).click();
    await flush();

    expect(calls.some((call) => call.method === 'POST' && call.url.endsWith('/projects/p1/cpm/recalculate'))).toBe(true);
  });

  it('resizes the panes with the keyboard', async () => {
    const { fixture, element } = await render();
    const divider = element.querySelector('[data-testid="ws-divider"]') as HTMLElement;
    const width = () => Number(divider.getAttribute('aria-valuenow'));
    const initial = width();

    divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();

    expect(width()).toBe(initial + 24);

    for (let press = 0; press < 100; press++) {
      divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    }

    fixture.detectChanges();

    expect(width()).toBe(320);
  });

  it('hides the editing controls from a reader and makes the Gantt read-only', async () => {
    const { element, calls, fixture } = await render(false);

    expect(element.querySelector('[data-testid="ws-add-root"]')).toBeNull();
    expect(element.querySelector('[data-testid="ws-recalculate"]')).toBeNull();
    expect(element.querySelector('[data-testid="ws-edit-n11"]')).toBeNull();
    expect(element.querySelector('[data-testid="ws-dep-add"]')).toBeNull();

    const before = calls.length;
    drag(element.querySelector('[data-testid="gantt-bar-n11"]') as Element, 100, 148);
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="ws-preview"]')).toBeNull();
    expect(calls.length).toBe(before);
  });
});
