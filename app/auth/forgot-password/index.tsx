import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { API_ENDPOINTS } from "../../../config/api";
import { getUserFriendlyError } from "../../../utils/errorMessages";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isOtpStage, setIsOtpStage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [emailError, setEmailError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [otpTouched, setOtpTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const parseJsonSafe = async (response: Response) => {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (error) {
      return { message: text || response.statusText };
    }
  };

  const validateEmail = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return "Email is required";
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(trimmed)) return "Enter a valid email address";
    return null;
  };

  const validateOtp = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return "OTP is required";
    if (!/^\d{5}$/.test(trimmed)) return "OTP must be 5 digits";
    return null;
  };

  const validatePassword = (val: string): string | null => {
    if (!val) return "Password is required";
    if (val.length < 6) return "Password must be at least 6 characters";
    return null;
  };

  const handleSubmit = async () => {
    const emailErr = validateEmail(email);
    setEmailTouched(true);
    setEmailError(emailErr);

    if (emailErr) {
      Alert.alert("Invalid input", emailErr);
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    setIsLoading(true);

    try {
      const response = await fetch(API_ENDPOINTS.FORGOT_PASSWORD, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      const data = await parseJsonSafe(response);
      const message =
        data && typeof data === "object" && "message" in data
          ? (data as any).message
          : typeof data === "string"
            ? data
            : response.statusText || "Failed to send reset email.";

      if (!response.ok) {
        throw new Error(message || "Failed to send reset email.");
      }

      await AsyncStorage.setItem("resetEmail", trimmedEmail);
      setEmail("");
      setIsOtpStage(true);
      Alert.alert(
        "Sent",
        "OTP sent to your email. Enter it to reset your password.",
      );
    } catch (error: any) {
      console.log("Forgot password error:", error);
      Alert.alert(
        "Request failed",
        getUserFriendlyError(error, "Failed to send reset email."),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    const otpErr = validateOtp(otp);
    const passwordErr = validatePassword(newPassword);

    setOtpTouched(true);
    setPasswordTouched(true);
    setOtpError(otpErr);
    setPasswordError(passwordErr);

    if (otpErr || passwordErr) {
      Alert.alert("Invalid input", "Please fix the errors in the form");
      return;
    }

    const trimmedOtp = otp.trim();
    const trimmedPassword = newPassword.trim();
    setIsLoading(true);

    try {
      const storedEmail = await AsyncStorage.getItem("resetEmail");
      const emailToUse = (storedEmail || email).trim().toLowerCase();

      if (!emailToUse) {
        throw new Error(
          "Email not found for reset. Please restart the reset flow.",
        );
      }

      const response = await fetch(API_ENDPOINTS.RESET_PASSWORD, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: emailToUse,
          code: trimmedOtp,
          newPassword: trimmedPassword,
        }),
      });

      const data = await parseJsonSafe(response);
      const message =
        data && typeof data === "object" && "message" in data
          ? (data as any).message
          : typeof data === "string"
            ? data
            : response.statusText || "Failed to reset password.";

      if (!response.ok) {
        throw new Error(message || "Failed to reset password.");
      }

      await AsyncStorage.removeItem("resetEmail");
      Alert.alert("Success", "Password reset successful. Please login.", [
        { text: "OK", onPress: () => router.push("/auth/login" as any) },
      ]);
    } catch (error: any) {
      console.log("Reset password error:", error);
      Alert.alert(
        "Reset failed",
        getUserFriendlyError(error, "Failed to reset password."),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          testID="forgotPasswordScrollView"
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            {/* iPhone-style Back Icon (top-left) */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={26} color="#111827" />
            </TouchableOpacity>

            {/* Center Image */}
            <View style={styles.imageWrapper}>
              {/* Using logo.png as placeholder; replace with assets/images/forgot.png when available */}
              <Image
                source={require("../../../assets/images/forgotpassword.png")}
                style={styles.image}
                resizeMode="contain"
              />
            </View>

            {/* Title */}
            <Text testID="forgotPasswordTitle" style={styles.title}>
              {isOtpStage ? "Reset Password" : "Forgot Password"}
            </Text>

            {!isOtpStage && (
              <>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  testID="forgotPasswordEmailInput"
                  style={[
                    styles.input,
                    emailTouched && emailError ? styles.inputError : null,
                  ]}
                  placeholder="Enter your email"
                  placeholderTextColor="#9B7B7F"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (emailTouched) setEmailError(validateEmail(text));
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onBlur={() => {
                    setEmailTouched(true);
                    setEmailError(validateEmail(email));
                  }}
                />
                {emailTouched && !!emailError && (
                  <Text style={styles.errorText}>{emailError}</Text>
                )}
              </>
            )}

            {isOtpStage && (
              <>
                <Text style={styles.label}>OTP</Text>
                <TextInput
                  style={[
                    styles.input,
                    otpTouched && otpError ? styles.inputError : null,
                  ]}
                  placeholder="Enter 5-digit OTP"
                  placeholderTextColor="#9B7B7F"
                  value={otp}
                  onChangeText={(text) => {
                    setOtp(text);
                    if (otpTouched) setOtpError(validateOtp(text));
                  }}
                  keyboardType="number-pad"
                  maxLength={5}
                  onBlur={() => {
                    setOtpTouched(true);
                    setOtpError(validateOtp(otp));
                  }}
                />
                {otpTouched && !!otpError && (
                  <Text style={styles.errorText}>{otpError}</Text>
                )}

                <Text style={styles.label}>New Password</Text>
                <TextInput
                  style={[
                    styles.input,
                    passwordTouched && passwordError ? styles.inputError : null,
                  ]}
                  placeholder="Enter new password"
                  placeholderTextColor="#9B7B7F"
                  value={newPassword}
                  onChangeText={(text) => {
                    setNewPassword(text);
                    if (passwordTouched)
                      setPasswordError(validatePassword(text));
                  }}
                  secureTextEntry
                  onBlur={() => {
                    setPasswordTouched(true);
                    setPasswordError(validatePassword(newPassword));
                  }}
                />
                {passwordTouched && !!passwordError && (
                  <Text style={styles.errorText}>{passwordError}</Text>
                )}
              </>
            )}

            {/* Submit / Reset Button */}
            <TouchableOpacity
              testID="forgotPasswordSubmitButton"
              style={[
                styles.submitButton,
                (isLoading ||
                  (!isOtpStage && validateEmail(email)) ||
                  (isOtpStage &&
                    (validateOtp(otp) || validatePassword(newPassword)))) &&
                  styles.submitButtonDisabled,
              ]}
              onPress={isOtpStage ? handleReset : handleSubmit}
              disabled={
                isLoading ||
                (!isOtpStage && !!validateEmail(email)) ||
                (isOtpStage &&
                  (!!validateOtp(otp) || !!validatePassword(newPassword)))
              }
            >
              <Text style={styles.submitText}>
                {isOtpStage
                  ? "Reset Password"
                  : isLoading
                    ? "Sending..."
                    : "Forgot Password"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    backgroundColor: "#FFFFFF",
    paddingBottom: 40,
  },
  scrollContent: {
    flexGrow: 1,
  },
  backButton: {
    position: "absolute",
    top: 10,
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
    width: 350,
    height: 350,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#D11B31",
    textAlign: "center",
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 8,
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
  errorText: {
    color: "#dc2626",
    fontSize: 13,
    marginTop: -12,
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: "#D11B31",
    borderRadius: 26,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  inputDisabled: {
    opacity: 0.7,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
});
