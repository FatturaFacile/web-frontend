import { expect, Page, test } from '@playwright/test';
import { seedAuthenticatedSession } from './pages/ErpPages';

const json = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

const PDV_XML =
  '<?xml version="1.0" encoding="UTF-8"?>\n<PacchettoDiVersamento IdPdV="PDV-2026-000042"><Intestazione/></PacchettoDiVersamento>';

const batch = (status: string) => ({
  id: 'b-1',
  batch_number: 'PDV-2026-000042',
  jurisdiction: 'DUAL',
  status,
  document_category: 'active_invoices',
  period_from: '2026-11-01',
  period_to: '2026-11-30',
  item_count: 1,
  total_size_bytes: 2048,
  pdv_sha256: 'a'.repeat(64),
  pda_sha256: null,
  merkle_root_sha256: 'b'.repeat(64),
  previous_batch_sha256: null,
  rfc3161_gen_time: null,
  external_conservator_id: null,
  retention_until: '2036-11-30',
  sealed_at: '2026-11-19T22:00:00Z',
  dispatched_at: null,
  created_at: '2026-11-19T21:00:00Z',
  has_timestamp: true,
  has_rdv: false,
});

async function mockApi(page: Page): Promise<{ saved: unknown[] }> {
  const saved: unknown[] = [];

  await page.route('**/api/v1/preservation/dashboard', (route) =>
    route.fulfill(
      json({
        success: true,
        message: '',
        data: {
          preserved_documents: 42,
          worm_size_bytes: 5242880,
          last_sealed_batch: {
            id: 'b-1',
            batch_number: 'PDV-2026-000042',
            sealed_at: '2026-11-19T22:00:00Z',
          },
          chain_status: 'verified',
          pending_unpreserved_documents: 3,
          retention_years: 10,
          batches_by_status: { sealed: 1 },
          last_verification_at: null,
        },
      }),
    ),
  );

  await page.route('**/api/v1/preservation/configuration', async (route) => {
    const cfg = {
      jurisdiction: 'IT',
      provider: 'local_worm',
      has_credentials: false,
      preservation_officer_name: 'Mario Rossi',
      preservation_officer_tax_code: 'RSSMRA80A01F205X',
      tsa_url: null,
      has_tsa_credentials: false,
      auto_seal_frequency: 'monthly',
      default_retention_years: 10,
      is_active: true,
    };
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      saved.push(body);
      await route.fulfill(
        json({ success: true, message: '', data: { ...cfg, ...body, has_credentials: true } }),
      );
      return;
    }
    await route.fulfill(json({ success: true, message: '', data: cfg }));
  });

  await page.route('**/api/v1/preservation/batches**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (method === 'POST' && url.pathname.endsWith('/batches')) {
      await route.fulfill(json({ success: true, message: '', data: batch('draft') }, 201));
    } else if (url.pathname.endsWith('/export-pdd')) {
      await route.fulfill({ status: 200, contentType: 'application/zip', body: 'PK' });
    } else if (url.pathname.endsWith('/b-1')) {
      await route.fulfill(
        json({
          success: true,
          message: '',
          data: {
            ...batch('timestamped'),
            pdv_xml: PDV_XML,
            rdv_xml: null,
            timestamp: null,
            items: [],
          },
        }),
      );
    } else {
      await route.fulfill(
        json({
          success: true,
          message: '',
          data: [batch('timestamped')],
          meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
        }),
      );
    }
  });

  return { saved };
}

test.describe('Digital preservation (Issue #212)', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthenticatedSession(page);
  });

  test('shows the dashboard KPIs and the verified chain badge', async ({ page }) => {
    await mockApi(page);
    await page.goto('/digital-preservation/dashboard');

    await expect(page.getByTestId('preservation-kpis')).toContainText('42');
    await expect(page.getByTestId('chain-badge')).toBeVisible();
  });

  test('configures an accredited conservator', async ({ page }) => {
    const { saved } = await mockApi(page);
    await page.goto('/digital-preservation/configuration');

    await page.getByTestId('provider-select').click();
    await page.locator('nz-option-item').nth(1).click();
    await expect(page.getByTestId('provider-credentials')).toBeVisible();
    await page
      .getByTestId('provider-credentials')
      .locator('input')
      .first()
      .fill('https://api.example.test');
    await page.getByTestId('save-configuration').click();

    await expect.poll(() => saved.length).toBe(1);
    expect(saved[0]).toMatchObject({ provider: 'aruba_pec' });
  });

  test('creates a batch, inspects PdV.xml and downloads the PdD package', async ({ page }) => {
    await mockApi(page);
    await page.goto('/digital-preservation/batches');

    await expect(page.getByTestId('batches-table')).toContainText('PDV-2026-000042');
    await page.getByTestId('open-batch').first().click();

    await page.getByRole('tab').nth(1).click();
    await expect(page.getByTestId('xml-viewer')).toContainText('PacchettoDiVersamento');

    const download = page.waitForEvent('download');
    await page.getByTestId('export-pdd').click();
    expect((await download).suggestedFilename()).toBe('PdD_PDV-2026-000042.zip');
  });
});
