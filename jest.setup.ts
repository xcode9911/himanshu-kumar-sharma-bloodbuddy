import "@testing-library/jest-native/extend-expect";
import "react-native-gesture-handler/jestSetup";

process.env.EXPO_OS = process.env.EXPO_OS || "ios";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
}));
jest.mock("jwt-decode", () => ({
  jwtDecode: jest.fn(),
}));
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({
    status: "granted",
  })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true })),
}));
jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({
    status: "granted",
  })),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: { latitude: 27.7172, longitude: 85.324 },
  })),
  reverseGeocodeAsync: jest.fn(async () => []),
  geocodeAsync: jest.fn(async () => []),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: jest.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 })),
}));
jest.mock("./utils/expoMapsRuntime", () => ({
  loadExpoMapsModule: jest.fn(() => null),
}));
jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));
jest.mock("expo/src/winter/runtime.native", () => ({}));
jest.mock("expo/src/winter/installGlobal", () => ({
  installGlobal: jest.fn(),
}));
jest.mock("react-native-reanimated", () =>
  require("react-native-reanimated/mock"),
);
