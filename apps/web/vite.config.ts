import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `pnpm dev:web` serves the client; it talks to the game server from `pnpm play` (port 8787).
export default defineConfig({ plugins: [react()], server: { host: true } });
