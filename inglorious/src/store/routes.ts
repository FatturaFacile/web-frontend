import { LOGIN_PATH } from "../config"

// Each page is a chunk of its own, loaded on its first visit. The router
// registers the module's types and routes to its default export's entity.
const login = () => import("../pages/login-page")
const dashboard = () => import("../pages/dashboard-page")
const welcome = () => import("../pages/welcome-page")
const orders = () => import("../pages/orders-page")
const timeAttendance = () => import("../pages/time-attendance-page")
const inventory = () => import("../pages/inventory-page")
const alerts = () => import("../pages/alerts-page")
const treasury = () => import("../pages/treasury-page")
const purchaseOrders = () => import("../pages/purchase-orders-page")
const expenses = () => import("../pages/expenses-page")
const invoices = () => import("../pages/invoices-page")
const qrBill = () => import("../pages/qr-bill-page")
const accounting = () => import("../pages/accounting-page")
const settings = () => import("../pages/settings-page")
const backups = () => import("../pages/backups-page")
const tireHotel = () => import("../pages/tire-hotel-page")
const clients = () => import("../pages/clients-page")
const suppliers = () => import("../pages/suppliers-page")
const construction = () => import("../pages/construction-page")
const hr = () => import("../pages/hr-page")
const fieldService = () => import("../pages/field-service-page")
const manufacturing = () => import("../pages/manufacturing-page")
const professionals = () => import("../pages/professionals-page")
const rent = () => import("../pages/rent-page")
const retail = () => import("../pages/retail-page")

// A path names the entity its page renders, or loads the page first.
// Paths of the Angular app not ported fall through to `notPorted`.
export const routes: Record<string, string | (() => Promise<unknown>)> = {
  "/": "root",
  [LOGIN_PATH]: login,
  "/auth/login": login,
  "/dashboard": dashboard,
  "/welcome": welcome,
  "/orders": orders,
  "/time-attendance": timeAttendance,
  "/inventory": inventory,
  "/inventory/stock": inventory,
  "/inventory/ddt": inventory,
  "/inventory/customs": inventory,
  "/alerts": alerts,
  "/treasury": treasury,
  "/purchases": purchaseOrders,
  "/purchases/sdi-inbox": purchaseOrders,
  "/purchases/qr-scanner": purchaseOrders,
  "/purchases/expenses": expenses,
  "/sales": "sales",
  "/sales/qr-bill": qrBill,
  "/sales/invoices": invoices,
  "/accounting": accounting,
  "/accounting/ledger": accounting,
  "/settings": settings,
  "/settings/tenant": settings,
  "/system": backups,
  "/system/backups": backups,
  "/automotive": tireHotel,
  "/automotive/tire-hotel": tireHotel,
  "/automotive/workshop": tireHotel,
  "/crm": "crm",
  "/crm/clients": clients,
  "/crm/suppliers": suppliers,
  "/construction": construction,
  "/hr": hr,
  "/hr/employees": hr,
  "/field-service": fieldService,
  "/field-service/tickets": fieldService,
  "/field-service/reports": fieldService,
  "/manufacturing": manufacturing,
  "/professionals": professionals,
  "/rent": rent,
  "/rent/fleet": rent,
  "/rent/appraisal": rent,
  "/retail": retail,
  "*": "notPorted",
}
