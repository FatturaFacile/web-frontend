import { describe, expect, it } from 'vitest';
import { renderPageWithEmptyBackend } from '../../../../../testing/component-smoke';
import { DeliveryNoteFormModalComponent } from './delivery-note-form-modal.component';

describe('DeliveryNoteFormModalComponent', () => {
  it('renders its template against an empty backend and answers every request', async () => {
    const { fixture, requests } = await renderPageWithEmptyBackend(DeliveryNoteFormModalComponent, { visible: true, source: { kind: 'order', id: 'o1', items: [] } });

    expect(fixture.nativeElement).toBeInstanceOf(HTMLElement);
    expect(requests.every((request) => request.startsWith('GET ') || request.startsWith('POST '))).toBe(true);
  });
});
