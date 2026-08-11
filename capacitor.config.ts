import type { CapacitorConfig } from '@capacitor/cli';

const IS_DEV = process.env.CAP_ENV === 'dev';

const config: CapacitorConfig = {
  appId: 'com.ceibapp.app',
  appName: 'Ceiba',
  webDir: 'www',
  server: IS_DEV
    ? {
        // Local dev: apunta al servidor Next.js corriendo en tu Mac
        url: 'http://localhost:3020',
        cleartext: true,
      }
    : {
        // Producción: carga desde Vercel
        url: 'https://ceibapp.com',
        cleartext: false,
      },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#060318',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#060318',
    },
    PushNotifications: {
      presentationOptions: ['alert', 'badge', 'sound'],
    },
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scrollEnabled: true,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
