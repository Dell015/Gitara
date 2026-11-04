// Runs scripts/make-seed.ts through Vite so it can use the app's own TypeScript code.
import { createServer } from "vite";
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: "custom", logLevel: "error", optimizeDeps: { noDiscovery: true, include: [] } });
try {
  await server.ssrLoadModule("/scripts/make-seed.ts");
} finally {
  await server.close();
}
