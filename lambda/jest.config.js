module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^../../utils/middy$': '<rootDir>/test/__mocks__/createHandler.js',
    '^../database/connection$': '<rootDir>/test/__mocks__/database/connection.js',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/migrations/**',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 30000, // TypeORMのデータベース接続のため
};