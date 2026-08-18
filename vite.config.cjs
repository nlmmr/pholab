const { defineConfig } = require('vite');

module.exports = defineConfig({
  root: '.',
  esbuild: {
    jsx: 'automatic'
  },
  server: {
    port: 3000,
    open: false,
    host: '127.0.0.1'
  }
});
