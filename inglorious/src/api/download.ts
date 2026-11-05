/** Hands a file the server sent to the browser, to save as `filename`. */
export function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

// Long enough for the new tab to load the file.
const OPENED_FILE_LIFETIME_MS = 60_000

/**
 * Shows a file the server sent in a new tab, as the Angular pages did; where
 * the browser blocks the tab (it opens after a request, not on the click),
 * the file is saved instead.
 */
export function openFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const tab = window.open(url, "_blank")
  if (!tab) {
    URL.revokeObjectURL(url)
    saveFile(blob, filename)
    return
  }
  tab.opener = null
  setTimeout(() => URL.revokeObjectURL(url), OPENED_FILE_LIFETIME_MS)
}
