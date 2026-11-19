import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { I18nService } from '@core';
import { environment } from '@env';
import { NzMessageService } from 'ng-zorro-antd/message';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AreaBallotsComponent } from './area-ballots.component';

const BALLOT = { id: 'b-1', meeting_id: 'm-1', question: 'Approvi il bilancio?', options: ['Si', 'No'], is_secret: false, can_vote_self: true, can_vote_for: ['p-9'] };

describe('AreaBallotsComponent', () => {
  const base = `${environment.apiBaseUrl}/association-area`;
  let http: HttpTestingController;

  function create() {
    TestBed.configureTestingModule({
      imports: [AreaBallotsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.createComponent(AreaBallotsComponent);
  }

  afterEach(() => http.verify());

  it('lists the open ballots with a vote for the person and one for each proxy', () => {
    const fixture = create();
    fixture.detectChanges();
    http.expectOne(`${base}/ballots`).flush({ data: [BALLOT] });
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Approvi il bilancio?');
    expect(text).toContain('Per delega 1');
  });

  it('shows the empty state without ballots', () => {
    const fixture = create();
    fixture.detectChanges();
    http.expectOne(`${base}/ballots`).flush({ data: [] });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Nessuna votazione aperta');
  });

  it('sends the vote on behalf of a proxy and reloads', () => {
    const fixture = create();
    fixture.detectChanges();
    http.expectOne(`${base}/ballots`).flush({ data: [BALLOT] });
    (fixture.componentInstance as unknown as { vote: (b: typeof BALLOT, c: string, o?: string) => void }).vote(BALLOT, 'Si', 'p-9');
    const req = http.expectOne(`${base}/ballots/b-1/vote`);
    expect(req.request.body).toEqual({ choice: 'Si', on_behalf_of: 'p-9' });
    req.flush({ data: { recorded: true } });
    http.expectOne(`${base}/ballots`).flush({ data: [] });
  });
});
