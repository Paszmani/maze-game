import { defineConfig } from 'vite';

export default defineConfig({
  // Caminhos RELATIVOS dos assets: funcionam sob file:// (Electron) e no
  // Capacitor (Android), além da web. Sem isso, o Electron abre em branco
  // (os /assets/... absolutos apontam pra raiz do disco e dão 404).
  base: './',
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
