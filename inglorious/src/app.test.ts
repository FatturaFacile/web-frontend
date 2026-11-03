import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// jsdom has <dialog> without its methods: enough of them to open and close one.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true
}
HTMLDialogElement.prototype.show ??= function (this: HTMLDialogElement) {
  this.open = true
}
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.open = false
}

const UNAUTHORIZED = 401
const OK = 200

const user = { id: "u1", name: "Marco Rossi", email: "m.rossi@example.com" }
const contacts = [
  {
    id: "c1",
    type: "client",
    country: "IT",
    company_name: "Rossi Impianti S.r.l.",
    first_name: "Marco",
    last_name: "Rossi",
    email: "info@rossi.it",
    phone: null,
    vat_number: "IT12345678901",
    fiscal_code: null,
    uid_number: null,
    sdi_code: null,
    pec: null,
    iban: null,
    qr_iban: null,
    payment_terms_days: 30,
    address: null,
  },
]

const site = {
  code: "CANT-042",
  client: "Comune di Lugano",
  location: "Lugano",
  regime: "CH",
  sal: "SAL 3 - 45%",
  norm: "SIA 118",
  vatRegime: "Reverse charge",
}

const kpi = {
  revenue_month: 12500.5,
  revenue_ytd: 98000,
  open_receivables: 3200,
  open_payables: 1500,
  pending_invoices_count: 7,
  active_alerts_count: 2,
}

const invoice = {
  id: "i1",
  invoice_number: "FT-2026-0042",
  issue_date: "2026-10-01",
  due_date: null,
  status: "issued",
  payment_status: "overdue",
  subtotal: 1000,
  tax_amount: 81,
  total: 1081,
  currency: "CHF",
  has_swiss_qr: true,
  client: contacts[0],
}

const invoiceDetail = {
  ...invoice,
  notes: "Grazie",
  items: [
    {
      description: "Consulenza",
      quantity: 2,
      unit_price: 500,
      tax_rate: 8.1,
      discount_percentage: 0,
    },
  ],
}

const qrBill = {
  id: "q1",
  billNumber: "QR-2026-0007",
  issueDate: "2026-10-01",
  dueDate: "2026-10-31",
  currency: "CHF",
  amount: 1450.83,
  creditor: {
    name: "Helvetia Tech SA",
    address: "Via Nassa 12",
    postalCode: "6900",
    city: "Lugano",
    country: "CH",
    qrIban: "CH4431999123000889012",
  },
  debtor: {
    name: "Bernasconi SA",
    address: "Corso Elvezia 18",
    postalCode: "6900",
    city: "Lugano",
    country: "CH",
  },
  reference: "210000000003139471430009017",
  unstructuredMessage: "Fornitura Q4",
  status: "PENDING",
}

const SERVER_ERROR = 500

const purchaseOrders = [
  {
    id: "po1",
    order_number: "PO-2026-001",
    supplier_name: "Swisscom AG",
    channel: "QR-Bill",
    status: "draft",
    currency: "CHF",
    total: 120,
  },
  {
    id: "po2",
    order_number: "PO-2026-002",
    supplier_name: "TIM S.p.A.",
    channel: "SDI",
    status: "pending_approval",
    currency: "EUR",
    total: 80,
  },
]

const expense = {
  id: "e1",
  date: "2026-10-20",
  description: "Pranzo di lavoro",
  merchant: "Ristorante Bellavista",
  amount: 145.5,
  currency: "CHF",
  status: "pending_approval",
}

const ledgerEntry = {
  id: "le1",
  entry_number: "GL-2026-0042",
  date: "2026-10-31",
  description: "Pagamento fornitore",
  lines: [
    {
      account_id: "a1",
      account_code: "2010",
      account_name: "Fornitori",
      debit: 300,
      credit: 0,
    },
    {
      account_id: "a2",
      account_code: "1010",
      account_name: "Cassa",
      debit: 0,
      credit: 300,
    },
  ],
}

const accounts = [
  {
    id: "ba1",
    bank_name: "UBS",
    iban: "CH44",
    currency: "CHF",
    balance: 1000.5,
    is_active: true,
  },
  {
    id: "ba2",
    bank_name: "Credit Suisse",
    iban: "CH45",
    currency: "CHF",
    balance: 500,
    is_active: true,
  },
  {
    id: "ba3",
    bank_name: "Intesa",
    iban: "IT60",
    currency: "EUR",
    balance: 200,
    is_active: true,
  },
]

const transactions = [
  {
    id: "tx1",
    bank_account_id: "ba1",
    transaction_date: "2026-10-25",
    amount: -450,
    currency: "CHF",
    description: "PAGAMENTO QR-BILL 982347",
    counterparty: "Swiss Post",
    reconciled: false,
  },
  {
    id: "tx2",
    bank_account_id: "ba3",
    transaction_date: "2026-10-24",
    amount: 1351.25,
    currency: "EUR",
    description: "BONIFICO SEPA INV-2026-0042",
    reconciled: true,
  },
]

const tenantSettings = {
  id: "t-it",
  name: "Fattura Facile Italia S.r.l.",
  legal_name: null,
  vat_number: "IT01234567890",
  default_currency: "EUR",
  sdi_code: "M5UXCR1",
}

const settingsUser = {
  id: "u2",
  name: "Chiara Bianchi",
  email: "c.bianchi@example.com",
  role: "Accountant",
  roles: ["ACCOUNTANT"],
  is_active: false,
  last_login_at: null,
}

const alert = {
  id: "a1",
  title: "Liquidazione IVA Q3",
  message: "Versamento F24 entro il 16 novembre",
  severity: "warning",
  is_active: true,
  created_at: "2026-10-25T08:00:00Z",
}

const product = {
  id: "p1",
  sku: "EL-SENS-01",
  name: "Sensore di temperatura",
  warehouse: "Chiasso (CH)",
  quantity: 40,
  unit_of_measure: "Pz",
  hs_code: "9025.19.00",
  price: 12.5,
  currency: "CHF",
}

const backup = {
  id: "b1",
  filename: "fatturafacile-backup-2026-10-30-full.zip",
  size_bytes: 48512000,
  status: "completed",
  created_at: "2026-10-30T23:00:00Z",
}
let profile: Record<string, unknown> = user

const italian = {
  id: "t-it",
  name: "Fattura Facile Italia S.r.l.",
  role: "admin",
}
const swiss = { id: "t-ch", name: "Fattura Facile Schweiz AG", role: "admin" }
let isReminderFailing = false

const tire = {
  id: "t1",
  customerName: "Garage Bernasconi",
  vehiclePlate: "TI 123456",
  vehicleModel: "VW Golf",
  season: "WINTER",
  brandModel: "Michelin Alpin 6",
  dot: "2324",
  treadDepthMm: { frontLeft: 6, frontRight: 6, rearLeft: 5, rearRight: 5 },
  hasRims: true,
  rimType: "Alu",
  rackLocation: "A-12",
  depositDate: "2026-10-15",
  status: "stored",
  reminderSent: false,
}

const order = {
  order_id: "o1",
  ref_code: "ORD-77",
  created_timestamp: "2026-10-20T09:30:00Z",
  items: [{ item_id: "x", prod_name: "Inverter 5kW", qty: 2, price: 450 }],
  total: 900,
}

const attendance = {
  summary: {
    weeklyHoursWorked: 38,
    weeklyLimitHours: 45,
    overtimeHours: 0,
    vacationDaysAvailable: 12,
    statutoryRestCompliant: false,
    jurisdiction: "CH",
    regime: "ArG 45h",
  },
  todaySession: {
    isClockedIn: false,
    clockInTime: "08:00",
    breakMinutes: 30,
    totalTodayHours: 4.5,
  },
  records: [
    {
      id: "r1",
      date: "2026-11-02",
      clockIn: "08:00",
      clockOut: null,
      breakMinutes: 30,
      hoursWorked: 4.5,
      complianceNotice: "Pausa minima rispettata",
      status: "IN_PROGRESS",
    },
  ],
  vacations: {
    annualEntitlementDays: 25,
    takenDays: 13,
    remainingDays: 12,
    rolHoursAvailable: 16,
  },
}

function respond(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }))
}

async function boot(path: string, isSignedIn: boolean) {
  history.replaceState(null, "", path)
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("/auth/profile")) {
        return isSignedIn
          ? respond(OK, { success: true, message: "", data: profile })
          : respond(UNAUTHORIZED, { message: "Unauthenticated." })
      }
      if (url.includes("/auth/login")) {
        isSignedIn = true
        return respond(OK, { success: true, message: "", data: { user } })
      }
      // As the backend really answers: a paginator nested in `data`.
      if (url.includes("/crm/contacts")) {
        return respond(OK, {
          success: true,
          message: "",
          data: { current_page: 1, data: contacts, per_page: 25, total: 1 },
        })
      }
      if (url.includes("/dashboard/kpi-summary")) {
        return respond(OK, { success: true, message: "", data: kpi })
      }
      if (url.includes("/documents/invoice/i1/email")) {
        return respond(OK, { success: true, message: "", data: null })
      }
      if (url.includes("/sales/invoices/i1")) {
        return respond(OK, { success: true, message: "", data: invoiceDetail })
      }
      if (url.includes("/sales/invoices") && init?.method === "POST") {
        return respond(201, { success: true, message: "", data: invoice })
      }
      if (url.includes("/sales/qr-bills")) {
        return respond(OK, [qrBill])
      }
      if (url.includes("/sales/invoices")) {
        return respond(OK, {
          success: true,
          message: "",
          data: [invoice],
          meta: { total: 1 },
        })
      }
      if (url.includes("/purchase-orders/po2/approve")) {
        return respond(OK, { success: true, message: "", data: null })
      }
      if (
        url.includes("/procurement/purchase-orders") &&
        init?.method === "POST"
      ) {
        return respond(201, { success: true, message: "", data: null })
      }
      if (url.includes("/procurement/purchase-orders")) {
        return respond(OK, {
          success: true,
          message: "",
          data: {
            current_page: 1,
            data: purchaseOrders,
            per_page: 10,
            total: 2,
          },
        })
      }
      if (url.includes("/procurement/suppliers")) {
        return respond(OK, {
          success: true,
          message: "",
          data: [{ id: "sup-uuid-1", company_name: "Swisscom AG" }],
        })
      }
      if (url.includes("/expenses/export")) {
        return respond(SERVER_ERROR, { message: "Export service unavailable" })
      }
      if (url.includes("/expenses")) {
        return respond(OK, {
          success: true,
          message: "",
          data: { current_page: 1, data: [expense], per_page: 10, total: 1 },
        })
      }
      if (
        url.includes("/accounting/ledger-entries") &&
        init?.method === "POST"
      ) {
        return respond(201, { success: true, message: "", data: ledgerEntry })
      }
      if (url.includes("/accounting/ledger-entries")) {
        return respond(OK, {
          success: true,
          message: "",
          data: {
            current_page: 1,
            data: [ledgerEntry],
            per_page: 10,
            total: 1,
          },
        })
      }
      if (url.includes("/treasury/reconciliation/auto-match")) {
        return respond(SERVER_ERROR, {
          message: "Matching service unavailable",
        })
      }
      if (url.includes("/treasury/import-cbi")) {
        return respond(OK, {
          success: true,
          message: "",
          data: { imported_count: 3 },
        })
      }
      if (url.includes("/treasury/bank-accounts")) {
        return respond(OK, { success: true, message: "", data: accounts })
      }
      if (url.includes("/treasury/transactions")) {
        return respond(OK, {
          success: true,
          message: "",
          data: { current_page: 1, data: transactions, per_page: 10, total: 2 },
        })
      }
      if (url.includes("/banking/statements")) {
        return respond(OK, { success: true, message: "", data: [] })
      }
      if (url.includes("/settings/tenant")) {
        return respond(OK, { success: true, message: "", data: tenantSettings })
      }
      if (url.includes("/settings/users")) {
        return respond(OK, { success: true, message: "", data: [settingsUser] })
      }
      if (url.includes("/alerts/a1") && init?.method === "PUT") {
        return respond(OK, { success: true, message: "", data: alert })
      }
      if (url.includes("/alerts")) {
        return respond(OK, {
          success: true,
          message: "",
          data: { current_page: 1, data: [alert], per_page: 10, total: 1 },
        })
      }
      if (url.includes("/inventory/products") && init?.method === "POST") {
        return respond(201, { success: true, message: "", data: product })
      }
      if (url.includes("/inventory/products")) {
        return respond(OK, {
          success: true,
          message: "",
          data: { current_page: 1, data: [product], per_page: 10, total: 1 },
        })
      }
      if (url.includes("/system/backups/b1/restore")) {
        return respond(SERVER_ERROR, {
          message: "Restore failed: archive corrupted",
        })
      }
      if (url.includes("/system/backups/b1") && init?.method === "DELETE") {
        return respond(OK, { success: true, message: "", data: null })
      }
      if (url.includes("/system/backups")) {
        return respond(OK, { success: true, message: "", data: [backup] })
      }
      if (url.includes("/auth/switch-tenant")) {
        profile = { ...profile, active_tenant: { ...swiss, country: "CH" } }
        return respond(OK, { success: true, message: "", data: null })
      }
      if (url.includes("/reminder")) {
        return isReminderFailing
          ? respond(SERVER_ERROR, { message: "SMS gateway down" })
          : respond(OK, { success: true, message: "", data: null })
      }
      if (url.includes("/automotive/tire-hotel")) {
        return respond(OK, [tire])
      }
      if (url.includes("/time-attendance")) {
        return respond(OK, attendance)
      }
      if (url.includes("/orders")) {
        return respond(OK, [order])
      }
      if (url.includes("/construction/sites")) {
        return respond(OK, { success: true, message: "", data: [site] })
      }
      return respond(OK, {})
    }),
  )

  const { start } = await import("./start")

  const root = document.createElement("div")
  document.body.append(root)
  await start(root)
  return root
}

describe("App", () => {
  beforeEach(() => {
    vi.resetModules()
    isReminderFailing = false
    profile = user
    localStorage.setItem("lang", "en")
  })

  afterEach(() => {
    document.body.replaceChildren()
    vi.unstubAllGlobals()
  })

  it("sends a visitor from a protected page to the login form", async () => {
    const root = await boot("/crm/clients", false)

    await vi.waitFor(() => expect(location.pathname).toBe("/login"))
    expect(location.search).toBe("?from=%2Fcrm%2Fclients")
    await vi.waitFor(() =>
      expect(root.querySelector("form input[type=email]")).not.toBeNull(),
    )
  })

  it("signs in and goes back where the visitor was headed", async () => {
    const root = await boot("/crm/suppliers", false)
    await vi.waitFor(() =>
      expect(root.querySelector("input[type=password]")).not.toBeNull(),
    )

    type("input[type=email]", "m.rossi@example.com")
    type("input[type=password]", "Password123!")
    root.querySelector<HTMLButtonElement>("button[type=submit]")!.click()

    await vi.waitFor(() => expect(location.pathname).toBe("/crm/suppliers"))
    await vi.waitFor(() =>
      expect(root.textContent).toContain("Rossi Impianti S.r.l."),
    )
    const lastRequest = vi
      .mocked(fetch)
      .mock.calls.map(([url]) => String(url))
      .filter((url) => url.includes("/crm/contacts"))
      .pop()
    expect(lastRequest).toContain("type=supplier")

    function type(selector: string, value: string) {
      const input = root.querySelector<HTMLInputElement>(selector)!
      input.value = value
      input.dispatchEvent(new Event("input", { bubbles: true }))
    }
  })

  it("shows a signed-in user the clients from the server", async () => {
    const root = await boot("/crm/clients", true)

    await vi.waitFor(() =>
      expect(root.textContent).toContain("Rossi Impianti S.r.l."),
    )
    expect(root.textContent).toContain("IT12345678901")
    expect(root.querySelector("nav[aria-label]")).not.toBeNull()

    const [request] = vi
      .mocked(fetch)
      .mock.calls.map(([url]) => String(url))
      .filter((url) => url.includes("/crm/contacts"))
    expect(request).toBe("/api/v1/crm/contacts?page=1&per_page=10")
  })

  it("lists a section loaded from its endpoint, with its tags", async () => {
    const root = await boot("/construction", true)

    await vi.waitFor(() => expect(root.textContent).toContain("CANT-042"))
    expect(root.querySelector("th")?.textContent).toContain("Site Code")
    const tags = [...root.querySelectorAll(".iw-chip")].map((chip) =>
      chip.textContent?.trim(),
    )
    expect(tags).toEqual(["Lugano (CH)", "SIA 118"])
  })

  it("opens on the dashboard, with the figures and the latest invoices", async () => {
    const root = await boot("/", true)

    await vi.waitFor(() => expect(location.pathname).toBe("/dashboard"))
    await vi.waitFor(() => expect(root.textContent).toContain("FT-2026-0042"))
    expect(root.textContent).toContain("€12,500.50")
    expect(root.textContent).toMatch(/CHF\s1,081\.00/)
    expect(root.textContent).toContain("Rossi Impianti S.r.l.")
    expect(root.textContent).toContain("Italy (SDI")
  })

  it("marks a tire reminder as sent once it goes out", async () => {
    const root = await boot("/automotive/tire-hotel", true)
    await vi.waitFor(() => expect(root.textContent).toContain("TI 123456"))

    remindButton(root).click()

    await vi.waitFor(() => expect(root.textContent).toContain("Sent"))
    await vi.waitFor(() =>
      expect(root.textContent).toContain(
        "Notification sent successfully for vehicle TI 123456",
      ),
    )
  })

  // The Angular page showed the reminder as sent even when it failed.
  it("takes a tire reminder back when it fails", async () => {
    isReminderFailing = true
    const root = await boot("/automotive/tire-hotel", true)
    await vi.waitFor(() => expect(root.textContent).toContain("TI 123456"))

    remindButton(root).click()

    await vi.waitFor(() =>
      expect(root.textContent).toContain("SMS gateway down"),
    )
    expect(root.textContent).not.toContain("Sent")
    expect(remindButton(root)).toBeDefined()
  })

  it("shows the order selected in the history", async () => {
    const root = await boot("/orders", true)
    await vi.waitFor(() => expect(root.textContent).toContain("ORD-77"))
    expect(root.textContent).not.toContain("Selected Order Details")

    const select = [...root.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Select",
    )!
    select.click()

    await vi.waitFor(() =>
      expect(root.textContent).toContain("Selected Order Details"),
    )
    expect(root.textContent).toContain("Inverter 5kW")
  })

  it("follows the system's dark mode until the user picks a theme", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((media: string) => ({
        media,
        matches: media === "(prefers-color-scheme: dark)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
    localStorage.removeItem("theme")
    const root = await boot("/construction", true)

    const app = () => root.querySelector(".ff-app")!
    await vi.waitFor(() => expect(app().classList).toContain("iw-theme-dark"))

    const light = () =>
      root.querySelector<HTMLButtonElement>('button[aria-label="Light theme"]')
    await vi.waitFor(() => expect(light()).not.toBeNull())
    light()!.click()

    await vi.waitFor(() => expect(app().classList).toContain("iw-theme-light"))
    expect(localStorage.getItem("theme")).toBe("light")
  })

  it("shows time and attendance, and clocks in on the page", async () => {
    const root = await boot("/time-attendance", true)

    await vi.waitFor(() =>
      expect(root.textContent).toContain("Pausa minima rispettata"),
    )
    expect(root.textContent).toContain("In progress...")
    expect(root.textContent).toContain("Annual entitlement: 25 days")
    // The backend says the rest period was not respected: no tag claims it was.
    expect(root.textContent).not.toContain("11h Rest Compliant")
    expect(root.textContent).toContain("Off Duty")

    const clockIn = [...root.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Clock In",
    )!
    clockIn.click()

    await vi.waitFor(() =>
      expect(root.textContent).toContain("Clocked-In (Active)"),
    )
  })

  it("takes the language and tenant from the profile, and switches tenant", async () => {
    profile = {
      ...user,
      locale: "it",
      active_tenant: { ...italian, country: "IT" },
      tenants: [italian, swiss],
    }
    const root = await boot("/dashboard", true)

    await vi.waitFor(() =>
      expect(root.textContent).toContain("Dashboard Esecutiva ERP"),
    )
    expect(localStorage.getItem("ff_active_tenant_id")).toBe("t-it")

    const tenant = root.querySelector<HTMLSelectElement>("#tenant")!
    tenant.value = "t-ch"
    tenant.dispatchEvent(new Event("change", { bubbles: true }))

    await vi.waitFor(() =>
      expect(root.textContent).toContain("Svizzera (QR-Bill"),
    )
    expect(localStorage.getItem("ff_active_tenant_id")).toBe("t-ch")
    const calls = vi.mocked(fetch).mock.calls.map(([url]) => String(url))
    expect(calls).toContain("/api/v1/auth/switch-tenant")
    // The dashboard loaded again, for the new tenant.
    expect(
      calls.filter((url) => url.includes("/dashboard/kpi-summary")),
    ).toHaveLength(2)
  })

  it("deletes a backup once confirmed", async () => {
    const root = await boot("/system/backups", true)
    await vi.waitFor(() =>
      expect(root.textContent).toContain(
        "fatturafacile-backup-2026-10-30-full.zip",
      ),
    )
    expect(root.textContent).toContain("46.26 MB")

    buttonLabelled(root, "Delete Backup").click()
    await vi.waitFor(() =>
      expect(root.textContent).toContain("permanently delete this backup"),
    )
    buttonWithText(root, "Delete").click()

    await vi.waitFor(() =>
      expect(root.textContent).toContain("Backup archive removed"),
    )
    const deletion = vi
      .mocked(fetch)
      .mock.calls.find(([, init]) => init?.method === "DELETE")
    expect(String(deletion?.[0])).toBe("/api/v1/system/backups/b1")
  })

  // The Angular page announced a completed restore even when it failed.
  it("says so when a restore fails", async () => {
    const root = await boot("/system/backups", true)
    await vi.waitFor(() =>
      expect(root.textContent).toContain(
        "fatturafacile-backup-2026-10-30-full.zip",
      ),
    )

    buttonLabelled(root, "Restore this backup").click()
    await vi.waitFor(() =>
      expect(root.textContent).toContain("Warning: restoring"),
    )
    buttonWithText(root, "Restore Data", "dialog").click()

    await vi.waitFor(() =>
      expect(root.textContent).toContain("Restore failed: archive corrupted"),
    )
    expect(root.textContent).not.toContain("completed")
  })

  it("lists products and creates one in the workspace's currency", async () => {
    const root = await boot("/inventory/stock", true)
    await vi.waitFor(() => expect(root.textContent).toContain("EL-SENS-01"))
    expect(root.textContent).toContain("40 Pz")

    buttonWithText(root, "New Warehouse Product").click()
    await vi.waitFor(() =>
      expect(root.querySelector("#productForm-sku")).not.toBeNull(),
    )
    type("#productForm-sku", "EL-SENS-02")
    type("#productForm-name", "Sensore di umidità")
    type("#productForm-price", "19.9")
    buttonWithText(root, "Save Product").click()

    await vi.waitFor(() =>
      expect(root.textContent).toContain("Product created successfully"),
    )
    const creation = vi
      .mocked(fetch)
      .mock.calls.find(
        ([url, init]) =>
          String(url).includes("/inventory") && init?.method === "POST",
      )
    expect(JSON.parse(String(creation?.[1]?.body))).toEqual({
      sku: "EL-SENS-02",
      name: "Sensore di umidità",
      warehouse: "Milano (IT)",
      quantity: 1,
      unit_of_measure: "Pz",
      price: 19.9,
      currency: "EUR",
    })

    function type(selector: string, value: string) {
      const input = root.querySelector<HTMLInputElement>(selector)!
      input.value = value
      input.dispatchEvent(new Event("input", { bubbles: true }))
    }
  })

  it("filters alerts on the server and edits one", async () => {
    const root = await boot("/alerts", true)
    await vi.waitFor(() =>
      expect(root.textContent).toContain("Liquidazione IVA Q3"),
    )

    const severity = root.querySelector<HTMLSelectElement>(
      "#alertsGrid-severity",
    )!
    severity.value = "critical"
    severity.dispatchEvent(new Event("change", { bubbles: true }))
    await vi.waitFor(() =>
      expect(urls()).toContain(
        "/api/v1/alerts?severity=critical&page=1&per_page=10",
      ),
    )

    buttonLabelled(root, "Edit Alert").click()
    const title = () => root.querySelector<HTMLInputElement>("#alertForm-title")
    await vi.waitFor(() => expect(title()?.value).toBe("Liquidazione IVA Q3"))
    title()!.value = "Liquidazione IVA Q4"
    title()!.dispatchEvent(new Event("input", { bubbles: true }))
    buttonWithText(root, "Save Alert").click()

    await vi.waitFor(() => expect(root.textContent).toContain("Alert updated"))
    const update = vi
      .mocked(fetch)
      .mock.calls.find(([, init]) => init?.method === "PUT")
    expect(String(update?.[0])).toBe("/api/v1/alerts/a1")
    expect(JSON.parse(String(update?.[1]?.body))).toEqual({
      title: "Liquidazione IVA Q4",
      severity: "warning",
      message: "Versamento F24 entro il 16 novembre",
      is_active: true,
    })
  })

  it("edits the tenant's real data, and loads a tab when it opens", async () => {
    const root = await boot("/settings", true)
    const name = () => root.querySelector<HTMLInputElement>("#tenantForm-name")
    await vi.waitFor(() =>
      expect(name()?.value).toBe("Fattura Facile Italia S.r.l."),
    )
    expect(
      root.querySelector<HTMLInputElement>("#tenantForm-sdi_code")?.value,
    ).toBe("M5UXCR1")

    buttonWithText(root, "Save Company Changes").click()
    await vi.waitFor(() =>
      expect(root.textContent).toContain("Company settings saved successfully"),
    )
    const save = vi
      .mocked(fetch)
      .mock.calls.find(([, init]) => init?.method === "PUT")
    expect(JSON.parse(String(save?.[1]?.body))).toMatchObject({
      name: "Fattura Facile Italia S.r.l.",
      vat_number: "IT01234567890",
      legal_name: null,
    })

    expect(urls().some((url) => url.includes("/settings/users"))).toBe(false)
    buttonWithText(root, "Users & Access").click()
    await vi.waitFor(() => expect(root.textContent).toContain("Chiara Bianchi"))
    expect(root.textContent).toContain("Inactive")
  })

  it("shows treasury balances, fails auto-matching honestly, and imports a CBI file", async () => {
    const root = await boot("/treasury", true)
    await vi.waitFor(() =>
      expect(root.textContent).toContain("PAGAMENTO QR-BILL 982347"),
    )
    expect(root.textContent).toMatch(/CHF\s1,500\.50/)
    expect(root.textContent).toContain("€200.00")

    buttonWithText(root, "Automatic reconciliation").click()
    await vi.waitFor(() =>
      expect(root.textContent).toContain("Matching service unavailable"),
    )
    expect(root.textContent).not.toContain("Automatic reconciliation completed")

    buttonWithText(root, "Import CAMT.053 / CBI Bank File").click()
    const cbi = () => root.querySelector<HTMLInputElement>('input[value="cbi"]')
    await vi.waitFor(() => expect(cbi()).not.toBeNull())
    cbi()!.click()
    await vi.waitFor(() => expect(cbi()!.checked).toBe(true))

    const fileInput =
      root.querySelector<HTMLInputElement>('input[type="file"]')!
    const file = new File(["CBI"], "estratto.cbi")
    Object.defineProperty(fileInput, "files", { value: [file] })
    fileInput.dispatchEvent(new Event("change", { bubbles: true }))

    await vi.waitFor(() =>
      expect(root.textContent).toContain("CBI file imported successfully."),
    )
    const upload = vi
      .mocked(fetch)
      .mock.calls.find(([url]) => String(url).includes("/treasury/import-cbi"))
    expect((upload?.[1]?.body as FormData).get("cbi_file")).toBe(file)
  })

  it("leads with a breadcrumb, folds sidebar groups, and lets the profile menu open", async () => {
    const root = await boot("/crm/clients", true)
    await vi.waitFor(() =>
      expect(root.querySelector(".ff-breadcrumbs")).not.toBeNull(),
    )

    const crumbs = [
      ...root.querySelectorAll(".ff-breadcrumbs li.iw-breadcrumbs-item"),
    ]
    expect(crumbs.map((crumb) => crumb.textContent?.trim())).toEqual([
      "Home",
      "CRM & Master Data",
      "Cross-Border Clients",
    ])
    expect(
      root.querySelector('.ff-breadcrumbs a[href="/dashboard"]'),
    ).not.toBeNull()

    const group = (name: string) =>
      [...root.querySelectorAll<HTMLButtonElement>(".ff-nav-group-label")].find(
        (button) => button.textContent?.includes(name),
      )!
    expect(group("CRM").getAttribute("aria-expanded")).toBe("true")
    expect(group("Sales").getAttribute("aria-expanded")).toBe("false")
    group("Sales").click()
    await vi.waitFor(() =>
      expect(group("Sales").getAttribute("aria-expanded")).toBe("true"),
    )

    // The menu opens and closes by its buttons' default actions: nothing may cancel them.
    const menu = root.querySelector(".ff-user-menu")!
    const preferences = [
      ...menu.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent?.includes("ERP Preferences"))!
    for (const button of [menu.querySelector("button")!, preferences]) {
      const click = new MouseEvent("click", { bubbles: true, cancelable: true })
      button.dispatchEvent(click)
      expect(click.defaultPrevented).toBe(false)
    }
    await vi.waitFor(() => expect(location.pathname).toBe("/settings"))
    const labels = [...menu.querySelectorAll(".iw-menu-item")].map((item) =>
      item.textContent?.replace(/\s+/g, " ").trim(),
    )
    expect(labels).toEqual(["Marco Rossi", "ERP Preferences", "Sign Out"])

    // The hamburger folds the sidebar.
    root
      .querySelector<HTMLButtonElement>('button[aria-label="Collapse menu"]')!
      .click()
    await vi.waitFor(() =>
      expect(root.querySelector(".ff-shell")!.classList).toContain(
        "ff-shell-collapsed",
      ),
    )
  })

  it("shows ledger lines and posts only a balanced entry", async () => {
    const root = await boot("/accounting", true)
    await vi.waitFor(() => expect(root.textContent).toContain("GL-2026-0042"))
    expect(root.textContent).toContain("€300.00")

    buttonLabelled(root, "Lines").click()
    await vi.waitFor(() =>
      expect(root.textContent).toContain("Journal Entry Detail GL-2026-0042"),
    )
    expect(root.textContent).toContain("Fornitori")

    buttonWithText(root, "New Journal Entry").click()
    const field = (id: string) =>
      root.querySelector<HTMLInputElement>(`#ledgerEntryForm-${id}`)!
    await vi.waitFor(() => expect(field("entry_number")).not.toBeNull())
    const type = (id: string, value: string) => {
      field(id).value = value
      field(id).dispatchEvent(new Event("input", { bubbles: true }))
    }
    type("entry_number", "GL-2026-0043")
    type("description", "Giroconto")
    type("line-0-account", "1010")
    type("line-0-debit", "50")
    type("line-1-account", "1020")
    type("line-1-credit", "30")

    const save = () => buttonWithText(root, "Save")
    await vi.waitFor(() => expect(save().disabled).toBe(true))
    expect(root.textContent).toContain("Journal entry must be balanced")

    buttonWithText(root, "Add line").click()
    await vi.waitFor(() => expect(field("line-2-account")).not.toBeNull())
    type("line-2-account", "1030")
    type("line-2-credit", "20")
    await vi.waitFor(() => expect(save().disabled).toBe(false))
    save().click()

    await vi.waitFor(() =>
      expect(root.textContent).toContain("Journal entry recorded successfully"),
    )
    const post = vi
      .mocked(fetch)
      .mock.calls.find(
        ([url, init]) =>
          String(url).includes("/ledger-entries") && init?.method === "POST",
      )
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({
      entry_number: "GL-2026-0043",
      description: "Giroconto",
      lines: [
        { account_id: "1010", debit: 50, credit: 0 },
        { account_id: "1020", debit: 0, credit: 30 },
        { account_id: "1030", debit: 0, credit: 20 },
      ],
    })
  })

  it("approves a purchase order and creates one as the API documents it", async () => {
    const root = await boot("/purchases", true)
    await vi.waitFor(() => expect(root.textContent).toContain("PO-2026-002"))
    expect(root.textContent).toMatch(/CHF\s120\.00/)

    buttonLabelled(root, "Approve: PO-2026-002").click()
    await vi.waitFor(() =>
      expect(root.textContent).toContain("Order PO-2026-002 approved"),
    )

    buttonWithText(root, "New Purchase Order").click()
    const supplier = () =>
      root.querySelector<HTMLSelectElement>("#purchaseOrderForm-supplier_id")
    await vi.waitFor(() => expect(supplier()?.options.length).toBe(2))
    supplier()!.value = "sup-uuid-1"
    supplier()!.dispatchEvent(new Event("change", { bubbles: true }))
    const type = (id: string, value: string) => {
      const input = root.querySelector<HTMLInputElement>(
        `#purchaseOrderForm-${id}`,
      )!
      input.value = value
      input.dispatchEvent(new Event("input", { bubbles: true }))
    }
    type("expected_delivery_date", "2026-11-30")
    type("description", "Canone fibra")
    type("unit_price", "49.9")
    buttonWithText(root, "Save").click()

    await vi.waitFor(() =>
      expect(root.textContent).toContain("Purchase order created successfully"),
    )
    const post = vi
      .mocked(fetch)
      .mock.calls.find(
        ([url, init]) =>
          String(url).endsWith("/procurement/purchase-orders") &&
          init?.method === "POST",
      )
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({
      supplier_id: "sup-uuid-1",
      expected_delivery_date: "2026-11-30",
      lines: [
        {
          description: "Canone fibra",
          quantity_ordered: 1,
          unit_price: 49.9,
          uom: "PCS",
        },
      ],
    })
  })

  // The Angular page announced a completed export even when it failed.
  it("lists expenses and says so when the export fails", async () => {
    const root = await boot("/purchases/expenses", true)
    await vi.waitFor(() =>
      expect(root.textContent).toContain("Pranzo di lavoro"),
    )
    expect(root.textContent).toContain("Pending Approval")

    buttonWithText(root, "Export CSV").click()
    await vi.waitFor(() =>
      expect(root.textContent).toContain("Export service unavailable"),
    )
    expect(root.textContent).not.toContain("Export completed")
  })

  it("sends an invoice by email once confirmed, and duplicates one as a new draft", async () => {
    const root = await boot("/sales/invoices", true)
    await vi.waitFor(() => expect(root.textContent).toContain("FT-2026-0042"))
    expect(root.textContent).toContain("Overdue")
    expect(root.textContent).toContain("Switzerland")

    buttonWithText(root, "Send by email").click()
    await vi.waitFor(() =>
      expect(root.textContent).toContain(
        "Send the invoice to the client by email?",
      ),
    )
    buttonWithText(root, "Confirm").click()
    await vi.waitFor(() => expect(root.textContent).toContain("Email sent"))
    expect(
      urls().some((url) => url.endsWith("/documents/invoice/i1/email")),
    ).toBe(true)

    buttonWithText(root, "Duplicate document").click()
    const number = () =>
      root.querySelector<HTMLInputElement>("#invoiceForm-invoice_number")
    await vi.waitFor(() =>
      expect(
        root.querySelector<HTMLInputElement>("#invoiceForm-item-0-description")
          ?.value,
      ).toBe("Consulenza"),
    )
    await vi.waitFor(() =>
      expect(root.textContent).toContain("Rossi Impianti S.r.l."),
    )
    expect(root.textContent).toMatch(/CHF\s1,081\.00/)
    number()!.value = "FT-2026-0043"
    number()!.dispatchEvent(new Event("input", { bubbles: true }))
    buttonWithText(root, "Create invoice").click()

    await vi.waitFor(() =>
      expect(root.textContent).toContain("Invoice created"),
    )
    const post = vi
      .mocked(fetch)
      .mock.calls.find(
        ([url, init]) =>
          String(url).endsWith("/sales/invoices") && init?.method === "POST",
      )
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({
      contact_id: "c1",
      invoice_number: "FT-2026-0043",
      currency: "CHF",
      jurisdiction: "CH",
      notes: "Grazie",
      items: [
        {
          description: "Consulenza",
          quantity: 2,
          unit_price: 500,
          tax_rate: 8.1,
          discount_percentage: 0,
        },
      ],
    })
  })

  it("previews a Swiss QR-bill rounded to 0.05, and rounds an amount", async () => {
    const root = await boot("/sales/qr-bill", true)
    await vi.waitFor(() => expect(root.textContent).toContain("QR-2026-0007"))
    expect(root.textContent).toContain("21 00000 00003 13947 14300 09017")
    expect(root.textContent).toMatch(/CHF\s1,450\.85/)
    expect(root.textContent).toContain("Go to invoices")

    const amount = root.querySelector<HTMLInputElement>("#qrBill-raw-amount")!
    amount.value = "10.03"
    amount.dispatchEvent(new Event("input", { bubbles: true }))
    await vi.waitFor(() => expect(root.textContent).toMatch(/10\.05\sCHF/))
  })
})

function remindButton(root: HTMLElement) {
  return [...root.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("SMS/WhatsApp"),
  )!
}

function buttonLabelled(root: HTMLElement, label: string) {
  return root.querySelector<HTMLButtonElement>(
    `button[aria-label^="${label}"]`,
  )!
}

function buttonWithText(root: HTMLElement, text: string, within = "") {
  return [...root.querySelectorAll<HTMLButtonElement>(`${within} button`)].find(
    (button) => button.textContent?.trim() === text,
  )!
}

function urls() {
  return vi.mocked(fetch).mock.calls.map(([url]) => String(url))
}
