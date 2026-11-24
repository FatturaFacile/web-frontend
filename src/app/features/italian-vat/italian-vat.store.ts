import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { Observable, firstValueFrom } from 'rxjs';
import {
  AnnualVat,
  ApiResponse,
  CuCertification,
  CuValidation,
  F24Payment,
  F24PaymentPayload,
  F24Reconciliation,
  GoodsBalance,
  GoodsMovement,
  GoodsMovementPayload,
  ItalianVatApiService,
  ItalianVatPeriod,
  ItalianVatPrint,
  ItalianVatProRataState,
  ItalianVatRegisterSummary,
  ItalianVatRegisterType,
  ItalianVatSection,
  LipeCommunication,
  PlafondAssessment,
  PlafondCheckPayload,
  PlafondMonitor,
  VentilationPreview,
  VentilationRequest,
} from '@core';
import {
  annualCanFinalize,
  blockedDeclarations,
  cuCanIssue,
  cuInvalid,
  f24Unpaid,
} from './italian-vat.util';

export interface ItalianVatState {
  sections: ItalianVatSection[];
  register: ItalianVatRegisterSummary | null;
  prints: ItalianVatPrint[];
  proRata: ItalianVatProRataState | null;
  ventilation: VentilationPreview | null;
  movements: GoodsMovement[];
  balances: GoodsBalance[];
  plafond: PlafondMonitor | null;
  assessment: PlafondAssessment | null;
  lipe: LipeCommunication[];
  annual: AnnualVat | null;
  certifications: CuCertification[];
  cuValidation: CuValidation | null;
  f24: F24Payment[];
  f24Reconciliation: F24Reconciliation | null;
  loading: boolean;
  saving: boolean;
  error: unknown;
}

const initialState: ItalianVatState = {
  sections: [],
  register: null,
  prints: [],
  proRata: null,
  ventilation: null,
  movements: [],
  balances: [],
  plafond: null,
  assessment: null,
  lipe: [],
  annual: null,
  certifications: [],
  cuValidation: null,
  f24: [],
  f24Reconciliation: null,
  loading: false,
  saving: false,
  error: null,
};

/** State of the Italian VAT compliance pages: registers, ventilation, third-party goods, plafond, LIPE, annual VAT, CU and F24. */
export const ItalianVatStore = signalStore(
  withState(initialState),
  withComputed((store) => ({
    /** Declarations that cannot cover operations without VAT today (exceeded, expired, revoked or not yet valid). */
    blockedDeclarations: computed(() => blockedDeclarations(store.plafond()?.declarations ?? [])),
    registerLocked: computed(() =>
      (store.register()?.entries ?? []).some((entry) => entry.is_locked),
    ),
    annualFinalizable: computed(() => annualCanFinalize(store.annual())),
    cuIssuable: computed(() => cuCanIssue(store.certifications())),
    cuInvalid: computed(() => cuInvalid(store.certifications())),
    f24Unpaid: computed(() => f24Unpaid(store.f24())),
    lipeBalanced: computed(() =>
      store.lipe().every((lipe) => lipe.reconciliation_status === 'balanced'),
    ),
  })),
  withMethods((store, api = inject(ItalianVatApiService)) => {
    /** Runs a request with the loading or saving flag; the error is kept and `null` is returned on failure. */
    const run = async <T>(
      flag: 'loading' | 'saving',
      request: Observable<ApiResponse<T>>,
    ): Promise<T | null> => {
      patchState(store, { [flag]: true, error: null });
      try {
        return (await firstValueFrom(request)).data;
      } catch (error) {
        patchState(store, { error });
        return null;
      } finally {
        patchState(store, { [flag]: false });
      }
    };

    const replaceLipe = (updated: LipeCommunication | null): boolean => {
      if (!updated) {
        return false;
      }
      patchState(store, {
        lipe: store.lipe().map((lipe) => (lipe.id === updated.id ? updated : lipe)),
      });
      return true;
    };

    return {
      async loadSections(registerType?: ItalianVatRegisterType): Promise<void> {
        const sections = await run('loading', api.getSections(registerType));
        if (sections) {
          patchState(store, { sections });
        }
      },
      async loadRegister(sectionId: string, period: ItalianVatPeriod): Promise<void> {
        patchState(store, { register: null });
        const register = await run('loading', api.getRegister(sectionId, period));
        if (register) {
          patchState(store, { register });
        }
        const prints = await run('loading', api.getPrints({ section_id: sectionId }));
        if (prints) {
          patchState(store, { prints });
        }
      },
      async loadProRata(year: number): Promise<void> {
        patchState(store, { proRata: await run('loading', api.getProRata(year)) });
      },
      /** Definitive print of the register; the register is reloaded so the locked entries show up. */
      async printRegister(
        sectionId: string,
        year: number,
        period: ItalianVatPeriod,
      ): Promise<boolean> {
        const print = await run(
          'saving',
          api.printRegister(sectionId, { year, period_to: period.to }),
        );
        if (!print) {
          return false;
        }
        await this.loadRegister(sectionId, period);
        return true;
      },
      async previewVentilation(request: VentilationRequest): Promise<void> {
        patchState(store, { ventilation: await run('loading', api.previewVentilation(request)) });
      },
      async registerVentilation(request: VentilationRequest): Promise<boolean> {
        const result = await run('saving', api.registerVentilation(request));
        if (result) {
          patchState(store, { ventilation: null });
        }
        return result !== null;
      },
      async loadGoods(period: { from?: string; to?: string }, asOf?: string): Promise<void> {
        const [movements, balances] = await Promise.all([
          run('loading', api.getGoodsMovements(period)),
          run('loading', api.getGoodsBalances({ as_of: asOf })),
        ]);
        patchState(store, { movements: movements ?? [], balances: balances ?? [] });
      },
      async addMovement(
        payload: GoodsMovementPayload,
        period: { from?: string; to?: string },
      ): Promise<boolean> {
        const movement = await run('saving', api.createGoodsMovement(payload));
        if (!movement) {
          return false;
        }
        await this.loadGoods(period);
        return true;
      },
      async loadPlafond(year: number): Promise<void> {
        patchState(store, { plafond: await run('loading', api.getPlafondMonitor(year)) });
      },
      async checkPlafond(payload: PlafondCheckPayload): Promise<void> {
        patchState(store, { assessment: await run('loading', api.checkPlafond(payload)) });
      },
      async revokeDeclaration(id: string, year: number, reason: string | null): Promise<boolean> {
        const revoked = await run('saving', api.revokeDeclaration(id, reason));
        if (!revoked) {
          return false;
        }
        await this.loadPlafond(year);
        return true;
      },
      async loadLipe(year: number): Promise<void> {
        const lipe = await run('loading', api.getLipeList(year));
        if (lipe) {
          patchState(store, { lipe });
        }
      },
      async generateLipe(year: number, quarter: number): Promise<boolean> {
        const generated = await run('saving', api.generateLipe({ year, quarter }));
        if (!generated) {
          return false;
        }
        await this.loadLipe(year);
        return true;
      },
      async reconcileLipe(id: string): Promise<boolean> {
        return replaceLipe(await run('saving', api.reconcileLipe(id)));
      },
      async signLipe(id: string, signature: string, certificate: string): Promise<boolean> {
        return replaceLipe(await run('saving', api.signLipe(id, { signature, certificate })));
      },
      async markLipeReady(id: string): Promise<boolean> {
        return replaceLipe(await run('saving', api.markLipeReady(id)));
      },
      async recordLipeTransmission(id: string, protocol: string): Promise<boolean> {
        return replaceLipe(await run('saving', api.recordLipeTransmission(id, { protocol })));
      },
      async recordLipeRejection(id: string, reason: string): Promise<boolean> {
        return replaceLipe(await run('saving', api.recordLipeRejection(id, reason)));
      },
      async loadAnnual(year: number): Promise<void> {
        patchState(store, { annual: null });
        try {
          patchState(store, {
            loading: true,
            error: null,
            annual: (await firstValueFrom(api.getAnnualVat(year))).data,
          });
        } catch (error) {
          // Not calculated yet: the page offers to calculate it, so a 404 is not an error to show.
          const status = (error as { status?: number }).status;
          patchState(store, { error: status === 404 ? null : error });
        } finally {
          patchState(store, { loading: false });
        }
      },
      async calculateAnnual(year: number): Promise<boolean> {
        const annual = await run('saving', api.calculateAnnualVat(year));
        patchState(store, { annual: annual ?? store.annual() });
        return annual !== null;
      },
      async finalizeAnnual(year: number): Promise<boolean> {
        const annual = await run('saving', api.finalizeAnnualVat(year));
        patchState(store, { annual: annual ?? store.annual() });
        return annual !== null;
      },
      async loadCertifications(year: number): Promise<void> {
        const [certifications, validation, f24, reconciliation] = await Promise.all([
          run('loading', api.getCertifications(year)),
          run('loading', api.validateCertifications(year)),
          run('loading', api.getF24(year)),
          run('loading', api.getF24Reconciliation(year)),
        ]);
        patchState(store, {
          certifications: certifications ?? [],
          cuValidation: validation,
          f24: f24 ?? [],
          f24Reconciliation: reconciliation,
        });
      },
      async buildCertifications(year: number): Promise<boolean> {
        const built = await run('saving', api.buildCertifications(year));
        if (!built) {
          return false;
        }
        await this.loadCertifications(year);
        return true;
      },
      async issueCertifications(year: number): Promise<boolean> {
        const issued = await run('saving', api.issueCertifications(year));
        if (!issued) {
          return false;
        }
        patchState(store, { certifications: issued });
        return true;
      },
      async syncF24(year: number): Promise<boolean> {
        const synced = await run('saving', api.syncF24(year));
        if (!synced) {
          return false;
        }
        await this.loadCertifications(year);
        return true;
      },
      async payF24(id: string, payload: F24PaymentPayload, year: number): Promise<boolean> {
        const payment = await run('saving', api.payF24(id, payload));
        if (!payment) {
          return false;
        }
        await this.loadCertifications(year);
        return true;
      },
    };
  }),
);
