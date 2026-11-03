// Every component's styles at once: a stylesheet left out of a list renders
// its component unstyled (Vaitu's docs/styling.md).
import "@inglorious/ui/all.css"
import "@inglorious/ui/themes/bootstrap.css"
import "./styles/theme.css"
import "./app.css"
import "./pwa"

import { start } from "./start"

start(document.getElementById("root")!)
