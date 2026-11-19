import { ResourceAction, ResourcePageConfig } from '@shared';
import { describe, expect, it } from 'vitest';
import { SDI_CHANNEL_PAGE } from './sdi-channel.page';

function actionsOf(page: ResourcePageConfig): ResourceAction[] {
  return page.tabs.flatMap((tab) => [...(tab.toolbar ?? []), ...(tab.rowActions ?? [])]);
}

describe('SDI_CHANNEL_PAGE', () => {
  it('has a channel tab and a quarantine tab on the settings API', () => {
    expect(SDI_CHANNEL_PAGE.tabs.map((tab) => tab.id)).toEqual(['channel', 'quarantine']);
    expect(SDI_CHANNEL_PAGE.tabs.every((tab) => tab.list.path.startsWith('/settings/sdi-channel'))).toBe(true);
  });

  it('edits the channel with a prefilled form that requires the channel type', () => {
    const edit = actionsOf(SDI_CHANNEL_PAGE).find((action) => action.method === 'PUT');
    expect(edit?.path).toBe('/settings/sdi-channel');
    expect(edit?.prefill).toBe(true);
    const channel = edit?.fields?.find((field) => field.key === 'channel');
    expect(channel?.required).toBe(true);
    expect(channel?.options).toContain('pec');
  });

  it('masks every credential field of the channel form', () => {
    const edit = actionsOf(SDI_CHANNEL_PAGE).find((action) => action.method === 'PUT');
    const secrets = (edit?.fields ?? []).filter((field) => field.secret).map((field) => field.key);
    expect(secrets).toEqual(['pec_password', 'webhook_secret']);
  });

  it('polls the channel and retries a quarantined message only after confirmation', () => {
    const posts = actionsOf(SDI_CHANNEL_PAGE).filter((action) => action.method === 'POST');
    expect(posts.map((action) => action.path)).toEqual(['/settings/sdi-channel/poll', '/settings/sdi-channel/quarantine/{id}/retry']);
    expect(posts.every((action) => !!action.confirmKey)).toBe(true);
  });
});
