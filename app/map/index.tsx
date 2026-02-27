import { Ionicons } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as Location from "expo-location"
import React, { useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { WebView } from "react-native-webview"
import { API_ENDPOINTS } from "../../config/api"
import { moderateScale, scale, verticalScale } from "../../utils/responsive"

type UserType = "gainer" | "donor" | "organization"

interface BloodBank {
  id: string
  name: string
  latitude: number
  longitude: number
  address: string
  distance: number
  bloodTypes: string[]
  phone?: string
}

interface MapScreenProps {
  hideNavigation?: boolean
}

export default function MapScreen({ hideNavigation = false }: MapScreenProps = {}) {
  const [bloodBanks, setBloodBanks] = useState<BloodBank[]>([])
  const [loading, setLoading] = useState(true)
  const [userType, setUserType] = useState<UserType>("donor")
  const [selectedBank, setSelectedBank] = useState<BloodBank | null>(null)
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null)

  useEffect(() => {
    loadUserData()
    getCurrentLocation()
    loadBloodBanks()
  }, [])

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== "granted") return

      const location = await Location.getCurrentPositionAsync({})
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      })
    } catch (error) {
      console.log("Error getting location:", error)
    }
  }

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem("userData")
      if (userData) {
        const parsed = JSON.parse(userData)
        setUserType(parsed.role || "donor")
      }
    } catch (error) {
      console.log("Error loading user data:", error)
    }
  }

  const loadBloodBanks = async () => {
    try {
      setLoading(true)
      const token = await AsyncStorage.getItem("authToken")

      const response = await fetch(API_ENDPOINTS.GET_ORGANIZATIONS, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      const data = await response.json().catch(() => null)

      const list = data?.organizations || data?.data || (Array.isArray(data) ? data : [])

      const normalized: BloodBank[] = Array.isArray(list)
        ? list.map((org: any) => {
          const inventory = Array.isArray(org.inventory) ? org.inventory : []
          return {
            id: String(org.organizationId || org.id),
            name: org.organizationName || org.name || "Unknown",
            latitude: Number(org.Latitude || org.latitude || 19.0760),
            longitude: Number(org.Longitude || org.longitude || 72.8777),
            address: org.location || org.address || "",
            distance: org.distance || 0,
            bloodTypes: inventory.map((item: any) => item.bloodType),
            phone: org.phone || org.contact || "+91 98765 43210"
          }
        })
        : []

      setBloodBanks(normalized)
      // No default selection as per user request
      setSelectedBank(null)
    } catch (error) {
      console.error("Error loading blood banks:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCallPress = (phone: string) => {
    console.log("Call:", phone)
  }

  const handleDirectionsPress = () => {
    if (selectedBank) {
      console.log("Open directions to:", selectedBank.name)
    }
  }

  const mapHtml = useMemo(() => {
    const initialLat = userLocation?.latitude || 27.7172 // Kathmandu default
    const initialLng = userLocation?.longitude || 85.3240

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Blood Banks Map</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
        body { margin: 0; padding: 0; }
        #map { height: 100vh; width: 100vw; }
        .custom-div-icon {
            background: none;
            border: none;
        }
        .marker-pin {
            width: 32px;
            height: 32px;
            border-radius: 50% 50% 50% 0;
            background: #D11B31;
            position: absolute;
            transform: rotate(-45deg);
            left: 50%;
            top: 50%;
            margin: -16px 0 0 -16px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid white;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        }
        .marker-pin::after {
            content: '';
            width: 22px;
            height: 22px;
            margin: 0;
            background: white;
            position: absolute;
            border-radius: 50%;
        }
        .marker-pin.active {
            background: #059669;
            width: 38px;
            height: 38px;
            margin: -19px 0 0 -19px;
        }
        .marker-pin.active::after {
            width: 26px;
            height: 26px;
        }
        .user-location-dot {
            width: 16px;
            height: 16px;
            background: #2563EB;
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 0 10px rgba(37,99,235,0.5);
        }
        .icon-text {
            transform: rotate(45deg);
            z-index: 10;
            display: flex;
            align-items: center;
            justify-content: center;
        }
    </style>
</head>
<body>
    <div id="map"></div>
    <script>
        var map = L.map('map').setView([${initialLat}, ${initialLng}], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        setTimeout(function() { map.invalidateSize(); }, 500);

        // Deselect when clicking map
        map.on('click', function(e) {
            if (e.originalEvent.target.id === 'map') {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'deselect'
                }));
            }
        });

        // Add user location dot
        if (${!!userLocation}) {
            var userIcon = L.divIcon({
                className: 'custom-div-icon',
                html: "<div class='user-location-dot'></div>",
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });
            L.marker([${userLocation?.latitude || initialLat}, ${userLocation?.longitude || initialLng}], {icon: userIcon}).addTo(map);
        }

        var markers = {};
        var bloodBanks = ${JSON.stringify(bloodBanks)};
        var selectedId = "${selectedBank?.id || ""}";

        function createIcon(id) {
            var isActive = id === selectedId;
            return L.divIcon({
                className: 'custom-div-icon',
                html: "<div class='marker-pin " + (isActive ? 'active' : '') + "'><span class='icon-text'><svg width='16' height='16' viewBox='0 0 24 24' fill='" + (isActive ? '#059669' : '#D11B31') + "'><path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/></svg></span></div>",
                iconSize: [isActive ? 38 : 32, isActive ? 52 : 44],
                iconAnchor: [isActive ? 19 : 16, isActive ? 52 : 44]
            });
        }

        bloodBanks.forEach(function(bank) {
            var marker = L.marker([bank.latitude, bank.longitude], {
                icon: createIcon(bank.id)
            }).addTo(map);
            
            marker.on('click', function() {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'selectBank',
                    bankId: bank.id
                }));
            });
            
            markers[bank.id] = marker;
        });

        if (selectedId && markers[selectedId]) {
            var m = markers[selectedId];
            map.setView(m.getLatLng(), 14);
        }

        window.addEventListener('message', function(event) {
            var data = JSON.parse(event.data);
            if (data.type === 'updateSelected') {
                var oldId = selectedId;
                selectedId = data.bankId;
                
                if (oldId && markers[oldId]) {
                    markers[oldId].setIcon(createIcon(oldId));
                }
                if (selectedId && markers[selectedId]) {
                    markers[selectedId].setIcon(createIcon(selectedId));
                    map.panTo(markers[selectedId].getLatLng());
                }
            } else if (data.type === 'deselect') {
                if (selectedId && markers[selectedId]) {
                    markers[selectedId].setIcon(createIcon(selectedId));
                }
                selectedId = "";
            }
        });
    </script>
</body>
</html>
        `;
  }, [bloodBanks, selectedBank?.id, userLocation]);

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "selectBank") {
        const bank = bloodBanks.find((b) => b.id === data.bankId);
        if (bank) {
          setSelectedBank(bank);
        }
      } else if (data.type === "deselect") {
        setSelectedBank(null);
      }
    } catch (e) {
      console.error("WebView message error:", e);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D11B31" />
        <Text style={styles.loadingText}>Loading blood banks...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.headerSection}>
        <View style={styles.modalHandle} />
        <Text style={styles.title}>Nearby Blood Banks</Text>
        <Text style={styles.subtitle}>Find blood centers in your current location</Text>
      </View>

      {/* Map View */}
      <View style={styles.mapContainer}>
        <WebView
          originWhitelist={['*']}
          source={{ html: mapHtml }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          onMessage={handleWebViewMessage}
        />
      </View>

      {/* Selected Bank Card */}
      {selectedBank && (
        <View style={styles.bankCard}>
          <View style={styles.bankHeader}>
            <View style={styles.bankInfoMain}>
              <Text style={styles.bankName}>{selectedBank.name}</Text>
              <View style={styles.distanceContainer}>
                <Ionicons name="location-outline" size={14} color="#6B7280" />
                <Text style={styles.distance}>{selectedBank.distance} km away</Text>
              </View>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{selectedBank.bloodTypes.length}</Text>
              <Text style={styles.badgeLabel}>Types</Text>
            </View>
          </View>

          <View style={styles.addressContainer}>
            <Ionicons name="map-outline" size={16} color="#4B5563" style={{ marginTop: 2 }} />
            <Text style={styles.address}>{selectedBank.address}</Text>
          </View>

          <View style={styles.bloodTypesContainer}>
            <Text style={styles.bloodTypesLabel}>Available Blood Types:</Text>
            <View style={styles.bloodTypesList}>
              {selectedBank.bloodTypes.map((type) => (
                <View key={type} style={styles.bloodTypeBadge}>
                  <Text style={styles.bloodTypeText}>{type}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.directionsBtn]}
              activeOpacity={0.85}
              onPress={handleDirectionsPress}
            >
              <Ionicons name="navigate" size={18} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Directions</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.callBtn]}
              activeOpacity={0.85}
              onPress={() => handleCallPress(selectedBank.phone || "+91 98765 43210")}
            >
              <Ionicons name="call" size={18} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Call Center</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
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
  headerSection: {
    paddingTop: verticalScale(50),
    paddingBottom: verticalScale(14),
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalHandle: {
    alignSelf: "center",
    width: scale(44),
    height: verticalScale(5),
    borderRadius: moderateScale(99),
    backgroundColor: "#E5E7EB",
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
    marginTop: verticalScale(2),
  },
  mapContainer: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  webview: {
    flex: 1,
  },
  bankCard: {
    position: "absolute",
    bottom: verticalScale(100),
    left: scale(16),
    right: scale(16),
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(24),
    padding: scale(18),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: moderateScale(8) },
    shadowOpacity: 0.15,
    shadowRadius: moderateScale(20),
    elevation: 10,
    borderWidth: 1,
    borderColor: "#F3F4F6",
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
})
