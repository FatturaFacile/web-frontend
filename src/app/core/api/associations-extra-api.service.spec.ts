import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { AssociationsExtraApiService } from './associations-extra-api.service';

describe('AssociationsExtraApiService', () => {
  let service: AssociationsExtraApiService;
  let httpTesting: HttpTestingController;
  const base = `${environment.apiBaseUrl}/associations`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AssociationsExtraApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AssociationsExtraApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  const cases: [string, string, string, () => Observable<unknown>, boolean][] = [
    ['getSettings', 'GET', 'settings', () => service.getSettings(), false],
    ['updateSettings', 'PUT', 'settings', () => service.updateSettings({ note: 1 }), false],
    ['listCatalog', 'GET', 'catalogs/cat1', () => service.listCatalog('cat1'), false],
    ['createCatalogEntry', 'POST', 'catalogs/cat1', () => service.createCatalogEntry('cat1', { note: 1 }), false],
    ['getCatalogEntry', 'GET', 'catalogs/cat1/id1', () => service.getCatalogEntry('cat1', 'id1'), false],
    ['updateCatalogEntry', 'PUT', 'catalogs/cat1/id1', () => service.updateCatalogEntry('cat1', 'id1', { note: 1 }), false],
    ['deleteCatalogEntry', 'DELETE', 'catalogs/cat1/id1', () => service.deleteCatalogEntry('cat1', 'id1'), false],
    ['exportMembers', 'GET', 'members/export', () => service.exportMembers(), true],
    ['setMemberRegistryTypes', 'POST', 'members/mem1/registry-types', () => service.setMemberRegistryTypes('mem1', { note: 1 }), false],
    ['setMemberSocialRoles', 'POST', 'members/mem1/social-roles', () => service.setMemberSocialRoles('mem1', { note: 1 }), false],
    ['createRegistryImport', 'POST', 'registry-imports', () => service.createRegistryImport({ title: "t" }, new File(['x'], 'f.pdf')), false],
    ['getRegistryImport', 'GET', 'registry-imports/id1', () => service.getRegistryImport('id1'), false],
    ['commitRegistryImport', 'POST', 'registry-imports/id1/commit', () => service.commitRegistryImport('id1'), false],
    ['getMemberDocuments', 'GET', 'members/mem1/documents', () => service.getMemberDocuments('mem1'), false],
    ['uploadMemberDocument', 'POST', 'members/mem1/documents', () => service.uploadMemberDocument('mem1', { title: "t" }, new File(['x'], 'f.pdf')), false],
    ['getExpiringMemberDocuments', 'GET', 'member-documents/expiring', () => service.getExpiringMemberDocuments(), false],
    ['downloadMemberDocument', 'GET', 'member-documents/id1/download', () => service.downloadMemberDocument('id1'), true],
    ['deleteMemberDocument', 'DELETE', 'member-documents/id1', () => service.deleteMemberDocument('id1'), false],
    ['getMemberGuardians', 'GET', 'members/mem1/guardians', () => service.getMemberGuardians('mem1'), false],
    ['addMemberGuardian', 'POST', 'members/mem1/guardians', () => service.addMemberGuardian('mem1', { note: 1 }), false],
    ['deleteGuardian', 'DELETE', 'guardians/id1', () => service.deleteGuardian('id1'), false],
    ['getMemberAuthorizations', 'GET', 'members/mem1/authorizations', () => service.getMemberAuthorizations('mem1'), false],
    ['createMemberAuthorization', 'POST', 'members/mem1/authorizations', () => service.createMemberAuthorization('mem1', { note: 1 }), false],
    ['revokeAuthorization', 'POST', 'authorizations/id1/revoke', () => service.revokeAuthorization('id1'), false],
    ['createContactAreaLink', 'POST', 'contacts/con1/area-link', () => service.createContactAreaLink('con1'), false],
    ['deleteContactAreaLink', 'DELETE', 'contacts/con1/area-link', () => service.deleteContactAreaLink('con1'), false],
    ['getMemberships', 'GET', 'memberships', () => service.getMemberships(), false],
    ['createMembership', 'POST', 'memberships', () => service.createMembership({ note: 1 }), false],
    ['getMembership', 'GET', 'memberships/id1', () => service.getMembership('id1'), false],
    ['activateMembership', 'POST', 'memberships/id1/activate', () => service.activateMembership('id1'), false],
    ['renewMembership', 'POST', 'memberships/id1/renew', () => service.renewMembership('id1'), false],
    ['suspendMembership', 'POST', 'memberships/id1/suspend', () => service.suspendMembership('id1'), false],
    ['ceaseMembership', 'POST', 'memberships/id1/cease', () => service.ceaseMembership('id1'), false],
    ['downloadMembershipCard', 'GET', 'memberships/id1/card', () => service.downloadMembershipCard('id1'), true],
    ['issueMemberQr', 'POST', 'members/mem1/qr', () => service.issueMemberQr('mem1'), false],
    ['issueMemberBadge', 'POST', 'members/mem1/badges', () => service.issueMemberBadge('mem1'), false],
    ['deleteCredential', 'DELETE', 'credentials/id1', () => service.deleteCredential('id1'), false],
    ['getEnrolmentForms', 'GET', 'enrolment-forms', () => service.getEnrolmentForms(), false],
    ['createEnrolmentForm', 'POST', 'enrolment-forms', () => service.createEnrolmentForm({ note: 1 }), false],
    ['getEnrolmentForm', 'GET', 'enrolment-forms/id1', () => service.getEnrolmentForm('id1'), false],
    ['updateEnrolmentForm', 'PUT', 'enrolment-forms/id1', () => service.updateEnrolmentForm('id1', { note: 1 }), false],
    ['deleteEnrolmentForm', 'DELETE', 'enrolment-forms/id1', () => service.deleteEnrolmentForm('id1'), false],
    ['addEnrolmentFormDocument', 'POST', 'enrolment-forms/id1/documents', () => service.addEnrolmentFormDocument('id1', { title: "t" }, new File(['x'], 'f.pdf')), false],
    ['deleteEnrolmentFormDocument', 'DELETE', 'enrolment-form-documents/id1', () => service.deleteEnrolmentFormDocument('id1'), false],
    ['getEnrolmentApplications', 'GET', 'enrolment-applications', () => service.getEnrolmentApplications(), false],
    ['getEnrolmentApplication', 'GET', 'enrolment-applications/id1', () => service.getEnrolmentApplication('id1'), false],
    ['approveEnrolmentApplication', 'POST', 'enrolment-applications/id1/approve', () => service.approveEnrolmentApplication('id1'), false],
    ['rejectEnrolmentApplication', 'POST', 'enrolment-applications/id1/reject', () => service.rejectEnrolmentApplication('id1'), false],
    ['downloadEnrolmentUpload', 'GET', 'enrolment-uploads/id1/download', () => service.downloadEnrolmentUpload('id1'), true],
    ['getInstalments', 'GET', 'instalments', () => service.getInstalments(), false],
    ['createInstalmentPaymentLink', 'POST', 'instalments/id1/payment-link', () => service.createInstalmentPaymentLink('id1'), false],
    ['reverseFeePayment', 'POST', 'fee-payments/id1/reverse', () => service.reverseFeePayment('id1'), false],
    ['getReceipts', 'GET', 'receipts', () => service.getReceipts(), false],
    ['downloadReceiptPdf', 'GET', 'receipts/id1/pdf', () => service.downloadReceiptPdf('id1'), true],
    ['getCourse', 'GET', 'courses/id1', () => service.getCourse('id1'), false],
    ['getCourseCalendar', 'GET', 'courses/id1/calendar', () => service.getCourseCalendar('id1'), false],
    ['addCourseSchedule', 'POST', 'courses/id1/schedules', () => service.addCourseSchedule('id1', { note: 1 }), false],
    ['deleteCourseSchedule', 'DELETE', 'course-schedules/id1', () => service.deleteCourseSchedule('id1'), false],
    ['addCourseSuspension', 'POST', 'courses/id1/suspensions', () => service.addCourseSuspension('id1', { note: 1 }), false],
    ['deleteCourseSuspension', 'DELETE', 'course-suspensions/id1', () => service.deleteCourseSuspension('id1'), false],
    ['addCourseInstructor', 'POST', 'courses/id1/instructors', () => service.addCourseInstructor('id1', { note: 1 }), false],
    ['deleteCourseInstructor', 'DELETE', 'course-instructors/id1', () => service.deleteCourseInstructor('id1'), false],
    ['withdrawCourseEnrolment', 'POST', 'course-enrolments/id1/withdraw', () => service.withdrawCourseEnrolment('id1'), false],
    ['getCourseAttendance', 'GET', 'courses/id1/attendance', () => service.getCourseAttendance('id1'), false],
    ['recordCourseAttendance', 'POST', 'courses/id1/attendance', () => service.recordCourseAttendance('id1', { note: 1 }), false],
    ['bookCourseLessons', 'POST', 'courses/id1/book-lessons', () => service.bookCourseLessons('id1', { note: 1 }), false],
    ['addCourseTicketType', 'POST', 'courses/id1/ticket-types', () => service.addCourseTicketType('id1', { note: 1 }), false],
    ['getCourseRegistrations', 'GET', 'courses/id1/registrations', () => service.getCourseRegistrations('id1'), false],
    ['checkInCourseEvent', 'POST', 'courses/id1/check-in', () => service.checkInCourseEvent('id1', { note: 1 }), false],
    ['registerForTicketType', 'POST', 'ticket-types/id1/registrations', () => service.registerForTicketType('id1', { note: 1 }), false],
    ['cancelEventRegistration', 'POST', 'event-registrations/id1/cancel', () => service.cancelEventRegistration('id1'), false],
    ['getBookings', 'GET', 'bookings', () => service.getBookings(), false],
    ['createBooking', 'POST', 'bookings', () => service.createBooking({ note: 1 }), false],
    ['cancelBooking', 'POST', 'bookings/id1/cancel', () => service.cancelBooking('id1'), false],
    ['getExpiredCertificates', 'GET', 'certificates/expired', () => service.getExpiredCertificates(), false],
    ['getExpiringCertificates', 'GET', 'certificates/expiring', () => service.getExpiringCertificates(), false],
    ['downloadCertificate', 'GET', 'certificates/id1/download', () => service.downloadCertificate('id1'), true],
    ['deleteCertificate', 'DELETE', 'certificates/id1', () => service.deleteCertificate('id1'), false],
    ['getMemberCertificates', 'GET', 'members/mem1/certificates', () => service.getMemberCertificates('mem1'), false],
    ['addMemberCertificate', 'POST', 'members/mem1/certificates', () => service.addMemberCertificate('mem1', { title: "t" }, new File(['x'], 'f.pdf')), false],
    ['getAccessDevices', 'GET', 'access-devices', () => service.getAccessDevices(), false],
    ['createAccessDevice', 'POST', 'access-devices', () => service.createAccessDevice({ note: 1 }), false],
    ['rotateAccessDeviceSecret', 'POST', 'access-devices/id1/rotate-secret', () => service.rotateAccessDeviceSecret('id1'), false],
    ['deactivateAccessDevice', 'POST', 'access-devices/id1/deactivate', () => service.deactivateAccessDevice('id1'), false],
    ['getAccessLogs', 'GET', 'access-logs', () => service.getAccessLogs(), false],
    ['getAccessAreaOccupancy', 'GET', 'access-areas/id1/occupancy', () => service.getAccessAreaOccupancy('id1'), false],
    ['getNetworkCode', 'GET', 'network/code', () => service.getNetworkCode(), false],
    ['addNetworkAffiliate', 'POST', 'network/affiliates', () => service.addNetworkAffiliate({ note: 1 }), false],
    ['getNetworkConsents', 'GET', 'network/consents', () => service.getNetworkConsents(), false],
    ['grantNetworkConsent', 'POST', 'network/consents/id1/grant', () => service.grantNetworkConsent('id1'), false],
    ['withdrawNetworkConsent', 'POST', 'network/consents/id1/withdraw', () => service.withdrawNetworkConsent('id1'), false],
    ['getNetworkFigures', 'GET', 'network/figures', () => service.getNetworkFigures(), false],
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
