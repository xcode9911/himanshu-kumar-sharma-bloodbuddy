import { Stack } from "expo-router";
import { NotificationProvider } from "../context/NotificationContext";

export default function RootLayout() {
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
