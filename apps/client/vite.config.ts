import { defineConfig } from 'vite';

const SERVER_URL = 'http://localhost:3001';

const proxy = {
  '/rooms': SERVER_URL,
  '/health': SERVER_URL,
  '/ws': { target: SERVER_URL, ws: true },
};

export default defineConfig({
  server: { proxy },
  preview: { proxy },
});
