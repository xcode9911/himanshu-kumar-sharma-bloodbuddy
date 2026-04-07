import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { jwtDecode } from "jwt-decode";

export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
};

export const makeJsonResponse = (ok: boolean, body: any) => ({
  ok,
  json: jest.fn(async () => body),
  status: ok ? 200 : 400,
  statusText: ok ? "OK" : "Bad Request",
});

export const makeTextResponse = (ok: boolean, body: any) => ({
  ok,
  text: jest.fn(async () => JSON.stringify(body)),
  status: ok ? 200 : 400,
  statusText: ok ? "OK" : "Bad Request",
});

export const mockedUseLocalSearchParams = useLocalSearchParams as jest.Mock;
export const mockedJwtDecode = jwtDecode as jest.Mock;
export const mockedAsyncStorageGetItem = AsyncStorage.getItem as jest.Mock;

export const setupDefaultCaseMocks = () => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
  mockedUseLocalSearchParams.mockReturnValue({});
  (global.fetch as any) = jest.fn();
};

export const logCaseStep = (
  caseId: string,
  step: string,
  details?: Record<string, any> | string,
) => {
  if (typeof details === "string") {
    console.log(`[${caseId}] ${step}: ${details}`);
    return;
  }

  if (details) {
    console.log(`[${caseId}] ${step}`, details);
    return;
  }

  console.log(`[${caseId}] ${step}`);
};
