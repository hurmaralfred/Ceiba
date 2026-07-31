import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  // tsconfig usa "jsx": "preserve" (Next.js transforma el JSX con su propio
  // compilador). Vite 8 usa oxc (no esbuild) para transformar por defecto y
  // hereda ese "preserve" del tsconfig; hay que forzar el runtime aquí para
  // poder importar componentes .tsx directamente en pruebas de integración
  // (p. ej. buildLayout de FamilyTreeGraph).
  oxc: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environmentOptions: {
      jsdom: { url: "http://localhost/" },
    },
  },
});
