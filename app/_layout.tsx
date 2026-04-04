import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { AppState, LogBox } from "react-native";
import { NotificationProvider } from "../context/NotificationContext";
import { clearSession, getStoredTokenStatus } from "../utils/auth";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (__DEV__) {
      LogBox.ignoreAllLogs(true);
    }
  }, []);

  useEffect(() => {
    const enforceSession = async () => {
      const status = await getStoredTokenStatus();

      if (!status.hasToken || !status.isExpired) {
        return;
      }

      await clearSession();

      // Keep users on auth screens if already there; otherwise force logout redirect.
      if (segments[0] !== "auth") {
        router.replace("/auth/login" as any);
      }
    };

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        enforceSession();
      }
    });

    const interval = setInterval(enforceSession, 60 * 1000);
    enforceSession();

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [router, segments]);

  return (
    <NotificationProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="navigation" />
        <Stack.Screen name="home" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="privacy-policy" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="eligibility-check" />
        <Stack.Screen name="organization" />
        <Stack.Screen name="campaign" />
      </Stack>
    </NotificationProvider>
  );
}
