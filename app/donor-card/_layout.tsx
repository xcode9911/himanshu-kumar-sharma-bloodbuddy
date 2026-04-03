import { Stack } from "expo-router"

export default function DonorCardLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  )
}
