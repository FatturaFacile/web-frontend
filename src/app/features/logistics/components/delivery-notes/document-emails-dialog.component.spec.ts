import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NzMessageService } from 'ng-zorro-antd/message';
import { describe, expect, it, vi } from 'vitest';
import { I18nService } from '@core';
import { DocumentEmailsDialogComponent } from './document-emails-dialog.component';

describe('DocumentEmailsDialogComponent', () => {
  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
      ],
    });
    const fixture = TestBed.createComponent(DocumentEmailsDialogComponent);
    fixture.componentRef.setInput('type', 'delivery_note');
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  it('loads the sent e-mails of the document when opened', () => {
    const { fixture, http } = setup();
    fixture.componentRef.setInput('documentId', 'ddt-1');
    fixture.detectChanges();

    const request = http.expectOne((req) => req.url.endsWith('/documents/delivery_note/ddt-1/emails'));
    request.flush({ data: [{ id: 'e1', recipient: 'a@b.it', subject: null, message: null, status: 'sent', error: null, sent_at: null, attachment_name: null }] });
    expect(fixture.componentInstance['emails']().length).toBe(1);
  });

  it('sends the document and reloads the history', () => {
    const { fixture, http } = setup();
    fixture.componentRef.setInput('documentId', 'ddt-1');
    fixture.detectChanges();
    http.expectOne((req) => req.method === 'GET').flush({ data: [] });

    fixture.componentInstance['to'].set('x@y.it');
    fixture.componentInstance['send']();
    const post = http.expectOne((req) => req.method === 'POST' && req.url.endsWith('/documents/delivery_note/ddt-1/email'));
    expect(post.request.body).toEqual({ to: 'x@y.it', message: null });
    post.flush({ data: null });
    http.expectOne((req) => req.method === 'GET').flush({ data: [] });
  });
});
