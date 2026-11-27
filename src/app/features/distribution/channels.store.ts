import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  DistributionApiService,
  DstChannel,
  DstChannelPayload,
  DstChannelRule,
  DstChannelRulePayload,
  DstLookups,
} from '@core';
import { attempt, DstOutcome, failureOf } from './distribution.util';

export interface ChannelsState {
  channels: DstChannel[];
  selectedId: string | null;
  rules: DstChannelRule[];
  lookups: DstLookups | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/** Sales channels and the warehouse allocation rules (shared pool, percentage, fixed reserve, priority rank). */
export const ChannelsStore = signalStore(
  withState<ChannelsState>({
    channels: [],
    selectedId: null,
    rules: [],
    lookups: null,
    loading: false,
    saving: false,
    error: null,
  }),
  withMethods((store, api = inject(DistributionApiService)) => {
    const loadRules = async (): Promise<void> => {
      const id = store.selectedId();
      if (id === null) {
        patchState(store, { rules: [] });
        return;
      }
      patchState(store, { rules: (await firstValueFrom(api.listChannelRules(id))).data });
    };

    const load = async (): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const [lookups, channels] = await Promise.all([
          firstValueFrom(api.getLookups()),
          firstValueFrom(api.listChannels()),
        ]);
        const current = store.selectedId();
        const selected = channels.data.some((channel) => channel.id === current)
          ? current
          : (channels.data[0]?.id ?? null);
        patchState(store, { lookups: lookups.data, channels: channels.data, selectedId: selected });
        await loadRules();
        patchState(store, { loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    };

    const write = async (call: () => Promise<unknown>): Promise<DstOutcome> => {
      patchState(store, { saving: true });
      const outcome = await attempt(call);
      patchState(store, { saving: false });
      if (outcome.ok) {
        await load();
      }
      return outcome;
    };

    return {
      load,
      async select(id: string | null): Promise<void> {
        patchState(store, { selectedId: id });
        try {
          await loadRules();
        } catch (error) {
          patchState(store, { error: failureOf(error).errorKey });
        }
      },
      saveChannel: (payload: DstChannelPayload, id?: string): Promise<DstOutcome> =>
        write(() =>
          firstValueFrom(id ? api.updateChannel(id, payload) : api.createChannel(payload)),
        ),
      removeChannel: (id: string): Promise<DstOutcome> =>
        write(() => firstValueFrom(api.deleteChannel(id))),
      saveRule(payload: DstChannelRulePayload, ruleId?: string): Promise<DstOutcome> {
        const channelId = store.selectedId();
        if (channelId === null) {
          return Promise.resolve(failureOf(null));
        }
        return write(() =>
          firstValueFrom(
            ruleId
              ? api.updateChannelRule(ruleId, payload)
              : api.createChannelRule(channelId, payload),
          ),
        );
      },
      removeRule: (ruleId: string): Promise<DstOutcome> =>
        write(() => firstValueFrom(api.deleteChannelRule(ruleId))),
    };
  }),
);
