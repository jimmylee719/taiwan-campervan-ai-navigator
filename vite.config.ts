import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // FIX: Replaced process.cwd() with an empty string to resolve a TypeScript type error.
  // Vite's loadEnv function will treat this as the project root.
  const env = loadEnv(mode, '', '');
  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    },
  };
});
