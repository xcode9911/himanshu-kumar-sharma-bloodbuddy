import { Stack } from 'expo-router';

export default function MapLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{
          title: "Find Blood Banks",
          headerStyle: {
            backgroundColor: '#D11B31',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: '600',
          },
        }}
      />
    </Stack>
  );
}
