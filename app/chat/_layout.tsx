import { Stack } from 'expo-router';

export default function ChatLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Messages",
          headerStyle: {
            backgroundColor: '#D11B31',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: '600',
          },
        }}
      />
      <Stack.Screen
        name="conversation"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
