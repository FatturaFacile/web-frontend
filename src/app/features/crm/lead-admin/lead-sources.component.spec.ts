import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LeadApiService, LeadSource } from '@core';
import { icons } from '../../../icons-provider';
import { httpError, i18nStub, messageStub } from '../leads/lead-test.utils';
import { extractSecrets, LeadSourcesComponent, stripSecrets } from './lead-sources.component';
import { LeadSecretModalComponent } from './lead-secret-modal.component';

const EXISTING: LeadSource = {
  id: 's1',
  name: 'Website',
  type: 'web_form',
  webhook_url: 'https://api.test/api/v1/webhooks/crm/leads/s1',
  api_key_prefix: 'ff_ab12',
  last_received_at: null,
};

const CREATED: LeadSource = {
  id: 's2',
  name: 'Landing',
  type: 'wordpress',
  webhook_url: 'https://api.test/api/v1/webhooks/crm/leads/s2',
  api_key_prefix: 'ff_cd34',
  webhook_secret: 'whsec_supersecret',
  api_key: 'ff_cd34_fullkey',
};

describe('lead source secrets', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let setItem: ReturnType<typeof vi.spyOn>;
  let consoleLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    api = {
      listSources: vi.fn().mockReturnValue(of([EXISTING])),
      createSource: vi.fn().mockReturnValue(of(CREATED)),
      updateSource: vi.fn(),
      deleteSource: vi.fn().mockReturnValue(of(null)),
      rotateSourceSecret: vi
        .fn()
        .mockReturnValue(
          of({
            ...EXISTING,
            webhook_secret: 'whsec_rotated',
            api_key: 'ff_new_key',
            api_key_prefix: 'ff_new',
          }),
        ),
    };
    setItem = vi.spyOn(Storage.prototype, 'setItem');
    consoleLog = vi.spyOn(console, 'log');
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        i18nStub(),
        { provide: LeadApiService, useValue: api },
        { provide: NzMessageService, useValue: messageStub() },
      ],
    });
  });

  afterEach(() => {
    setItem.mockRestore();
    consoleLog.mockRestore();
  });

  it('extractSecrets / stripSecrets separate one-shot values from list state', () => {
    expect(extractSecrets(EXISTING)).toBeNull();
    expect(extractSecrets(CREATED)).toEqual({
      source_name: 'Landing',
      webhook_url: CREATED.webhook_url,
      webhook_secret: 'whsec_supersecret',
      api_key: 'ff_cd34_fullkey',
    });
    const clean = stripSecrets(CREATED);
    expect('webhook_secret' in clean).toBe(false);
    expect('api_key' in clean).toBe(false);
    expect(clean.api_key_prefix).toBe('ff_cd34');
  });

  it('shows secret and api key once after create, then forgets them on close', () => {
    const fixture = TestBed.createComponent(LeadSourcesComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;

    cmp.openCreate();
    cmp.form.patchValue({ name: 'Landing', type: 'wordpress' });
    cmp.save();

    expect(api['createSource']).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Landing', type: 'wordpress' }),
    );
    expect(cmp.secrets()).toEqual(extractSecrets(CREATED));
    // List state never holds the secrets.
    expect(JSON.stringify(cmp.sources())).not.toContain('whsec_supersecret');
    expect(JSON.stringify(cmp.sources())).not.toContain('ff_cd34_fullkey');

    fixture.detectChanges();
    const modal = fixture.debugElement.query(
      (d) => d.componentInstance instanceof LeadSecretModalComponent,
    ).componentInstance as LeadSecretModalComponent;
    modal.close();
    expect(cmp.secrets()).toBeNull();

    // Never persisted nor logged.
    const persisted = setItem.mock.calls.map((c: unknown[]) => String(c[1])).join(' ');
    expect(persisted).not.toContain('whsec_supersecret');
    expect(consoleLog).not.toHaveBeenCalledWith(expect.stringContaining('whsec_supersecret'));
  });

  it('rotate-secret shows the new credentials once and keeps only the prefix in the list', () => {
    const fixture = TestBed.createComponent(LeadSourcesComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;

    cmp.rotate(EXISTING);

    expect(api['rotateSourceSecret']).toHaveBeenCalledWith('s1');
    expect(cmp.secrets()).toMatchObject({ webhook_secret: 'whsec_rotated', api_key: 'ff_new_key' });
    expect(cmp.sources()[0]).toMatchObject({ id: 's1', api_key_prefix: 'ff_new' });
    expect(cmp.sources()[0].webhook_secret).toBeUndefined();
  });

  it('a later list response never brings secrets back', () => {
    api['listSources'].mockReturnValue(
      of([{ ...EXISTING, webhook_secret: 'leaked', api_key: 'leaked' }]),
    );
    const cmp = TestBed.createComponent(LeadSourcesComponent).componentInstance;
    expect(JSON.stringify(cmp.sources())).not.toContain('leaked');
  });

  it('switches to a read-only message on 403', () => {
    api['listSources'].mockReturnValue(throwError(() => httpError(403)));
    const fixture = TestBed.createComponent(LeadSourcesComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.forbidden()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('CRM.LEADS.FORBIDDEN');
  });
});
