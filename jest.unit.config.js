/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  preset: "react-native",
  testMatch: ["<rootDir>/tests/unit/**/*.test.ts?(x)"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "\\.svg$": "<rootDir>/tests/mocks/svgMock.tsx",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(?:.pnpm/)?((jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|expo-router|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg))",
  ],
  clearMocks: true,
};
