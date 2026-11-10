// Import defineConfig helper from Vite for full type hinting and configuration support.
import { defineConfig } from 'vite';

// Import official Vite plugin for React JSX transformation and Fast Refresh.
import react from '@vitejs/plugin-react';

// Export Vite configuration object.
export default defineConfig({
  // Configure plugins array with the React plugin enabled.
  plugins: [react()],
  // Configure development server options.
  server: {
    // Specify local development port for the frontend prototype.
    port: 5173,
    // Automatically open browser or allow binding on localhost.
    host: true,
  },
});
