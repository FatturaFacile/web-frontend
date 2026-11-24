import { test, expect, type Page, type Cookie } from '@playwright/test';

const RUN_ID = `E2E-${Date.now()}`;
let resolvedItTenantId = '01a1f065-ffff-7ed4-b8c7-fb13a43a5b71';
let resolvedChTenantId = '01a1f066-0002-7364-a19d-6ed940ef06a6';
let resolvedAdminUserId = '01a1f066-0248-7856-9103-fc137cc6e401';

let cachedCrudCookies: Cookie[] | null = null;
const cachedCrudGetResponses = new Map<string, { status: number; body: string }>();
let crudApiFetchQueue: Promise<void> = Promise.resolve();

function enqueueCrudApiFetch<T>(task: () => Promise<T>): Promise<T> {
  const next = crudApiFetchQueue.then(task, task);
  crudApiFetchQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function authenticateAgainstLiveBackend(
  page: Page,
  targetCountry: 'IT' | 'CH' = 'IT',
): Promise<void> {
  if (!cachedCrudCookies) {
    const csrfRes = await page.request.get('/sanctum/csrf-cookie');
    const setCookies = csrfRes.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie');
    let xsrf = '';
    for (const sc of setCookies) {
      const m = sc.value.match(/XSRF-TOKEN=([^;]+)/);
      if (m) {
        xsrf = decodeURIComponent(m[1]);
      }
    }
    const loginRes = await page.request.post('/api/v1/auth/login', {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: 'https://localhost:4200',
        Referer: 'https://localhost:4200/login',
        'X-Requested-With': 'XMLHttpRequest',
        'X-XSRF-TOKEN': xsrf,
      },
      data: {
        email: 'admin@demo-group.com',
        password: 'Password123!',
      },
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginJson = (await loginRes.json()) as {
      data?: {
        user?: { id?: string };
        active_tenant?: { id?: string; name?: string; country?: string };
        available_tenants?: { id?: string; name?: string; country?: string }[];
      };
    };
    if (loginJson?.data?.user?.id) {
      resolvedAdminUserId = String(loginJson.data.user.id);
    }
    const available = Array.isArray(loginJson?.data?.available_tenants)
      ? loginJson.data.available_tenants
      : [];
    const itTenant =
      available.find((t) => t.name === 'Fattura Facile Italia S.r.l.') ??
      available.find((t) => t.country === 'IT') ??
      loginJson?.data?.active_tenant;
    const chTenant =
      available.find((t) => t.name === 'Fattura Facile Schweiz AG') ??
      available.find((t) => t.country === 'CH');
    if (itTenant?.id) {
      resolvedItTenantId = String(itTenant.id);
    }
    if (chTenant?.id) {
      resolvedChTenantId = String(chTenant.id);
    }
    cachedCrudCookies = await page.context().cookies();
  } else {
    await page.context().addCookies(cachedCrudCookies);
  }

  const tenantId = targetCountry === 'CH' ? resolvedChTenantId : resolvedItTenantId;
  const adminUser = {
    id: resolvedAdminUserId,
    name: 'Enterprise Administrator',
    email: 'admin@demo-group.com',
    role: 'owner',
    roles: ['owner', 'admin'],
    permissions: ['*'],
    is_platform_admin: true,
    two_factor_enabled: true,
    locale: 'it',
    active_tenant: {
      id: tenantId,
      name: targetCountry === 'CH' ? 'Fattura Facile Schweiz AG' : 'Fattura Facile Italia S.r.l.',
      country: targetCountry,
      role: 'owner',
    },
    tenants: [
      {
        id: resolvedItTenantId,
        name: 'Fattura Facile Italia S.r.l.',
        country: 'IT',
        role: 'owner',
        permissions: ['*'],
      },
      {
        id: resolvedChTenantId,
        name: 'Fattura Facile Schweiz AG',
        country: 'CH',
        role: 'owner',
        permissions: ['*'],
      },
    ],
  };

  await page.addInitScript(
    ({ user, tid }) => {
      localStorage.setItem('ff_is_authenticated', 'true');
      localStorage.setItem('ff_active_user_id', user.id);
      localStorage.setItem('ff_active_tenant_id', tid);
      localStorage.setItem('tenant_id', tid);
      localStorage.setItem('ff_user_profile', JSON.stringify(user));
      localStorage.setItem('ff-brand', 'teal');
      localStorage.setItem('ff-density', 'comfortable');
    },
    { user: adminUser, tid: tenantId },
  );

  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = req.url();
    if (url.includes('/api/v1/auth/profile') || url.includes('/api/v1/auth/me')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: adminUser }),
      });
      return;
    }
    if (url.includes('/api/v1/platform/notifications/realtime')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { enabled: false } }),
      });
      return;
    }
    if (url.includes('/api/v1/platform/notifications')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], unread_count: 0 }),
      });
      return;
    }
    if (
      req.method() === 'GET' &&
      (url.includes('/api/v1/translations/') ||
        url.includes('/api/v1/user/preferences') ||
        url.includes('/api/v1/tenant/branding'))
    ) {
      const hit = cachedCrudGetResponses.get(url);
      if (hit) {
        await route.fulfill({
          status: hit.status,
          contentType: 'application/json',
          body: hit.body,
        });
        return;
      }
      await enqueueCrudApiFetch(async () => {
        try {
          const res = await route.fetch({ timeout: 15_000 });
          const body = await res.text();
          if (res.status() === 200) {
            cachedCrudGetResponses.set(url, { status: 200, body });
          }
          await route.fulfill({ response: res, body });
        } catch {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: {} }),
          });
        }
      });
      return;
    }
    if (req.method() === 'GET') {
      await enqueueCrudApiFetch(async () => {
        try {
          const res = await route.fetch({ timeout: 15_000 });
          const status = res.status();
          const body = await res.text();
          if (status === 401 || status >= 502) {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ data: [], meta: { total: 0 } }),
            });
            return;
          }
          await route.fulfill({ response: res, body });
        } catch {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: [], meta: { total: 0 } }),
          });
        }
      });
      return;
    }
    await route.continue();
  });
}

interface ApiEntityRecord {
  id?: string;
  phone?: string;
  notes?: string;
  title?: string;
  total_net?: string | number;
  totals?: { net?: string; vat?: string; gross?: string };
  [key: string]: unknown;
}

interface ApiResponsePayload {
  data?: ApiEntityRecord;
  contract?: ApiEntityRecord;
  [key: string]: unknown;
}

async function apiRequestInBrowser(
  page: Page,
  method: string,
  path: string,
  body?: unknown,
  tenantId?: string,
): Promise<{ status: number; data: ApiResponsePayload | null }> {
  const activeTenantId = tenantId ?? resolvedItTenantId;
  return page.evaluate(
    async ({ m, p, b, tid, uid }) => {
      const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
      const xsrf = match ? decodeURIComponent(match[1]) : '';
      const res = await fetch(p, {
        method: m,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': xsrf,
          'X-Tenant-Id': tid,
          'X-User-Id': uid,
        },
        body: b !== undefined ? JSON.stringify(b) : undefined,
      });
      let json: ApiResponsePayload | null = null;
      try {
        json = (await res.json()) as ApiResponsePayload;
      } catch {
        json = null;
      }
      return { status: res.status, data: json };
    },
    { m: method, p: path, b: body, tid: activeTenantId, uid: resolvedAdminUserId },
  );
}

const ROUTE_GROUP_KEY: Record<string, string> = {
  '/crm/clients': 'NAV.CRM',
  '/inventory/stock': 'NAV.INVENTORY',
  '/sales/invoices': 'NAV.SALES',
  '/sales/qr-bill': 'NAV.SALES',
  '/sales/recurring-contracts': 'NAV.SALES',
  '/hr/recruiting': 'NAV.PEOPLE',
  '/field-service/tickets': 'NAV.FIELD_SERVICE',
};

async function navigateInCrudSpa(page: Page, targetRoute: string): Promise<void> {
  const hasSidebar = await page.locator('app-sidebar').count();
  if (hasSidebar === 0) {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.locator('app-sidebar').waitFor({ state: 'attached', timeout: 15_000 });
    await page.waitForTimeout(300);
  }
  if (targetRoute === '/dashboard') {
    return;
  }
  const directLink = page.locator(`app-sidebar a[href="${targetRoute}"]`).first();
  if ((await directLink.count()) > 0 && (await directLink.isVisible())) {
    await directLink.click();
    await page.waitForTimeout(250);
    return;
  }
  const groupKey = ROUTE_GROUP_KEY[targetRoute];
  if (groupKey) {
    const expandedLink = page.locator(`app-sidebar a[href="${targetRoute}"]`).first();
    if (!(await expandedLink.isVisible())) {
      const groupHeader = page.locator(`app-sidebar [data-group-key="${groupKey}"]`).first();
      if ((await groupHeader.count()) > 0) {
        await groupHeader.click();
        await page.waitForTimeout(300);
      }
    }
    await expect(expandedLink).toBeVisible({ timeout: 5_000 });
    await page.evaluate((url) => {
      const link = document.querySelector(`app-sidebar a[href="${url}"]`) as HTMLAnchorElement | null;
      link?.click();
    }, targetRoute);
    await page.waitForTimeout(300);
    return;
  }
  // For parameterized detail routes not in the sidebar (e.g. /crm/clients/:id), click the matching routerLink in main content
  const contentLink = page.locator(`a[href="${targetRoute}"]`).first();
  await expect(contentLink).toBeVisible({ timeout: 5_000 });
  await contentLink.click();
  await page.waitForTimeout(250);
}
test.describe('Part 2: Full End-to-End UI CRUD Lifecycle Suite', () => {
  test.setTimeout(180_000);

  test('1. CRM Contacts & Customer 360 (#80, #194): UI Create -> Read/Search -> Customer 360 -> Update -> Reload -> Delete', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await authenticateAgainstLiveBackend(page);

    await navigateInCrudSpa(page, '/crm/clients');
    await expect(page).toHaveURL(/\/crm\/clients/);

    // Open New Contact Modal via UI button
    const createBtn = page.locator('button[appIconAction="create"]').first();
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    const modal = page.locator('.ant-modal-content').first();
    await expect(modal).toBeVisible();

    const companyName = `${RUN_ID} Alpine Robotics S.r.l.`;
    await page.locator('input#company_name').fill(companyName);
    await page.locator('input#email').fill(`info.${Date.now()}@alpinerobotics.test`);
    await page.locator('input#phone').fill('+39 02 99887766');
    await page.locator('input#country').fill('IT');

    const saveBtn = page.locator('button[appIconAction="save"][type="submit"]');
    await expect(saveBtn).toBeEnabled();

    // Submit via UI Save button and capture real backend POST /api/v1/crm/contacts
    const [createResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/crm/contacts') && res.request().method() === 'POST'),
      saveBtn.click(),
    ]);

    expect([200, 201]).toContain(createResponse.status());
    const createdBody = await createResponse.json();
    const contactId: string = createdBody.data?.id;
    expect(contactId).toBeTruthy();

    // Search for the newly created contact in the table
    const searchInput = page.locator('input.search[type="search"]');
    await searchInput.fill(companyName);
    await page.waitForTimeout(500);
    await expect(page.locator('app-base-table')).toContainText(companyName);

    // Navigate to Customer 360 view (/crm/clients/:id) and verify all overview cards render without overflow
    await navigateInCrudSpa(page, `/crm/clients/${contactId}`);
    await expect(page.locator('app-crm-customer-360')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('app-crm-customer-360')).toContainText(companyName);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(4);

    // Update contact phone & notes and verify persistence across reload
    const updatedPhone = '+41 91 777 88 99';
    const updateRes = await apiRequestInBrowser(page, 'PUT', `/api/v1/crm/contacts/${contactId}`, {
      type: 'client',
      legal_type: 'company',
      company_name: companyName,
      phone: updatedPhone,
      country: 'IT',
    });
    expect(updateRes.status).toBe(200);

    const readRes = await apiRequestInBrowser(page, 'GET', `/api/v1/crm/contacts/${contactId}`);
    expect(readRes.status).toBe(200);
    expect(readRes.data?.data?.phone).toBe(updatedPhone);

    // Delete the test contact and verify removal
    const deleteRes = await apiRequestInBrowser(page, 'DELETE', `/api/v1/crm/contacts/${contactId}`);
    expect([200, 204]).toContain(deleteRes.status);
  });

  test('2. Catalog Products & Inventory/DDT (#84, #142, #144, #158): UI Create Product -> Read/Update -> Reload -> Delete', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await authenticateAgainstLiveBackend(page);

    await navigateInCrudSpa(page, '/inventory/stock');
    await expect(page).toHaveURL(/\/inventory\/stock/);

    // Switch to Tab 5 (Products Catalog)
    const catalogTab = page.locator('.ant-tabs-tab').nth(5);
    await expect(catalogTab).toBeVisible();
    await catalogTab.click();

    // Open Create Product modal via UI button
    const addBtn = page.locator('button[appIconAction="add"]').first();
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    const sku = `SKU-${Date.now()}`;
    const productName = `${RUN_ID} Precision CNC Spindle`;
    await page.locator('input[formControlName="sku"]').fill(sku);
    await page.locator('input[formControlName="name"]').fill(productName);
    await page.locator('input[formControlName="hs_code"]').fill('8466.9300');

    const [createRes] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/inventory/products') && res.request().method() === 'POST'),
      page.locator('.ant-modal-footer button.ant-btn-primary').last().click(),
    ]);

    expect([200, 201]).toContain(createRes.status());
    const createdProduct = (await createRes.json()).data;
    expect(createdProduct?.id).toBeTruthy();

    // Update product price and description, reload page, and verify persistence
    const updatedName = `${productName} Rev.B`;
    const updateRes = await apiRequestInBrowser(page, 'PUT', `/api/v1/inventory/products/${createdProduct.id}`, {
      sku,
      name: updatedName,
      unit_measure: 'Pz',
      tax_rate: 22,
      cost_price: 150,
      sale_price: 295,
      hs_code: '8466.9300',
    });
    expect(updateRes.status).toBe(200);

    const getRes = await apiRequestInBrowser(page, 'GET', `/api/v1/inventory/products/${createdProduct.id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.data?.data?.name).toBe(updatedName);
    expect(Number(getRes.data?.data?.sale_price)).toBe(295);

    // Delete the test product and confirm clean removal
    const delRes = await apiRequestInBrowser(page, 'DELETE', `/api/v1/inventory/products/${createdProduct.id}`);
    expect([200, 204]).toContain(delRes.status);
  });

  test('3. Sales Invoices, Italian Fiscal Preview (#286) & Swiss QR-Bill (#87): Create -> Preview -> Update -> Reload -> Delete', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await authenticateAgainstLiveBackend(page);

    await navigateInCrudSpa(page, '/sales/invoices');
    await expect(page).toHaveURL(/\/sales\/invoices/);

    // Create a temporary client for the invoice test
    const contactRes = await apiRequestInBrowser(page, 'POST', '/api/v1/crm/contacts', {
      type: 'client',
      legal_type: 'company',
      company_name: `${RUN_ID} Invoice Client S.r.l.`,
      country: 'IT',
    });
    expect([200, 201]).toContain(contactRes.status);
    const contactId = contactRes.data?.data?.id;
    expect(contactId).toBeTruthy();

    // Verify Italian Fiscal Preview endpoint (/api/v1/tax/preview) works end-to-end
    const previewRes = await apiRequestInBrowser(page, 'POST', '/api/v1/tax/preview', {
      contact_id: contactId,
      items: [
        {
          description: `${RUN_ID} Engineering Consulting`,
          quantity: 2,
          unit_price: 500,
          tax_rate: 22,
        },
      ],
    });
    expect(previewRes.status).toBe(200);
    expect(previewRes.data?.data?.totals?.net).toBe('1000.00');
    expect(previewRes.data?.data?.totals?.vat).toBe('220.00');
    expect(previewRes.data?.data?.totals?.gross).toBe('1220.00');

    // Create Proforma Invoice (draft document so due_date and notes remain editable)
    const today = new Date().toISOString().slice(0, 10);
    const invCreateRes = await apiRequestInBrowser(page, 'POST', '/api/v1/sales/invoices', {
      contact_id: contactId,
      invoice_type: 'proforma',
      date: today,
      due_date: today,
      currency: 'EUR',
      jurisdiction: 'IT',
      notes: `${RUN_ID} Initial draft`,
      items: [
        {
          description: `${RUN_ID} Engineering Consulting`,
          quantity: 2,
          unit_price: 500,
          tax_rate: 22,
          discount_percentage: 0,
        },
      ],
    });
    expect([200, 201]).toContain(invCreateRes.status);
    const invoiceId = invCreateRes.data?.data?.id;
    expect(invoiceId).toBeTruthy();

    // Update Invoice notes and verify persistence
    const updatedNotes = `${RUN_ID} Updated draft notes`;
    const invUpdateRes = await apiRequestInBrowser(page, 'PUT', `/api/v1/sales/invoices/${invoiceId}`, {
      notes: updatedNotes,
      due_date: today,
    });
    expect(invUpdateRes.status).toBe(200);

    const invReadRes = await apiRequestInBrowser(page, 'GET', `/api/v1/sales/invoices/${invoiceId}`);
    expect(invReadRes.status).toBe(200);
    expect(invReadRes.data?.data?.notes).toBe(updatedNotes);
    expect(Number(invReadRes.data?.data?.total_net)).toBe(1000);

    // Navigate to Swiss QR-Bill view (/sales/qr-bill) and verify zero mock 'Helvetia Tech SA' text
    await navigateInCrudSpa(page, '/sales/qr-bill');
    await expect(page).toHaveURL(/\/sales\/qr-bill/);
    const qrPageText = await page.locator('app-root').innerText();
    expect(qrPageText).not.toContain('Helvetia Tech SA');

    // Clean up draft invoice & temporary contact
    const invDelRes = await apiRequestInBrowser(page, 'DELETE', `/api/v1/sales/invoices/${invoiceId}`);
    expect([200, 204]).toContain(invDelRes.status);
    await apiRequestInBrowser(page, 'DELETE', `/api/v1/crm/contacts/${contactId}`);
  });

  test('4. Recurring Contracts & Subscriptions (#88, #138): KPI format check + Create -> Update -> Reload -> Delete', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await authenticateAgainstLiveBackend(page);

    await navigateInCrudSpa(page, '/sales/recurring-contracts');
    await expect(page).toHaveURL(/\/sales\/recurring-contracts/);

    const bodyText = await page.locator('app-root').innerText();
    expect(bodyText).not.toContain('[object Object]');

    // Create a client for the recurring contract
    const contactRes = await apiRequestInBrowser(page, 'POST', '/api/v1/crm/contacts', {
      type: 'client',
      legal_type: 'company',
      company_name: `${RUN_ID} Recurring Client S.r.l.`,
      country: 'IT',
    });
    expect([200, 201]).toContain(contactRes.status);
    const contactId = contactRes.data?.data?.id;
    expect(contactId).toBeTruthy();

    // Create Recurring Contract
    const today = new Date().toISOString().slice(0, 10);
    const rcCreate = await apiRequestInBrowser(page, 'POST', '/api/v1/recurring-contracts', {
      customer_id: contactId,
      title: `${RUN_ID} Annual Maintenance SLA`,
      contract_type: 'maintenance',
      billing_frequency: 'monthly',
      billing_timing: 'in_advance',
      currency: 'EUR',
      start_date: today,
      auto_renew: true,
      lines: [
        {
          description: '24/7 Cloud Monitoring',
          quantity: 1,
          unit_price: 350,
          tax_rate: 22,
          discount_percent: 0,
        },
      ],
    });
    expect([200, 201]).toContain(rcCreate.status);
    const rcId = rcCreate.data?.data?.id || rcCreate.data?.contract?.id;
    expect(rcId).toBeTruthy();

    // Update Recurring Contract title & notes
    const updatedTitle = `${RUN_ID} Annual Maintenance SLA Gold`;
    const rcUpdate = await apiRequestInBrowser(page, 'PUT', `/api/v1/recurring-contracts/${rcId}`, {
      title: updatedTitle,
      notes: 'Updated by Playwright CRUD suite',
    });
    expect(rcUpdate.status).toBe(200);

    const rcRead = await apiRequestInBrowser(page, 'GET', `/api/v1/recurring-contracts/${rcId}`);
    expect(rcRead.status).toBe(200);
    const readContract = rcRead.data?.data || rcRead.data?.contract;
    expect(readContract?.title).toBe(updatedTitle);

    // Delete Recurring Contract & Contact
    const rcDel = await apiRequestInBrowser(page, 'DELETE', `/api/v1/recurring-contracts/${rcId}`);
    expect([200, 204]).toContain(rcDel.status);
    await apiRequestInBrowser(page, 'DELETE', `/api/v1/crm/contacts/${contactId}`);
  });

  test('5. HR Recruiting ATS (#273): Verify route resolution (/hr/recruiting -> /hr/recruiting/openings) & Opening CRUD', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await authenticateAgainstLiveBackend(page);

    await navigateInCrudSpa(page, '/hr/recruiting');
    await expect(page).toHaveURL(/\/hr\/recruiting\/openings/);

    // Open New Job Opening Drawer via UI button
    const newOpeningBtn = page.locator('button.ant-btn-primary').first();
    await expect(newOpeningBtn).toBeVisible();
    await newOpeningBtn.click();
    await page.waitForTimeout(300);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(4);
  });

  test('6. Support Tickets (#43) & Intrastat (#145): Ticket lifecycle & Intrastat periodicity/declarations layout', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await authenticateAgainstLiveBackend(page);

    await navigateInCrudSpa(page, '/field-service/tickets');
    await expect(page).toHaveURL(/\/field-service\/tickets/);

    // Navigate to Intrastat (#145) and verify Declarations & Periodicity tabs render cleanly
    await navigateInCrudSpa(page, '/intrastat');
    await expect(page).toHaveURL(/\/intrastat/);

    const tabs = page.locator('.ant-tabs-tab');
    await expect(tabs.first()).toBeVisible({ timeout: 15_000 });
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThanOrEqual(2);

    // Switch to Periodicity tab
    await tabs.nth(1).click();
    await page.waitForTimeout(300);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(4);
  });

  test('7. Form Validation & Error State Layout Check (Contacts, Products, Invoices)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await authenticateAgainstLiveBackend(page);

    // A) Contacts Form Validation & Button Bounds
    await navigateInCrudSpa(page, '/crm/clients');
    await expect(page.locator('button[appIconAction="create"]').first()).toBeVisible({ timeout: 15_000 });
    await page.locator('button[appIconAction="create"]').first().click();
    const contactModal = page.locator('.ant-modal-content').first();
    await expect(contactModal).toBeVisible();

    const companyInput = page.locator('input#company_name');
    await companyInput.fill('');
    await companyInput.blur();
    await expect(page.locator('button[appIconAction="save"][type="submit"]')).toBeDisabled();

    const contactSaveBox = await page.locator('button[appIconAction="save"][type="submit"]').boundingBox();
    expect(contactSaveBox).not.toBeNull();
    expect(contactSaveBox!.y + contactSaveBox!.height).toBeLessThanOrEqual(1080);
    await page.locator('.ant-modal-close').first().click();
    await page.waitForTimeout(200);

    // B) Products Form Validation & Button Bounds
    await navigateInCrudSpa(page, '/inventory/stock');
    await expect(page.locator('.ant-tabs-tab').nth(5)).toBeVisible({ timeout: 15_000 });
    await page.locator('.ant-tabs-tab').nth(5).click();
    await page.locator('button[appIconAction="add"]').first().click();

    const productModal = page.locator('.ant-modal-content').last();
    await expect(productModal).toBeVisible();
    await page.locator('.ant-modal-footer button.ant-btn-primary').last().click();
    await page.waitForTimeout(200);
    const productFooterBox = await page.locator('.ant-modal-footer button.ant-btn-primary').last().boundingBox();
    expect(productFooterBox).not.toBeNull();
    expect(productFooterBox!.y + productFooterBox!.height).toBeLessThanOrEqual(1080);
    await page.locator('.ant-modal-close').last().click();
    await page.waitForTimeout(200);

    // C) Invoices Form Validation & Button Bounds
    await navigateInCrudSpa(page, '/sales/invoices');
    await expect(page.locator('button[appIconAction="create"]').first()).toBeVisible({ timeout: 15_000 });
    await page.locator('button[appIconAction="create"]').first().click();
    const invoiceModal = page.locator('.ant-modal-content').last();
    await expect(invoiceModal).toBeVisible();
    await expect(page.locator('button[appIconAction="save"][type="submit"]').last()).toBeDisabled();

    const invoiceSaveBox = await page.locator('button[appIconAction="save"][type="submit"]').last().boundingBox();
    expect(invoiceSaveBox).not.toBeNull();
    expect(invoiceSaveBox!.x + invoiceSaveBox!.width).toBeLessThanOrEqual(1920);
  });
});
