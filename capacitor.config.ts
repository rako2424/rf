import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rfservis.app',
  appName: 'RF SERVIS',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
