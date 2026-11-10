import { act, col, cols, ResourcePageConfig, rf, req, tagCol } from '@shared';

const CHANNEL_FIELDS = [
  req(rf.select('channel', ['pec', 'openapi', 'acube', 'invoicetronic', 'local'])),
  rf.select('environment', ['production', 'sandbox']),
  rf.text('pec_email'),
  rf.text('pec_smtp_host'),
  rf.select('pec_smtp_port', ['465', '587', '25']),
  rf.text('pec_imap_host'),
  rf.select('pec_imap_port', ['993', '143']),
  rf.text('pec_username'),
  rf.text('pec_password', { secret: true }),
  rf.text('pec_address'),
  rf.json('credentials', { labelKey: 'RES.F.sdi_credentials' }),
  rf.text('webhook_secret', { secret: true }),
  rf.bool('sign_outgoing'),
  rf.text('zero_rate_nature'),
  rf.bool('ade_telematic_address_registered'),
  rf.date('ade_conservation_agreement_at'),
];

/** Electronic invoicing channel of the company (PEC or gateway), manual poll and quarantined inbound messages. */
export const SDI_CHANNEL_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.SDI_CHANNEL',
  tabs: [
    {
      id: 'channel',
      titleKey: 'RES.P.sdi_channel',
      module: 'system',
      list: { path: '/settings/sdi-channel', report: true, columns: [] },
      toolbar: [
        act('PUT', 'RES.A.edit_channel', '/settings/sdi-channel', { prefill: true, fields: CHANNEL_FIELDS }),
        act('POST', 'RES.A.poll_channel', '/settings/sdi-channel/poll', { confirm: true }),
      ],
    },
    {
      id: 'quarantine',
      titleKey: 'RES.P.sdi_quarantine',
      module: 'system',
      list: {
        path: '/settings/sdi-channel/quarantine',
        columns: [...cols('provider', 'event_type', 'sdi_uuid'), tagCol('status'), ...cols('error'), col('created_at', 'datetime')],
      },
      rowActions: [act('POST', 'RES.A.retry_message', '/settings/sdi-channel/quarantine/{id}/retry', { confirm: true, showResult: true })],
    },
  ],
};
