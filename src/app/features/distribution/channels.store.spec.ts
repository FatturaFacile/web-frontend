import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DistributionApiService } from '@core';
import { ChannelsStore } from './channels.store';

const ok = (data: unknown = {}) => of({ success: true, message: '', data });

describe('ChannelsStore', () => {
  const api = {
    getLookups: vi.fn(),
    listChannels: vi.fn(),
    listChannelRules: vi.fn(),
    createChannel: vi.fn(),
    updateChannel: vi.fn(),
    deleteChannel: vi.fn(),
    createChannelRule: vi.fn(),
    updateChannelRule: vi.fn(),
    deleteChannelRule: vi.fn(),
  };
  let store: InstanceType<typeof ChannelsStore>;

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.getLookups.mockReturnValue(ok({ warehouses: [] }));
    api.listChannels.mockReturnValue(ok([{ id: 'c1' }, { id: 'c2' }]));
    api.listChannelRules.mockReturnValue(ok([{ id: 'r1' }]));
    TestBed.configureTestingModule({
      providers: [ChannelsStore, { provide: DistributionApiService, useValue: api }],
    });
    store = TestBed.inject(ChannelsStore);
  });

  it('loads the channels and the rules of the first one', async () => {
    await store.load();

    expect(store.selectedId()).toBe('c1');
    expect(api.listChannelRules).toHaveBeenCalledWith('c1');
    expect(store.rules()).toHaveLength(1);
  });

  it('keeps the selected channel across a reload and falls back when it disappears', async () => {
    await store.load();
    await store.select('c2');
    expect(api.listChannelRules).toHaveBeenLastCalledWith('c2');

    await store.load();
    expect(store.selectedId()).toBe('c2');

    api.listChannels.mockReturnValue(ok([{ id: 'c1' }]));
    await store.load();
    expect(store.selectedId()).toBe('c1');
  });

  it('shows no rules when there is no channel', async () => {
    api.listChannels.mockReturnValue(ok([]));

    await store.load();

    expect(store.selectedId()).toBeNull();
    expect(store.rules()).toEqual([]);
  });

  it('saves and deletes channels', async () => {
    api.createChannel.mockReturnValue(ok());
    api.updateChannel.mockReturnValue(ok());
    api.deleteChannel.mockReturnValue(ok(null));
    const payload = { code: 'WEB', name: 'Web shop', channel_type: 'ecommerce' as const };

    expect((await store.saveChannel(payload)).ok).toBe(true);
    expect(api.createChannel).toHaveBeenCalledWith(payload);
    expect((await store.saveChannel(payload, 'c1')).ok).toBe(true);
    expect(api.updateChannel).toHaveBeenCalledWith('c1', payload);
    expect((await store.removeChannel('c1')).ok).toBe(true);
  });

  it('adds a rule to the selected channel, updates and deletes it', async () => {
    await store.load();
    api.createChannelRule.mockReturnValue(ok());
    api.updateChannelRule.mockReturnValue(ok());
    api.deleteChannelRule.mockReturnValue(ok(null));
    const payload = {
      warehouse_id: 'w1',
      allocation_mode: 'percentage' as const,
      allocation_percentage: 60,
    };

    expect((await store.saveRule(payload)).ok).toBe(true);
    expect(api.createChannelRule).toHaveBeenCalledWith('c1', payload);
    expect((await store.saveRule(payload, 'r1')).ok).toBe(true);
    expect(api.updateChannelRule).toHaveBeenCalledWith('r1', payload);
    expect((await store.removeRule('r1')).ok).toBe(true);
    expect(api.deleteChannelRule).toHaveBeenCalledWith('r1');
  });

  it('refuses a rule while no channel is selected', async () => {
    const outcome = await store.saveRule({ warehouse_id: 'w1', allocation_mode: 'shared_pool' });

    expect(outcome.ok).toBe(false);
    expect(api.createChannelRule).not.toHaveBeenCalled();
  });
});
