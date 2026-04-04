import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from "jwt-decode";

type JwtPayload = {
  exp?: number;
};

export const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = jwtDecode<JwtPayload>(token);
    if (!decoded?.exp) {
      return false;
    }

    const expiresAtMs = decoded.exp * 1000;
    return Date.now() >= expiresAtMs;
  } catch {
    return true;
  }
};

export const clearSession = async () => {
  await AsyncStorage.multiRemove(["authToken", "userData"]);
};

export const getStoredTokenStatus = async (): Promise<{
  hasToken: boolean;
  isExpired: boolean;
  token: string | null;
}> => {
  const token = await AsyncStorage.getItem("authToken");

  if (!token) {
    return {
      hasToken: false,
      isExpired: false,
      token: null,
    };
  }

  return {
    hasToken: true,
    isExpired: isTokenExpired(token),
    token,
  };
};

export const getValidToken = async (): Promise<string | null> => {
  const status = await getStoredTokenStatus();
  if (!status.hasToken) {
    return null;
  }

  if (status.isExpired) {
    await clearSession();
    return null;
  }

  return status.token;
};
