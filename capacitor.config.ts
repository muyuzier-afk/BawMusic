import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.music.mh',
  appName: 'BawMusic',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK'
    }
  }
};

export default config;
