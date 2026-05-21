
const cfg = require('./app.json');

const apiUrl =
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  process.env.REACT_APP_API_URL?.trim() ||
  cfg.expo.extra?.apiBaseUrl?.trim() ||
  'http://localhost:5001/api';

module.exports = {
  expo: {
    ...cfg.expo,
    extra: {
      ...(cfg.expo.extra || {}),
      apiBaseUrl: apiUrl,
      eas: {
        ...(cfg.expo.extra?.eas || {}),
        projectId: 'd2ad0f4f-0a56-4819-8c18-46189e99395d',
      },
    },
  },
};
