import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { AssociationsGovernanceApiService } from './associations-governance-api.service';

describe('AssociationsGovernanceApiService', () => {
  let service: AssociationsGovernanceApiService;
  let httpTesting: HttpTestingController;
  const base = `${environment.apiBaseUrl}/associations`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AssociationsGovernanceApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AssociationsGovernanceApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  const cases: [string, string, string, () => Observable<unknown>, boolean][] = [
    ['getMeeting', 'GET', 'meetings/id1', () => service.getMeeting('id1'), false],
    ['updateMeeting', 'PUT', 'meetings/id1', () => service.updateMeeting('id1', { note: 1 }), false],
    ['deleteMeeting', 'DELETE', 'meetings/id1', () => service.deleteMeeting('id1'), false],
    ['addAgendaItem', 'POST', 'meetings/id1/agenda-items', () => service.addAgendaItem('id1', { note: 1 }), false],
    ['deleteAgendaItem', 'DELETE', 'agenda-items/id1', () => service.deleteAgendaItem('id1'), false],
    ['recordAgendaDecision', 'POST', 'agenda-items/id1/decision', () => service.recordAgendaDecision('id1', { note: 1 }), false],
    ['uploadMeetingAttachment', 'POST', 'meetings/id1/attachments', () => service.uploadMeetingAttachment('id1', { title: "t" }, new File(['x'], 'f.pdf')), false],
    ['downloadMeetingAttachment', 'GET', 'meeting-attachments/id1/download', () => service.downloadMeetingAttachment('id1'), true],
    ['addMeetingParticipant', 'POST', 'meetings/id1/participants', () => service.addMeetingParticipant('id1', { note: 1 }), false],
    ['removeMeetingParticipant', 'DELETE', 'meeting-participants/id1', () => service.removeMeetingParticipant('id1'), false],
    ['removeParticipantProxy', 'DELETE', 'meeting-participants/id1/proxy', () => service.removeParticipantProxy('id1'), false],
    ['sendMeetingNotices', 'POST', 'meetings/id1/notices', () => service.sendMeetingNotices('id1'), false],
    ['getMeetingDeliveries', 'GET', 'meetings/id1/deliveries', () => service.getMeetingDeliveries('id1'), false],
    ['downloadMeetingLetter', 'GET', 'meetings/id1/letter', () => service.downloadMeetingLetter('id1'), true],
    ['recordMeetingAttendance', 'POST', 'meetings/id1/attendance', () => service.recordMeetingAttendance('id1', { note: 1 }), false],
    ['addMeetingProxy', 'POST', 'meetings/id1/proxies', () => service.addMeetingProxy('id1', { note: 1 }), false],
    ['getMeetingQuorum', 'GET', 'meetings/id1/quorum', () => service.getMeetingQuorum('id1'), false],
    ['holdMeeting', 'POST', 'meetings/id1/hold', () => service.holdMeeting('id1'), false],
    ['closeMeeting', 'POST', 'meetings/id1/close', () => service.closeMeeting('id1'), false],
    ['cancelMeeting', 'POST', 'meetings/id1/cancel', () => service.cancelMeeting('id1'), false],
    ['createBallot', 'POST', 'meetings/id1/ballots', () => service.createBallot('id1', { note: 1 }), false],
    ['getBallot', 'GET', 'ballots/id1', () => service.getBallot('id1'), false],
    ['openBallot', 'POST', 'ballots/id1/open', () => service.openBallot('id1'), false],
    ['closeBallot', 'POST', 'ballots/id1/close', () => service.closeBallot('id1'), false],
    ['recordBallotVote', 'POST', 'ballots/id1/votes', () => service.recordBallotVote('id1', { note: 1 }), false],
    ['createMinutes', 'POST', 'meetings/id1/minutes', () => service.createMinutes('id1', { note: 1 }), false],
    ['getMinutes', 'GET', 'minutes/id1', () => service.getMinutes('id1'), false],
    ['updateMinutes', 'PUT', 'minutes/id1', () => service.updateMinutes('id1', { note: 1 }), false],
    ['approveMinutes', 'POST', 'minutes/id1/approve', () => service.approveMinutes('id1'), false],
    ['downloadMinutesPdf', 'GET', 'minutes/id1/pdf', () => service.downloadMinutesPdf('id1'), true],
    ['distributeMinutes', 'POST', 'minutes/id1/distribute', () => service.distributeMinutes('id1'), false],
    ['getMinutesDeliveries', 'GET', 'minutes/id1/deliveries', () => service.getMinutesDeliveries('id1'), false],
    ['getBook', 'GET', 'books/boo1', () => service.getBook('boo1'), false],
    ['downloadBookCsv', 'GET', 'books/boo1/csv', () => service.downloadBookCsv('boo1'), true],
    ['downloadBookPdf', 'GET', 'books/boo1/pdf', () => service.downloadBookPdf('boo1'), true],
    ['getArchive', 'GET', 'archive', () => service.getArchive(), false],
    ['getProtocol', 'GET', 'protocol', () => service.getProtocol(), false],
    ['registerProtocolEntry', 'POST', 'protocol', () => service.registerProtocolEntry({ title: "t" }, new File(['x'], 'f.pdf')), false],
    ['cancelProtocolEntry', 'POST', 'protocol/id1/cancel', () => service.cancelProtocolEntry('id1'), false],
    ['downloadProtocolEntry', 'GET', 'protocol/id1/download', () => service.downloadProtocolEntry('id1'), true],
    ['getShiftsNeedingAttention', 'GET', 'shifts/attention', () => service.getShiftsNeedingAttention(), false],
    ['setShiftAvailability', 'POST', 'shifts/id1/availability', () => service.setShiftAvailability('id1', { note: 1 }), false],
    ['assignShift', 'POST', 'shifts/id1/assignments', () => service.assignShift('id1', { note: 1 }), false],
    ['getShiftCoverage', 'GET', 'shifts/id1/coverage', () => service.getShiftCoverage('id1'), false],
    ['requestShiftSubstitution', 'POST', 'shift-assignments/id1/substitution-request', () => service.requestShiftSubstitution('id1'), false],
    ['assignShiftSubstitute', 'POST', 'shift-assignments/id1/substitute', () => service.assignShiftSubstitute('id1', { note: 1 }), false],
    ['uploadReimbursementAttachment', 'POST', 'reimbursements/id1/attachments', () => service.uploadReimbursementAttachment('id1', { title: "t" }, new File(['x'], 'f.pdf')), false],
    ['downloadReimbursementAttachment', 'GET', 'reimbursement-attachments/id1/download', () => service.downloadReimbursementAttachment('id1'), true],
    ['getPrivacyActivities', 'GET', 'privacy/activities', () => service.getPrivacyActivities(), false],
    ['createPrivacyActivity', 'POST', 'privacy/activities', () => service.createPrivacyActivity({ note: 1 }), false],
    ['updatePrivacyActivity', 'PUT', 'privacy/activities/id1', () => service.updatePrivacyActivity('id1', { note: 1 }), false],
    ['finalizePrivacyActivity', 'POST', 'privacy/activities/id1/finalize', () => service.finalizePrivacyActivity('id1'), false],
    ['addPrivacyActivityVersion', 'POST', 'privacy/activities/id1/versions', () => service.addPrivacyActivityVersion('id1'), false],
    ['getPrivacyActivityNotice', 'GET', 'privacy/activities/id1/notice', () => service.getPrivacyActivityNotice('id1'), false],
    ['downloadPrivacyActivityNoticePdf', 'GET', 'privacy/activities/id1/notice/pdf', () => service.downloadPrivacyActivityNoticePdf('id1'), true],
    ['getPrivacyRegister', 'GET', 'privacy/register', () => service.getPrivacyRegister(), false],
    ['downloadPrivacyRegisterCsv', 'GET', 'privacy/register/csv', () => service.downloadPrivacyRegisterCsv(), true],
    ['downloadPrivacyRegisterPdf', 'GET', 'privacy/register/pdf', () => service.downloadPrivacyRegisterPdf(), true],
    ['downloadPrivacyAppointment', 'GET', 'privacy/subjects/id1/appointment', () => service.downloadPrivacyAppointment('id1'), true],
    ['getPrivacyConsents', 'GET', 'privacy/consents', () => service.getPrivacyConsents(), false],
    ['recordPrivacyConsent', 'POST', 'privacy/consents', () => service.recordPrivacyConsent({ note: 1 }), false],
    ['withdrawPrivacyConsent', 'POST', 'privacy/consents/id1/withdraw', () => service.withdrawPrivacyConsent('id1'), false],
    ['getPrivacyRequests', 'GET', 'privacy/requests', () => service.getPrivacyRequests(), false],
    ['createPrivacyRequest', 'POST', 'privacy/requests', () => service.createPrivacyRequest({ note: 1 }), false],
    ['extendPrivacyRequest', 'POST', 'privacy/requests/id1/extend', () => service.extendPrivacyRequest('id1'), false],
    ['getPrivacyErasurePreview', 'GET', 'privacy/requests/id1/erasure-preview', () => service.getPrivacyErasurePreview('id1'), false],
    ['completePrivacyRequest', 'POST', 'privacy/requests/id1/complete', () => service.completePrivacyRequest('id1'), false],
    ['rejectPrivacyRequest', 'POST', 'privacy/requests/id1/reject', () => service.rejectPrivacyRequest('id1'), false],
    ['getPrivacyRequestExport', 'GET', 'privacy/requests/id1/export', () => service.getPrivacyRequestExport('id1'), false],
  ];

  it.each(cases)('%s calls %s %s', (_name, method, path, call, isBlob) => {
    call().subscribe();
    const req = httpTesting.expectOne(`${base}/${path}`);
    expect(req.request.method).toBe(method);
    if (isBlob) {
      expect(req.request.responseType).toBe('blob');
      req.flush(new Blob(['x']));
    } else {
      req.flush({ success: true, message: '', data: {} });
    }
  });
});
