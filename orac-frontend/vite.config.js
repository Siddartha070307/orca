import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'three/addons/': 'three/examples/jsm/'
    }
  },
  server: {
    port: 3000,
    open: false,
    host: true
  }
});
