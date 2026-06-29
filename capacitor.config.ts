import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor empacota o MESMO build web (dist/) num APK Android offline.
 * O totem Windows continua via Electron; ambos compartilham o dist/.
 */
const config: CapacitorConfig = {
  appId: 'com.gsb.kioskmaze',
  appName: 'KioskMaze',
  webDir: 'dist',
  android: {
    // Sem barra de status/navegacao por cima do jogo.
    backgroundColor: '#000010',
  },
};

export default config;
