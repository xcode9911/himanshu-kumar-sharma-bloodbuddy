import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useImage } from "expo-image";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Linking,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_ENDPOINTS } from "../../config/api";
import {
    loadExpoMapsModule,
    type AppleMapProps,
    type GoogleMapMarker,
    type GoogleMapProps,
} from "../../utils/expoMapsRuntime";
import { moderateScale, scale, verticalScale } from "../../utils/responsive";

type UserType = "gainer" | "donor" | "organization";

interface BloodBank {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  distance: number;
  bloodTypes: string[];
  phone?: string;
}

interface MapScreenProps {
  hideNavigation?: boolean;
}

const NEPAL_DEFAULT = {
  latitude: 27.7172,
  longitude: 85.324,
};

const OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving";
const CAMPAIGN_DESTINATION_ID = "campaign-destination";

const isValidCoordinates = (latitude: number, longitude: number) => {
  return Number.isFinite(latitude) && Number.isFinite(longitude);
};

const truncateText = (value: string, maxLength = 56) => {
  if (!value) return "";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}...`;
};

const estimateDistanceKm = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) => {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371;

  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);

  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const haversine =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return earthRadius * c;
};

export default function MapScreen(_props: MapScreenProps = {}) {
  const router = useRouter();
  const params = useLocalSearchParams();
  const expoMapsModule = loadExpoMapsModule();
  const AppleMapsView = expoMapsModule?.AppleMaps?.View;
  const GoogleMapsView = expoMapsModule?.GoogleMaps?.View;
  const insets = useSafeAreaInsets();
  const [bloodBanks, setBloodBanks] = useState<BloodBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState<UserType>("donor");
  const [selectedBank, setSelectedBank] = useState<BloodBank | null>(null);
  const [campaignDestination, setCampaignDestination] =
    useState<BloodBank | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [topControlsWidth, setTopControlsWidth] = useState(0);
  const [isBankDropdownOpen, setIsBankDropdownOpen] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<
    Array<{ latitude: number; longitude: number }>
  >([]);
  const [routeTargetBankId, setRouteTargetBankId] = useState<string | null>(
    null,
  );
  const [roadRouteSummary, setRoadRouteSummary] = useState<{
    distanceKm: number;
    durationMin: number;
  } | null>(null);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const mapRef = useRef<any>(null);
  const topSearchInputRef = useRef<TextInput | null>(null);
  const topSearchAnim = useRef(new Animated.Value(0)).current;
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);
  const lastRerouteAtRef = useRef(0);
  const lastRerouteOriginRef = useRef<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const routeRequestIdRef = useRef(0);
  const hasHandledIncomingDestinationRef = useRef(false);
  const organizationMarkerIcon = useImage(
    require("../../assets/images/logo.png"),
    { maxWidth: 56, maxHeight: 56 },
  );

  const getSingleParam = (value: string | string[] | undefined): string => {
    if (Array.isArray(value)) {
      return value[0] ?? "";
    }
    return value ?? "";
  };

  const incomingDestinationName = getSingleParam(
    params.destinationName as string | string[] | undefined,
  );
  const incomingDestinationAddress = getSingleParam(
    params.destinationAddress as string | string[] | undefined,
  );
  const incomingDestinationLatitude = params.destinationLatitude
    ? Number(getSingleParam(params.destinationLatitude as any))
    : NaN;
  const incomingDestinationLongitude = params.destinationLongitude
    ? Number(getSingleParam(params.destinationLongitude as any))
    : NaN;

  useEffect(() => {
    loadUserData();
    getCurrentLocation();
    loadBloodBanks();
  }, []);

  useEffect(() => {
    return () => {
      if (locationWatchRef.current) {
        locationWatchRef.current.remove();
        locationWatchRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedBank || !mapRef.current?.setCameraPosition) {
      return;
    }

    const nextCamera =
      Platform.OS === "android"
        ? {
            coordinates: {
              latitude: selectedBank.latitude,
              longitude: selectedBank.longitude,
            },
            zoom: 14,
            duration: 350,
          }
        : {
            coordinates: {
              latitude: selectedBank.latitude,
              longitude: selectedBank.longitude,
            },
            zoom: 14,
          };

    mapRef.current.setCameraPosition(nextCamera);
  }, [selectedBank]);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return null;

      const location = await Location.getCurrentPositionAsync({});
      const coordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setUserLocation(coordinates);
      return coordinates;
    } catch (error) {
      console.log("Error getting location:", error);
      return null;
    }
  };

  const clearRoute = () => {
    if (locationWatchRef.current) {
      locationWatchRef.current.remove();
      locationWatchRef.current = null;
    }
    routeRequestIdRef.current += 1;
    lastRerouteAtRef.current = 0;
    lastRerouteOriginRef.current = null;
    setRouteCoordinates([]);
    setRoadRouteSummary(null);
    setRouteTargetBankId(null);
  };

  const focusRouteCamera = (
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
  ) => {
    if (!mapRef.current?.setCameraPosition) {
      return;
    }

    const distanceKm = estimateDistanceKm(origin, destination);
    const zoom =
      distanceKm > 18 ? 10 : distanceKm > 8 ? 11 : distanceKm > 3 ? 12 : 13;

    const midpoint = {
      latitude: (origin.latitude + destination.latitude) / 2,
      longitude: (origin.longitude + destination.longitude) / 2,
    };

    const nextCamera =
      Platform.OS === "android"
        ? {
            coordinates: midpoint,
            zoom,
            duration: 350,
          }
        : {
            coordinates: midpoint,
            zoom,
          };

    mapRef.current.setCameraPosition(nextCamera);
  };

  const fetchRoadRoute = async (
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
  ) => {
    const url = `${OSRM_BASE_URL}/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson&steps=false&alternatives=false`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch road route");
    }

    const data = await response.json().catch(() => null);
    const route = data?.routes?.[0];
    const geometry = route?.geometry?.coordinates;

    if (!Array.isArray(geometry) || geometry.length < 2) {
      throw new Error("No route geometry available");
    }

    const coordinates = geometry
      .filter(
        (point: unknown) =>
          Array.isArray(point) &&
          point.length >= 2 &&
          Number.isFinite(Number(point[0])) &&
          Number.isFinite(Number(point[1])),
      )
      .map((point: any) => ({
        latitude: Number(point[1]),
        longitude: Number(point[0]),
      }));

    if (coordinates.length < 2) {
      throw new Error("No valid route coordinates");
    }

    const distanceKm = Number(route?.distance || 0) / 1000;
    const durationMin = Number(route?.duration || 0) / 60;

    return {
      coordinates,
      distanceKm,
      durationMin,
    };
  };

  const updateRoutePath = async (
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    options?: { force?: boolean },
  ) => {
    const now = Date.now();
    const previousOrigin = lastRerouteOriginRef.current;
    const movedKm = previousOrigin
      ? estimateDistanceKm(previousOrigin, origin)
      : Number.POSITIVE_INFINITY;

    if (!options?.force) {
      const rerouteTooSoon = now - lastRerouteAtRef.current < 10000;
      const movedTooLittle = movedKm < 0.05;
      if (rerouteTooSoon && movedTooLittle) {
        return;
      }
    }

    const requestId = ++routeRequestIdRef.current;

    try {
      const roadRoute = await fetchRoadRoute(origin, destination);
      if (requestId !== routeRequestIdRef.current) {
        return;
      }

      setRouteCoordinates(roadRoute.coordinates);
      setRoadRouteSummary({
        distanceKm: roadRoute.distanceKm,
        durationMin: roadRoute.durationMin,
      });
      lastRerouteAtRef.current = now;
      lastRerouteOriginRef.current = origin;
    } catch (error) {
      if (requestId !== routeRequestIdRef.current) {
        return;
      }

      // Fallback to a direct straight-line route if road routing fails or is unreachable
      setRouteCoordinates([origin, destination]);
      setRoadRouteSummary({
        distanceKm: estimateDistanceKm(origin, destination),
        durationMin: Math.max(
          1,
          (estimateDistanceKm(origin, destination) / 30) * 60,
        ),
      });

      lastRerouteAtRef.current = now;
      lastRerouteOriginRef.current = origin;
    }
  };

  const startRealtimeRouteTracking = async (destination: {
    latitude: number;
    longitude: number;
  }) => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      return;
    }

    if (locationWatchRef.current) {
      locationWatchRef.current.remove();
      locationWatchRef.current = null;
    }

    locationWatchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 3,
        timeInterval: 1500,
      },
      (position) => {
        const current = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setUserLocation(current);
        focusRouteCamera(current, destination);
        void updateRoutePath(current, destination);
      },
    );
  };

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem("userData");
      if (userData) {
        const parsed = JSON.parse(userData);
        setUserType((parsed.role || "donor").toLowerCase());
      }
    } catch (error) {
      console.log("Error loading user data:", error);
    }
  };

  const loadBloodBanks = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("authToken");

      const response = await fetch(API_ENDPOINTS.GET_ORGANIZATIONS, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await response.json().catch(() => null);
      const list =
        data?.organizations || data?.data || (Array.isArray(data) ? data : []);

      const normalized: BloodBank[] = Array.isArray(list)
        ? list.reduce((acc: BloodBank[], org: any) => {
            const inventory = Array.isArray(org.inventory) ? org.inventory : [];
            const latitude = Number(org.Latitude || org.latitude);
            const longitude = Number(org.Longitude || org.longitude);

            if (!isValidCoordinates(latitude, longitude)) {
              return acc;
            }

            acc.push({
              id: String(org.organizationId || org.id),
              name: org.organizationName || org.name || "Unknown",
              latitude,
              longitude,
              address: org.location || org.address || "",
              distance: Number(org.distance) || 0,
              bloodTypes: inventory.map((item: any) => item.bloodType),
              phone: org.phone || org.contact || "",
            });

            return acc;
          }, [])
        : [];

      setBloodBanks(normalized);
      setSelectedBank(null);
    } catch (error) {
      console.log("Error loading blood banks:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredBloodBanks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return bloodBanks;
    }

    return bloodBanks.filter((bank) => {
      const searchable = [
        bank.name,
        bank.address,
        bank.phone || "",
        bank.bloodTypes.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(q);
    });
  }, [bloodBanks, searchQuery]);

  const displayBanks = useMemo(() => {
    if (campaignDestination) {
      return [campaignDestination];
    }
    return filteredBloodBanks;
  }, [campaignDestination, filteredBloodBanks]);

  const getDistanceForBank = (bank: BloodBank): number | null => {
    if (userLocation) {
      return estimateDistanceKm(userLocation, {
        latitude: bank.latitude,
        longitude: bank.longitude,
      });
    }

    if (bank.distance > 0) {
      return bank.distance;
    }

    return null;
  };

  const formatDistanceLabel = (
    distanceKm: number | null,
    includeAway = true,
  ): string => {
    if (distanceKm === null || !Number.isFinite(distanceKm)) {
      return includeAway ? "Distance unavailable" : "Distance N/A";
    }

    const rounded =
      distanceKm < 10 ? distanceKm.toFixed(1) : distanceKm.toFixed(0);
    return includeAway ? `${rounded} km away` : `${rounded} km`;
  };

  const activeRouteDistanceKm = useMemo(() => {
    if (!selectedBank || routeTargetBankId !== selectedBank.id) {
      return null;
    }

    if (
      roadRouteSummary &&
      Number.isFinite(roadRouteSummary.distanceKm) &&
      roadRouteSummary.distanceKm > 0
    ) {
      return roadRouteSummary.distanceKm;
    }

    return getDistanceForBank(selectedBank);
  }, [routeTargetBankId, selectedBank, userLocation, roadRouteSummary]);

  const activeRouteEtaMin = useMemo(() => {
    if (
      roadRouteSummary &&
      Number.isFinite(roadRouteSummary.durationMin) &&
      roadRouteSummary.durationMin > 0
    ) {
      return Math.max(1, Math.round(roadRouteSummary.durationMin));
    }

    if (activeRouteDistanceKm === null) {
      return null;
    }

    // Approximate city traffic pace.
    return Math.max(1, Math.round((activeRouteDistanceKm / 32) * 60));
  }, [activeRouteDistanceKm, roadRouteSummary]);

  const initialCoordinates = useMemo(() => {
    if (userLocation) return userLocation;
    if (filteredBloodBanks.length > 0) {
      return {
        latitude: filteredBloodBanks[0].latitude,
        longitude: filteredBloodBanks[0].longitude,
      };
    }
    return NEPAL_DEFAULT;
  }, [filteredBloodBanks, userLocation]);

  useEffect(() => {
    if (!selectedBank) {
      clearRoute();
      return;
    }

    const isVisible = displayBanks.some((bank) => bank.id === selectedBank.id);
    if (!isVisible) {
      setSelectedBank(null);
      clearRoute();
    }
  }, [displayBanks, selectedBank]);

  useEffect(() => {
    if (hasHandledIncomingDestinationRef.current) {
      return;
    }

    const hasValidCoordinates =
      Number.isFinite(incomingDestinationLatitude) &&
      Number.isFinite(incomingDestinationLongitude);
    const hasDestinationInput =
      hasValidCoordinates || !!incomingDestinationAddress;

    if (!hasDestinationInput) {
      return;
    }

    hasHandledIncomingDestinationRef.current = true;

    const openIncomingDestination = async () => {
      let destination = hasValidCoordinates
        ? {
            latitude: incomingDestinationLatitude,
            longitude: incomingDestinationLongitude,
          }
        : null;

      if (!destination && incomingDestinationAddress) {
        const geocoded = await Location.geocodeAsync(incomingDestinationAddress)
          .then((results) => results?.[0] || null)
          .catch(() => null);

        if (geocoded) {
          destination = {
            latitude: geocoded.latitude,
            longitude: geocoded.longitude,
          };
        }
      }

      if (!destination) {
        Alert.alert(
          "Directions unavailable",
          "Could not find this campaign location on the map.",
        );
        return;
      }

      const destinationBank: BloodBank = {
        id: CAMPAIGN_DESTINATION_ID,
        name: incomingDestinationName || "Campaign Location",
        latitude: destination.latitude,
        longitude: destination.longitude,
        address: incomingDestinationAddress || "Campaign location",
        distance: 0,
        bloodTypes: [],
      };

      setCampaignDestination(destinationBank);
      setSelectedBank(destinationBank);
      setIsBankDropdownOpen(false);
      closeTopSearch();

      const currentLocation = userLocation || (await getCurrentLocation());
      if (!currentLocation) {
        Alert.alert(
          "Location Required",
          "Enable location permission to show in-app directions.",
        );
        return;
      }

      clearRoute();
      setRouteTargetBankId(destinationBank.id);
      focusRouteCamera(currentLocation, destination);
      await updateRoutePath(currentLocation, destination, { force: true });
      await startRealtimeRouteTracking(destination);
    };

    void openIncomingDestination();
  }, [
    incomingDestinationAddress,
    incomingDestinationLatitude,
    incomingDestinationLongitude,
    incomingDestinationName,
    userLocation,
  ]);

  const appleRoutePolylines = useMemo<
    NonNullable<AppleMapProps["polylines"]>
  >(() => {
    if (routeCoordinates.length < 2) {
      return [];
    }

    return [
      {
        id: "route",
        coordinates: routeCoordinates,
        color: "#2563EB",
        width: 6,
      },
    ];
  }, [routeCoordinates]);

  const googleRoutePolylines = useMemo<
    NonNullable<GoogleMapProps["polylines"]>
  >(() => {
    if (routeCoordinates.length < 2) {
      return [];
    }

    return [
      {
        id: "route",
        coordinates: routeCoordinates,
        color: "#2563EB",
        width: 6,
      },
    ];
  }, [routeCoordinates]);

  const appleAnnotations: AppleMapMarker[] = useMemo(() => {
    return displayBanks.map((bank) => {
      const isCampaign = bank.id === CAMPAIGN_DESTINATION_ID;

      const annotation: any = {
        id: bank.id,
        title: bank.name,
        coordinates: {
          latitude: bank.latitude,
          longitude: bank.longitude,
        },
        tintColor:
          selectedBank?.id === bank.id && !isCampaign ? "#059669" : "#D11B31",
      };

      if (!isCampaign) {
        if (organizationMarkerIcon) {
          annotation.icon = organizationMarkerIcon;
        } else {
          annotation.systemImage = "drop.fill";
        }
      } else {
        annotation.systemImage = "mappin.and.ellipse";
      }

      return annotation;
    });
  }, [displayBanks, organizationMarkerIcon, selectedBank?.id]);

  const googleMarkers: GoogleMapMarker[] = useMemo(() => {
    return displayBanks.map((bank) => {
      const isCampaign = bank.id === CAMPAIGN_DESTINATION_ID;

      const marker: any = {
        id: bank.id,
        title: bank.name,
        coordinates: {
          latitude: bank.latitude,
          longitude: bank.longitude,
        },
        color:
          selectedBank?.id === bank.id && !isCampaign ? "#059669" : "#D11B31",
        zIndex: selectedBank?.id === bank.id ? 2 : 1,
      };

      if (!isCampaign && organizationMarkerIcon) {
        marker.icon = organizationMarkerIcon;
        marker.anchor = { x: 0.5, y: 0.5 };
      }

      return marker;
    });
  }, [displayBanks, organizationMarkerIcon, selectedBank?.id]);

  const handleMapMarkerClick = (markerId?: string) => {
    if (!markerId) return;
    const bank = displayBanks.find((entry) => entry.id === markerId);
    if (bank) {
      setSelectedBank(bank);
      setIsBankDropdownOpen(false);
      clearRoute();
    }
  };

  const handleBottomBankPress = (bank: BloodBank) => {
    setSelectedBank(bank);
    setIsBankDropdownOpen(false);
    clearRoute();
  };

  const openTopSearch = () => {
    setIsBankDropdownOpen(false);
    setIsSearchOpen(true);
    Animated.timing(topSearchAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      topSearchInputRef.current?.focus();
    });
  };

  const closeTopSearch = (options?: { clearQuery?: boolean }) => {
    Animated.timing(topSearchAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      setIsSearchOpen(false);
      if (options?.clearQuery ?? true) {
        setSearchQuery("");
      }
    });
  };

  const handleCallPress = async (phone: string) => {
    try {
      const rawNumber = String(phone || "").trim();
      const dialableNumber = rawNumber
        .replace(/[^\d+]/g, "")
        .replace(/(?!^)\+/g, "");

      if (!dialableNumber) {
        Alert.alert("Phone Unavailable", "No contact number found.");
        return;
      }

      const telUrl = `tel:${dialableNumber}`;
      const canUseTel = await Linking.canOpenURL(telUrl);

      if (!canUseTel) {
        Alert.alert(
          "Unable to Call",
          `Call this number manually: ${dialableNumber}`,
        );
        return;
      }

      await Linking.openURL(telUrl);
    } catch (error) {
      const rawNumber = String(phone || "").trim();
      const dialableNumber = rawNumber
        .replace(/[^\d+]/g, "")
        .replace(/(?!^)\+/g, "");

      Alert.alert(
        "Unable to Call",
        dialableNumber
          ? `Call this number manually: ${dialableNumber}`
          : "No contact number found.",
      );
    }
  };

  const handleDirectionsPress = async () => {
    if (!selectedBank) {
      return;
    }

    if (routeTargetBankId === selectedBank.id) {
      clearRoute();
      return;
    }

    const currentLocation = userLocation || (await getCurrentLocation());
    if (!currentLocation) {
      Alert.alert(
        "Location Required",
        "Enable location permission to show directions in map.",
      );
      return;
    }

    const destinationCoordinates = {
      latitude: selectedBank.latitude,
      longitude: selectedBank.longitude,
    };

    setRouteTargetBankId(selectedBank.id);
    focusRouteCamera(currentLocation, destinationCoordinates);
    await updateRoutePath(currentLocation, destinationCoordinates, {
      force: true,
    });
    await startRealtimeRouteTracking(destinationCoordinates);
  };

  const renderMap = () => {
    if (Platform.OS === "ios" && AppleMapsView) {
      return (
        <AppleMapsView
          ref={(ref) => {
            mapRef.current = ref;
          }}
          style={styles.mapView}
          cameraPosition={{ coordinates: initialCoordinates, zoom: 12 }}
          markers={appleAnnotations}
          polylines={appleRoutePolylines}
          uiSettings={{
            compassEnabled: true,
            myLocationButtonEnabled: true,
            scaleBarEnabled: true,
          }}
          properties={{
            isMyLocationEnabled: true,
          }}
          onMarkerClick={(event) => handleMapMarkerClick(event.id)}
          onMapClick={() => {
            setSelectedBank(null);
            setIsBankDropdownOpen(false);
            clearRoute();
          }}
        />
      );
    }

    if (Platform.OS === "android" && GoogleMapsView) {
      return (
        <GoogleMapsView
          ref={(ref) => {
            mapRef.current = ref;
          }}
          style={styles.mapView}
          cameraPosition={{ coordinates: initialCoordinates, zoom: 12 }}
          markers={googleMarkers}
          polylines={googleRoutePolylines}
          uiSettings={{
            compassEnabled: true,
            myLocationButtonEnabled: true,
            scaleBarEnabled: true,
            zoomControlsEnabled: false,
          }}
          properties={{
            isMyLocationEnabled: true,
          }}
          onMarkerClick={(event) => handleMapMarkerClick(event.id)}
          onMapClick={() => {
            setSelectedBank(null);
            setIsBankDropdownOpen(false);
            clearRoute();
          }}
        />
      );
    }

    return (
      <View style={styles.unsupportedContainer}>
        <Ionicons name="map-outline" size={34} color="#9CA3AF" />
        <Text style={styles.unsupportedText}>
          Map module is unavailable in this build.
        </Text>
        <Text style={styles.unsupportedText}>
          Rebuild using expo run:ios or expo run:android.
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D11B31" />
        <Text style={styles.loadingText}>Loading blood banks...</Text>
      </View>
    );
  }

  const showDonorBankRail =
    userType === "donor" &&
    filteredBloodBanks.length > 0 &&
    !campaignDestination;
  const navOverlayHeight = verticalScale(74) + insets.bottom;
  const bankCardBottom = navOverlayHeight - verticalScale(6);
  const miniRouteBottom = verticalScale(100);
  const isRouteActiveForSelectedBank =
    !!selectedBank && routeTargetBankId === selectedBank.id;
  const isCampaignDestinationSelected =
    selectedBank?.id === CAMPAIGN_DESTINATION_ID;

  const activeBankLabel = selectedBank
    ? selectedBank.name
    : "All nearby blood banks";

  const liveCenterText =
    routeTargetBankId && selectedBank
      ? `LIVE • ${formatDistanceLabel(activeRouteDistanceKm, false)}${
          activeRouteEtaMin !== null ? ` • ${activeRouteEtaMin} min` : ""
        }`
      : "LIVE MAP";

  const collapsedSearchWidth = moderateScale(52);
  const expandedSearchWidth = Math.max(collapsedSearchWidth, topControlsWidth);
  const animatedTopSearchWidth = topSearchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [collapsedSearchWidth, expandedSearchWidth],
  });
  const trimmedSearchQuery = searchQuery.trim();
  const showSearchSuggestions = isSearchOpen && trimmedSearchQuery.length > 0;
  const suggestionBanks = filteredBloodBanks.slice(0, 6);

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.headerRow}>
          {router.canGoBack() && (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={32} color="#D11B31" />
            </TouchableOpacity>
          )}
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>
              {campaignDestination ? "Campaign Location" : "Live Map"}
            </Text>
            <Text style={styles.headerSubtitle}>
              {campaignDestination
                ? "Navigate to the campaign"
                : "Find and navigate to nearby blood banks"}
            </Text>
          </View>
        </View>

        {showDonorBankRail && (
          <View
            style={styles.topControlsRow}
            onLayout={(event) => {
              setTopControlsWidth(event.nativeEvent.layout.width);
            }}
          >
            <View style={styles.dropdownContainer}>
              <TouchableOpacity
                style={styles.dropdown}
                activeOpacity={0.8}
                onPress={() => {
                  if (!isSearchOpen) {
                    setIsBankDropdownOpen((open) => !open);
                  }
                }}
              >
                <Text style={styles.dropdownText} numberOfLines={1}>
                  {truncateText(activeBankLabel, 38)}
                </Text>
                <Ionicons
                  name={isBankDropdownOpen ? "chevron-up" : "chevron-down"}
                  size={moderateScale(18)}
                  color="#D11B31"
                  style={{ marginLeft: scale(8) }}
                />
              </TouchableOpacity>

              {isBankDropdownOpen && (
                <View style={styles.dropdownList}>
                  <TouchableOpacity
                    style={[
                      styles.dropdownItem,
                      !selectedBank && styles.dropdownItemActive,
                      styles.dropdownItemBorder,
                    ]}
                    onPress={() => {
                      setSelectedBank(null);
                      setIsBankDropdownOpen(false);
                      clearRoute();
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownItemName,
                        !selectedBank && styles.dropdownItemNameActive,
                      ]}
                    >
                      All nearby blood banks
                    </Text>
                    {!selectedBank && (
                      <Ionicons
                        name="checkmark"
                        size={moderateScale(20)}
                        color="#FFFFFF"
                      />
                    )}
                  </TouchableOpacity>

                  {filteredBloodBanks.length === 0 ? (
                    <View style={styles.dropdownEmptyRow}>
                      <Text style={styles.dropdownEmptyText}>
                        No blood banks match your search.
                      </Text>
                    </View>
                  ) : (
                    filteredBloodBanks.map((bank, index) => {
                      const isActive = selectedBank?.id === bank.id;
                      return (
                        <TouchableOpacity
                          key={bank.id}
                          style={[
                            styles.dropdownItem,
                            isActive && styles.dropdownItemActive,
                            index < filteredBloodBanks.length - 1 &&
                              styles.dropdownItemBorder,
                          ]}
                          onPress={() => handleBottomBankPress(bank)}
                        >
                          <View style={styles.dropdownItemTextWrap}>
                            <Text
                              style={[
                                styles.dropdownItemName,
                                isActive && styles.dropdownItemNameActive,
                              ]}
                              numberOfLines={1}
                            >
                              {bank.name}
                            </Text>
                            <Text
                              style={[
                                styles.dropdownItemMeta,
                                isActive && styles.dropdownItemMetaActive,
                              ]}
                              numberOfLines={1}
                            >
                              {formatDistanceLabel(
                                getDistanceForBank(bank),
                                true,
                              )}
                            </Text>
                          </View>
                          {isActive && (
                            <Ionicons
                              name="checkmark"
                              size={moderateScale(20)}
                              color="#FFFFFF"
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.searchToggleBtn}
              activeOpacity={0.85}
              onPress={openTopSearch}
            >
              <Ionicons name="search" size={20} color="#D11B31" />
            </TouchableOpacity>

            <Animated.View
              pointerEvents={isSearchOpen ? "auto" : "none"}
              style={[
                styles.topSearchOverlay,
                {
                  width: animatedTopSearchWidth,
                  opacity: topSearchAnim,
                },
              ]}
            >
              <Ionicons name="search" size={20} color="#9CA3AF" />
              <TextInput
                ref={topSearchInputRef}
                style={styles.topSearchInput}
                placeholder="Search blood banks..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                returnKeyType="search"
              />
              <TouchableOpacity
                onPress={() => closeTopSearch()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

        {showSearchSuggestions && (
          <View style={styles.searchSuggestionsCard}>
            {suggestionBanks.length === 0 ? (
              <Text style={styles.searchSuggestionEmptyText}>
                No similar blood banks found.
              </Text>
            ) : (
              suggestionBanks.map((bank, index) => (
                <TouchableOpacity
                  key={bank.id}
                  activeOpacity={0.85}
                  style={styles.searchSuggestionItem}
                  onPress={() => {
                    setSelectedBank(bank);
                    setIsBankDropdownOpen(false);
                    setSearchQuery(bank.name);
                    closeTopSearch({ clearQuery: false });
                    clearRoute();
                  }}
                >
                  <View style={styles.searchSuggestionTextWrap}>
                    <Text style={styles.searchSuggestionName} numberOfLines={1}>
                      {bank.name}
                    </Text>
                    <Text style={styles.searchSuggestionMeta} numberOfLines={1}>
                      {formatDistanceLabel(getDistanceForBank(bank), true)}
                    </Text>
                  </View>
                  {index < suggestionBanks.length - 1 && (
                    <View style={styles.searchSuggestionDivider} />
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </View>

      <View style={styles.mapContainer}>
        {renderMap()}
        <View style={styles.liveCenterWrap} pointerEvents="none">
          <View style={styles.liveCenterPill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveCenterLabel}>{liveCenterText}</Text>
          </View>
        </View>
      </View>

      {selectedBank && !isRouteActiveForSelectedBank && (
        <View
          style={[
            styles.bankCard,
            {
              bottom: bankCardBottom,
              paddingBottom: verticalScale(16),
            },
          ]}
        >
          <View style={styles.bankHeader}>
            <View style={styles.bankInfoMain}>
              <Text style={styles.bankName}>{selectedBank.name}</Text>
              <View style={styles.distanceContainer}>
                <Ionicons name="location-outline" size={14} color="#6B7280" />
                <Text style={styles.distance}>
                  {formatDistanceLabel(getDistanceForBank(selectedBank), true)}
                </Text>
              </View>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {selectedBank.bloodTypes.length}
              </Text>
              <Text style={styles.badgeLabel}>Types</Text>
            </View>
          </View>

          <View style={styles.addressContainer}>
            <Ionicons
              name="map-outline"
              size={16}
              color="#4B5563"
              style={{ marginTop: 2 }}
            />
            <Text style={styles.address}>
              {selectedBank.address || "Address unavailable"}
            </Text>
          </View>

          {!isCampaignDestinationSelected && (
            <View style={styles.bloodTypesContainer}>
              <Text style={styles.bloodTypesLabel}>Available Blood Types:</Text>
              <View style={styles.bloodTypesList}>
                {selectedBank.bloodTypes.length > 0 ? (
                  selectedBank.bloodTypes.map((type) => (
                    <View key={type} style={styles.bloodTypeBadge}>
                      <Text style={styles.bloodTypeText}>{type}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.address}>No blood type data</Text>
                )}
              </View>
            </View>
          )}

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.directionsBtn]}
              activeOpacity={0.85}
              onPress={handleDirectionsPress}
            >
              <Ionicons name="navigate" size={18} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>
                {routeTargetBankId === selectedBank.id
                  ? "Hide Route"
                  : "Directions"}
              </Text>
            </TouchableOpacity>

            {!isCampaignDestinationSelected && !!selectedBank.phone && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.callBtn]}
                activeOpacity={0.85}
                onPress={() => handleCallPress(selectedBank.phone || "")}
              >
                <Ionicons name="call" size={18} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Call</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {selectedBank && isRouteActiveForSelectedBank && (
        <View style={[styles.miniRouteCard, { bottom: miniRouteBottom }]}>
          <View style={styles.miniRouteTextWrap}>
            <Text style={styles.miniRouteTitle} numberOfLines={1}>
              {selectedBank.name}
            </Text>
            <Text style={styles.miniRouteMeta} numberOfLines={1}>
              {formatDistanceLabel(activeRouteDistanceKm, false)}
              {activeRouteEtaMin !== null ? ` • ~${activeRouteEtaMin} min` : ""}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.miniRouteCloseBtn}
            onPress={handleDirectionsPress}
            activeOpacity={0.85}
          >
            <Ionicons name="close" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  loadingText: {
    marginTop: verticalScale(12),
    fontSize: moderateScale(14),
    color: "#6B7280",
  },
  searchContainer: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(54),
    paddingBottom: verticalScale(12),
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: verticalScale(16),
  },
  backBtn: {
    marginRight: scale(12),
    marginLeft: -scale(4),
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: moderateScale(18),
    fontWeight: "800",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: moderateScale(13),
    color: "#6B7280",
    marginTop: verticalScale(2),
    fontWeight: "500",
  },
  topControlsRow: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: moderateScale(25),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(12),
    gap: scale(8),
    borderWidth: 2,
    borderColor: "#D11B31",
  },
  searchBarWrap: {
    backgroundColor: "#F8FAFC",
    borderRadius: moderateScale(14),
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: scale(12),
    height: verticalScale(46),
    flexDirection: "row",
    alignItems: "center",
  },
  searchIcon: {
    marginRight: scale(6),
  },
  searchInput: {
    flex: 1,
    fontSize: moderateScale(15),
    color: "#111827",
  },
  dropdownContainer: {
    flex: 1,
    position: "relative",
    zIndex: 20,
    marginRight: scale(10),
  },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FEE2E2",
    borderRadius: moderateScale(24),
    paddingHorizontal: scale(18),
    paddingVertical: verticalScale(14),
    borderWidth: moderateScale(2),
    borderColor: "#D11B31",
  },
  dropdownText: {
    flex: 1,
    fontSize: moderateScale(15),
    color: "#333333",
    fontWeight: "600",
  },
  searchToggleBtn: {
    width: moderateScale(56),
    height: verticalScale(52),
    borderRadius: moderateScale(26),
    backgroundColor: "#FEE2E2",
    borderWidth: moderateScale(2),
    borderColor: "#D11B31",
    alignItems: "center",
    justifyContent: "center",
  },
  topSearchOverlay: {
    position: "absolute",
    right: 0,
    height: verticalScale(52),
    borderRadius: moderateScale(26),
    backgroundColor: "#F3F4F6",
    borderWidth: moderateScale(2),
    borderColor: "#D11B31",
    paddingHorizontal: scale(12),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    zIndex: 40,
  },
  topSearchInput: {
    flex: 1,
    fontSize: moderateScale(15),
    color: "#111827",
  },
  searchSuggestionsCard: {
    marginTop: verticalScale(10),
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: moderateScale(5) },
    shadowOpacity: 0.08,
    shadowRadius: moderateScale(10),
    elevation: 6,
    zIndex: 35,
  },
  searchSuggestionItem: {
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(11),
  },
  searchSuggestionTextWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: scale(8),
  },
  searchSuggestionName: {
    flex: 1,
    fontSize: moderateScale(14),
    color: "#111827",
    fontWeight: "600",
  },
  searchSuggestionMeta: {
    fontSize: moderateScale(12),
    color: "#6B7280",
    fontWeight: "500",
  },
  searchSuggestionDivider: {
    marginTop: verticalScale(10),
    height: 1,
    backgroundColor: "#F3F4F6",
  },
  searchSuggestionEmptyText: {
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(13),
    fontSize: moderateScale(13),
    color: "#6B7280",
  },
  dropdownWrap: {
    marginTop: verticalScale(10),
    zIndex: 20,
  },
  dropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    borderRadius: moderateScale(14),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(9),
  },
  dropdownLeadingPill: {
    width: scale(30),
    height: scale(30),
    borderRadius: moderateScale(10),
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: scale(10),
  },
  dropdownTextWrap: {
    flex: 1,
  },
  dropdownLabel: {
    fontSize: moderateScale(10),
    color: "#6B7280",
    fontWeight: "700",
  },
  dropdownValue: {
    marginTop: verticalScale(2),
    fontSize: moderateScale(14),
    color: "#111827",
    fontWeight: "700",
  },
  dropdownList: {
    position: "absolute",
    top: moderateScale(58),
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: moderateScale(8) },
    shadowOpacity: 0.12,
    shadowRadius: moderateScale(16),
    elevation: 8,
    zIndex: 30,
    overflow: "hidden",
  },
  dropdownPanel: {
    marginTop: verticalScale(8),
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: moderateScale(16),
    backgroundColor: "#FFFFFF",
    maxHeight: verticalScale(280),
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: moderateScale(3) },
    shadowOpacity: 0.06,
    shadowRadius: moderateScale(10),
    elevation: 3,
  },
  dropdownContent: {
    paddingVertical: verticalScale(6),
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(18),
    backgroundColor: "#FFFFFF",
  },
  dropdownItemActive: {
    backgroundColor: "#D11B31",
  },
  dropdownItemBorder: {
    borderBottomWidth: moderateScale(0.5),
    borderBottomColor: "#F3F4F6",
  },
  dropdownItemTextWrap: {
    flex: 1,
    marginRight: scale(8),
  },
  dropdownRowStart: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: scale(8),
  },
  dropdownItemIconWrap: {
    width: scale(30),
    height: scale(30),
    borderRadius: moderateScale(10),
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: scale(8),
  },
  dropdownItemIconWrapActive: {
    backgroundColor: "#FFFFFF",
  },
  dropdownTextCol: {
    flex: 1,
  },
  dropdownItemName: {
    fontSize: moderateScale(16),
    color: "#111827",
    fontWeight: "500",
  },
  dropdownItemNameActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  dropdownItemMeta: {
    marginTop: verticalScale(2),
    fontSize: moderateScale(12),
    color: "#6B7280",
  },
  dropdownItemMetaActive: {
    color: "#FEE2E2",
  },
  dropdownEmptyRow: {
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(14),
  },
  dropdownEmptyText: {
    fontSize: moderateScale(13),
    color: "#6B7280",
  },
  mapContainer: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    position: "relative",
  },
  mapView: {
    flex: 1,
  },
  liveCenterWrap: {
    position: "absolute",
    top: verticalScale(12),
    left: 0,
    right: 0,
    alignItems: "center",
  },
  liveCenterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: moderateScale(999),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(6),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: moderateScale(2) },
    shadowOpacity: 0.08,
    shadowRadius: moderateScale(8),
    elevation: 3,
  },
  liveDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: moderateScale(8),
    backgroundColor: "#EF4444",
  },
  liveCenterLabel: {
    fontSize: moderateScale(12),
    color: "#111827",
    fontWeight: "700",
  },
  unsupportedContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: scale(8),
  },
  unsupportedText: {
    fontSize: moderateScale(13),
    color: "#6B7280",
  },
  bankCard: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    paddingTop: verticalScale(20),
    paddingHorizontal: scale(20),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -moderateScale(6) },
    shadowOpacity: 0.1,
    shadowRadius: moderateScale(15),
    elevation: 20,
    borderTopWidth: 1,
    borderColor: "#E5E7EB",
  },
  bankHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: verticalScale(12),
  },
  bankInfoMain: {
    flex: 1,
    marginRight: scale(12),
  },
  bankName: {
    fontSize: moderateScale(18),
    fontWeight: "800",
    color: "#111827",
    marginBottom: verticalScale(4),
  },
  distanceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
  },
  distance: {
    fontSize: moderateScale(13),
    color: "#6B7280",
    fontWeight: "500",
  },
  badge: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(6),
    borderRadius: moderateScale(12),
    alignItems: "center",
    minWidth: scale(48),
  },
  badgeText: {
    fontSize: moderateScale(14),
    fontWeight: "800",
    color: "#D11B31",
  },
  badgeLabel: {
    fontSize: moderateScale(10),
    color: "#D11B31",
    fontWeight: "600",
    marginTop: verticalScale(1),
  },
  addressContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: scale(8),
    marginBottom: verticalScale(16),
  },
  address: {
    flex: 1,
    fontSize: moderateScale(13),
    color: "#4B5563",
    lineHeight: moderateScale(18),
  },
  liveRoutePill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#DBEAFE",
    borderRadius: moderateScale(10),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(7),
    marginBottom: verticalScale(12),
  },
  liveRouteTextWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    flex: 1,
    marginRight: scale(8),
  },
  liveRouteText: {
    fontSize: moderateScale(12),
    color: "#1E3A8A",
    fontWeight: "700",
  },
  liveRouteCancelBtn: {
    width: moderateScale(22),
    height: moderateScale(22),
    borderRadius: moderateScale(11),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D11B31",
  },
  miniRouteCard: {
    position: "absolute",
    left: scale(16),
    right: scale(96),
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(14),
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(12),
    borderWidth: 2,
    borderColor: "#D11B31",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: moderateScale(3) },
    shadowOpacity: 0.08,
    shadowRadius: moderateScale(8),
    elevation: 4,
  },
  miniRouteTextWrap: {
    flex: 1,
    marginRight: scale(10),
  },
  miniRouteTitle: {
    fontSize: moderateScale(14),
    fontWeight: "800",
    color: "#111827",
    marginBottom: verticalScale(2),
  },
  miniRouteMeta: {
    fontSize: moderateScale(12),
    color: "#1E3A8A",
    fontWeight: "700",
  },
  miniRouteCloseBtn: {
    width: moderateScale(24),
    height: moderateScale(24),
    borderRadius: moderateScale(12),
    backgroundColor: "#D11B31",
    alignItems: "center",
    justifyContent: "center",
  },
  bloodTypesContainer: {
    marginBottom: verticalScale(18),
  },
  bloodTypesLabel: {
    fontSize: moderateScale(12),
    color: "#6B7280",
    fontWeight: "700",
    marginBottom: verticalScale(8),
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bloodTypesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scale(6),
  },
  bloodTypeBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
    borderRadius: moderateScale(8),
  },
  bloodTypeText: {
    fontSize: moderateScale(12),
    color: "#1F2937",
    fontWeight: "700",
  },
  actionButtons: {
    flexDirection: "row",
    gap: scale(10),
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(8),
    paddingVertical: verticalScale(13),
    borderRadius: moderateScale(14),
  },
  directionsBtn: {
    backgroundColor: "#D11B31",
  },
  callBtn: {
    backgroundColor: "#059669",
  },
  actionBtnText: {
    fontSize: moderateScale(14),
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
