import 'dotenv/config';

export default ({ config }: any) => {
  return {
    ...config,
    name: config.name ?? 'Wishera-Mobile',
    slug: config.slug ?? 'wishera-mobile',
    scheme: 'wishera',
    plugins: [
      ...(config.plugins || []),
      'expo-video',
    ],
    extra: {
      apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:5219',
    },
    web: {
      ...config.web,
      bundler: 'metro',
    },
    ios: {
      ...config.ios,
      bundleIdentifier: 'com.wishera.mobile',
      associatedDomains: ['applinks:yourdomain.com'], // Configure with your actual domain for universal links
      infoPlist: {
        NSCameraUsageDescription: 'This app needs access to your camera to make video calls.',
        NSMicrophoneUsageDescription: 'This app needs access to your microphone to make audio and video calls.',
      },
    },
    android: {
      ...config.android,
      package: 'com.wishera.mobile',
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'wishera',
              host: '*',
            },
            {
              scheme: 'https',
              host: 'yourdomain.com', // Configure with your actual domain
              pathPrefix: '/reset-password',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
  };
};


