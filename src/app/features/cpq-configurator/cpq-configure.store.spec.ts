import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '@env';
import { cpqEvaluation, cpqInstance, cpqModel, cpqProposal } from '../../../testing/cpq-fixtures';
import { CPQ_EVALUATION_DELAY_MS, CpqConfigureStore } from './cpq-configure.store';

describe('CpqConfigureStore', () => {
  const base = `${environment.apiBaseUrl}/cpq-configurator`;
  let store: InstanceType<typeof CpqConfigureStore>;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [CpqConfigureStore, provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(CpqConfigureStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  async function start(): Promise<void> {
    const loaded = store.loadModels();
    http.expectOne(`${base}/models?status=published`).flush({ data: [cpqModel()] });
    await loaded;

    const selected = store.selectModel('m1');
    http.expectOne(`${base}/models/m1/evaluate`).flush({ data: cpqEvaluation() });
    await selected;
  }

  it('loads the published models and starts a configuration with the first evaluation', async () => {
    await start();

    expect(store.models()).toHaveLength(1);
    expect(store.model()?.code).toBe('PUMP-SKID');
    expect(store.evaluation()?.valid).toBe(true);
    expect(store.steps().map((step) => step.code)).toEqual(['application', 'hydraulics']);
    expect(store.evaluating()).toBe(false);
  });

  it('asks the API with the answers only, never the values it derived itself', async () => {
    await start();

    store.setValue('material', 'AISI_316');
    await vi.advanceTimersByTimeAsync(CPQ_EVALUATION_DELAY_MS);

    const request = http.expectOne(`${base}/models/m1/evaluate`);
    expect(request.request.body).toEqual({
      selections: { material: 'AISI_316' },
      quantity: 1,
      discount_percent: 0,
      customer_reference: null,
    });
    request.flush({ data: cpqEvaluation() });
    await vi.advanceTimersByTimeAsync(0);
  });

  it('evaluates once after a burst of changes', async () => {
    await start();

    store.setValue('flow_rate', 41);
    store.setValue('flow_rate', 42);
    store.setValue('flow_rate', 45);
    await vi.advanceTimersByTimeAsync(CPQ_EVALUATION_DELAY_MS - 1);
    http.expectNone(`${base}/models/m1/evaluate`);
    await vi.advanceTimersByTimeAsync(1);

    const request = http.expectOne(`${base}/models/m1/evaluate`);
    expect(request.request.body.selections).toEqual({ flow_rate: 45 });
    request.flush({ data: cpqEvaluation() });
    await vi.advanceTimersByTimeAsync(0);
  });

  it('takes an answer back and sends the quantity and discount along', async () => {
    await start();

    store.setValue('flow_rate', 45);
    store.clearValue('flow_rate');
    store.setQuantity(3);
    store.setDiscount(5);
    store.setQuantity(null);
    store.setDiscount(-4);
    store.setQuantity(4);
    await vi.advanceTimersByTimeAsync(CPQ_EVALUATION_DELAY_MS);

    const request = http.expectOne(`${base}/models/m1/evaluate`);
    expect(request.request.body).toMatchObject({
      selections: {},
      quantity: 4,
      discount_percent: 0,
    });
    request.flush({ data: cpqEvaluation() });
    await vi.advanceTimersByTimeAsync(0);
  });

  it('discards the answer of an older request when a newer one was made', async () => {
    await start();

    store.setValue('flow_rate', 50);
    await vi.advanceTimersByTimeAsync(CPQ_EVALUATION_DELAY_MS);
    const first = http.expectOne(`${base}/models/m1/evaluate`);
    store.setValue('flow_rate', 55);
    await vi.advanceTimersByTimeAsync(CPQ_EVALUATION_DELAY_MS);
    const second = http.expectOne(`${base}/models/m1/evaluate`);

    second.flush({ data: cpqEvaluation({ part_number_preview: 'NEWER' }) });
    await vi.advanceTimersByTimeAsync(0);
    first.flush({ data: cpqEvaluation({ part_number_preview: 'OLDER' }) });
    await vi.advanceTimersByTimeAsync(0);

    expect(store.evaluation()?.part_number_preview).toBe('NEWER');
  });

  it('shows the errors of the rules apart from the notices and does not allow confirming an invalid selection', async () => {
    await start();
    expect(store.canConfirm()).toBe(true);

    store.setValue('material', 'AISI_304');
    await vi.advanceTimersByTimeAsync(CPQ_EVALUATION_DELAY_MS);
    http.expectOne(`${base}/models/m1/evaluate`).flush({
      data: cpqEvaluation({
        valid: false,
        violations: [
          {
            code: 'option_blocked',
            severity: 'error',
            characteristic: 'material',
            characteristic_label: 'Material',
            rule: null,
            message: 'Acid needs AISI 316',
            params: {},
          },
          {
            code: 'vfd-atex-warning',
            severity: 'warning',
            characteristic: null,
            characteristic_label: null,
            rule: 'vfd-atex-warning',
            message: 'Install the panel in a safe area',
            params: {},
          },
        ],
      }),
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(store.errors()).toHaveLength(1);
    expect(store.notices()).toHaveLength(1);
    expect(store.canConfirm()).toBe(false);
    expect(await store.confirm()).toBe(false);
  });

  it('does not allow confirming an incomplete selection', async () => {
    await start();

    store.setValue('flow_rate', 50);
    await vi.advanceTimersByTimeAsync(CPQ_EVALUATION_DELAY_MS);
    http
      .expectOne(`${base}/models/m1/evaluate`)
      .flush({ data: cpqEvaluation({ complete: false, missing: ['material'] }) });
    await vi.advanceTimersByTimeAsync(0);

    expect(store.canConfirm()).toBe(false);
  });

  it('confirms and tells a new part number from a reused one', async () => {
    await start();

    const created = store.confirm();
    const request = http.expectOne(`${base}/models/m1/confirm`);
    expect(request.request.method).toBe('POST');
    request.flush({ data: cpqInstance() }, { status: 201, statusText: 'Created' });
    await vi.advanceTimersByTimeAsync(0);

    expect(await created).toBe(true);
    expect(store.instance()?.part_number).toBe('PSK-S6-400-B-Q40-H30-SK-CH-0001');
    expect(store.reused()).toBe(false);

    const again = store.confirm();
    http
      .expectOne(`${base}/models/m1/confirm`)
      .flush({ data: cpqInstance({ reuse_count: 1 }), meta: { reused: true } });
    await vi.advanceTimersByTimeAsync(0);

    expect(await again).toBe(true);
    expect(store.reused()).toBe(true);
  });

  it('forgets the confirmation as soon as an answer changes', async () => {
    await start();
    const confirmed = store.confirm();
    http.expectOne(`${base}/models/m1/confirm`).flush({ data: cpqInstance() });
    await vi.advanceTimersByTimeAsync(0);
    await confirmed;
    expect(store.instance()).not.toBeNull();

    store.setValue('flow_rate', 70);
    expect(store.instance()).toBeNull();
    expect(store.proposal()).toBeNull();

    await vi.advanceTimersByTimeAsync(CPQ_EVALUATION_DELAY_MS);
    http.expectOne(`${base}/models/m1/evaluate`).flush({ data: cpqEvaluation() });
    await vi.advanceTimersByTimeAsync(0);
  });

  it('keeps the translation key of a refusal of the confirmation', async () => {
    await start();

    const confirming = store.confirm();
    http
      .expectOne(`${base}/models/m1/confirm`)
      .flush(
        {
          message: 'CPQ_CONFIGURATOR.ERR.CONFIGURATION_INCOMPLETE',
          errors: { selections: ['CPQ_CONFIGURATOR.ERR.CONFIGURATION_INCOMPLETE'] },
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    await vi.advanceTimersByTimeAsync(0);

    expect(await confirming).toBe(false);
    expect(store.failure()?.key).toBe('CPQ_CONFIGURATOR.ERR.CONFIGURATION_INCOMPLETE');
    expect(store.confirming()).toBe(false);
  });

  it('loads the proposal of the selection, with the breakdown only when asked, and closes it', async () => {
    await start();

    const loading = store.loadProposal(true);
    const request = http.expectOne(`${base}/models/m1/proposal`);
    expect(request.request.body.include_breakdown).toBe(true);
    request.flush({ data: cpqProposal() });
    await vi.advanceTimersByTimeAsync(0);

    expect(await loading).toBe(true);
    expect(store.proposal()?.dossier.commercial.total_price).toBe(4000);

    store.closeProposal();
    expect(store.proposal()).toBeNull();
  });

  it('downloads the PDF only for a confirmed configuration', async () => {
    await start();
    expect(await store.downloadProposalPdf()).toBeNull();

    const confirmed = store.confirm();
    http.expectOne(`${base}/models/m1/confirm`).flush({ data: cpqInstance() });
    await vi.advanceTimersByTimeAsync(0);
    await confirmed;

    const downloading = store.downloadProposalPdf();
    const request = http.expectOne(
      (candidate) => candidate.url === `${base}/instances/i1/proposal/pdf`,
    );
    request.flush(new Blob(['%PDF']));
    await vi.advanceTimersByTimeAsync(0);

    expect((await downloading)?.size).toBe(4);
  });

  it('moves between the steps without leaving the list', async () => {
    await start();

    store.setStep(1);
    expect(store.currentStep()?.code).toBe('hydraulics');
    expect(store.stepCharacteristics().map((characteristic) => characteristic.code)).toEqual([
      'material',
      'flow_rate',
      'safety_kit',
    ]);

    store.setStep(9);
    expect(store.activeStep()).toBe(1);
    store.setStep(-3);
    expect(store.activeStep()).toBe(0);
  });

  it('reports a failed evaluation and clears everything on reset, keeping the models', async () => {
    await start();

    store.setValue('flow_rate', 70);
    await vi.advanceTimersByTimeAsync(CPQ_EVALUATION_DELAY_MS);
    http
      .expectOne(`${base}/models/m1/evaluate`)
      .flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.failure()?.detail).toBe('Not found');

    store.reset();
    expect(store.modelId()).toBeNull();
    expect(store.evaluation()).toBeNull();
    expect(store.selections()).toEqual({});
    expect(store.models()).toHaveLength(1);
  });
});
