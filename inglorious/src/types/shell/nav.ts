import addressBook from "@iconify-icons/fa7-solid/address-book"
import bell from "@iconify-icons/fa7-solid/bell"
import boxesStacked from "@iconify-icons/fa7-solid/boxes-stacked"
import buildingColumns from "@iconify-icons/fa7-solid/building-columns"
import calendarWeek from "@iconify-icons/fa7-solid/calendar-week"
import car from "@iconify-icons/fa7-solid/car"
import carBurst from "@iconify-icons/fa7-solid/car-burst"
import carSide from "@iconify-icons/fa7-solid/car-side"
import cartFlatbed from "@iconify-icons/fa7-solid/cart-flatbed"
import cartShopping from "@iconify-icons/fa7-solid/cart-shopping"
import cashRegister from "@iconify-icons/fa7-solid/cash-register"
import circleDot from "@iconify-icons/fa7-solid/circle-dot"
import clock from "@iconify-icons/fa7-solid/clock"
import fileImport from "@iconify-icons/fa7-solid/file-import"
import fileInvoice from "@iconify-icons/fa7-solid/file-invoice"
import fileInvoiceDollar from "@iconify-icons/fa7-solid/file-invoice-dollar"
import gaugeHigh from "@iconify-icons/fa7-solid/gauge-high"
import gears from "@iconify-icons/fa7-solid/gears"
import inbox from "@iconify-icons/fa7-solid/inbox"
import industry from "@iconify-icons/fa7-solid/industry"
import landmark from "@iconify-icons/fa7-solid/landmark"
import passport from "@iconify-icons/fa7-solid/passport"
import personDigging from "@iconify-icons/fa7-solid/person-digging"
import qrcode from "@iconify-icons/fa7-solid/qrcode"
import receipt from "@iconify-icons/fa7-solid/receipt"
import scaleBalanced from "@iconify-icons/fa7-solid/scale-balanced"
import screwdriverWrench from "@iconify-icons/fa7-solid/screwdriver-wrench"
import server from "@iconify-icons/fa7-solid/server"
import ticket from "@iconify-icons/fa7-solid/ticket"
import truckField from "@iconify-icons/fa7-solid/truck-field"
import truckRampBox from "@iconify-icons/fa7-solid/truck-ramp-box"
import userTie from "@iconify-icons/fa7-solid/user-tie"
import users from "@iconify-icons/fa7-solid/users"
import wallet from "@iconify-icons/fa7-solid/wallet"
import warehouse from "@iconify-icons/fa7-solid/warehouse"
import wrench from "@iconify-icons/fa7-solid/wrench"
import type { IconData } from "@inglorious/ui/icon"

export interface NavLink {
  label: string
  icon: IconData
  path: string
}

export interface NavGroup {
  label: string
  icon: IconData
  children: NavLink[]
}

/** The Angular sidebar. Labels are translation keys. */
export const NAV: (NavLink | NavGroup)[] = [
  { label: "NAV.DASHBOARD", icon: gaugeHigh, path: "/dashboard" },
  {
    label: "NAV.CRM",
    icon: users,
    children: [
      { label: "NAV.CLIENTS", icon: addressBook, path: "/crm/clients" },
      { label: "NAV.SUPPLIERS", icon: truckField, path: "/crm/suppliers" },
    ],
  },
  {
    label: "NAV.SALES",
    icon: fileInvoiceDollar,
    children: [
      { label: "NAV.INVOICES", icon: fileInvoice, path: "/sales/invoices" },
      { label: "NAV.ORDERS", icon: cartShopping, path: "/sales/orders" },
      { label: "NAV.SDI", icon: receipt, path: "/sales/sdi" },
      { label: "NAV.QR_BILL", icon: qrcode, path: "/sales/qr-bill" },
    ],
  },
  {
    label: "NAV.PURCHASES",
    icon: cartFlatbed,
    children: [
      { label: "NAV.SDI_INBOX", icon: inbox, path: "/purchases/sdi-inbox" },
      {
        label: "NAV.QR_SCANNER",
        icon: fileImport,
        path: "/purchases/qr-scanner",
      },
      { label: "NAV.EXPENSES", icon: wallet, path: "/purchases/expenses" },
    ],
  },
  { label: "NAV.TREASURY", icon: buildingColumns, path: "/treasury" },
  {
    label: "NAV.INVENTORY",
    icon: boxesStacked,
    children: [
      { label: "NAV.STOCK", icon: warehouse, path: "/inventory/stock" },
      { label: "NAV.DDT", icon: truckRampBox, path: "/inventory/ddt" },
      { label: "NAV.CUSTOMS", icon: passport, path: "/inventory/customs" },
    ],
  },
  {
    label: "NAV.FIELD_SERVICE",
    icon: screwdriverWrench,
    children: [
      { label: "NAV.TICKETS", icon: ticket, path: "/field-service/tickets" },
      {
        label: "NAV.REPORTS",
        icon: screwdriverWrench,
        path: "/field-service/reports",
      },
    ],
  },
  {
    label: "NAV.AUTOMOTIVE",
    icon: car,
    children: [
      { label: "NAV.WORKSHOP", icon: wrench, path: "/automotive/workshop" },
      {
        label: "NAV.TIRE_HOTEL",
        icon: circleDot,
        path: "/automotive/tire-hotel",
      },
    ],
  },
  {
    label: "NAV.RENT",
    icon: carSide,
    children: [
      { label: "NAV.FLEET", icon: calendarWeek, path: "/rent/fleet" },
      { label: "NAV.APPRAISAL", icon: carBurst, path: "/rent/appraisal" },
    ],
  },
  { label: "NAV.CONSTRUCTION", icon: personDigging, path: "/construction" },
  { label: "NAV.PROFESSIONALS", icon: scaleBalanced, path: "/professionals" },
  { label: "NAV.MANUFACTURING", icon: industry, path: "/manufacturing" },
  { label: "NAV.RETAIL", icon: cashRegister, path: "/retail" },
  { label: "NAV.TIME_ATTENDANCE", icon: clock, path: "/time-attendance" },
  { label: "NAV.HR", icon: userTie, path: "/hr" },
  { label: "NAV.ACCOUNTING", icon: landmark, path: "/accounting" },
  { label: "NAV.ALERTS", icon: bell, path: "/alerts" },
  { label: "NAV.SYSTEM", icon: server, path: "/system" },
  { label: "NAV.SETTINGS", icon: gears, path: "/settings" },
]
