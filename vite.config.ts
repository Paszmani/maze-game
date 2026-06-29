import { defineConfig } from 'vite';

export default defineConfig({
  // Caminhos relativos: necessario para o Electron carregar via file:// (senao
  // /assets/... aponta para a raiz do disco e a tela fica em branco).
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      // Duas paginas: o jogo (index) e o editor de tema (admin).
      input: {
        main: 'index.html',
        editor: 'editor.html',
      },
    },
  },
});
