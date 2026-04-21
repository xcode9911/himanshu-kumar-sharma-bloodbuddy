import React, { useMemo } from "react";
import {
    ActivityIndicator,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {
    loadExpoMapsModule,
    type AppleMapMarker,
    type AppleMapProps,
    type GoogleMapMarker,
    type GoogleMapProps,
} from "../utils/expoMapsRuntime";
import { moderateScale, scale, verticalScale } from "../utils/responsive";
import LeafletMapView from "./LeafletMapView";

interface Location {
  lat: number;
  lng: number;
}

interface MapModalProps {
  visible: boolean;
  onClose: () => void;
  donorLocation: Location | null;
  gainerLocation: Location | null;
  donorName?: string;
  gainerName?: string;
}

const DEFAULT_COORDINATES = {
  latitude: 27.7172,
  longitude: 85.324,
};

const hasValidLocation = (location: Location | null) => {
  return !!(
    location &&
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lng) &&
    (location.lat !== 0 || location.lng !== 0)
  );
};

export default function MapModal({
  visible,
  onClose,
  donorLocation,
  gainerLocation,
  donorName = "Donor",
  gainerName = "Gainer",
}: MapModalProps) {
  const expoMapsModule = loadExpoMapsModule();
  const AppleMapsView = expoMapsModule?.AppleMaps?.View;

  const donorValid = hasValidLocation(donorLocation);
  const gainerValid = hasValidLocation(gainerLocation);
  const hasAnyLocation = donorValid || gainerValid;

  const centerCoordinates = useMemo(() => {
    if (donorValid && gainerValid) {
      return {
        latitude: (donorLocation!.lat + gainerLocation!.lat) / 2,
        longitude: (donorLocation!.lng + gainerLocation!.lng) / 2,
      };
    }

    if (donorValid) {
      return {
        latitude: donorLocation!.lat,
        longitude: donorLocation!.lng,
      };
    }

    if (gainerValid) {
      return {
        latitude: gainerLocation!.lat,
        longitude: gainerLocation!.lng,
      };
    }

    return DEFAULT_COORDINATES;
  }, [donorLocation, donorValid, gainerLocation, gainerValid]);

  const appleMarkers = useMemo<AppleMapMarker[]>(() => {
    const markers: AppleMapMarker[] = [];

    if (donorValid) {
      markers.push({
        id: "donor",
        title: donorName,
        coordinates: {
          latitude: donorLocation!.lat,
          longitude: donorLocation!.lng,
        },
        tintColor: "#D11B31",
        systemImage: "heart.fill",
      });
    }

    if (gainerValid) {
      markers.push({
        id: "gainer",
        title: gainerName,
        coordinates: {
          latitude: gainerLocation!.lat,
          longitude: gainerLocation!.lng,
        },
        tintColor: "#2563EB",
        systemImage: "house.fill",
      });
    }

    return markers;
  }, [
    donorLocation,
    donorName,
    donorValid,
    gainerLocation,
    gainerName,
    gainerValid,
  ]);

  const googleMarkers = useMemo<GoogleMapMarker[]>(() => {
    const markers: GoogleMapMarker[] = [];

    if (donorValid) {
      markers.push({
        id: "donor",
        title: donorName,
        coordinates: {
          latitude: donorLocation!.lat,
          longitude: donorLocation!.lng,
        },
      });
    }

    if (gainerValid) {
      markers.push({
        id: "gainer",
        title: gainerName,
        coordinates: {
          latitude: gainerLocation!.lat,
          longitude: gainerLocation!.lng,
        },
      });
    }

    return markers;
  }, [
    donorLocation,
    donorName,
    donorValid,
    gainerLocation,
    gainerName,
    gainerValid,
  ]);

  const routeCoordinates = useMemo(() => {
    if (!donorValid || !gainerValid) {
      return [];
    }

    return [
      {
        latitude: donorLocation!.lat,
        longitude: donorLocation!.lng,
      },
      {
        latitude: gainerLocation!.lat,
        longitude: gainerLocation!.lng,
      },
    ];
  }, [donorLocation, donorValid, gainerLocation, gainerValid]);

  const applePolylines = useMemo<
    NonNullable<AppleMapProps["polylines"]>
  >(() => {
    if (routeCoordinates.length < 2) {
      return [];
    }

    return [
      {
        id: "route",
        coordinates: routeCoordinates,
        color: "#D11B31",
        width: 6,
      },
    ];
  }, [routeCoordinates]);

  const googlePolylines = useMemo<
    NonNullable<GoogleMapProps["polylines"]>
  >(() => {
    if (routeCoordinates.length < 2) {
      return [];
    }

    return [
      {
        id: "route",
        coordinates: routeCoordinates,
        color: "#D11B31",
        width: 6,
      },
    ];
  }, [routeCoordinates]);

  const renderMap = () => {
    if (!hasAnyLocation) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#D11B31" />
          <Text style={styles.loadingText}>Waiting for location signal...</Text>
        </View>
      );
    }

    if (Platform.OS === "ios" && AppleMapsView) {
      return (
        <AppleMapsView
          style={styles.mapView}
          cameraPosition={{
            coordinates: centerCoordinates,
            zoom: donorValid && gainerValid ? 12 : 14,
          }}
          markers={appleMarkers}
          polylines={applePolylines}
          uiSettings={{
            compassEnabled: true,
            myLocationButtonEnabled: true,
            scaleBarEnabled: true,
          }}
          properties={{
            isMyLocationEnabled: true,
          }}
        />
      );
    }

    if (Platform.OS === "android") {
      return (
        <LeafletMapView
          style={styles.mapView}
          cameraPosition={{
            coordinates: centerCoordinates,
            zoom: donorValid && gainerValid ? 12 : 14,
          }}
          markers={googleMarkers}
          polylines={googlePolylines}
        />
      );
    }

    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>
          Map module is unavailable in this build.
        </Text>
        <Text style={styles.loadingText}>
          Rebuild using expo run:ios or expo run:android.
        </Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.modalContent}>
          <View style={styles.modalHandle} />
          <Text style={styles.title}>Live Tracking</Text>
          <Text style={styles.subtitle}>
            Real-time tracking of donor and gainer
          </Text>

          <View style={styles.mapContainer}>{renderMap()}</View>

          <View style={styles.footer}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: "#D11B31" }]} />
              <Text style={styles.legendText}>Donor: {donorName}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.routeLine} />
              <Text style={styles.legendText}>Route</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: "#2563EB" }]} />
              <Text style={styles.legendText}>Gainer: {gainerName}</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.18)",
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    width: "100%",
    height: "85%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: moderateScale(26),
    borderTopRightRadius: moderateScale(26),
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: moderateScale(6) },
    shadowOpacity: 0.18,
    shadowRadius: moderateScale(16),
    elevation: 12,
  },
  modalHandle: {
    alignSelf: "center",
    width: scale(44),
    height: verticalScale(5),
    borderRadius: moderateScale(99),
    backgroundColor: "#E5E7EB",
    marginTop: verticalScale(10),
    marginBottom: verticalScale(10),
  },
  title: {
    fontSize: moderateScale(20),
    fontWeight: "800",
    color: "#D11B31",
    textAlign: "center",
  },
  subtitle: {
    fontSize: moderateScale(13),
    color: "#6B7280",
    textAlign: "center",
    marginBottom: verticalScale(12),
  },
  mapContainer: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  mapView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: verticalScale(12),
    fontSize: moderateScale(14),
    color: "#6B7280",
  },
  footer: {
    padding: scale(16),
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    flexDirection: "row",
    justifyContent: "space-around",
    paddingBottom: verticalScale(24),
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  routeLine: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D11B31",
    opacity: 0.7,
    marginRight: 8,
  },
  legendText: {
    fontSize: moderateScale(11),
    color: "#4B5563",
    fontWeight: "500",
  },
});
