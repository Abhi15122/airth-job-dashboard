module.exports = {
  ...require('./jest.config.cjs'),
  testMatch: ['**/test/**/*.integration.ts'],
  testTimeout: 20000,
};
