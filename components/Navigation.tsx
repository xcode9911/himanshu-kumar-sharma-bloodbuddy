import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { API_ENDPOINTS } from "../config/api";
import { connectSocket, getSocket } from "../config/socket";
import EmergencyFAB from "./EmergencyFAB";
import EmergencyModal from "./EmergencyModal";
import EmergencyStatusModal from "./EmergencyStatusModal";
import MapModal from "./MapModal";

const { width } = Dimensions.get("window");
const ACTIVE_BG = "#D11B31";
const ACTIVE_PILL = "#FFFFFF";
const ICON_INACTIVE = "#FFFFFF";
const ICON_ACTIVE = "#D11B31";
const TEXT_ACTIVE = "#D11B31";

const BASE_EMERGENCY_RADIUS_STEPS_KM = [
  { afterMinutes: 0, radiusKm: 5 },
  { afterMinutes: 2, radiusKm: 10 },
  { afterMinutes: 5, radiusKm: 20 },
  { afterMinutes: 10, radiusKm: 30 },
];

const RARE_BLOOD_TYPES = new Set(["O-", "AB-"]);

const buildEmergencyDispatchPlan = (bloodType: string) => {
  if (RARE_BLOOD_TYPES.has((bloodType || "").toUpperCase())) {
    return [
      { afterMinutes: 0, radiusKm: 10 },
      { afterMinutes: 2, radiusKm: 20 },
      { afterMinutes: 5, radiusKm: 30 },
      { afterMinutes: 10, radiusKm: 50 },
    ];
  }

  return BASE_EMERGENCY_RADIUS_STEPS_KM;
};

export type TabKey =
  | "home"
  | "organization"
  | "map"
  | "chat"
  | "profile"
  | "bookings"
  | "inventory"
  | "contact"
  | "history";
export type UserType = "gainer" | "donor" | "organization";

type NavigationProps = {
  userType?: UserType;
  initialTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
};

const tabConfigs: Record<
  UserType,
  { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[]
> = {
  gainer: [
    { key: "home", label: "Home", icon: "home" },
    { key: "organization", label: "B Bank", icon: "business" },
    { key: "chat", label: "Chat", icon: "chatbubble" },
    { key: "contact", label: "Contacts", icon: "people" },
  ],
  donor: [
    { key: "home", label: "Home", icon: "home" },
    { key: "organization", label: "B Bank", icon: "business" },
    { key: "map", label: "Map", icon: "map" },
    { key: "chat", label: "Chat", icon: "chatbubble" },
  ],
  organization: [
    { key: "home", label: "Home", icon: "home" },
    { key: "inventory", label: "Inventory", icon: "layers" },
    { key: "chat", label: "Chat", icon: "chatbubble" },
    { key: "bookings", label: "Bookings", icon: "calendar" },
  ],
};

const tabRouteMap: Record<TabKey, string> = {
  home: "/home",
  organization: "/organization",
  map: "/map",
  chat: "/chat",
  profile: "/profile",
  bookings: "/bookings",
  inventory: "/inventory",
  contact: "/contacts",
  history: "/history",
};

const toFiniteNumber = (value: any) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const normalizeLocationPoint = (location: any) => {
  if (!location || typeof location !== "object") {
    return null;
  }

  const lat = toFiniteNumber(location.lat ?? location.latitude);
  const lng = toFiniteNumber(location.lng ?? location.longitude);

  if (lat === null || lng === null) {
    return null;
  }

  return { lat, lng };
};

const Navigation = ({
  userType: propUserType,
  initialTab,
  onTabChange,
}: NavigationProps) => {
  const router = useRouter();
  const [userType, setUserType] = useState<UserType>(propUserType || "donor");
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab || "home");

  // Emergency States
  const [emergencyModalVisible, setEmergencyModalVisible] = useState(false);
  const [emergencyBloodType, setEmergencyBloodType] = useState("O+");
  const [isEmergencyLoading, setIsEmergencyLoading] = useState(false);
  const [activeEmergencyRequest, setActiveEmergencyRequest] =
    useState<any>(null);
  const [incomingEmergency, setIncomingEmergency] = useState<any>(null);
  const [emergencyStatusModalVisible, setEmergencyStatusModalVisible] =
    useState(false);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [donorLocation, setDonorLocation] = useState<any>(null);
  const [gainerLocation, setGainerLocation] = useState<any>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(
    null,
  );

  // SOS Animation Values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;

  // Load user type from AsyncStorage on mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userData = await AsyncStorage.getItem("userData");
        if (userData) {
          const parsed = JSON.parse(userData);
          const role = (
            parsed.role ||
            parsed.userType ||
            parsed.type ||
            "donor"
          ).toLowerCase();
          setUserType(role as UserType);
          if (parsed.id) {
            connectSocket(parsed.id);
            setupNotifications(role);
            if (role === "gainer" || role === "donor") {
              fetchActiveEmergency(parsed.id, role);
            }
          }
        }
      } catch (error) {
        console.log("Error loading user data:", error);
      }
    };
    loadUserData();
  }, []);

  const setupNotifications = (role: string) => {
    const socket = getSocket();
    if (!socket) return;

    // Donor notifications
    socket.off("newEmergencyRequest");
    if (role === "donor") {
      socket.on("newEmergencyRequest", (data: any) => {
        const normalized = normalizeEmergencyData(data);
        setIncomingEmergency(normalized);
        setEmergencyStatusModalVisible(true);
        startSOSAnimation();
      });
    }

    // Location updates
    socket.off("locationUpdated");
    socket.on("locationUpdated", (data: any) => {
      const nextDonorLocation = normalizeLocationPoint(data?.donorLocation);
      const nextGainerLocation = normalizeLocationPoint(data?.gainerLocation);

      if (nextDonorLocation) setDonorLocation(nextDonorLocation);
      if (nextGainerLocation) setGainerLocation(nextGainerLocation);
    });

    // Gainer notifications
    if (role === "gainer") {
      socket.off("emergencyAccepted");
      socket.on("emergencyAccepted", (data: any) => {
        const name = data.donorName || data.DonorName;
        const phone = data.donorPhone || data.DonorPhone;
        Alert.alert(
          "Emergency Accepted! 🚨",
          `${name} is coming to help! Phone: ${phone}`,
        );
        setActiveEmergencyRequest((prev: any) =>
          normalizeEmergencyData({
            ...prev,
            ...data,
            status: "Accepted",
          }),
        );
        const nextDonorLocation = normalizeLocationPoint(data?.donorLocation);
        const nextGainerLocation = normalizeLocationPoint(data?.gainerLocation);
        if (nextDonorLocation) setDonorLocation(nextDonorLocation);
        if (nextGainerLocation) setGainerLocation(nextGainerLocation);
        startLocationTracking(data.requestId || data.RequestId, "gainer");
      });

      socket.off("emergencyDonorCancelled");
      socket.on("emergencyDonorCancelled", (data: any) => {
        Alert.alert(
          "Donor Backed Out",
          "The donor who accepted your emergency request has cancelled. We are looking for other donors...",
        );
        setActiveEmergencyRequest((prev: any) => ({
          ...normalizeEmergencyData(prev),
          status: "Emergency",
          donorName: null,
          donorPhone: null,
        }));
        setDonorLocation(null);
        stopLocationTracking();
      });
    }
  };

  const startSOSAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 2,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.6,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ).start();
  };

  const normalizeEmergencyData = (data: any) => {
    if (!data) return null;
    return {
      requestId: data.requestId || data.RequestId,
      bloodType: data.bloodType || data.BloodType,
      units: data.units || data.Units,
      status: data.status || data.Status,
      requestDate: data.requestDate || data.RequestDate,
      gainerName: data.gainerName || data.gainer?.user?.FullName,
      donorName: data.donorName || data.DonorName,
      donorPhone: data.donorPhone || data.DonorPhone,
      organizationName:
        data.organizationName ||
        data.organization?.OrganizationName ||
        data.organization?.organizationName,
      donorLocation: normalizeLocationPoint(data.donorLocation),
      gainerLocation: normalizeLocationPoint(data.gainerLocation),
    };
  };

  const openEmergencyTrackingMap = async () => {
    const displayData =
      userType === "gainer" ? activeEmergencyRequest : incomingEmergency;
    const requestIdValue = toFiniteNumber(
      displayData?.requestId ?? displayData?.RequestId,
    );

    if (requestIdValue === null) {
      Alert.alert("Map Unavailable", "No active emergency request found.");
      return;
    }

    const requestId = Number(requestIdValue);
    let nextDonorLocation = normalizeLocationPoint(donorLocation);
    let nextGainerLocation = normalizeLocationPoint(gainerLocation);

    try {
      const token = await AsyncStorage.getItem("authToken");
      if (token) {
        const response = await fetch(
          API_ENDPOINTS.GET_EMERGENCY_LOCATION(requestId),
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (response.ok) {
          const data = await response.json();
          const fetchedDonorLocation = normalizeLocationPoint(
            data?.donorLocation,
          );
          const fetchedGainerLocation = normalizeLocationPoint(
            data?.gainerLocation,
          );

          if (fetchedDonorLocation) {
            nextDonorLocation = fetchedDonorLocation;
          }

          if (fetchedGainerLocation) {
            nextGainerLocation = fetchedGainerLocation;
          }
        }
      }
    } catch (error) {
      console.log(
        "Failed to refresh emergency locations before map open:",
        error,
      );
    }

    if (!nextDonorLocation || !nextGainerLocation) {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const position = await Location.getCurrentPositionAsync({});
          const currentPoint = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          if (userType === "donor" && !nextDonorLocation) {
            nextDonorLocation = currentPoint;
          }

          if (userType === "gainer" && !nextGainerLocation) {
            nextGainerLocation = currentPoint;
          }
        }
      } catch (error) {
        console.log(
          "Failed to fetch current location before opening map:",
          error,
        );
      }
    }

    if (nextDonorLocation) {
      setDonorLocation(nextDonorLocation);
    }

    if (nextGainerLocation) {
      setGainerLocation(nextGainerLocation);
    }

    setEmergencyStatusModalVisible(false);
    setMapModalVisible(true);
  };

  const fetchActiveEmergency = async (
    userId: string | number,
    role?: string,
  ) => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) return;

      const response = await fetch(API_ENDPOINTS.GET_USER_BOOKINGS(userId), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok && data.requests) {
        const active = data.requests.find(
          (r: any) => r.Status === "Emergency" || r.Status === "Accepted",
        );
        if (active) {
          const normalized = normalizeEmergencyData(active);
          if (!normalized) return;

          // Map donor details if accepted
          if (normalized.status === "Accepted") {
            if (role === "gainer" && active.donorResponses?.length > 0) {
              const donorInfo = active.donorResponses[0].donor?.user;
              normalized.donorName = donorInfo?.FullName;
              normalized.donorPhone = donorInfo?.Phone;
              setActiveEmergencyRequest(normalized);
            } else if (role === "donor") {
              setIncomingEmergency(normalized);
            } else {
              setActiveEmergencyRequest(normalized);
            }
          } else {
            if (role === "gainer") setActiveEmergencyRequest(normalized);
            if (role === "donor") {
              setIncomingEmergency(normalized);
              startSOSAnimation();
            }
          }
        }
      }
    } catch (error) {
      console.log("Error fetching active emergency:", error);
    }
  };

  const startLocationTracking = async (
    requestId: number,
    role: "donor" | "gainer",
  ) => {
    try {
      if (locationSubscription.current) return;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 3,
          timeInterval: 1500,
        },
        async (location) => {
          const { latitude, longitude } = location.coords;
          if (role === "donor")
            setDonorLocation({ lat: latitude, lng: longitude });
          else setGainerLocation({ lat: latitude, lng: longitude });

          // Send to backend
          const token = await AsyncStorage.getItem("authToken");
          if (token) {
            fetch(API_ENDPOINTS.UPDATE_EMERGENCY_LOCATION(requestId), {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ latitude, longitude, role }),
            });
          }
        },
      );
    } catch (error) {
      console.log("Error starting location tracking:", error);
    }
  };

  const stopLocationTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
  };

  useEffect(() => {
    return () => stopLocationTracking();
  }, []);

  const handleCreateEmergency = async () => {
    try {
      setIsEmergencyLoading(true);
      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
        Alert.alert("Error", "Authentication failed. Please login again.");
        return;
      }

      let latitude: number | undefined;
      let longitude: number | undefined;

      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          permission = await Location.requestForegroundPermissionsAsync();
        }

        if (permission.status === "granted") {
          const location = await Location.getCurrentPositionAsync({});
          latitude = location.coords.latitude;
          longitude = location.coords.longitude;
        }
      } catch (locationError) {
        console.warn(
          "Could not fetch gainer location while creating emergency:",
          locationError,
        );
      }

      const dispatchPlan = buildEmergencyDispatchPlan(emergencyBloodType);
      const response = await fetch(API_ENDPOINTS.CREATE_EMERGENCY, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bloodType: emergencyBloodType,
          units: 1,
          dispatchMode: "progressive-radius",
          dispatchPlan,
          ...(latitude !== undefined && longitude !== undefined
            ? { latitude, longitude }
            : {}),
        }),
      });

      const data = await response.json();
      if (response.ok) {
        Alert.alert("Success", "Emergency blood request broadcasted!");
        setEmergencyModalVisible(false);
        setActiveEmergencyRequest(normalizeEmergencyData(data.request));
      } else {
        Alert.alert(
          "Error",
          data.message || "Failed to create emergency request",
        );
      }
    } catch (error) {
      Alert.alert("Error", "Something went wrong");
    } finally {
      setIsEmergencyLoading(false);
    }
  };

  const handleStopEmergency = async () => {
    if (!activeEmergencyRequest) return;
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) return;
      const response = await fetch(
        API_ENDPOINTS.STOP_EMERGENCY(
          activeEmergencyRequest.requestId || activeEmergencyRequest.RequestId,
        ),
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.ok) {
        Alert.alert("Stopped", "Emergency request has been stopped.");
        setActiveEmergencyRequest(null);
        stopLocationTracking();
      }
    } catch (error) {
      Alert.alert("Error", "Something went wrong");
    } finally {
      stopLocationTracking();
    }
  };

  const handleAcceptEmergency = async (requestId: number) => {
    Alert.alert(
      "Share Location",
      "To help the gainer track you, we need to share your current location. Do you agree?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Agree & Accept",
          onPress: async () => {
            try {
              const { status } =
                await Location.requestForegroundPermissionsAsync();
              if (status !== "granted") {
                Alert.alert(
                  "Permission Denied",
                  "Location permission is required to accept emergency requests.",
                );
                return;
              }

              const location = await Location.getCurrentPositionAsync({});
              const { latitude, longitude } = location.coords;

              const token = await AsyncStorage.getItem("authToken");
              if (!token) return;

              const response = await fetch(
                API_ENDPOINTS.ACCEPT_EMERGENCY(requestId),
                {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ latitude, longitude }),
                },
              );

              if (response.ok) {
                Alert.alert(
                  "Accepted",
                  "The gainer has been notified with your live location.",
                );
                // Keep it in incomingEmergency so they can see the status and "Cancel Help"
                setIncomingEmergency((prev: any) =>
                  normalizeEmergencyData({
                    ...prev,
                    status: "Accepted",
                  }),
                );
                setEmergencyStatusModalVisible(true); // Keep it open to show status
                startLocationTracking(requestId, "donor");
              }
            } catch (error) {
              Alert.alert(
                "Error",
                "Something went wrong fetching location or accepting request",
              );
            }
          },
        },
      ],
    );
  };
  const handleCancelEmergency = async (requestId: number) => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) return;

      const response = await fetch(API_ENDPOINTS.CANCEL_EMERGENCY(requestId), {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        Alert.alert(
          "Cancelled",
          "You have cancelled your help. The request is visible to others again.",
        );
        setEmergencyStatusModalVisible(false);
        setIncomingEmergency(null);
        setDonorLocation(null);
        stopLocationTracking();
      }
    } catch (error) {
      Alert.alert("Error", "Something went wrong");
    }
  };

  const tabs = tabConfigs[userType] || tabConfigs.donor;

  // Update active tab when initialTab changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handlePress = (tab: TabKey) => {
    setActiveTab(tab);
    if (onTabChange) {
      onTabChange(tab);
      return;
    }

    const targetRoute = tabRouteMap[tab];
    if (targetRoute) {
      router.push(targetRoute as any);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              testID={`navTab_${tab.key}`}
              style={styles.tab}
              activeOpacity={0.9}
              onPress={() => handlePress(tab.key)}
            >
              {isActive ? (
                <View style={styles.activePill}>
                  <Ionicons name={tab.icon} size={20} color={ICON_ACTIVE} />
                  <Text style={styles.activeLabel}>{tab.label}</Text>
                </View>
              ) : (
                <View style={styles.inactiveIconWrap}>
                  <Ionicons name={tab.icon} size={20} color={ICON_INACTIVE} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Emergency Components */}
      {(userType === "gainer" || userType === "donor") && (
        <EmergencyFAB
          isActive={userType === "gainer" && !!activeEmergencyRequest}
          isAlert={userType === "donor" && !!incomingEmergency}
          onPress={() => {
            if (userType === "gainer") {
              if (activeEmergencyRequest) {
                setEmergencyStatusModalVisible(true);
              } else {
                setEmergencyModalVisible(true);
              }
            } else if (userType === "donor") {
              if (incomingEmergency) {
                setEmergencyStatusModalVisible(true);
              } else {
                Alert.alert(
                  "No Emergency",
                  "There are no incoming emergency requests at the moment.",
                );
              }
            }
          }}
        />
      )}

      <EmergencyModal
        visible={emergencyModalVisible}
        onClose={() => setEmergencyModalVisible(false)}
        onConfirm={handleCreateEmergency}
        loading={isEmergencyLoading}
        bloodType={emergencyBloodType}
        setBloodType={setEmergencyBloodType}
      />

      <EmergencyStatusModal
        visible={emergencyStatusModalVisible}
        onClose={() => setEmergencyStatusModalVisible(false)}
        role={userType as "gainer" | "donor"}
        activeEmergency={activeEmergencyRequest}
        incomingEmergency={incomingEmergency}
        onStop={() => {
          handleStopEmergency();
          setEmergencyStatusModalVisible(false);
        }}
        onAccept={handleAcceptEmergency}
        onCancel={handleCancelEmergency}
        onTrackLocation={openEmergencyTrackingMap}
      />

      <MapModal
        visible={mapModalVisible}
        onClose={() => setMapModalVisible(false)}
        donorLocation={donorLocation}
        gainerLocation={gainerLocation}
        donorName={
          userType === "gainer" ? activeEmergencyRequest?.donorName : "You"
        }
        gainerName={
          userType === "donor" ? incomingEmergency?.gainerName : "You"
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: ACTIVE_BG,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    minHeight: 50,
  },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: ACTIVE_PILL,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    maxWidth: "100%",
  },
  activeLabel: {
    color: TEXT_ACTIVE,
    fontSize: 12,
    fontWeight: "700",
  },
  inactiveIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default Navigation;
