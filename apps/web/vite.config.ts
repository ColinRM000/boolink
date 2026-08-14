import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cliPackage from '../../packages/cli/package.json' with { type: 'json' };

export default defineConfig({
  plugins: [react()],
  define: {
    __BOOLINK_CLI_VERSION__: JSON.stringify(cliPackage.version),
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
