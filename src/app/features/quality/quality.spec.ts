import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import { QualityApiService, QualityComplaint, QualityInstrument, SpcCharacteristic, SpcChart, TranslateService } from '@core';
import { QualityComplaintsComponent } from './quality-complaints.component';
import { QualityInstrumentsComponent } from './quality-instruments.component';
import { QualitySpcComponent } from './quality-spc.component';

const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
const translateSpy = { instant: vi.fn().mockImplementation((key: string) => key), translate: vi.fn().mockImplementation((key: string) => key) };

function configure(api: Record<string, unknown>): void {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: QualityApiService, useValue: api },
      { provide: NzMessageService, useValue: messageSpy },
      { provide: TranslateService, useValue: translateSpy },
      provideNzIcons(icons),
    ],
  });
}

const complaint: QualityComplaint = {
  id: 'cmp-1',
  number: 'CMP-2027-0001',
  customer_name: 'Acme',
  contact_id: null,
  received_at: '2027-06-15',
  channel: 'email',
  reference: null,
  product_description: null,
  description: 'Burrs',
  severity: 'major',
  status: 'received',
  owner_id: null,
  root_cause: null,
  nonconformity_id: null,
  capa_action_id: null,
  reply_text: null,
  replied_at: null,
  closed_at: null,
  closure_notes: null,
};

describe('QualityComplaintsComponent', () => {
  const api = { getComplaints: vi.fn(), createComplaint: vi.fn(), complaintAction: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getComplaints.mockReturnValue(of({ data: [complaint] }));
    api.createComplaint.mockReturnValue(of({ data: complaint }));
    api.complaintAction.mockReturnValue(of({ data: { ...complaint, status: 'investigating' } }));
    configure(api);
  });

  it('creates a complaint with the API payload', () => {
    const fixture = TestBed.createComponent(QualityComplaintsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.form.patchValue({ customer_name: ' Acme ', received_at: '2027-06-15', channel: 'phone', severity: 'major', reference: '', product_description: 'Shaft', description: 'Burrs' });
    component.create();

    expect(api.createComplaint).toHaveBeenCalledWith({
      customer_name: 'Acme',
      received_at: '2027-06-15',
      channel: 'phone',
      reference: null,
      product_description: 'Shaft',
      description: 'Burrs',
      severity: 'major',
    });
  });

  it('sends the text of a transition under the field the API expects', () => {
    const fixture = TestBed.createComponent(QualityComplaintsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openTextModal({ ...complaint, status: 'investigating' }, 'root-cause');
    component.textForm.patchValue({ text: 'Worn tool' });
    component.submitText();
    expect(api.complaintAction).toHaveBeenCalledWith('cmp-1', 'root-cause', { root_cause: 'Worn tool' });

    component.openTextModal({ ...complaint, status: 'replied' }, 'close');
    component.submitText();
    expect(api.complaintAction).toHaveBeenLastCalledWith('cmp-1', 'close', { closure_notes: null });
  });
});

const instrument: QualityInstrument = {
  id: 'ins-1',
  code: 'CAL-1',
  name: 'Micrometer',
  serial_number: null,
  manufacturer: null,
  location: null,
  unit: null,
  range_min: null,
  range_max: null,
  tolerance: '0.05000',
  calibration_interval_days: 180,
  status: 'active',
  last_calibrated_on: null,
  next_due_on: null,
  calibration_status: 'overdue',
  notes: null,
};

describe('QualityInstrumentsComponent', () => {
  const api = { getInstruments: vi.fn(), createInstrument: vi.fn(), recordCalibration: vi.fn(), getCalibrations: vi.fn(), getCalibrationImpact: vi.fn(), retireInstrument: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getInstruments.mockReturnValue(of({ data: [instrument] }));
    api.createInstrument.mockReturnValue(of({ data: instrument }));
    api.getCalibrations.mockReturnValue(of({ data: [] }));
    api.recordCalibration.mockReturnValue(of({ data: { id: 'cal-1', result: 'out_of_tolerance' } }));
    configure(api);
  });

  it('creates an instrument and records an out-of-tolerance calibration', () => {
    const fixture = TestBed.createComponent(QualityInstrumentsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.instrumentForm.patchValue({ code: 'CAL-1', name: 'Micrometer', tolerance: 0.05, calibration_interval_days: 180 });
    component.saveInstrument();
    expect(api.createInstrument).toHaveBeenCalledWith(expect.objectContaining({ code: 'CAL-1', tolerance: '0.05', calibration_interval_days: 180, serial_number: null }));

    component.openCalibrationModal(instrument);
    component.calibrationForm.patchValue({ calibrated_on: '2027-06-15', result: 'out_of_tolerance', as_found_error: 0.2 });
    component.saveCalibration();
    expect(api.recordCalibration).toHaveBeenCalledWith('ins-1', expect.objectContaining({ result: 'out_of_tolerance', as_found_error: '0.2', next_due_on: null }));
    expect(messageSpy.warning).toHaveBeenCalledWith('QUALITY.OUT_OF_TOLERANCE_RAISED');
  });
});

describe('QualitySpcComponent', () => {
  const characteristic: SpcCharacteristic = {
    id: 'ch-1',
    code: 'DIA',
    name: 'Diameter',
    unit: 'mm',
    lower_spec_limit: '9.00000',
    upper_spec_limit: '11.00000',
    target: null,
    subgroup_size: 2,
    instrument_id: null,
    status: 'active',
    notes: null,
  };
  const chart: SpcChart = {
    characteristic_id: 'ch-1',
    subgroup_size: 2,
    subgroup_count: 3,
    is_reliable: false,
    in_control: false,
    points: [
      { sample_id: 's1', sampled_at: '2027-06-15T09:00:00+00:00', lot: null, mean: 10, range: 0.2 },
      { sample_id: 's2', sampled_at: '2027-06-15T10:00:00+00:00', lot: null, mean: 10.1, range: 0.2 },
      { sample_id: 's3', sampled_at: '2027-06-15T11:00:00+00:00', lot: null, mean: 12, range: 0.2 },
    ],
    limits: { xbar: { center: 10.7, ucl: 11.2, lcl: 10.2 }, range: { center: 0.2, ucl: 0.65, lcl: 0 } },
    capability: { mean: 10.7, sigma_within: 0.17, sigma_overall: 1, cp: 1.9, cpk: 0.5, pp: 0.3, ppk: null, measurement_count: 6 },
    violations: [{ sample_id: 's3', index: 2, chart: 'xbar', rule: 1 }],
  };
  const api = { getCharacteristics: vi.fn(), getSpcChart: vi.fn(), addSpcSample: vi.fn(), createCharacteristic: vi.fn(), deleteCharacteristic: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getCharacteristics.mockReturnValue(of({ data: [characteristic] }));
    api.getSpcChart.mockReturnValue(of({ data: chart }));
    api.addSpcSample.mockReturnValue(of({ data: { id: 's4' }, violations: [{ sample_id: 's4', index: 3, chart: 'xbar', rule: 1 }] }));
    configure(api);
  });

  it('plots the points, marks the violations and sends the measurements as numbers', () => {
    const fixture = TestBed.createComponent(QualitySpcComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.select(characteristic);
    const plotted = component.plotted();
    expect(plotted).toHaveLength(3);
    expect(plotted.map((point) => point.violated)).toEqual([false, false, true]);
    expect(component.yFor(chart.limits!.xbar.ucl)).toBeLessThan(component.yFor(chart.limits!.xbar.lcl));

    component.openSampleModal(characteristic);
    component.sampleForm.patchValue({ measurements: '10.1, 9.9', lot: 'L1' });
    component.saveSample();
    expect(api.addSpcSample).toHaveBeenCalledWith('ch-1', { measurements: [10.1, 9.9], sampled_at: null, lot: 'L1', instrument_id: null });
    expect(messageSpy.warning).toHaveBeenCalledWith('QUALITY.SAMPLE_OUT_OF_CONTROL');
  });

  it('creates a characteristic with decimal strings', () => {
    api.createCharacteristic.mockReturnValue(of({ data: characteristic }));
    const fixture = TestBed.createComponent(QualitySpcComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.characteristicForm.patchValue({ code: 'DIA', name: 'Diameter', unit: '', lower_spec_limit: 9, upper_spec_limit: 11, subgroup_size: 2 });
    component.saveCharacteristic();

    expect(api.createCharacteristic).toHaveBeenCalledWith({
      code: 'DIA',
      name: 'Diameter',
      unit: null,
      lower_spec_limit: '9',
      upper_spec_limit: '11',
      target: null,
      subgroup_size: 2,
      instrument_id: null,
      notes: null,
    });
  });
});
