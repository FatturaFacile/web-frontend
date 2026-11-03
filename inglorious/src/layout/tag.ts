import { Chip, type ChipProps } from "@inglorious/ui/chip"
import type { TemplateResult } from "@inglorious/web"

export type TagColor = NonNullable<ChipProps["color"]>

// ng-zorro's tag colors, as the backend still sends some of them.
const ANT_COLORS: Record<string, TagColor> = {
  success: "success",
  green: "success",
  processing: "info",
  blue: "info",
  cyan: "info",
  warning: "warning",
  orange: "warning",
  gold: "warning",
  error: "error",
  red: "error",
  volcano: "error",
  purple: "secondary",
  magenta: "secondary",
}

/** A status tag, the ng-zorro `nz-tag` of the Angular tables. */
export function renderTag(
  children: TemplateResult | string,
  color: TagColor = "default",
): TemplateResult {
  return Chip.render({ size: "sm", color, children })
}

export function fromAntColor(color: string | null | undefined): TagColor {
  return (color && ANT_COLORS[color]) || "default"
}
