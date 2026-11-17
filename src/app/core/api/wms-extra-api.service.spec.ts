import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WmsExtraApiService } from './wms-extra-api.service';

describe('WmsExtraApiService', () => {
  let service: WmsExtraApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [WmsExtraApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(WmsExtraApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const cases: [string, string, string, () => Observable<unknown>][] = [
    ['listDockDoors', 'GET', '/wms/dock-doors', () => service.listDockDoors()],
    ['createDockDoor', 'POST', '/wms/dock-doors', () => service.createDockDoor({})],
    ['getDockDoor', 'GET', '/wms/dock-doors/dockDo-1', () => service.getDockDoor('dockDo-1')],
    ['updateDockDoor', 'PUT', '/wms/dock-doors/dockDo-1', () => service.updateDockDoor('dockDo-1', {})],
    ['deleteDockDoor', 'DELETE', '/wms/dock-doors/dockDo-1', () => service.deleteDockDoor('dockDo-1')],
    ['listWaveRules', 'GET', '/wms/wave-rules', () => service.listWaveRules()],
    ['createWaveRule', 'POST', '/wms/wave-rules', () => service.createWaveRule({})],
    ['getWaveRule', 'GET', '/wms/wave-rules/waveRu-1', () => service.getWaveRule('waveRu-1')],
    ['updateWaveRule', 'PUT', '/wms/wave-rules/waveRu-1', () => service.updateWaveRule('waveRu-1', {})],
    ['deleteWaveRule', 'DELETE', '/wms/wave-rules/waveRu-1', () => service.deleteWaveRule('waveRu-1')],
    ['listWaves', 'GET', '/wms/waves', () => service.listWaves()],
    ['getWave', 'GET', '/wms/waves/waveId-1', () => service.getWave('waveId-1')],
    ['planWave', 'POST', '/wms/waves/plan', () => service.planWave({})],
    ['releaseWave', 'POST', '/wms/waves/waveId-1/release', () => service.releaseWave('waveId-1', {})],
    ['completeWave', 'POST', '/wms/waves/waveId-1/complete', () => service.completeWave('waveId-1', {})],
    ['cancelWave', 'POST', '/wms/waves/waveId-1/cancel', () => service.cancelWave('waveId-1', {})],
    ['listTasks', 'GET', '/wms/tasks', () => service.listTasks()],
    ['createTask', 'POST', '/wms/tasks', () => service.createTask({})],
    ['getTask', 'GET', '/wms/tasks/taskId-1', () => service.getTask('taskId-1')],
    ['updateTask', 'PUT', '/wms/tasks/taskId-1', () => service.updateTask('taskId-1', {})],
    ['deleteTask', 'DELETE', '/wms/tasks/taskId-1', () => service.deleteTask('taskId-1')],
    ['claimNextTask', 'POST', '/wms/tasks/claim-next', () => service.claimNextTask({})],
    ['assignTask', 'POST', '/wms/tasks/taskId-1/assign', () => service.assignTask('taskId-1', {})],
    ['startTask', 'POST', '/wms/tasks/taskId-1/start', () => service.startTask('taskId-1', {})],
    ['confirmTask', 'POST', '/wms/tasks/taskId-1/confirm', () => service.confirmTask('taskId-1', {})],
    ['shortTask', 'POST', '/wms/tasks/taskId-1/short', () => service.shortTask('taskId-1', {})],
    ['skipTask', 'POST', '/wms/tasks/taskId-1/skip', () => service.skipTask('taskId-1', {})],
    ['cancelTask', 'POST', '/wms/tasks/taskId-1/cancel', () => service.cancelTask('taskId-1', {})],
    ['listSlottingRules', 'GET', '/wms/slotting-rules', () => service.listSlottingRules()],
    ['createSlottingRule', 'POST', '/wms/slotting-rules', () => service.createSlottingRule({})],
    ['getSlottingRule', 'GET', '/wms/slotting-rules/slotti-1', () => service.getSlottingRule('slotti-1')],
    ['updateSlottingRule', 'PUT', '/wms/slotting-rules/slotti-1', () => service.updateSlottingRule('slotti-1', {})],
    ['deleteSlottingRule', 'DELETE', '/wms/slotting-rules/slotti-1', () => service.deleteSlottingRule('slotti-1')],
    ['listSlottingRecommendations', 'GET', '/wms/slotting-recommendations', () => service.listSlottingRecommendations()],
    ['getSlottingRecommendation', 'GET', '/wms/slotting-recommendations/slotti-1', () => service.getSlottingRecommendation('slotti-1')],
    ['generateSlottingRecommendation', 'POST', '/wms/slotting-recommendations/generate', () => service.generateSlottingRecommendation({})],
    ['acceptSlottingRecommendation', 'POST', '/wms/slotting-recommendations/slotti-1/accept', () => service.acceptSlottingRecommendation('slotti-1', {})],
    ['rejectSlottingRecommendation', 'POST', '/wms/slotting-recommendations/slotti-1/reject', () => service.rejectSlottingRecommendation('slotti-1', {})],
    ['listDockAppointments', 'GET', '/wms/dock-appointments', () => service.listDockAppointments()],
    ['createDockAppointment', 'POST', '/wms/dock-appointments', () => service.createDockAppointment({})],
    ['getDockAppointment', 'GET', '/wms/dock-appointments/dockAp-1', () => service.getDockAppointment('dockAp-1')],
    ['updateDockAppointment', 'PUT', '/wms/dock-appointments/dockAp-1', () => service.updateDockAppointment('dockAp-1', {})],
    ['deleteDockAppointment', 'DELETE', '/wms/dock-appointments/dockAp-1', () => service.deleteDockAppointment('dockAp-1')],
    ['checkInDockAppointment', 'POST', '/wms/dock-appointments/dockAp-1/check-in', () => service.checkInDockAppointment('dockAp-1', {})],
    ['completeDockAppointment', 'POST', '/wms/dock-appointments/dockAp-1/complete', () => service.completeDockAppointment('dockAp-1', {})],
    ['cancelDockAppointment', 'POST', '/wms/dock-appointments/dockAp-1/cancel', () => service.cancelDockAppointment('dockAp-1', {})],
    ['noShowDockAppointment', 'POST', '/wms/dock-appointments/dockAp-1/no-show', () => service.noShowDockAppointment('dockAp-1', {})],
    ['listCrossDockOrders', 'GET', '/wms/cross-dock-orders', () => service.listCrossDockOrders()],
    ['createCrossDockOrder', 'POST', '/wms/cross-dock-orders', () => service.createCrossDockOrder({})],
    ['getCrossDockOrder', 'GET', '/wms/cross-dock-orders/crossD-1', () => service.getCrossDockOrder('crossD-1')],
    ['updateCrossDockOrder', 'PUT', '/wms/cross-dock-orders/crossD-1', () => service.updateCrossDockOrder('crossD-1', {})],
    ['deleteCrossDockOrder', 'DELETE', '/wms/cross-dock-orders/crossD-1', () => service.deleteCrossDockOrder('crossD-1')],
    ['receiveCrossDockOrder', 'POST', '/wms/cross-dock-orders/crossD-1/receive', () => service.receiveCrossDockOrder('crossD-1', {})],
    ['allocateCrossDockOrder', 'POST', '/wms/cross-dock-orders/crossD-1/allocate', () => service.allocateCrossDockOrder('crossD-1', {})],
    ['shipCrossDockOrder', 'POST', '/wms/cross-dock-orders/crossD-1/ship', () => service.shipCrossDockOrder('crossD-1', {})],
    ['cancelCrossDockOrder', 'POST', '/wms/cross-dock-orders/crossD-1/cancel', () => service.cancelCrossDockOrder('crossD-1', {})],
  ];

  it.each(cases)('%s sends %s %s', (_name, method, url, call) => {
    call().subscribe();
    const request = http.expectOne((r) => r.method === method && r.url.endsWith(url));
    request.flush(request.request.responseType === 'blob' ? new Blob() : {});
  });

  it('forwards GET filters as query parameters', () => {
    service.listDockDoors({ page: 2 }).subscribe();
    const request = http.expectOne((r) => r.url.endsWith('/wms/dock-doors'));
    expect(request.request.params.get('page')).toBe('2');
    request.flush({});
  });
});
