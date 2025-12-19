import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  base: "/turnos/",       
  build: {
    outDir: "dist",
    manifest: "manifest.json",
    emptyOutDir: true,
  },
})
