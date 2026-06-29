import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    target: 'es2022',
    rollupOptions: {
      // Duas paginas: o jogo (index) e o editor de tema (admin).
      input: {
        main: 'index.html',
        editor: 'editor.html',
      },
    },
  },
});
