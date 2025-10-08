import 'dotenv/config';

export default ({ config }: any) => {
  return {
    ...config,
    name: config.name ?? 'Wishera-Mobile',
    slug: config.slug ?? 'wishera-mobile',
    scheme: 'wishera',
    extra: {
      apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:5219',
    },
  };
};


