const { defineConfig } = require('vite');

module.exports = defineConfig({
  base: './',
  esbuild: {
    jsx: 'automatic'
  },
  server: {
    port: 3000,
    open: false
  }
});
