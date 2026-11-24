import { TestBed } from '@angular/core/testing';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttachmentsApiService } from '@core/api/attachments-api.service';
import { RecordAttachmentsComponent } from './record-attachments.component';

describe('RecordAttachmentsComponent', () => {
  const api = { list: vi.fn(), upload: vi.fn(), download: vi.fn(), delete: vi.fn() };
  const message = { error: vi.fn(), success: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockReturnValue(of({ data: [{ id: 'a1', original_name: 'doc.pdf' }] }));
    api.delete.mockReturnValue(of(undefined));
    TestBed.configureTestingModule({
      imports: [RecordAttachmentsComponent],
      providers: [
        { provide: AttachmentsApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
      ],
    });
  });

  it('lists the attachments of the record', () => {
    const fixture = TestBed.createComponent(RecordAttachmentsComponent);
    fixture.componentRef.setInput('attachableType', 'ticket');
    fixture.componentRef.setInput('attachableId', 't1');
    fixture.detectChanges();
    expect(api.list).toHaveBeenCalledWith('ticket', 't1');
    expect(fixture.nativeElement.textContent).toContain('doc.pdf');
  });

  it('deletes an attachment and reloads', () => {
    const fixture = TestBed.createComponent(RecordAttachmentsComponent);
    fixture.componentRef.setInput('attachableType', 'ticket');
    fixture.componentRef.setInput('attachableId', 't1');
    fixture.detectChanges();
    (fixture.componentInstance as unknown as { remove(a: { id: string }): void }).remove({ id: 'a1' });
    expect(api.delete).toHaveBeenCalledWith('a1');
    expect(api.list).toHaveBeenCalledTimes(2);
  });
});
