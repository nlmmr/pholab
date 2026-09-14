const { defineConfig } = require('vite');

module.exports = defineConfig({
  root: __dirname,
  plugins: [
    {
      name: 'rewrite-root',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/') {
            req.url = '/index.html';
          }
          next();
        });
      },
    },
  ],
  base: './',
  esbuild: {
    jsx: 'automatic',
  },
  server: {
    port: 3000,
    open: false,
    host: '127.0.0.1',
  },
});
