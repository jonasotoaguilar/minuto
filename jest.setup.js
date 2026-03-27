const { jest } = require('@jest/globals');

jest.mock('expo-location', () => ({
  Accuracy: {
    High: 'high',
  },
  requestForegroundPermissionsAsync: jest.fn(async () => ({
    status: 'granted',
  })),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: {
      latitude: 0,
      longitude: 0,
      accuracy: 10,
    },
  })),
}));
