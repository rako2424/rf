import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

import { resolve } from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      'firebase/app': resolve(__dirname, './src/firebase.ts'),
      'firebase/auth': resolve(__dirname, './src/firebase.ts'),
      'firebase/firestore': resolve(__dirname, './src/firebase.ts'),
      'firebase/storage': resolve(__dirname, './src/firebase.ts'),
    }
  }
});
