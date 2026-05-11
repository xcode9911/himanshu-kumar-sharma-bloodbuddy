import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { jwtDecode } from "jwt-decode";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LeafletMapView from "../../components/LeafletMapView";
import { API_ENDPOINTS } from "../../config/api";
import { getUserFriendlyError } from "../../utils/errorMessages";
import {
    loadExpoMapsModule,
    type AppleMapMarker,
    type GoogleMapMarker,
} from "../../utils/expoMapsRuntime";
import { getCleanImageUrl } from "../../utils/image";
import { moderateScale, scale, verticalScale } from "../../utils/responsive";

type UserData = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  phone?: string;
  bloodType?: string;
  location?: string;
  address?: string;
  organizationName?: string;
  eligibilityStatus?: string;
  contact?: string;
  profileImage?: any;
  latitude?: number;
  longitude?: number;
};

const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const eligibilityStatuses = ["eligible", "pending", "ineligible"];

const NEPAL_DEFAULT_COORDINATES = {
  latitude: 27.7172,
  longitude: 85.324,
};

type Coordinates = {
  latitude?: number;
  longitude?: number;
};

const parseCoordinate = (value: any): number | undefined => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
};

const getUserCoordinates = (user: UserData): Coordinates | null => {
  const latitude = Number(user.latitude);
  const longitude = Number(user.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
};

const normalizeUserData = (raw: any, fallbackRole?: string): UserData => {
  const source = raw?.user || raw?.data || raw || {};
  const role = (source.role || fallbackRole || "").toString().toLowerCase();

  // Extract role-specific data from nested structure
  const roleData = source[role] || {};

  // Convert boolean eligibilityStatus to string for UI
  let elVal = source.eligibilityStatus;
  if (elVal === undefined) elVal = roleData.eligibilityStatus;

  let eligibilityStr = "";
  if (typeof elVal === "boolean") {
    eligibilityStr = elVal ? "eligible" : "ineligible";
  } else if (typeof elVal === "string") {
    const lower = elVal.toLowerCase();
    if (lower === "true" || lower === "eligible") eligibilityStr = "eligible";
    else if (lower === "false" || lower === "ineligible")
      eligibilityStr = "ineligible";
    else eligibilityStr = elVal;
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
    profileImage:
      source.profileImage || source.ProfileImage || roleData.ProfileImage,
    latitude: parseCoordinate(
      source.latitude ||
        source.Latitude ||
        roleData.latitude ||
        roleData.Latitude,
    ),
    longitude: parseCoordinate(
      source.longitude ||
        source.Longitude ||
        roleData.longitude ||
        roleData.Longitude,
    ),
  };
};

const prefillFormFields = (
  user: UserData,
  setters: {
    setFullName: (v: string) => void;
    setPhone: (v: string) => void;
    setBloodType: (v: string) => void;
    setEligibilityStatus: (v: string) => void;
    setLocation: (v: string) => void;
    setAddress: (v: string) => void;
    setOrganizationName: (v: string) => void;
    setContact: (v: string) => void;
    setProfileImage: (v: string | null) => void;
  },
) => {
  console.log("Prefilling form with address:", user.address);
  setters.setFullName(user.fullName || "");
  setters.setPhone(user.phone || "");
  setters.setBloodType(user.bloodType || "");
  setters.setEligibilityStatus(user.eligibilityStatus || "");
  setters.setLocation(user.location || "");
  setters.setAddress(user.address || "");
  setters.setOrganizationName(user.organizationName || "");
  setters.setContact(user.contact || "");

  setters.setProfileImage(getCleanImageUrl(user.profileImage));
};

const validateFullName = (val: string): string | null => {
  if (!val.trim()) return "Full name is required";
  if (val.trim().length < 2) return "Full name must be at least 2 characters";
  return null;
};

const validatePhone = (val: string): string | null => {
  const trimmed = val.trim();
  if (!trimmed) return "Phone number is required";
  if (!/^\+?\d{10,15}$/.test(trimmed.replace(/[-\s]/g, "")))
    return "Enter a valid phone number";
  return null;
};

const validateLocation = (val: string): string | null => {
  if (!val.trim()) return "Location is required";
  return null;
};

const validateAddress = (val: string): string | null => {
  if (!val.trim()) return "Address is required";
  return null;
};

const validateOrganizationName = (val: string): string | null => {
  if (!val.trim()) return "Organization name is required";
  return null;
};

const validateContact = (val: string): string | null => {
  const trimmed = val.trim();
  if (!trimmed) return "Contact number is required";
  if (!/^\+?\d{10,15}$/.test(trimmed.replace(/[-\s]/g, "")))
    return "Enter a valid contact number";
  return null;
};

export default function EditProfileScreen() {
  const expoMapsModule = loadExpoMapsModule();
  const AppleMapsView = expoMapsModule?.AppleMaps?.View;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/profile" as any);
    }
  };

  // Form fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [eligibilityStatus, setEligibilityStatus] = useState("");
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [contact, setContact] = useState("");

  // Validation errors
  const [fullNameError, setFullNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [organizationNameError, setOrganizationNameError] = useState<
    string | null
  >(null);
  const [contactError, setContactError] = useState<string | null>(null);

  // Pickers
  const [showBloodTypePicker, setShowBloodTypePicker] = useState(false);
  const [showEligibilityPicker, setShowEligibilityPicker] = useState(false);
  const [organizationCoordinates, setOrganizationCoordinates] =
    useState<Coordinates | null>(null);
  const [showOrganizationMapPicker, setShowOrganizationMapPicker] =
    useState(false);
  const [mapPickerCoordinates, setMapPickerCoordinates] =
    useState<Coordinates | null>(null);
  const [mapPickerCenter, setMapPickerCenter] = useState<Coordinates>(
    NEPAL_DEFAULT_COORDINATES,
  );
  const [isMapPickerLoadingLocation, setIsMapPickerLoadingLocation] =
    useState(false);
  const [locationSearchQuery, setLocationSearchQuery] = useState("");
  const [locationSearchError, setLocationSearchError] = useState<string | null>(
    null,
  );
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);

  const mapPickerRef = useRef<any>(null);

  const syncOrganizationCoordinatesFromUser = (user: UserData) => {
    if (user.role?.toLowerCase() !== "organization") {
      setOrganizationCoordinates(null);
      return;
    }

    const coordinates = getUserCoordinates(user);
    setOrganizationCoordinates(coordinates);

    if (coordinates) {
      setMapPickerCoordinates(coordinates);
      setMapPickerCenter(coordinates);
    }
  };

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");

      if (!token) {
        Alert.alert("Error", "Session expired. Please login again.");
        router.replace("/auth/login");
        return;
      }

      // Try to extract full user data from JWT first
      try {
        const payload: any = jwtDecode(token);
        console.log(
          "EditProfile - JWT payload:",
          JSON.stringify(payload, null, 2),
        );

        // Extract user object from JWT
        const jwtUser = payload?.user || payload || {};

        // Normalize using the JWT user data
        const normalized = normalizeUserData({ user: jwtUser }, jwtUser.role);
        console.log(
          "EditProfile - User from JWT:",
          JSON.stringify(normalized, null, 2),
        );

        setUserData(normalized);
        prefillFormFields(normalized, {
          setFullName,
          setPhone,
          setBloodType,
          setEligibilityStatus,
          setLocation,
          setAddress,
          setOrganizationName,
          setContact,
          setProfileImage,
        });
        syncOrganizationCoordinatesFromUser(normalized);

        // Update cached data
        await AsyncStorage.setItem("userData", JSON.stringify(normalized));
        return;
      } catch (e) {
        console.log("Failed to decode JWT:", e);
      }

      // Fallback to cached data
      const userDataString = await AsyncStorage.getItem("userData");
      if (userDataString) {
        const parsedUser = JSON.parse(userDataString);
        const normalized = normalizeUserData(parsedUser, parsedUser.role);
        console.log(
          "EditProfile - Using cached user data:",
          JSON.stringify(normalized, null, 2),
        );

        setUserData(normalized);
        prefillFormFields(normalized, {
          setFullName,
          setPhone,
          setBloodType,
          setEligibilityStatus,
          setLocation,
          setAddress,
          setOrganizationName,
          setContact,
          setProfileImage,
        });
        syncOrganizationCoordinatesFromUser(normalized);
        return;
      }

      Alert.alert("Error", "Session expired. Please login again.");
      router.replace("/auth/login");
    } catch (error) {
      console.log("Error loading user data:", error);
      Alert.alert("Error", "Failed to load profile data");
    } finally {
      setIsLoading(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Denied",
        "We need camera roll permissions to change your profile picture.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const mapPickerAppleMarkers = useMemo<AppleMapMarker[]>(() => {
    if (!mapPickerCoordinates) {
      return [];
    }

    return [
      {
        id: "organization-location",
        title: "Selected Location",
        coordinates: mapPickerCoordinates,
        tintColor: "#D11B31",
        systemImage: "mappin.and.ellipse",
      },
    ];
  }, [mapPickerCoordinates]);

  const mapPickerGoogleMarkers = useMemo<GoogleMapMarker[]>(() => {
    if (!mapPickerCoordinates) {
      return [];
    }

    return [
      {
        id: "organization-location",
        title: "Selected Location",
        coordinates: mapPickerCoordinates,
      },
    ];
  }, [mapPickerCoordinates]);

  useEffect(() => {
    if (
      !showOrganizationMapPicker ||
      !mapPickerRef.current?.setCameraPosition
    ) {
      return;
    }

    const nextCamera =
      Platform.OS === "android"
        ? {
            coordinates: mapPickerCenter,
            zoom: 13,
            duration: 350,
          }
        : {
            coordinates: mapPickerCenter,
            zoom: 13,
          };

    mapPickerRef.current.setCameraPosition(nextCamera);
  }, [mapPickerCenter, showOrganizationMapPicker]);

  const buildLocationLabel = async (coordinates: Coordinates) => {
    try {
      if (
        coordinates.latitude === undefined ||
        coordinates.longitude === undefined
      ) {
        return "Unknown location";
      }

      const places = await Location.reverseGeocodeAsync({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      });
      const place = places?.[0];

      if (place) {
        const parts = [
          place.name,
          place.street,
          place.city,
          place.subregion,
          place.region,
          place.country,
        ].filter(Boolean);

        if (parts.length > 0) {
          return Array.from(new Set(parts)).join(", ");
        }
      }
    } catch (error) {
      console.log("Edit profile reverse geocoding failed:", error);
    }

    return `${(coordinates.latitude ?? 0).toFixed(6)}, ${(coordinates.longitude ?? 0).toFixed(6)}`;
  };

  const openOrganizationMapPicker = async () => {
    setShowOrganizationMapPicker(true);
    setLocationSearchError(null);
    setLocationSearchQuery(location || "");

    const existingCoordinates = organizationCoordinates || mapPickerCoordinates;
    if (existingCoordinates) {
      setMapPickerCoordinates(existingCoordinates);
      setMapPickerCenter(existingCoordinates);
      return;
    }

    setIsMapPickerLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status === "granted") {
        const current = await Location.getCurrentPositionAsync({});
        const currentCoordinates = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        };

        setMapPickerCenter(currentCoordinates);
        setMapPickerCoordinates(currentCoordinates);
      } else {
        setMapPickerCenter(NEPAL_DEFAULT_COORDINATES);
      }
    } catch (error) {
      console.log("Edit profile failed to get current location:", error);
      setMapPickerCenter(NEPAL_DEFAULT_COORDINATES);
    } finally {
      setIsMapPickerLoadingLocation(false);
    }
  };

  const searchMapLocation = async () => {
    const query = locationSearchQuery.trim();
    if (!query) {
      setLocationSearchError("Please enter a location to search.");
      return;
    }

    setLocationSearchError(null);
    setIsSearchingLocation(true);

    try {
      const results = await Location.geocodeAsync(query);
      const firstMatch = results?.[0];

      if (!firstMatch) {
        setLocationSearchError("No location found. Try a more specific place.");
        return;
      }

      const coordinates = {
        latitude: firstMatch.latitude,
        longitude: firstMatch.longitude,
      };

      setMapPickerCoordinates(coordinates);
      setMapPickerCenter(coordinates);
    } catch (error) {
      console.log("Edit profile location search failed:", error);
      setLocationSearchError("Unable to search location right now.");
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const confirmOrganizationMapLocation = async () => {
    if (!mapPickerCoordinates) {
      Alert.alert(
        "Location Required",
        "Please search or tap map to choose location.",
      );
      return;
    }

    const label = await buildLocationLabel(mapPickerCoordinates);
    setOrganizationCoordinates(mapPickerCoordinates);
    setLocation(label);
    setLocationError(null);
    setShowOrganizationMapPicker(false);
  };

  const handleSave = async () => {
    if (!userData) return;

    // Validate fields based on role - only basic fields are required
    const nameErr = validateFullName(fullName);
    const phoneErr = validatePhone(phone);
    setFullNameError(nameErr);
    setPhoneError(phoneErr);

    let hasError = !!(nameErr || phoneErr);

    // Role-specific validation - only validate if field has a value
    if (userData.role?.toLowerCase() === "donor") {
      if (location && location.trim()) {
        const locErr = validateLocation(location);
        setLocationError(locErr);
        if (locErr) hasError = true;
      } else {
        setLocationError(null);
      }
    }

    if (userData.role?.toLowerCase() === "gainer") {
      if (address && address.trim()) {
        const addrErr = validateAddress(address);
        setAddressError(addrErr);
        if (addrErr) hasError = true;
      } else {
        setAddressError(null);
      }
    }

    if (userData.role?.toLowerCase() === "organization") {
      // Only validate fields that have values
      if (organizationName && organizationName.trim()) {
        const orgErr = validateOrganizationName(organizationName);
        setOrganizationNameError(orgErr);
        if (orgErr) hasError = true;
      } else {
        setOrganizationNameError(null);
      }

      if (location && location.trim()) {
        const locErr = validateLocation(location);
        setLocationError(locErr);
        if (locErr) hasError = true;
      } else {
        setLocationError(null);
      }

      if (contact && contact.trim()) {
        const contactErr = validateContact(contact);
        setContactError(contactErr);
        if (contactErr) hasError = true;
      } else {
        setContactError(null);
      }
    }

    if (hasError) {
      Alert.alert("Invalid input", "Please fix the errors in the form");
      return;
    }

    setIsSaving(true);

    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
        throw new Error("Session expired. Please login again.");
      }

      console.log("Sending update with FormData...");

      const formData = new FormData();
      formData.append("userId", userData.id);
      formData.append("fullName", fullName.trim());
      formData.append("phone", phone.trim());

      if (userData.role?.toLowerCase() === "donor") {
        if (bloodType) formData.append("bloodType", bloodType);
        if (eligibilityStatus) {
          let eligibilityBoolean = eligibilityStatus === "eligible";
          formData.append("eligibilityStatus", String(eligibilityBoolean));
        }
        if (location) formData.append("location", location.trim());
      } else if (userData.role?.toLowerCase() === "gainer") {
        if (address) formData.append("address", address.trim());
      } else if (userData.role?.toLowerCase() === "organization") {
        if (organizationName)
          formData.append("organizationName", organizationName.trim());
        if (location) formData.append("location", location.trim());
        if (contact) formData.append("contact", contact.trim());
        if (organizationCoordinates) {
          formData.append(
            "latitude",
            String(organizationCoordinates.latitude ?? 0),
          );
          formData.append(
            "longitude",
            String(organizationCoordinates.longitude ?? 0),
          );
          formData.append(
            "Latitude",
            String(organizationCoordinates.latitude ?? 0),
          );
          formData.append(
            "Longitude",
            String(organizationCoordinates.longitude ?? 0),
          );
        }
      }

      if (profileImage && !/^https?:\/\//i.test(profileImage)) {
        const uriParts = profileImage.split(".");
        const fileType = uriParts[uriParts.length - 1];

        // @ts-ignore
        formData.append("profileImage", {
          uri: profileImage,
          name: `profile-${userData.id}.${fileType}`,
          type: `image/${fileType}`,
        });
      }

      const response = await fetch(API_ENDPOINTS.PROFILE, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          // Note: Do NOT set Content-Type header when sending FormData
        },
        body: formData,
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch (jsonErr) {
        console.warn("Update profile: response not JSON", jsonErr);
      }

      if (!response.ok) {
        const message =
          data?.message ||
          data?.error ||
          `Failed to update profile (${response.status})`;
        throw new Error(message);
      }

      // Update stored user data
      const normalized = normalizeUserData(data, userData.role);
      const updatedUserData = { ...userData, ...normalized };
      await AsyncStorage.setItem("userData", JSON.stringify(updatedUserData));
      setUserData(updatedUserData);
      prefillFormFields(updatedUserData, {
        setFullName,
        setPhone,
        setBloodType,
        setEligibilityStatus,
        setLocation,
        setAddress,
        setOrganizationName,
        setContact,
        setProfileImage,
      });
      syncOrganizationCoordinatesFromUser(updatedUserData);

      Alert.alert("Success", "Profile updated successfully!", [
        { text: "OK", onPress: handleGoBack },
      ]);
    } catch (error: any) {
      console.log("Update profile error:", error);
      Alert.alert(
        "Update failed",
        getUserFriendlyError(error, "Failed to update profile"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D11B31" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!userData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>No user data available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, verticalScale(12)),
            minHeight: verticalScale(64) + insets.top,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleGoBack}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <Ionicons name="chevron-back" size={28} color="#D11B31" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        testID="editProfileScrollView"
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Image Section */}
        <View style={styles.imageUploadSection}>
          <TouchableOpacity
            onPress={pickImage}
            activeOpacity={0.8}
            style={styles.imageContainer}
          >
            {profileImage ? (
              <View style={styles.profileImageWrapper}>
                <Image
                  source={{ uri: getCleanImageUrl(profileImage) || "" }}
                  style={styles.profileImage}
                />
                <View style={styles.cameraIconOverlay}>
                  <Ionicons name="camera" size={20} color="#FFF" />
                </View>
              </View>
            ) : (
              <View
                style={[
                  styles.profileImagePlaceholder,
                  { backgroundColor: "#FEE2E2" },
                ]}
              >
                <Ionicons name="person" size={50} color="#D11B31" />
                <View style={styles.addIconBadge}>
                  <Ionicons name="add" size={16} color="#FFF" />
                </View>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.imageUploadHint}>
            Tap to change profile picture
          </Text>
        </View>

        {/* Common Fields */}
        <View style={styles.formContainer}>
          <Text style={styles.sectionTitle}>Basic Information</Text>

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            testID="editProfileNameInput"
            style={[styles.input, fullNameError ? styles.inputError : null]}
            placeholder="Enter your name"
            placeholderTextColor="#9B7B7F"
            value={fullName}
            onChangeText={(text) => {
              setFullName(text);
              setFullNameError(null);
            }}
          />
          {!!fullNameError && (
            <Text style={styles.errorText}>{fullNameError}</Text>
          )}

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            testID="editProfilePhoneInput"
            style={[styles.input, phoneError ? styles.inputError : null]}
            placeholder="Enter your phone number"
            placeholderTextColor="#9B7B7F"
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              setPhoneError(null);
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
                <Text
                  style={[
                    styles.pickerButtonText,
                    !bloodType && styles.placeholderText,
                  ]}
                >
                  {bloodType || "Select blood type"}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#6b7280" />
              </TouchableOpacity>

              <Text style={styles.label}>Eligibility Status</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowEligibilityPicker(true)}
              >
                <Text
                  style={[
                    styles.pickerButtonText,
                    !eligibilityStatus && styles.placeholderText,
                  ]}
                >
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
                  setLocation(text);
                  setLocationError(null);
                }}
              />
              {!!locationError && (
                <Text style={styles.errorText}>{locationError}</Text>
              )}
            </>
          )}

          {/* Gainer Fields */}
          {userData.role?.toLowerCase() === "gainer" && (
            <>
              <Text style={styles.sectionTitle}>Gainer Information</Text>

              <Text style={styles.label}>Address</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  addressError ? styles.inputError : null,
                ]}
                placeholder="Enter your address"
                placeholderTextColor="#9B7B7F"
                value={address}
                onChangeText={(text) => {
                  setAddress(text);
                  setAddressError(null);
                }}
                multiline
                numberOfLines={3}
              />
              {!!addressError && (
                <Text style={styles.errorText}>{addressError}</Text>
              )}
            </>
          )}

          {/* Organization Fields */}
          {userData.role?.toLowerCase() === "organization" && (
            <>
              <Text style={styles.sectionTitle}>Organization Information</Text>

              <Text style={styles.label}>Organization Name</Text>
              <TextInput
                testID="editProfileOrgNameInput"
                style={[
                  styles.input,
                  organizationNameError ? styles.inputError : null,
                ]}
                placeholder="Enter organization name"
                placeholderTextColor="#9B7B7F"
                value={organizationName}
                onChangeText={(text) => {
                  setOrganizationName(text);
                  setOrganizationNameError(null);
                }}
              />
              {!!organizationNameError && (
                <Text style={styles.errorText}>{organizationNameError}</Text>
              )}

              <Text style={styles.label}>Location</Text>
              <TouchableOpacity
                style={[
                  styles.input,
                  styles.mapPickerButton,
                  locationError ? styles.inputError : null,
                ]}
                activeOpacity={0.85}
                onPress={openOrganizationMapPicker}
              >
                <View style={styles.mapPickerButtonRow}>
                  <Ionicons name="location-outline" size={20} color="#6b7280" />
                  <Text
                    style={[
                      styles.mapPickerButtonText,
                      !location && styles.placeholderText,
                    ]}
                    numberOfLines={2}
                  >
                    {location || "Tap to pick organization location on map"}
                  </Text>
                </View>
                <Ionicons name="map-outline" size={20} color="#6b7280" />
              </TouchableOpacity>
              {organizationCoordinates && (
                <Text style={styles.mapCoordinateText}>
                  Lat {(organizationCoordinates?.latitude ?? 0).toFixed(6)} |
                  Lng {(organizationCoordinates?.longitude ?? 0).toFixed(6)}
                </Text>
              )}
              {!!locationError && (
                <Text style={styles.errorText}>{locationError}</Text>
              )}

              <Text style={styles.label}>Contact Number</Text>
              <TextInput
                testID="editProfileContactInput"
                style={[styles.input, contactError ? styles.inputError : null]}
                placeholder="Enter contact number"
                placeholderTextColor="#9B7B7F"
                value={contact}
                onChangeText={(text) => {
                  setContact(text);
                  setContactError(null);
                }}
                keyboardType="phone-pad"
              />
              {!!contactError && (
                <Text style={styles.errorText}>{contactError}</Text>
              )}
            </>
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          testID="editProfileSaveButton"
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={styles.saveButtonText}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Text>
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
                  style={[
                    styles.pickerOption,
                    bloodType === type && styles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    setBloodType(type);
                    setShowBloodTypePicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      bloodType === type && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {type}
                  </Text>
                  {bloodType === type && (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color="#D11B31"
                    />
                  )}
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
                  style={[
                    styles.pickerOption,
                    eligibilityStatus === status && styles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    setEligibilityStatus(status);
                    setShowEligibilityPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      eligibilityStatus === status &&
                        styles.pickerOptionTextSelected,
                    ]}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                  {eligibilityStatus === status && (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color="#D11B31"
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showOrganizationMapPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOrganizationMapPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.mapModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pick Organization Location</Text>
              <TouchableOpacity
                onPress={() => setShowOrganizationMapPicker(false)}
              >
                <Ionicons name="close-circle" size={28} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.mapHintText}>
              Search for a place or tap the map to set your organization
              location.
            </Text>

            <View style={styles.mapSearchRow}>
              <View style={styles.mapSearchInputWrap}>
                <Ionicons
                  name="search-outline"
                  size={18}
                  color="#6B7280"
                  style={styles.mapSearchIcon}
                />
                <TextInput
                  style={styles.mapSearchInput}
                  placeholder="Search location"
                  placeholderTextColor="#9CA3AF"
                  value={locationSearchQuery}
                  onChangeText={(text) => {
                    setLocationSearchQuery(text);
                    if (locationSearchError) {
                      setLocationSearchError(null);
                    }
                  }}
                  onSubmitEditing={searchMapLocation}
                  returnKeyType="search"
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.searchButton,
                  isSearchingLocation && styles.searchButtonDisabled,
                ]}
                disabled={isSearchingLocation}
                onPress={searchMapLocation}
              >
                {isSearchingLocation ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.searchButtonText}>Search</Text>
                )}
              </TouchableOpacity>
            </View>

            {locationSearchError ? (
              <Text style={styles.mapSearchErrorText}>
                {locationSearchError}
              </Text>
            ) : null}

            <View style={styles.mapPickerContainer}>
              {isMapPickerLoadingLocation ? (
                <View style={styles.mapLoadingContainer}>
                  <ActivityIndicator size="large" color="#D11B31" />
                  <Text style={styles.mapLoadingText}>
                    Getting your current location...
                  </Text>
                </View>
              ) : Platform.OS === "ios" && AppleMapsView ? (
                <AppleMapsView
                  ref={(ref) => {
                    mapPickerRef.current = ref;
                  }}
                  style={styles.mapPickerMap}
                  cameraPosition={{ coordinates: mapPickerCenter, zoom: 13 }}
                  markers={mapPickerAppleMarkers}
                  uiSettings={{
                    compassEnabled: true,
                    myLocationButtonEnabled: true,
                    scaleBarEnabled: true,
                  }}
                  properties={{
                    isMyLocationEnabled: true,
                  }}
                  onMapClick={(event) => {
                    setMapPickerCoordinates(event.coordinates);
                    setLocationSearchError(null);
                  }}
                />
              ) : Platform.OS === "android" ? (
                <LeafletMapView
                  ref={(ref) => {
                    mapPickerRef.current = ref;
                  }}
                  style={styles.mapPickerMap}
                  cameraPosition={{ coordinates: mapPickerCenter, zoom: 13 }}
                  markers={mapPickerGoogleMarkers}
                  onMapClick={(event) => {
                    setMapPickerCoordinates(event.coordinates);
                    setLocationSearchError(null);
                  }}
                  onMapLongClick={(event) => {
                    setMapPickerCoordinates(event.coordinates);
                    setLocationSearchError(null);
                  }}
                />
              ) : (
                <View style={styles.mapLoadingContainer}>
                  <Text style={styles.mapLoadingText}>
                    Map module is unavailable in this build.
                  </Text>
                  <Text style={styles.mapLoadingText}>
                    Rebuild using expo run:ios or expo run:android.
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.mapActionsRow}>
              <TouchableOpacity
                style={[styles.mapActionButton, styles.mapCancelButton]}
                onPress={() => setShowOrganizationMapPicker(false)}
              >
                <Text style={[styles.mapActionText, styles.mapCancelText]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.mapActionButton,
                  styles.mapConfirmButton,
                  !mapPickerCoordinates && styles.saveButtonDisabled,
                ]}
                disabled={!mapPickerCoordinates}
                onPress={confirmOrganizationMapLocation}
              >
                <Text style={styles.mapActionText}>Use This Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
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
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E8E8E8",
    zIndex: 100,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: scale(8),
    zIndex: 10,
    width: scale(44),
    height: scale(44),
    justifyContent: "center",
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
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: {
    width: scale(44),
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
  mapPickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mapPickerButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    flex: 1,
    marginRight: scale(10),
  },
  mapPickerButtonText: {
    fontSize: moderateScale(15),
    color: "#333",
    flexShrink: 1,
  },
  mapCoordinateText: {
    color: "#6B7280",
    fontSize: moderateScale(12),
    marginTop: verticalScale(-10),
    marginBottom: verticalScale(10),
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
  imageUploadSection: {
    alignItems: "center",
    marginVertical: verticalScale(20),
  },
  imageContainer: {
    width: scale(110),
    height: scale(110),
    borderRadius: scale(55),
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  profileImageWrapper: {
    width: "100%",
    height: "100%",
    borderRadius: scale(55),
    overflow: "hidden",
  },
  profileImage: {
    width: "100%",
    height: "100%",
  },
  profileImagePlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: scale(55),
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
  },
  cameraIconOverlay: {
    position: "absolute",
    bottom: scale(4),
    right: scale(4),
    backgroundColor: "#D11B31",
    padding: scale(6),
    borderRadius: scale(16),
    borderWidth: 2,
    borderColor: "#FFF",
  },
  addIconBadge: {
    position: "absolute",
    bottom: scale(5),
    right: scale(5),
    backgroundColor: "#D11B31",
    borderRadius: scale(12),
    width: scale(24),
    height: scale(24),
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  imageUploadHint: {
    marginTop: verticalScale(10),
    fontSize: moderateScale(13),
    color: "#6B7280",
    fontWeight: "500",
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
  mapModalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    paddingBottom: verticalScale(24),
    maxHeight: "88%",
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
  mapHintText: {
    fontSize: moderateScale(14),
    color: "#4B5563",
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(12),
    paddingBottom: verticalScale(8),
  },
  mapSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    paddingHorizontal: scale(20),
    marginBottom: verticalScale(8),
  },
  mapSearchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: moderateScale(12),
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: scale(10),
  },
  mapSearchIcon: {
    marginRight: scale(4),
  },
  mapSearchInput: {
    flex: 1,
    height: verticalScale(42),
    color: "#111827",
    fontSize: moderateScale(14),
  },
  searchButton: {
    height: verticalScale(42),
    borderRadius: moderateScale(12),
    backgroundColor: "#D11B31",
    paddingHorizontal: scale(14),
    alignItems: "center",
    justifyContent: "center",
  },
  searchButtonDisabled: {
    opacity: 0.7,
  },
  searchButtonText: {
    color: "#FFF",
    fontSize: moderateScale(14),
    fontWeight: "700",
  },
  mapSearchErrorText: {
    color: "#dc2626",
    fontSize: moderateScale(12),
    marginBottom: verticalScale(8),
    paddingHorizontal: scale(20),
  },
  mapPickerContainer: {
    height: verticalScale(360),
    marginHorizontal: scale(20),
    borderRadius: moderateScale(18),
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
    marginBottom: verticalScale(16),
  },
  mapPickerMap: {
    flex: 1,
  },
  mapLoadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: scale(20),
  },
  mapLoadingText: {
    marginTop: verticalScale(10),
    color: "#6B7280",
    fontSize: moderateScale(13),
    textAlign: "center",
  },
  mapActionsRow: {
    flexDirection: "row",
    paddingHorizontal: scale(20),
    gap: scale(10),
  },
  mapActionButton: {
    flex: 1,
    borderRadius: moderateScale(16),
    paddingVertical: verticalScale(14),
    alignItems: "center",
    justifyContent: "center",
  },
  mapCancelButton: {
    backgroundColor: "#F3F4F6",
  },
  mapConfirmButton: {
    backgroundColor: "#D11B31",
  },
  mapActionText: {
    color: "#FFF",
    fontSize: moderateScale(15),
    fontWeight: "700",
  },
  mapCancelText: {
    color: "#111827",
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
});
