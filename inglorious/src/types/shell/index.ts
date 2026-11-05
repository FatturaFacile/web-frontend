import bars from "@iconify-icons/fa7-solid/bars"
import barsStaggered from "@iconify-icons/fa7-solid/bars-staggered"
import chevronDown from "@iconify-icons/fa7-solid/chevron-down"
import desktop from "@iconify-icons/fa7-solid/desktop"
import house from "@iconify-icons/fa7-solid/house"
import moon from "@iconify-icons/fa7-solid/moon"
import rightFromBracket from "@iconify-icons/fa7-solid/right-from-bracket"
import sliders from "@iconify-icons/fa7-solid/sliders"
import sun from "@iconify-icons/fa7-solid/sun"
import userIcon from "@iconify-icons/fa7-solid/user"
import { AppBar } from "@inglorious/ui/app-bar"
import { Avatar } from "@inglorious/ui/avatar"
import { Breadcrumbs } from "@inglorious/ui/breadcrumbs"
import { ButtonGroup } from "@inglorious/ui/button-group"
import { Drawer } from "@inglorious/ui/drawer"
import { Icon, type IconData } from "@inglorious/ui/icon"
import { IconButton } from "@inglorious/ui/icon-button"
import { Menu } from "@inglorious/ui/menu"
import { Select } from "@inglorious/ui/select"
import { html, nothing, type TemplateResult } from "@inglorious/web"
import { classMap } from "@inglorious/web/directives/class-map"

import type {
  AppApi,
  ShellEntity,
  ShellType,
  ThemePreference,
} from "../../../types"
import { HOME_PATH } from "../../config"
import { t } from "../../i18n"
import { renderRoute } from "../../layout/route-outlet"
import type { UserProfile } from "../../models/user"
import { NAV, type NavGroup, type NavLink } from "./nav"

// The key the Angular app saved the theme under, so the choice carries over.
const THEME_STORAGE_KEY = "theme"
const LOGOUT = "logout"
const PREFERENCES = "preferences"
const FIRST = 0
const MIN_TENANTS_TO_SWITCH = 2

// Labels are translation keys.
const THEME_CHOICES: {
  value: ThemePreference
  icon: IconData
  label: string
}[] = [
  { value: "light", icon: sun, label: "APP.THEME_LIGHT" },
  { value: "dark", icon: moon, label: "APP.THEME_DARK" },
  { value: "system", icon: desktop, label: "APP.THEME_SYSTEM" },
]

const FLAGS: Record<string, string> = {
  it: "🇮🇹",
  en: "🇬🇧",
  de: "🇩🇪",
  fr: "🇫🇷",
}

export const Shell: ShellType = {
  create(entity) {
    entity.isSidebarCollapsed ??= false
    entity.themePreference = readSavedPreference()
  },

  // The group of the page opened unfolds, as nz-menu did.
  routeChange(entity, { path }) {
    const group = findGroup(path)
    if (group && !entity.expandedGroups.includes(group.label)) {
      entity.expandedGroups.push(group.label)
    }
  },

  groupToggle(entity, label) {
    entity.expandedGroups = entity.expandedGroups.includes(label)
      ? entity.expandedGroups.filter((expanded) => expanded !== label)
      : [...entity.expandedGroups, label]
  },

  sidebarToggle(entity) {
    entity.isSidebarCollapsed = !entity.isSidebarCollapsed
  },

  themeChange(entity, preference) {
    entity.themePreference = preference
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference)
    } catch {
      // Storage unavailable: the choice lasts for this visit.
    }
  },

  render(entity, api) {
    const { path = "" } = api.getEntity("router")!
    const i18n = api.getEntity("i18n")!
    const { user } = api.getEntity("session")!

    return html`<div
      class=${classMap({
        "ff-shell": true,
        "ff-shell-collapsed": entity.isSidebarCollapsed,
      })}
    >
      ${Drawer.render({
        variant: "permanent",
        isCollapsed: entity.isSidebarCollapsed,
        collapseLabel: t("HEADER.TOGGLE_SIDEBAR_COLLAPSE"),
        expandLabel: t("HEADER.TOGGLE_SIDEBAR_EXPAND"),
        className: "ff-sidebar",
        title: renderBrand(entity.isSidebarCollapsed),
        children: renderNav(entity, path, api),
      })}
      <div class="ff-main">
        ${AppBar.render({
          position: "sticky",
          leading: html`<div class="ff-app-bar-actions">
            ${IconButton.render({
              icon: Icon.render({
                icon: entity.isSidebarCollapsed ? barsStaggered : bars,
                size: "lg",
              }),
              ariaLabel: t(
                entity.isSidebarCollapsed
                  ? "HEADER.TOGGLE_SIDEBAR_EXPAND"
                  : "HEADER.TOGGLE_SIDEBAR_COLLAPSE",
              ),
              "aria-expanded": String(!entity.isSidebarCollapsed),
              variant: "ghost",
              onClick: () => api.notify(`#${entity.id}:sidebarToggle`),
            })}
            ${renderTenantSelect(user, api)}
          </div>`,
          trailing: html`<div class="ff-app-bar-actions">
            ${api.render("workspace")}
            ${Select.render({
              id: "language",
              size: "sm",
              ariaLabel: t("APP.LANGUAGE"),
              value: i18n.locale,
              // A flag and the code, as in the Angular header.
              options: (i18n.languages ?? []).map(({ value }) => ({
                value,
                label: `${FLAGS[value] ?? ""} ${value.toUpperCase()}`.trim(),
              })),
              onChange: (locale) => api.notify("#i18n:localeChange", locale),
            })}
            ${ButtonGroup.render({
              size: "sm",
              variant: "outline",
              "aria-label": t("APP.THEME"),
              value: entity.themePreference,
              buttons: THEME_CHOICES.map(({ value, icon, label }) => ({
                value,
                label: t(label),
                children: Icon.render({ icon }),
              })),
              onChange: (value) =>
                api.notify(
                  `#${entity.id}:themeChange`,
                  value as ThemePreference,
                ),
            })}
            ${renderUserMenu(user, api)}
          </div>`,
        })}
        <main class="ff-content">
          ${renderBreadcrumbs(path)} ${renderRoute(api)}
        </main>
      </div>
    </div>`
  },
}

// The Angular sidebar's brand: the logo, and the name while there is room.
function renderBrand(isCollapsed: boolean): TemplateResult {
  return html`<a href="/" class="ff-brand">
    <img
      src="/images/fattura_facile_favicon_trasparente.svg"
      alt=""
      width="32"
      height="32"
    />
    <span class=${isCollapsed ? "ff-visually-hidden" : ""}>
      Fattura <span class="ff-brand-accent">Facile</span>
    </span>
  </a>`
}

// Only for someone in more than one tenant: the others they can switch to.
function renderTenantSelect(user: UserProfile | null, api: AppApi) {
  const tenants = user?.tenants ?? []
  if (tenants.length < MIN_TENANTS_TO_SWITCH) return nothing

  return Select.render({
    id: "tenant",
    size: "sm",
    ariaLabel: t("AUTH.TENANT_PRESET"),
    value: user?.active_tenant?.id ?? "",
    // As in the Angular header: the tenant's country after its name, when known.
    options: tenants.map(({ id, name, country }) => {
      const code =
        country ??
        (id === user?.active_tenant?.id ? user.active_tenant.country : null)
      return { value: id, label: code ? `${name} (${code})` : name }
    }),
    onChange: (tenantId) => api.notify("#session:tenantSwitch", tenantId),
  })
}

function renderNav(
  entity: ShellEntity,
  path: string,
  api: AppApi,
): TemplateResult {
  const isCollapsed = entity.isSidebarCollapsed
  return html`<nav aria-label=${t("APP.MAIN_NAV")} class="ff-nav">
    <ul>
      ${NAV.map((item) =>
        "children" in item
          ? renderGroup(item, path, isCollapsed, entity, api)
          : html`<li>${renderLink(item, path, isCollapsed)}</li>`,
      )}
    </ul>
  </nav>`
}

/**
 * A group unfolds and folds from its heading. A folded sidebar has no room
 * for headings: it shows every group's pages as icons.
 */
function renderGroup(
  group: NavGroup,
  path: string,
  isCollapsed: boolean,
  entity: ShellEntity,
  api: AppApi,
) {
  const isExpanded = isCollapsed || entity.expandedGroups.includes(group.label)
  const listId = `nav-${group.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`

  return html`<li class="ff-nav-group">
    <button
      type="button"
      class="ff-nav-group-label"
      aria-expanded=${String(isExpanded)}
      aria-controls=${listId}
      @click=${() => api.notify(`#${entity.id}:groupToggle`, group.label)}
    >
      ${Icon.render({ icon: group.icon })}
      <span class="ff-nav-group-name">${t(group.label)}</span>
      ${Icon.render({ icon: chevronDown, className: "ff-nav-chevron" })}
    </button>
    <ul id=${listId} ?hidden=${!isExpanded}>
      ${group.children.map(
        (link) => html`<li>${renderLink(link, path, isCollapsed)}</li>`,
      )}
    </ul>
  </li>`
}

// Pages not in the sidebar, with the breadcrumb label the Angular routes gave them.
const OTHER_PAGES: Record<string, string> = {
  "/orders": "BREADCRUMB.ORDERS",
  "/welcome": "BREADCRUMB.WELCOME",
}

/** Home, then the page's group and the page, each a link as in the Angular app. */
function renderBreadcrumbs(path: string): TemplateResult {
  const group = findGroup(path)
  const link = findLink(path)
  const other = Object.keys(OTHER_PAGES).find((page) => path.startsWith(page))

  return Breadcrumbs.render({
    className: "ff-breadcrumbs",
    "aria-label": t("APP.BREADCRUMB"),
    items: [
      {
        label: html`${Icon.render({ icon: house })} ${t("BREADCRUMB.HOME")}`,
        href: HOME_PATH,
      },
      ...(group
        ? [{ label: t(group.label), href: group.children[FIRST].path }]
        : []),
      ...(link ? [{ label: t(link.label), href: link.path }] : []),
      ...(other ? [{ label: t(OTHER_PAGES[other]), href: other }] : []),
    ],
  })
}

/**
 * The Angular profile dropdown: who is signed in and for which company, the
 * preferences, and signing out.
 *
 * The Form type cancels the default action of every button click that reaches
 * the document, and the menu opens and closes by its buttons' default actions
 * (`commandfor`): clicks inside it stop here.
 */
function renderUserMenu(user: UserProfile | null, api: AppApi) {
  return html`<div
    class="ff-user-menu"
    @click=${(event: Event) => event.stopPropagation()}
  >
    ${Menu.render({
      id: "user-menu",
      trigger: html`${Avatar.render({
          size: "md",
          color: "primary",
          children: Icon.render({ icon: userIcon }),
        })}
        <span class="ff-user-name">${user?.name}</span>
        ${Icon.render({ icon: chevronDown })}`,
      triggerProps: {
        ariaLabel: t("APP.USER_MENU"),
        className: "ff-user-trigger",
      },
      items: [
        {
          value: "profile",
          isDisabled: true,
          label: html`<span class="ff-user-panel">
            <strong>${user?.name}</strong>
            <span>${user?.active_tenant?.name}</span>
          </span>`,
        },
        { hasDivider: true },
        {
          value: PREFERENCES,
          icon: Icon.render({ icon: sliders }),
          label: t("HEADER.PREFERENCES"),
        },
        { hasDivider: true },
        {
          value: LOGOUT,
          icon: Icon.render({ icon: rightFromBracket }),
          label: html`<span class="ff-menu-danger"
            >${t("HEADER.LOGOUT")}</span
          >`,
        },
      ],
      onItemClick: (value) => {
        if (value === PREFERENCES) api.notify("#router:navigate", "/settings")
        if (value === LOGOUT) api.notify("#session:signOut")
      },
    })}
  </div>`
}

function findGroup(path: string): NavGroup | undefined {
  return NAV.find(
    (item): item is NavGroup =>
      "children" in item &&
      item.children.some((link) => isWithin(path, link.path)),
  )
}

function findLink(path: string): NavLink | undefined {
  return NAV.flatMap((item) =>
    "children" in item ? item.children : [item],
  ).find((link) => isWithin(path, link.path))
}

function isWithin(path: string, linkPath: string) {
  return path === linkPath || path.startsWith(`${linkPath}/`)
}

function renderLink(link: NavLink, path: string, isCollapsed: boolean) {
  const isCurrent = isWithin(path, link.path)
  const label = t(link.label)

  return html`<a
    href=${link.path}
    class=${classMap({ "ff-nav-link": true, "ff-nav-link-current": isCurrent })}
    aria-current=${isCurrent ? "page" : nothing}
    title=${isCollapsed ? label : nothing}
  >
    ${Icon.render({ icon: link.icon })}
    <span class=${isCollapsed ? "ff-visually-hidden" : ""}>${label}</span>
  </a>`
}

function readSavedPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved === "light" || saved === "dark" || saved === "system")
      return saved
  } catch {
    // Storage unavailable: follow the system.
  }
  return "system"
}
