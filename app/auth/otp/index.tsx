import { Ionicons } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useRef, useState } from "react"
import { Alert, Image, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native"
import { API_ENDPOINTS } from "../../../config/api"

export default function OTPScreen() {
  const router = useRouter()
  const { email: emailParam, userType: userTypeParam } = useLocalSearchParams<{ email?: string; userType?: string }>()
  const [email] = useState<string>(typeof emailParam === "string" ? emailParam : "")
  const [userType] = useState<string>(typeof userTypeParam === "string" ? userTypeParam : "")
  const [otp, setOtp] = useState<string[]>(["", "", "", "", ""]) // 5-digit OTP
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [otpTouched, setOtpTouched] = useState(false)
  const [otpError, setOtpError] = useState<string | null>(null)
  const otpInputRefs = useRef<Array<TextInput | null>>([])

  const validateOtp = (): string | null => {
    const otpString = otp.join("")
    if (!otpString) return "OTP is required"
    if (otpString.length !== 5) return "OTP must be 5 digits"
    if (!/^\d{5}$/.test(otpString)) return "OTP must contain only numbers"
    return null
  }

  const handleOTPChange = (value: string, index: number) => {
    if (value.length > 1) {
      const digits = value.slice(0, 5).split("")
      const newOtp = [...otp]
      digits.forEach((digit, i) => {
        if (index + i < 5) {
          newOtp[index + i] = digit
        }
      })
      setOtp(newOtp)
      const lastIndex = Math.min(index + digits.length - 1, 4)
      otpInputRefs.current[lastIndex]?.focus()
    } else {
      const newOtp = [...otp]
      newOtp[index] = value
      setOtp(newOtp)
      if (value && index < 4) {
        otpInputRefs.current[index + 1]?.focus()
      }
    }
    if (otpTouched) {
      setOtpError(validateOtp())
    }
  }

  const handleOTPKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus()
    }
  }

  const handleVerifyOTP = async () => {
    setOtpTouched(true)
    const otpErr = validateOtp()
    setOtpError(otpErr)
    
    if (otpErr) {
      Alert.alert("Invalid OTP", otpErr)
      return
    }

    const otpString = otp.join("")
    setIsVerifying(true)

    try {
      const response = await fetch(API_ENDPOINTS.VERIFY_OTP, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, code: otpString }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Invalid OTP. Please try again.")
      }

      console.log("✅ OTP verification response:", data)

      // Store auth token and userId if returned by backend
      if (data.token) {
        await AsyncStorage.setItem("authToken", data.token)
        console.log("💾 Auth token saved")
      }

      if (data.userId) {
        await AsyncStorage.setItem("userId", data.userId.toString())
        console.log("💾 UserId saved:", data.userId)
      }

      // If user is a donor, redirect to eligibility check; otherwise go to profile
      const nextScreen = userType === "donor" ? "/eligibility-check" : "/profile"
      const routeParams = userType === "donor" ? { userType: "donor" } : {}

      Alert.alert("Success", "Account verified successfully!", [
        {
          text: "OK",
          onPress: () => router.replace({ pathname: nextScreen as any, params: routeParams }),
        },
      ])
    } catch (error: any) {
      console.error("OTP verification error:", error)
      Alert.alert("Error", error.message || "Invalid OTP. Please try again.")
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResendOTP = async () => {
    setIsResending(true)

    try {
      const response = await fetch(API_ENDPOINTS.RESEND_OTP, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to resend OTP. Please try again.")
      }

      Alert.alert("Success", "OTP has been resent to your email")
    } catch (error: any) {
      console.error("Resend OTP error:", error)
      Alert.alert("Error", error.message || "Failed to resend OTP. Please try again.")
    } finally {
      setIsResending(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* iPhone-style Back Icon (top-left) */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={26} color="#111827" />
        </TouchableOpacity>

        {/* Center Image */}
        <View style={styles.imageWrapper}>
          <Image source={require("../../../assets/images/otp.png")} style={styles.image} resizeMode="contain" />
        </View>

        {/* Title and subtitle */}
        <Text style={styles.title}>Enter OTP</Text>
        {!!email && <Text style={styles.subtitle}>We sent a 5-digit code to {email}</Text>}

        {/* OTP Bubbles */}
        <View style={styles.otpCirclesContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                if (ref) {
                  otpInputRefs.current[index] = ref
                }
              }}
              style={[styles.otpCircle, digit && styles.otpCircleFilled, otpTouched && otpError ? styles.otpCircleError : null]}
              value={digit}
              onChangeText={(value) => handleOTPChange(value, index)}
              onKeyPress={({ nativeEvent }) => handleOTPKeyPress(nativeEvent.key, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              autoFocus={index === 0}
            />
          ))}
        </View>
        {otpTouched && !!otpError && <Text style={styles.errorText}>{otpError}</Text>}

        {/* Verify Button */}
        <TouchableOpacity
          style={[styles.verifyButton, (isVerifying || !!validateOtp()) && styles.verifyButtonDisabled]}
          onPress={handleVerifyOTP}
          disabled={isVerifying || !!validateOtp()}
        >
          <Text style={styles.verifyButtonText}>{isVerifying ? "Verifying..." : "Verify OTP"}</Text>
        </TouchableOpacity>

        {/* Resend OTP */}
        {!!email && (
          <TouchableOpacity style={styles.resendContainer} onPress={handleResendOTP} disabled={isResending}>
            <Text style={[styles.resendText, isResending && styles.resendTextDisabled]}>
              {isResending ? "Sending..." : "Resend OTP"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 10,
    padding: 6,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  imageWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 60,
    marginBottom: 24,
  },
  image: {
    width: 400,
    height: 400,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#D11B31",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 20,
  },
  otpCirclesContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
    width: "100%",
  },
  otpCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FEE2E2",
    borderWidth: 2,
    borderColor: "#F5C2C7",
    fontSize: 22,
    fontWeight: "700",
    color: "#D11B31",
    textAlign: "center",
    padding: 0,
  },
  otpCircleFilled: {
    backgroundColor: "#FADBDD",
    borderColor: "#D11B31",
  },
  otpCircleError: {
    borderColor: "#dc2626",
    borderWidth: 2,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 13,
    textAlign: "center",
    marginTop: -12,
    marginBottom: 12,
  },
  verifyButton: {
    backgroundColor: "#D11B31",
    borderRadius: 26,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  resendContainer: {
    alignItems: "center",
    paddingVertical: 8,
  },
  resendText: {
    fontSize: 15,
    color: "#D11B31",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  resendTextDisabled: {
    opacity: 0.5,
    color: "#9B7B7F",
  },
})
