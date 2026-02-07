import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="navigation" />
      <Stack.Screen name="home" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="eligibility-check" />
      <Stack.Screen name="organization" />
      <Stack.Screen name="campaign" />
    </Stack>
  );
}
