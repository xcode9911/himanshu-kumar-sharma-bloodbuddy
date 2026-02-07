import { Ionicons } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useRouter } from "expo-router"
import { useState } from "react"
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native"
import { API_ENDPOINTS } from "../../../config/api"

export default function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [emailTouched, setEmailTouched] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const validateEmail = (val: string): string | null => {
    const trimmed = val.trim()
    if (!trimmed) return "Email is required"
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!re.test(trimmed)) return "Enter a valid email address"
    return null
  }

  const validatePassword = (val: string): string | null => {
    if (!val) return "Password is required"
    if (val.length < 6) return "Password must be at least 6 characters"
    return null
  }

  const handleLogin = async () => {
    // Validate inputs
    const emailErr = validateEmail(email)
    const passwordErr = validatePassword(password)
    setEmailTouched(true)
    setPasswordTouched(true)
    setEmailError(emailErr)
    setPasswordError(passwordErr)
    if (emailErr || passwordErr) {
      Alert.alert("Invalid input", "Please fix the errors in the form")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(API_ENDPOINTS.LOGIN, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Login failed. Please check your credentials.")
      }

      // Store JWT token and user data
      if (data.token) {
        await AsyncStorage.setItem("authToken", data.token)
      }
      
      // Store user data (handle different response structures)
      const userData = data.user || data.data || data
      const role = userData.role || userData.type || userData.userType || null
      
      // Extract blood type from nested donor object if available
      let bloodType = userData.bloodType
      if (!bloodType && userData.donor) {
        bloodType = userData.donor.bloodType
      }
      
      // For donors without blood type in response, use a default
      // This will be properly set when user updates their profile
      if (role === 'donor' && !bloodType) {
        bloodType = 'O+' // Default blood type for new donors
      }
      
      await AsyncStorage.setItem("userData", JSON.stringify({
        id: userData.id || userData._id || userData.userId,
        fullName: userData.fullName || userData.name,
        email: userData.email,
        role,
        phone: userData.phone || userData.phoneNumber,
        bloodType: bloodType || null,
        location: userData.location || userData.donor?.location || null,
        address: userData.address || userData.gainer?.address || null,
        organizationName: userData.organizationName || userData.organization?.organizationName || null,
        eligibilityStatus: userData.eligibilityStatus || userData.donor?.eligibilityStatus || null,
        lastDonationDate: userData.lastDonationDate || userData.donor?.lastDonationDate || null,
      }))

      // Login successful - navigate based on role
      router.replace("/navigation" as any)
    } catch (error: any) {
      console.error("Login error:", error)
      Alert.alert("Error", error.message || "Failed to login. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      {/* ---- Header with Curved Bubble Design ---- */}
      <View style={styles.headerSection}>
        <View style={styles.circle1} />
        <View style={styles.circle2} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.contentWrapper}>
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeText}>Welcome</Text>
            <Text style={styles.backToText}>Back to</Text>
            <Text style={styles.bloodbuddyText}>BloodBuddy!</Text>

            <Text style={styles.quoteText}>
              "Your role matters — whether you're a donor, a gainer, or an organization, every login brings hope to
              someone in need."
            </Text>
          </View>
        </View>

        {/* ---- Form Fields ---- */}
        <View style={styles.formContainer}>
          <Text style={styles.label}>Email:</Text>
          <TextInput
            style={[styles.input, emailTouched && emailError ? styles.inputError : null]}
            placeholder="Enter your email"
            placeholderTextColor="#9B7B7F"
            value={email}
            onChangeText={(text) => {
              setEmail(text)
              if (emailTouched) setEmailError(validateEmail(text))
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            onBlur={() => {
              setEmailTouched(true)
              setEmailError(validateEmail(email))
            }}
          />
          {emailTouched && !!emailError && <Text style={styles.errorText}>{emailError}</Text>}

          <Text style={styles.label}>Password:</Text>
          <View style={styles.inputWithIcon}>
            <TextInput
              style={[styles.input, styles.inputFlex, passwordTouched && passwordError ? styles.inputError : null]}
              placeholder="Enter your password"
              placeholderTextColor="#9B7B7F"
              value={password}
              onChangeText={(text) => {
                setPassword(text)
                if (passwordTouched) setPasswordError(validatePassword(text))
              }}
              secureTextEntry={!showPassword}
              onBlur={() => {
                setPasswordTouched(true)
                setPasswordError(validatePassword(password))
              }}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword((prev) => !prev)}
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
            >
              <Ionicons name={showPassword ? "eye" : "eye-off"} size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>
          {passwordTouched && !!passwordError && <Text style={styles.errorText}>{passwordError}</Text>}

          {/* Forgot Password Link */}
          <View style={styles.forgotContainer}>
            <TouchableOpacity onPress={() => router.push("/auth/forgot-password" as any)}>
              <Text style={styles.forgotLink}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, (isLoading || validateEmail(email) || validatePassword(password)) && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading || !!validateEmail(email) || !!validatePassword(password)}
          >
            <Text style={styles.loginButtonText}>{isLoading ? "Logging in..." : "Login"}</Text>
          </TouchableOpacity>

          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Not Registered Yet ? </Text>
            <TouchableOpacity onPress={() => router.push("/auth/register")}>
              <Text style={styles.registerLink}>Register Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  headerSection: {
    height: 90,
    backgroundColor: "transparent",
    overflow: "visible",
    position: "relative",
    zIndex: 1,
  },
  circle1: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "#D11B31",
    borderWidth: 3,
    borderColor: "#D11B31",
    top: -40,
    left: -30,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  circle2: {
    position: "absolute",
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: "#D11B31",
    borderWidth: 3,
    borderColor: "#D11B31",
    top: -60,
    right: -90,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 100,
    paddingBottom: 40,
    flexGrow: 1,
  },

  contentWrapper: {
    marginBottom: 30,
    marginTop: 35,
  },

  welcomeSection: {
    width: "100%",
    paddingRight: 0,
    paddingLeft: 0,
    marginTop: 0,
    zIndex: 1,
  },
  welcomeText: {
    fontSize: 40,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 2,
  },
  backToText: {
    fontSize: 26,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 2,
  },
  bloodbuddyText: {
    fontSize: 30,
    fontWeight: "700",
    color: "#D11B31",
    marginBottom: 16,
  },
  quoteText: {
    fontSize: 13,
    color: "#666666",
    lineHeight: 18,
    marginTop: 12,
    fontStyle: "italic",
  },

  formContainer: {
    width: "100%",
    marginTop: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    backgroundColor: "#FEE2E2",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 15,
    color: "#333333",
    marginBottom: 20,
  },
  inputError: {
    borderWidth: 1,
    borderColor: "#dc2626",
  },
  inputWithIcon: {
    position: "relative",
  },
  inputFlex: {
    paddingRight: 48,
  },
  eyeButton: {
    position: "absolute",
    right: 12,
    top: "30%",
    transform: [{ translateY: -10 }],
    padding: 4,
  },
  loginButton: {
    backgroundColor: "#D11B31",
    borderRadius: 26,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 13,
    marginTop: -12,
    marginBottom: 12,
  },

  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  registerText: {
    fontSize: 15,
    color: "#666666",
  },
  registerLink: {
    fontSize: 15,
    color: "#D11B31",
    fontWeight: "600",
  },
  forgotContainer: {
    alignItems: "flex-end",
    marginTop: -8,
    marginBottom: 16,
  },
  forgotLink: {
    fontSize: 14,
    color: "#D11B31",
    fontWeight: "600",
  },
})
