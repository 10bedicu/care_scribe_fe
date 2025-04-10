import { defineConfig } from 'vite'
import federation from "@originjs/vite-plugin-federation";
import path from "path"
import react from '@vitejs/plugin-react-swc'
import tailwindcss from "@tailwindcss/vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [federation({
    name: "care_scribe",
    filename: "remoteEntry.js",
    exposes: {
      "./manifest": "./src/manifest.ts",
    },
    shared: ["react", "react-dom", "react-i18next"],
  }),
  react(),tailwindcss(),],
  build: {
    target: "esnext",
    minify: false,
    cssCodeSplit: false,
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      external: [],
      input: {
        main: "./src/main.tsx",
      },
      output: {
        format: "esm",
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  base: "./"
})
