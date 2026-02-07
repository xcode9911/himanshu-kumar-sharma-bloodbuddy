import { Ionicons } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useRouter } from "expo-router"
import { jwtDecode } from "jwt-decode"
import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"
import { API_ENDPOINTS } from "../../config/api"
import { moderateScale, scale, verticalScale } from "../../utils/responsive"

type UserData = {
  id: string
  fullName: string
  email: string
  role: string
  phone?: string
  bloodType?: string
  location?: string
  address?: string
  organizationName?: string
  eligibilityStatus?: string
  contact?: string
}

const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
const eligibilityStatuses = ["eligible", "pending", "ineligible"]

const normalizeUserData = (raw: any, fallbackRole?: string): UserData => {
  const source = raw?.user || raw?.data || raw || {}
  const role = (source.role || fallbackRole || "").toString().toLowerCase()
  
  // Extract role-specific data from nested structure
  const roleData = source[role] || {}
  
  // Convert boolean eligibilityStatus to string for UI
  let eligibilityStr = source.eligibilityStatus || roleData.eligibilityStatus
  if (typeof eligibilityStr === 'boolean') {
    eligibilityStr = eligibilityStr ? 'eligible' : 'ineligible'
  }
  
  return {
    id: String(source.id || source._id || source.userId || ""),
    fullName: source.fullName || source.name || "",
    email: source.email || "",
    role: role,
    phone: source.phone || source.phoneNumber || "",
    bloodType: source.bloodType || roleData.bloodType,
    location: source.location || roleData.location,
    address: source.address || roleData.address,
    organizationName: source.organizationName || roleData.organizationName,
    eligibilityStatus: eligibilityStr,
    contact: source.contact || source.contactNumber || roleData.contact,
  }
}

const prefillFormFields = (
  user: UserData,
  setters: {
    setFullName: (v: string) => void
    setPhone: (v: string) => void
    setBloodType: (v: string) => void
    setEligibilityStatus: (v: string) => void
    setLocation: (v: string) => void
    setAddress: (v: string) => void
    setOrganizationName: (v: string) => void
    setContact: (v: string) => void
  },
) => {
  console.log('Prefilling form with address:', user.address)
  setters.setFullName(user.fullName || "")
  setters.setPhone(user.phone || "")
  setters.setBloodType(user.bloodType || "")
  setters.setEligibilityStatus(user.eligibilityStatus || "")
  setters.setLocation(user.location || "")
  setters.setAddress(user.address || "")
  setters.setOrganizationName(user.organizationName || "")
  setters.setContact(user.contact || "")
}

export default function EditProfileScreen() {
  const router = useRouter()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace("/profile" as any)
    }
  }

  // Form fields
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [bloodType, setBloodType] = useState("")
  const [eligibilityStatus, setEligibilityStatus] = useState("")
  const [location, setLocation] = useState("")
  const [address, setAddress] = useState("")
  const [organizationName, setOrganizationName] = useState("")
  const [contact, setContact] = useState("")

  // Validation errors
  const [fullNameError, setFullNameError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [addressError, setAddressError] = useState<string | null>(null)
  const [organizationNameError, setOrganizationNameError] = useState<string | null>(null)
  const [contactError, setContactError] = useState<string | null>(null)

  // Pickers
  const [showBloodTypePicker, setShowBloodTypePicker] = useState(false)
  const [showEligibilityPicker, setShowEligibilityPicker] = useState(false)

  useEffect(() => {
    loadUserData()
  }, [])

  const loadUserData = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken")

      if (!token) {
        Alert.alert("Error", "Session expired. Please login again.")
        router.replace("/auth/login")
        return
      }

      // Try to extract full user data from JWT first
      try {
        const payload: any = jwtDecode(token)
        console.log('EditProfile - JWT payload:', JSON.stringify(payload, null, 2))
        
        // Extract user object from JWT
        const jwtUser = payload?.user || payload || {}
        
        // Normalize using the JWT user data
        const normalized = normalizeUserData({ user: jwtUser }, jwtUser.role)
        console.log('EditProfile - User from JWT:', JSON.stringify(normalized, null, 2))
        
        setUserData(normalized)
        prefillFormFields(normalized, {
          setFullName,
          setPhone,
          setBloodType,
          setEligibilityStatus,
          setLocation,
          setAddress,
          setOrganizationName,
          setContact,
        })
        
        // Update cached data
        await AsyncStorage.setItem("userData", JSON.stringify(normalized))
        return
      } catch (e) {
        console.error("Failed to decode JWT:", e)
      }

      // Fallback to cached data
      const userDataString = await AsyncStorage.getItem("userData")
      if (userDataString) {
        const parsedUser = JSON.parse(userDataString)
        const normalized = normalizeUserData(parsedUser, parsedUser.role)
        console.log('EditProfile - Using cached user data:', JSON.stringify(normalized, null, 2))
        
        setUserData(normalized)
        prefillFormFields(normalized, {
          setFullName,
          setPhone,
          setBloodType,
          setEligibilityStatus,
          setLocation,
          setAddress,
          setOrganizationName,
          setContact,
        })
        return
      }

      Alert.alert("Error", "Session expired. Please login again.")
      router.replace("/auth/login")
    } catch (error) {
      console.error("Error loading user data:", error)
      Alert.alert("Error", "Failed to load profile data")
    } finally {
      setIsLoading(false)
    }
  }

  const validateFullName = (val: string): string | null => {
    if (!val.trim()) return "Full name is required"
    if (val.trim().length < 2) return "Full name must be at least 2 characters"
    return null
  }

  const validatePhone = (val: string): string | null => {
    const trimmed = val.trim()
    if (!trimmed) return "Phone number is required"
    if (!/^\+?\d{10,15}$/.test(trimmed.replace(/[-\s]/g, ""))) return "Enter a valid phone number"
    return null
  }

  const validateLocation = (val: string): string | null => {
    if (!val.trim()) return "Location is required"
    return null
  }

  const validateAddress = (val: string): string | null => {
    if (!val.trim()) return "Address is required"
    return null
  }

  const validateOrganizationName = (val: string): string | null => {
    if (!val.trim()) return "Organization name is required"
    return null
  }

  const validateContact = (val: string): string | null => {
    const trimmed = val.trim()
    if (!trimmed) return "Contact number is required"
    if (!/^\+?\d{10,15}$/.test(trimmed.replace(/[-\s]/g, ""))) return "Enter a valid contact number"
    return null
  }

  const handleSave = async () => {
    if (!userData) return

    // Validate fields based on role - only basic fields are required
    const nameErr = validateFullName(fullName)
    const phoneErr = validatePhone(phone)
    setFullNameError(nameErr)
    setPhoneError(phoneErr)

    let hasError = !!(nameErr || phoneErr)

    // Role-specific validation - only validate if field has a value
    if (userData.role?.toLowerCase() === "donor") {
      if (location && location.trim()) {
        const locErr = validateLocation(location)
        setLocationError(locErr)
        if (locErr) hasError = true
      } else {
        setLocationError(null)
      }
    }

    if (userData.role?.toLowerCase() === "gainer") {
      if (address && address.trim()) {
        const addrErr = validateAddress(address)
        setAddressError(addrErr)
        if (addrErr) hasError = true
      } else {
        setAddressError(null)
      }
    }

    if (userData.role?.toLowerCase() === "organization") {
      // Only validate fields that have values
      if (organizationName && organizationName.trim()) {
        const orgErr = validateOrganizationName(organizationName)
        setOrganizationNameError(orgErr)
        if (orgErr) hasError = true
      } else {
        setOrganizationNameError(null)
      }
      
      if (location && location.trim()) {
        const locErr = validateLocation(location)
        setLocationError(locErr)
        if (locErr) hasError = true
      } else {
        setLocationError(null)
      }
      
      if (contact && contact.trim()) {
        const contactErr = validateContact(contact)
        setContactError(contactErr)
        if (contactErr) hasError = true
      } else {
        setContactError(null)
      }
    }

    if (hasError) {
      Alert.alert("Invalid input", "Please fix the errors in the form")
      return
    }

    setIsSaving(true)

    try {
      const token = await AsyncStorage.getItem("authToken")
      if (!token) {
        throw new Error("Session expired. Please login again.")
      }
      
      // Build request body based on role with userId - only include non-empty fields
      let requestBody: any = {
        userId: userData.id,
        fullName: fullName.trim(),
        phone: phone.trim(),
      }

      if (userData.role?.toLowerCase() === "donor") {
        requestBody = {
          userId: userData.id,
          fullName: fullName.trim(),
          phone: phone.trim(),
        }
        
        // Only add optional fields if they have values
        if (bloodType) {
          requestBody.bloodType = bloodType
        }
        
        if (eligibilityStatus) {
          // Convert eligibilityStatus string to boolean
          let eligibilityBoolean = true
          if (eligibilityStatus === "eligible") {
            eligibilityBoolean = true
          } else if (eligibilityStatus === "ineligible") {
            eligibilityBoolean = false
          } else {
            eligibilityBoolean = true
          }
          requestBody.eligibilityStatus = eligibilityBoolean
        }
        
        if (location && location.trim()) {
          requestBody.location = location.trim()
        }
      } else if (userData.role?.toLowerCase() === "gainer") {
        requestBody = {
          userId: userData.id,
          fullName: fullName.trim(),
          phone: phone.trim(),
        }
        
        // Only add address if it has a value
        if (address && address.trim()) {
          requestBody.address = address.trim()
        }
      } else if (userData.role?.toLowerCase() === "organization") {
        requestBody = {
          userId: userData.id,
        }
        
        // Only add fields that have values
        if (organizationName && organizationName.trim()) {
          requestBody.organizationName = organizationName.trim()
        }
        
        if (location && location.trim()) {
          requestBody.location = location.trim()
        }
        
        if (contact && contact.trim()) {
          requestBody.contact = contact.trim()
        }
      }

      console.log('Sending request body:', JSON.stringify(requestBody, null, 2))

      const response = await fetch(API_ENDPOINTS.PROFILE, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      })

      let data: any = null
      try {
        data = await response.json()
      } catch (jsonErr) {
        console.warn("Update profile: response not JSON", jsonErr)
      }

      if (!response.ok) {
        const message = data?.message || data?.error || `Failed to update profile (${response.status})`
        throw new Error(message)
      }

      // Update stored user data
      const normalized = normalizeUserData(data, userData.role)
      const updatedUserData = { ...userData, ...requestBody, ...normalized }
      await AsyncStorage.setItem("userData", JSON.stringify(updatedUserData))
      setUserData(updatedUserData)
      prefillFormFields(updatedUserData, {
        setFullName,
        setPhone,
        setBloodType,
        setEligibilityStatus,
        setLocation,
        setAddress,
        setOrganizationName,
        setContact,
      })

      Alert.alert("Success", "Profile updated successfully!", [
        { text: "OK", onPress: handleGoBack },
      ])
    } catch (error: any) {
      console.error("Update profile error:", error)
      Alert.alert("Error", error.message || "Failed to update profile")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D11B31" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    )
  }

  if (!userData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>No user data available</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Ionicons name="chevron-back" size={28} color="#D11B31" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Common Fields */}
        <View style={styles.formContainer}>
          <Text style={styles.sectionTitle}>Basic Information</Text>

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={[styles.input, fullNameError ? styles.inputError : null]}
            placeholder="Enter your name"
            placeholderTextColor="#9B7B7F"
            value={fullName}
            onChangeText={(text) => {
              setFullName(text)
              setFullNameError(null)
            }}
          />
          {!!fullNameError && <Text style={styles.errorText}>{fullNameError}</Text>}

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={[styles.input, phoneError ? styles.inputError : null]}
            placeholder="Enter your phone number"
            placeholderTextColor="#9B7B7F"
            value={phone}
            onChangeText={(text) => {
              setPhone(text)
              setPhoneError(null)
            }}
            keyboardType="phone-pad"
          />
          {!!phoneError && <Text style={styles.errorText}>{phoneError}</Text>}

          {/* Donor Fields */}
          {userData.role?.toLowerCase() === "donor" && (
            <>
              <Text style={styles.sectionTitle}>Donor Information</Text>

              <Text style={styles.label}>Blood Type</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowBloodTypePicker(true)}
              >
                <Text style={[styles.pickerButtonText, !bloodType && styles.placeholderText]}>
                  {bloodType || "Select blood type"}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#6b7280" />
              </TouchableOpacity>

              <Text style={styles.label}>Eligibility Status</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowEligibilityPicker(true)}
              >
                <Text style={[styles.pickerButtonText, !eligibilityStatus && styles.placeholderText]}>
                  {eligibilityStatus || "Select eligibility status"}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#6b7280" />
              </TouchableOpacity>

              <Text style={styles.label}>Location</Text>
              <TextInput
                style={[styles.input, locationError ? styles.inputError : null]}
                placeholder="Enter your location"
                placeholderTextColor="#9B7B7F"
                value={location}
                onChangeText={(text) => {
                  setLocation(text)
                  setLocationError(null)
                }}
              />
              {!!locationError && <Text style={styles.errorText}>{locationError}</Text>}
            </>
          )}

          {/* Gainer Fields */}
          {userData.role?.toLowerCase() === "gainer" && (
            <>
              <Text style={styles.sectionTitle}>Gainer Information</Text>

              <Text style={styles.label}>Address</Text>
              <TextInput
                style={[styles.input, styles.textArea, addressError ? styles.inputError : null]}
                placeholder="Enter your address"
                placeholderTextColor="#9B7B7F"
                value={address}
                onChangeText={(text) => {
                  setAddress(text)
                  setAddressError(null)
                }}
                multiline
                numberOfLines={3}
              />
              {!!addressError && <Text style={styles.errorText}>{addressError}</Text>}
            </>
          )}

          {/* Organization Fields */}
          {userData.role?.toLowerCase() === "organization" && (
            <>
              <Text style={styles.sectionTitle}>Organization Information</Text>

              <Text style={styles.label}>Organization Name</Text>
              <TextInput
                style={[styles.input, organizationNameError ? styles.inputError : null]}
                placeholder="Enter organization name"
                placeholderTextColor="#9B7B7F"
                value={organizationName}
                onChangeText={(text) => {
                  setOrganizationName(text)
                  setOrganizationNameError(null)
                }}
              />
              {!!organizationNameError && <Text style={styles.errorText}>{organizationNameError}</Text>}

              <Text style={styles.label}>Location</Text>
              <TextInput
                style={[styles.input, locationError ? styles.inputError : null]}
                placeholder="Enter organization location"
                placeholderTextColor="#9B7B7F"
                value={location}
                onChangeText={(text) => {
                  setLocation(text)
                  setLocationError(null)
                }}
              />
              {!!locationError && <Text style={styles.errorText}>{locationError}</Text>}

              <Text style={styles.label}>Contact Number</Text>
              <TextInput
                style={[styles.input, contactError ? styles.inputError : null]}
                placeholder="Enter contact number"
                placeholderTextColor="#9B7B7F"
                value={contact}
                onChangeText={(text) => {
                  setContact(text)
                  setContactError(null)
                }}
                keyboardType="phone-pad"
              />
              {!!contactError && <Text style={styles.errorText}>{contactError}</Text>}
            </>
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={styles.saveButtonText}>{isSaving ? "Saving..." : "Save Changes"}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Blood Type Picker Modal */}
      <Modal visible={showBloodTypePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Blood Type</Text>
              <TouchableOpacity onPress={() => setShowBloodTypePicker(false)}>
                <Ionicons name="close-circle" size={28} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerScroll}>
              {bloodTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.pickerOption, bloodType === type && styles.pickerOptionSelected]}
                  onPress={() => {
                    setBloodType(type)
                    setShowBloodTypePicker(false)
                  }}
                >
                  <Text style={[styles.pickerOptionText, bloodType === type && styles.pickerOptionTextSelected]}>
                    {type}
                  </Text>
                  {bloodType === type && <Ionicons name="checkmark-circle" size={24} color="#D11B31" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Eligibility Status Picker Modal */}
      <Modal visible={showEligibilityPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Eligibility Status</Text>
              <TouchableOpacity onPress={() => setShowEligibilityPicker(false)}>
                <Ionicons name="close-circle" size={28} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerScroll}>
              {eligibilityStatuses.map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[styles.pickerOption, eligibilityStatus === status && styles.pickerOptionSelected]}
                  onPress={() => {
                    setEligibilityStatus(status)
                    setShowEligibilityPicker(false)
                  }}
                >
                  <Text style={[styles.pickerOptionText, eligibilityStatus === status && styles.pickerOptionTextSelected]}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                  {eligibilityStatus === status && <Ionicons name="checkmark-circle" size={24} color="#D11B31" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    paddingTop: verticalScale(12),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
  },
  loadingText: {
    marginTop: verticalScale(12),
    fontSize: moderateScale(16),
    color: "#666",
  },
  errorText: {
    fontSize: moderateScale(13),
    color: "#dc2626",
    marginTop: verticalScale(-8),
    marginBottom: verticalScale(12),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(12),
    paddingBottom: verticalScale(12),
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E8E8E8",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: scale(4),
  },
  backButtonText: {
    fontSize: moderateScale(17),
    color: "#D11B31",
    marginLeft: scale(-2),
  },
  headerTitle: {
    fontSize: moderateScale(18),
    fontWeight: "700",
    color: "#000",
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
  },
  headerSpacer: {
    width: scale(100),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: verticalScale(40),
  },
  formContainer: {
    padding: scale(20),
  },
  sectionTitle: {
    fontSize: moderateScale(18),
    fontWeight: "700",
    color: "#000",
    marginBottom: verticalScale(16),
    marginTop: verticalScale(8),
  },
  label: {
    fontSize: moderateScale(16),
    fontWeight: "600",
    color: "#000",
    marginBottom: verticalScale(8),
    marginTop: verticalScale(8),
  },
  input: {
    backgroundColor: "#FEE2E2",
    borderRadius: moderateScale(20),
    paddingHorizontal: scale(18),
    paddingVertical: verticalScale(14),
    fontSize: moderateScale(15),
    color: "#333",
    marginBottom: verticalScale(16),
  },
  inputError: {
    borderWidth: 1,
    borderColor: "#dc2626",
  },
  textArea: {
    height: verticalScale(90),
    textAlignVertical: "top",
  },
  pickerButton: {
    backgroundColor: "#FEE2E2",
    borderRadius: moderateScale(20),
    paddingHorizontal: scale(18),
    paddingVertical: verticalScale(14),
    marginBottom: verticalScale(16),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pickerButtonText: {
    fontSize: moderateScale(15),
    color: "#333",
  },
  placeholderText: {
    color: "#9B7B7F",
  },
  saveButton: {
    backgroundColor: "#D11B31",
    marginHorizontal: scale(20),
    marginTop: verticalScale(8),
    marginBottom: verticalScale(20),
    paddingVertical: verticalScale(16),
    borderRadius: moderateScale(26),
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#FFF",
    fontSize: moderateScale(18),
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    paddingBottom: verticalScale(40),
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(20),
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  modalTitle: {
    fontSize: moderateScale(20),
    fontWeight: "700",
    color: "#000",
  },
  pickerScroll: {
    paddingHorizontal: scale(20),
  },
  pickerOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: verticalScale(16),
    paddingHorizontal: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  pickerOptionSelected: {
    backgroundColor: "#FEE2E2",
  },
  pickerOptionText: {
    fontSize: moderateScale(18),
    color: "#000",
    fontWeight: "500",
  },
  pickerOptionTextSelected: {
    color: "#D11B31",
    fontWeight: "700",
  },
})
