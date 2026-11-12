import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../../../icons-provider';
import { I18nService, TicketApiService, TranslateService } from '@core';
import { TicketCreateDrawerComponent } from './ticket-create-drawer.component';

interface Harness {
  form: { patchValue(value: object): void; controls: { title: { touched: boolean } } };
  submit(): void;
}

describe('TicketCreateDrawerComponent validation', () => {
  const api = { createTicket: vi.fn() };

  function createDrawer(): Harness {
    const fixture = TestBed.createComponent(TicketCreateDrawerComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    return fixture.componentInstance as unknown as Harness;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api.createTicket.mockReturnValue(of({ data: {}, message: 'ok' }));
    TestBed.configureTestingModule({
      imports: [TicketCreateDrawerComponent],
      providers: [
        provideNzIcons(icons),
        { provide: TicketApiService, useValue: api },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: I18nService, useValue: { translate: (key: string) => key, instant: (key: string) => key } },
      ],
    });
  });

  it('does not create a ticket from an empty form', () => {
    const drawer = createDrawer();

    drawer.submit();

    expect(api.createTicket).not.toHaveBeenCalled();
    expect(drawer.form.controls.title.touched).toBe(true);
  });

  it('creates the ticket once the title is given', () => {
    const drawer = createDrawer();
    drawer.form.patchValue({ title: 'Printer broken' });

    drawer.submit();

    expect(api.createTicket).toHaveBeenCalledTimes(1);
  });
});
