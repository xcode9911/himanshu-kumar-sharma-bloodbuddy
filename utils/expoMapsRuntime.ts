import type { AppleMaps, GoogleMaps } from "expo-maps";
import { Platform } from "react-native";

export type AppleMapMarker = AppleMaps.Marker;
export type GoogleMapMarker = GoogleMaps.Marker;
export type AppleMapProps = AppleMaps.MapProps;
export type GoogleMapProps = GoogleMaps.MapProps;

type ExpoMapsModule = typeof import("expo-maps");

let cachedModule: ExpoMapsModule | null | undefined;
let nativeAvailabilityChecked = false;
let isNativeExpoMapsAvailable = false;

const hasNativeExpoMaps = (): boolean => {
  if (nativeAvailabilityChecked) {
    return isNativeExpoMapsAvailable;
  }

  nativeAvailabilityChecked = true;

  try {
    const expoModulesCore = require("expo-modules-core") as {
      NativeModulesProxy?: Record<string, unknown>;
      requireNativeModule?: (moduleName: string) => unknown;
    };

    const fromProxy =
      expoModulesCore.NativeModulesProxy &&
      "ExpoMaps" in expoModulesCore.NativeModulesProxy;

    if (fromProxy) {
      isNativeExpoMapsAvailable = true;
      return true;
    }

    if (typeof expoModulesCore.requireNativeModule === "function") {
      try {
        expoModulesCore.requireNativeModule("ExpoMaps");
        isNativeExpoMapsAvailable = true;
        return true;
      } catch (error) {
        isNativeExpoMapsAvailable = false;
        return false;
      }
    }
  } catch (error) {
    isNativeExpoMapsAvailable = false;
  }

  return isNativeExpoMapsAvailable;
};

export const loadExpoMapsModule = (): ExpoMapsModule | null => {
  if (cachedModule !== undefined) {
    return cachedModule;
  }

  if (Platform.OS === "android") {
    cachedModule = null;
    return cachedModule;
  }

  if (!hasNativeExpoMaps()) {
    cachedModule = null;
    return cachedModule;
  }

  try {
    cachedModule = require("expo-maps") as ExpoMapsModule;
  } catch (error) {
    cachedModule = null;
  }

  return cachedModule;
};
