import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    KeyboardAvoidingView,
    Modal,
    PanResponder,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from "react-native-reanimated";
import LeafletMapView from "../../../components/LeafletMapView";
import { API_ENDPOINTS } from "../../../config/api";
import { getUserFriendlyError } from "../../../utils/errorMessages";
import {
    loadExpoMapsModule,
    type AppleMapMarker,
    type GoogleMapMarker,
} from "../../../utils/expoMapsRuntime";

const { width } = Dimensions.get("window");

type UserType = "donor" | "gainer" | "organization";

const userTypes: UserType[] = ["donor", "gainer", "organization"];

const userTypeConfig = {
  donor: { emoji: "💉", label: "Donor", color: "#FF6B6B" },
  gainer: { emoji: "🩺", label: "Gainer", color: "#4ECDC4" },
  organization: { emoji: "🏥", label: "Organization", color: "#95E1D3" },
};

const userTypeImages: Record<UserType, any> = {
  donor: require("../../../assets/images/donor.png"),
  gainer: require("../../../assets/images/gainer.png"),
  organization: require("../../../assets/images/organization.png"),
};

const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const NEPAL_DEFAULT_COORDINATES = {
  latitude: 27.7172,
  longitude: 85.324,
};

type Coordinates = {
  latitude?: number;
  longitude?: number;
};

export default function RegisterScreen() {
  const expoMapsModule = loadExpoMapsModule();
  const AppleMapsView = expoMapsModule?.AppleMaps?.View;
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<UserType>("gainer");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Validation states
  const [fullNameError, setFullNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [bloodTypeError, setBloodTypeError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [organizationNameError, setOrganizationNameError] = useState<
    string | null
  >(null);
  const [contactError, setContactError] = useState<string | null>(null);

  const [fullNameTouched, setFullNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [bloodTypeTouched, setBloodTypeTouched] = useState(false);
  const [locationTouched, setLocationTouched] = useState(false);
  const [addressTouched, setAddressTouched] = useState(false);
  const [organizationNameTouched, setOrganizationNameTouched] = useState(false);
  const [contactTouched, setContactTouched] = useState(false);
  // OTP verification will be done on a dedicated screen

  // Donor specific fields
  const [bloodType, setBloodType] = useState("");
  const [showBloodTypePicker, setShowBloodTypePicker] = useState(false);
  const [location, setLocation] = useState("");
  const [lastDonationDate, setLastDonationDate] = useState<Date | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Gainer specific fields
  const [address, setAddress] = useState("");

  // Organization specific fields
  const [organizationName, setOrganizationName] = useState("");
  const [contact, setContact] = useState("");
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

  const [carouselOrder, setCarouselOrder] = useState<UserType[]>([
    "organization",
    "gainer",
    "donor",
  ]);

  // Animation values for carousel
  const translateX = useSharedValue(0);
  const leftScale = useSharedValue(0.7);
  const centerScale = useSharedValue(1.2);
  const rightScale = useSharedValue(0.7);
  const leftOpacity = useSharedValue(0.4);
  const centerOpacity = useSharedValue(1);
  const rightOpacity = useSharedValue(0.4);
  const mapPickerRef = useRef<any>(null);

  const playHaptic = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const rotateCarouselRight = () => {
    playHaptic();

    // Rotate array right: [a, b, c] -> [c, a, b]
    setCarouselOrder((prev) => {
      const newOrder = [prev[2], prev[0], prev[1]];
      setSelectedType(newOrder[1]); // Center is always selected
      return newOrder;
    });

    // Animate the transition
    translateX.value = withSpring(-50, { damping: 20 });
    translateX.value = withSpring(0, { damping: 15 });

    animateScales();
  };

  const rotateCarouselLeft = () => {
    playHaptic();

    // Rotate array left: [a, b, c] -> [b, c, a]
    setCarouselOrder((prev) => {
      const newOrder = [prev[1], prev[2], prev[0]];
      setSelectedType(newOrder[1]); // Center is always selected
      return newOrder;
    });

    // Animate the transition
    translateX.value = withSpring(50, { damping: 20 });
    translateX.value = withSpring(0, { damping: 15 });

    animateScales();
  };

  const animateScales = () => {
    leftScale.value = withSpring(0.7, { damping: 15, stiffness: 150 });
    centerScale.value = withSpring(1.2, { damping: 15, stiffness: 150 });
    rightScale.value = withSpring(0.7, { damping: 15, stiffness: 150 });
    leftOpacity.value = withSpring(0.4);
    centerOpacity.value = withSpring(1);
    rightOpacity.value = withSpring(0.4);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_evt, gestureState) => {
        translateX.value = gestureState.dx * 0.5;
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const { dx, vx } = gestureState;
        const swipeThreshold = 40;
        const velocityThreshold = 0.3;

        if (dx > swipeThreshold || vx > velocityThreshold) {
          rotateCarouselLeft(); // Swipe right = rotate left
        } else if (dx < -swipeThreshold || vx < -velocityThreshold) {
          rotateCarouselRight(); // Swipe left = rotate right
        } else {
          translateX.value = withSpring(0);
        }
      },
    }),
  ).current;

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const leftBubbleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: leftScale.value }],
    opacity: leftOpacity.value,
  }));

  const centerBubbleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: centerScale.value }],
    opacity: centerOpacity.value,
  }));

  const rightBubbleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rightScale.value }],
    opacity: rightOpacity.value,
  }));

  const validateFullName = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return "Full name is required";
    if (trimmed.length < 2) return "Full name must be at least 2 characters";
    return null;
  };

  const validateEmail = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return "Email is required";
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(trimmed)) return "Enter a valid email address";
    return null;
  };

  const validatePassword = (val: string): string | null => {
    if (!val) return "Password is required";
    if (val.length < 6) return "Password must be at least 6 characters";
    return null;
  };

  const validatePhone = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return "Phone number is required";
    if (!/^\d{10,15}$/.test(trimmed.replace(/[-()\s]/g, "")))
      return "Enter a valid phone number";
    return null;
  };

  const validateBloodType = (val: string): string | null => {
    if (!val) return "Blood type is required";
    return null;
  };

  const validateLocation = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return "Location is required";
    return null;
  };

  const validateAddress = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return "Address is required";
    return null;
  };

  const validateOrganizationName = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return "Organization name is required";
    return null;
  };

  const validateContact = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return "Contact number is required";
    if (!/^\d{10,15}$/.test(trimmed.replace(/[-()\s]/g, "")))
      return "Enter a valid contact number";
    return null;
  };

  const isFormValid = (): boolean => {
    if (
      validateFullName(fullName) ||
      validateEmail(email) ||
      validatePassword(password) ||
      validatePhone(phoneNumber)
    )
      return false;
    if (selectedType === "gainer" && validateAddress(address)) return false;
    if (
      selectedType === "donor" &&
      (validateBloodType(bloodType) || validateLocation(location))
    )
      return false;
    if (
      selectedType === "organization" &&
      (validateOrganizationName(organizationName) ||
        validateLocation(location) ||
        validateContact(contact) ||
        !organizationCoordinates)
    ) {
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    // Validate all fields
    const nameErr = validateFullName(fullName);
    const emailErr = validateEmail(email);
    const passwordErr = validatePassword(password);
    const phoneErr = validatePhone(phoneNumber);

    setFullNameTouched(true);
    setEmailTouched(true);
    setPasswordTouched(true);
    setPhoneTouched(true);
    setFullNameError(nameErr);
    setEmailError(emailErr);
    setPasswordError(passwordErr);
    setPhoneError(phoneErr);

    let hasError = !!(nameErr || emailErr || passwordErr || phoneErr);

    // Role-specific validation
    if (selectedType === "gainer") {
      const addressErr = validateAddress(address);
      setAddressTouched(true);
      setAddressError(addressErr);
      if (addressErr) hasError = true;
    }

    if (selectedType === "donor") {
      const bloodErr = validateBloodType(bloodType);
      const locErr = validateLocation(location);
      setBloodTypeTouched(true);
      setLocationTouched(true);
      setBloodTypeError(bloodErr);
      setLocationError(locErr);
      if (bloodErr || locErr) hasError = true;
    }

    if (selectedType === "organization") {
      const orgErr = validateOrganizationName(organizationName);
      const locErr = organizationCoordinates
        ? validateLocation(location)
        : "Please choose location from map";
      const contactErr = validateContact(contact);
      setOrganizationNameTouched(true);
      setLocationTouched(true);
      setContactTouched(true);
      setOrganizationNameError(orgErr);
      setLocationError(locErr);
      setContactError(contactErr);
      if (orgErr || locErr || contactErr) hasError = true;
    }

    if (hasError) {
      Alert.alert(
        "Registration Failed",
        "Please fix the errors in the form and try again.",
      );
      return;
    }

    setIsLoading(true);

    try {
      let registrationData: any = {
        role: selectedType,
        fullName,
        email,
        password,
        phone: phoneNumber,
      };

      if (selectedType === "donor") {
        registrationData = {
          ...registrationData,
          bloodType,
          eligibilityStatus: "pending",
          location,
          lastDonationDate: lastDonationDate?.toISOString(),
        };
      } else if (selectedType === "gainer") {
        registrationData = {
          ...registrationData,
          address,
        };
      } else if (selectedType === "organization") {
        registrationData = {
          ...registrationData,
          organizationName,
          location,
          contact,
          ...(organizationCoordinates
            ? {
                latitude: organizationCoordinates.latitude,
                longitude: organizationCoordinates.longitude,
                Latitude: organizationCoordinates.latitude,
                Longitude: organizationCoordinates.longitude,
              }
            : {}),
        };
      }

      console.log("Sending registration data:", registrationData);

      const response = await fetch(API_ENDPOINTS.REGISTER, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(registrationData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed");
      }

      // Show success alert then navigate to OTP screen
      Alert.alert(
        "Registration Successful",
        "An OTP has been sent to your email. Please verify your account to continue.",
        [
          {
            text: "OK",
            onPress: () =>
              router.push({ pathname: "/auth/otp", params: { email } } as any),
          },
        ],
      );
    } catch (error: any) {
      console.log("Registration error:", error);
      Alert.alert(
        "Registration Failed",
        getUserFriendlyError(error, "Failed to register. Please try again."),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
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
      console.log("Reverse geocoding failed:", error);
    }

    return `${(coordinates.latitude ?? 0).toFixed(6)}, ${(coordinates.longitude ?? 0).toFixed(6)}`;
  };

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

  const openOrganizationMapPicker = async () => {
    setLocationTouched(true);
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
      console.log("Failed to get current location:", error);
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
      playHaptic();
    } catch (error) {
      console.log("Location search failed:", error);
      setLocationSearchError("Unable to search right now. Please try again.");
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const confirmOrganizationMapLocation = async () => {
    if (!mapPickerCoordinates) {
      Alert.alert(
        "Location Required",
        "Please tap on the map to choose organization coordinates.",
      );
      return;
    }

    const label = await buildLocationLabel(mapPickerCoordinates);
    setOrganizationCoordinates(mapPickerCoordinates);
    setLocation(label);
    setLocationError(null);
    setShowOrganizationMapPicker(false);
    playHaptic();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View style={styles.carouselWrapper}>
          <Text style={styles.swipeHint}>← Swipe to change →</Text>
          <Animated.View
            style={[styles.bubblesContainer, containerStyle]}
            {...panResponder.panHandlers}
          >
            {/* Left Bubble */}
            <Animated.View style={[styles.bubble, leftBubbleStyle]}>
              <View style={styles.bubbleContent}>
                <Image
                  source={userTypeImages[carouselOrder[0]]}
                  style={styles.bubbleImage}
                  resizeMode="cover"
                />
              </View>
            </Animated.View>

            {/* Center Bubble (Selected) */}
            <Animated.View
              style={[
                styles.bubble,
                styles.centerBubble,
                centerBubbleStyle,
                {
                  backgroundColor:
                    userTypeConfig[carouselOrder[1]].color + "40",
                },
              ]}
            >
              <View style={styles.bubbleContent}>
                <Image
                  source={userTypeImages[carouselOrder[1]]}
                  style={styles.centerImage}
                  resizeMode="cover"
                />
              </View>
            </Animated.View>

            {/* Right Bubble */}
            <Animated.View style={[styles.bubble, rightBubbleStyle]}>
              <View style={styles.bubbleContent}>
                <Image
                  source={userTypeImages[carouselOrder[2]]}
                  style={styles.bubbleImage}
                  resizeMode="cover"
                />
              </View>
            </Animated.View>
          </Animated.View>

          <View style={styles.selectedLabelContainer}>
            <Text style={styles.selectedTypeLabel}>
              {userTypeConfig[selectedType].label}
            </Text>
          </View>
        </View>

        <View style={styles.titleContainer}>
          <Text style={styles.title}>
            Create Your <Text style={styles.titleHighlight}>BloodBuddy</Text>{" "}
            Account
          </Text>
          <Text style={styles.subtitle}>
            Join the BloodBuddy family - where helping someone is just a
            connection away.
          </Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={[
              styles.input,
              fullNameTouched && fullNameError ? styles.inputError : null,
            ]}
            placeholder="Enter your name"
            placeholderTextColor="#9B7B7F"
            value={fullName}
            onChangeText={(text) => {
              setFullName(text);
              if (fullNameTouched) setFullNameError(validateFullName(text));
            }}
            onBlur={() => {
              setFullNameTouched(true);
              setFullNameError(validateFullName(fullName));
            }}
          />
          {fullNameTouched && !!fullNameError && (
            <Text style={styles.errorText}>{fullNameError}</Text>
          )}

          <Text style={styles.label}>Email</Text>
          <TextInput
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

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWithIcon}>
            <TextInput
              style={[
                styles.input,
                styles.inputFlex,
                passwordTouched && passwordError ? styles.inputError : null,
              ]}
              placeholder="Enter your password"
              placeholderTextColor="#9B7B7F"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (passwordTouched) setPasswordError(validatePassword(text));
              }}
              secureTextEntry={!showPassword}
              onBlur={() => {
                setPasswordTouched(true);
                setPasswordError(validatePassword(password));
              }}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword((prev) => !prev)}
              accessibilityLabel={
                showPassword ? "Hide password" : "Show password"
              }
            >
              <Ionicons
                name={showPassword ? "eye" : "eye-off"}
                size={20}
                color="#6b7280"
              />
            </TouchableOpacity>
          </View>
          {passwordTouched && !!passwordError && (
            <Text style={styles.errorText}>{passwordError}</Text>
          )}

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={[
              styles.input,
              phoneTouched && phoneError ? styles.inputError : null,
            ]}
            placeholder="Enter your phone number"
            placeholderTextColor="#9B7B7F"
            value={phoneNumber}
            onChangeText={(text) => {
              setPhoneNumber(text);
              if (phoneTouched) setPhoneError(validatePhone(text));
            }}
            keyboardType="phone-pad"
            onBlur={() => {
              setPhoneTouched(true);
              setPhoneError(validatePhone(phoneNumber));
            }}
          />
          {phoneTouched && !!phoneError && (
            <Text style={styles.errorText}>{phoneError}</Text>
          )}

          {selectedType === "donor" && (
            <>
              <Text style={styles.label}>Blood Type</Text>
              <TouchableOpacity
                style={[
                  styles.pickerButton,
                  bloodTypeTouched && bloodTypeError ? styles.inputError : null,
                ]}
                onPress={() => {
                  setShowBloodTypePicker(true);
                  setBloodTypeTouched(true);
                }}
              >
                <Text
                  style={[
                    styles.pickerButtonText,
                    !bloodType && styles.placeholderText,
                  ]}
                >
                  {bloodType || "Select your blood type"}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#6b7280" />
              </TouchableOpacity>
              {bloodTypeTouched && !!bloodTypeError && (
                <Text style={styles.errorText}>{bloodTypeError}</Text>
              )}

              <Text style={styles.label}>Location</Text>
              <TextInput
                style={[
                  styles.input,
                  locationTouched && locationError ? styles.inputError : null,
                ]}
                placeholder="Enter your location"
                placeholderTextColor="#9B7B7F"
                value={location}
                onChangeText={(text) => {
                  setLocation(text);
                  if (locationTouched) setLocationError(validateLocation(text));
                }}
                onBlur={() => {
                  setLocationTouched(true);
                  setLocationError(validateLocation(location));
                }}
              />
              {locationTouched && !!locationError && (
                <Text style={styles.errorText}>{locationError}</Text>
              )}

              <Text style={styles.label}>Last Donation Date</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text
                  style={[
                    styles.pickerButtonText,
                    !lastDonationDate && styles.placeholderText,
                  ]}
                >
                  {lastDonationDate
                    ? formatDate(lastDonationDate)
                    : "Select date"}
                </Text>
                <Ionicons name="calendar-outline" size={20} color="#6b7280" />
              </TouchableOpacity>
            </>
          )}

          {selectedType === "gainer" && (
            <>
              <Text style={styles.label}>Address</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  addressTouched && addressError ? styles.inputError : null,
                ]}
                placeholder="Enter your address"
                placeholderTextColor="#9B7B7F"
                value={address}
                onChangeText={(text) => {
                  setAddress(text);
                  if (addressTouched) setAddressError(validateAddress(text));
                }}
                multiline
                numberOfLines={3}
                onBlur={() => {
                  setAddressTouched(true);
                  setAddressError(validateAddress(address));
                }}
              />
              {addressTouched && !!addressError && (
                <Text style={styles.errorText}>{addressError}</Text>
              )}
            </>
          )}

          {selectedType === "organization" && (
            <>
              <Text style={styles.label}>Organization Name</Text>
              <TextInput
                style={[
                  styles.input,
                  organizationNameTouched && organizationNameError
                    ? styles.inputError
                    : null,
                ]}
                placeholder="Enter organization name"
                placeholderTextColor="#9B7B7F"
                value={organizationName}
                onChangeText={(text) => {
                  setOrganizationName(text);
                  if (organizationNameTouched)
                    setOrganizationNameError(validateOrganizationName(text));
                }}
                onBlur={() => {
                  setOrganizationNameTouched(true);
                  setOrganizationNameError(
                    validateOrganizationName(organizationName),
                  );
                }}
              />
              {organizationNameTouched && !!organizationNameError && (
                <Text style={styles.errorText}>{organizationNameError}</Text>
              )}

              <Text style={styles.label}>Location</Text>
              <TouchableOpacity
                style={[
                  styles.input,
                  styles.mapPickerButton,
                  locationTouched && locationError ? styles.inputError : null,
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
              {locationTouched && !!locationError && (
                <Text style={styles.errorText}>{locationError}</Text>
              )}

              <Text style={styles.label}>Contact</Text>
              <TextInput
                style={[
                  styles.input,
                  contactTouched && contactError ? styles.inputError : null,
                ]}
                placeholder="Enter contact number"
                placeholderTextColor="#9B7B7F"
                value={contact}
                onChangeText={(text) => {
                  setContact(text);
                  if (contactTouched) setContactError(validateContact(text));
                }}
                keyboardType="phone-pad"
                onBlur={() => {
                  setContactTouched(true);
                  setContactError(validateContact(contact));
                }}
              />
              {contactTouched && !!contactError && (
                <Text style={styles.errorText}>{contactError}</Text>
              )}
            </>
          )}

          <TouchableOpacity
            style={[
              styles.registerButton,
              (isLoading || !isFormValid()) && styles.registerButtonDisabled,
            ]}
            onPress={handleRegister}
            disabled={isLoading || !isFormValid()}
          >
            <Text style={styles.registerButtonText}>
              {isLoading ? "Registering..." : "Register Now"}
            </Text>
          </TouchableOpacity>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already Registered? </Text>
            <TouchableOpacity onPress={() => router.push("/auth/login")}>
              <Text style={styles.loginLink}>Login</Text>
            </TouchableOpacity>
          </View>
        </View>

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
                      setBloodTypeTouched(true);
                      setBloodTypeError(null);
                      playHaptic();
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

        <Modal
          visible={showOrganizationMapPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowOrganizationMapPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.mapModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Pick Organization Location
                </Text>
                <TouchableOpacity
                  onPress={() => setShowOrganizationMapPicker(false)}
                >
                  <Ionicons name="close-circle" size={28} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <Text style={styles.mapHintText}>
                Search for a place or tap the map to choose the exact
                coordinates of your organization.
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
                    !mapPickerCoordinates && styles.registerButtonDisabled,
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

        {showDatePicker && Platform.OS === "ios" && (
          <Modal visible={showDatePicker} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Date</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.doneButton}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={lastDonationDate || new Date()}
                  mode="date"
                  display="spinner"
                  onChange={(event, date) => {
                    if (date) {
                      setLastDonationDate(date);
                      playHaptic();
                    }
                  }}
                  maximumDate={new Date()}
                  textColor="#000000"
                />
              </View>
            </View>
          </Modal>
        )}

        {showDatePicker && Platform.OS === "android" && (
          <DateTimePicker
            value={lastDonationDate || new Date()}
            mode="date"
            display="default"
            onChange={(event, date) => {
              setShowDatePicker(false);
              if (event.type === "set" && date) {
                setLastDonationDate(date);
                playHaptic();
              }
            }}
            maximumDate={new Date()}
          />
        )}

        {/* OTP verification now handled in /otp screen */}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  contentContainer: {
    paddingTop: 56,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  carouselWrapper: {
    marginBottom: 32,
  },
  swipeHint: {
    textAlign: "center",
    fontSize: 12,
    color: "#8E8E93",
    marginBottom: 16,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  bubblesContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
    height: 140,
    paddingHorizontal: 20,
  },
  bubble: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E8E8E8",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  centerBubble: {
    width: 100,
    height: 100,
    borderRadius: 50,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  bubbleContent: {
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
  },
  bubbleEmoji: {
    fontSize: 36,
  },
  centerEmoji: {
    fontSize: 48,
  },
  bubbleImage: {
    width: "100%",
    height: "100%",
    borderRadius: 40,
  },
  centerImage: {
    width: "100%",
    height: "100%",
    borderRadius: 50,
  },
  selectedLabelContainer: {
    alignItems: "center",
    marginTop: 16,
  },
  selectedTypeLabel: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000",
    letterSpacing: 0.3,
  },
  titleContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    textAlign: "center",
    color: "#000000",
    letterSpacing: -0.5,
  },
  titleHighlight: {
    color: "#D11B31",
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    color: "#8E8E93",
    marginTop: 12,
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  formContainer: {
    width: "100%",
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
  errorText: {
    color: "#dc2626",
    fontSize: 13,
    marginTop: -12,
    marginBottom: 12,
  },
  textArea: {
    height: 90,
    textAlignVertical: "top",
    marginBottom: 20,
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
  pickerButton: {
    backgroundColor: "#FEE2E2",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pickerButtonText: {
    fontSize: 15,
    color: "#333333",
  },
  mapPickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mapPickerButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    marginRight: 10,
  },
  mapPickerButtonText: {
    fontSize: 15,
    color: "#333333",
    flexShrink: 1,
  },
  mapCoordinateText: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: -10,
    marginBottom: 12,
  },
  placeholderText: {
    color: "#9B7B7F",
  },
  registerButton: {
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
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
  },
  loginText: {
    fontSize: 15,
    color: "#666666",
  },
  loginLink: {
    fontSize: 15,
    color: "#D11B31",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: "70%",
  },
  mapModalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 24,
    maxHeight: "88%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000",
  },
  doneButton: {
    fontSize: 17,
    fontWeight: "600",
    color: "#D11B31",
  },
  mapHintText: {
    fontSize: 14,
    color: "#4B5563",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },
  mapSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  mapSearchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 10,
  },
  mapSearchIcon: {
    marginRight: 4,
  },
  mapSearchInput: {
    flex: 1,
    height: 42,
    color: "#111827",
    fontSize: 14,
  },
  searchButton: {
    height: 42,
    borderRadius: 12,
    backgroundColor: "#D11B31",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  searchButtonDisabled: {
    opacity: 0.7,
  },
  searchButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  mapSearchErrorText: {
    color: "#dc2626",
    fontSize: 12,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  mapPickerContainer: {
    height: 360,
    marginHorizontal: 20,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
    marginBottom: 16,
  },
  mapPickerMap: {
    flex: 1,
  },
  mapLoadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  mapLoadingText: {
    marginTop: 10,
    color: "#6B7280",
    fontSize: 13,
    textAlign: "center",
  },
  mapActionsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
  },
  mapActionButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
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
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  mapCancelText: {
    color: "#111827",
  },
  pickerScroll: {
    paddingHorizontal: 20,
  },
  pickerOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  pickerOptionSelected: {
    backgroundColor: "#FEE2E2",
  },
  pickerOptionText: {
    fontSize: 18,
    color: "#000",
    fontWeight: "500",
  },
  pickerOptionTextSelected: {
    color: "#D11B31",
    fontWeight: "700",
  },
  otpModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  otpModalContent: {
    backgroundColor: "#D11B31",
    borderRadius: 32,
    width: "100%",
    maxWidth: 400,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 15,
    position: "relative",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.2)",
    overflow: "hidden",
  },
  otpCloseButton: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 1,
  },
  otpIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  otpIcon: {
    fontSize: 40,
  },
  otpTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  otpSubtitle: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  otpCirclesContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginBottom: 32,
    width: "100%",
  },
  otpCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.5)",
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    padding: 0,
  },
  otpCircleFilled: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  otpVerifyButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    paddingVertical: 16,
    paddingHorizontal: 48,
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  otpVerifyButtonDisabled: {
    opacity: 0.5,
  },
  otpVerifyButtonText: {
    color: "#D11B31",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  otpResendContainer: {
    paddingVertical: 8,
  },
  otpResendText: {
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  otpResendTextDisabled: {
    opacity: 0.5,
    color: "rgba(255, 255, 255, 0.5)",
  },
});
