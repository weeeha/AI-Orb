import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

/** The most ordinary Vite + React setup there is. Anything the package needs
 *  beyond this is something every consumer would have to discover. */
export default defineConfig({
  plugins: [react()],
})
