import { Stack } from 'expo-router';

export default function ContactsLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{
          title: "Contacts",
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
