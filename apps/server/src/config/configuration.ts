export default () => ({
  port: parseInt(process.env.PORT || '3001', 10),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  logLevel: process.env.LOG_LEVEL || 'info',

  immich: {
    apiUrl: process.env.IMMICH_API_URL || 'http://localhost:2283',
    apiKey: process.env.IMMICH_API_KEY || '',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_DATABASE_NAME || 'immich',
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },

  autoHeal: {
    enabled: process.env.AUTO_HEAL_ENABLED === 'true',
    checkIntervalSeconds: parseInt(process.env.AUTO_HEAL_INTERVAL || '60', 10),
    thresholds: {
      faceDetection: parseInt(process.env.THRESHOLD_FACE_DETECTION || '300', 10),
      facialRecognition: parseInt(process.env.THRESHOLD_FACIAL_RECOGNITION || '300', 10),
      thumbnailGeneration: parseInt(process.env.THRESHOLD_THUMBNAIL || '120', 10),
      metadataExtraction: parseInt(process.env.THRESHOLD_METADATA || '180', 10),
      videoConversion: parseInt(process.env.THRESHOLD_VIDEO || '1800', 10),
      default: parseInt(process.env.THRESHOLD_DEFAULT || '300', 10),
    },
  },
});
