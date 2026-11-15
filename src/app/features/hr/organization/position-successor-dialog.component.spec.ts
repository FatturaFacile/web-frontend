import { describe, expect, it } from 'vitest';
import { renderPageWithEmptyBackend } from '../../../../testing/component-smoke';
import { PositionSuccessorDialogComponent } from './position-successor-dialog.component';

describe('PositionSuccessorDialogComponent', () => {
  it('renders its template against an empty backend and answers every request', async () => {
    const { fixture, requests } = await renderPageWithEmptyBackend(PositionSuccessorDialogComponent, { open: true, positionId: 'p1', currentSuccessor: null, employees: [] });

    expect(fixture.nativeElement).toBeInstanceOf(HTMLElement);
    expect(requests.every((request) => request.startsWith('GET ') || request.startsWith('POST '))).toBe(true);
  });
});
