import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), {
    name: 'touchline-reload-game',
    handleHotUpdate(ctx) {
      // The simulation owns a single RAF loop and DOM listeners. A full reload
      // replaces them together when its imperative files or markup are edited.
      if (/\/src\/(game\/|App\.tsx|main\.tsx)/.test(ctx.file.replaceAll('\\', '/'))) {
        ctx.server.ws.send({ type: 'full-reload' });
        return [];
      }
    }
  }],
  base: './',
  build: { target: 'es2022' }
});
