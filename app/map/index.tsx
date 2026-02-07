import { Ionicons } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import React, { useEffect, useState } from "react"
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native"
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps"
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
}

interface MapScreenProps {
  hideNavigation?: boolean
}

export default function MapScreen({ hideNavigation = false }: MapScreenProps = {}) {
  const [bloodBanks, setBloodBanks] = useState<BloodBank[]>([])
  const [loading, setLoading] = useState(true)
  const [userType, setUserType] = useState<UserType>("donor")
  const [selectedBank, setSelectedBank] = useState<BloodBank | null>(null)

  useEffect(() => {
    loadUserData()
    loadBloodBanks()
  }, [])

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
      // Mock data for blood banks
      const mockBanks: BloodBank[] = [
        {
          id: "1",
          name: "Central Blood Bank",
          latitude: 19.0760,
          longitude: 72.8777,
          address: "123 Medical Street, Mumbai",
          distance: 2.5,
          bloodTypes: ["A+", "B+", "O+", "AB+"],
        },
        {
          id: "2",
          name: "City Hospital Blood Center",
          latitude: 19.0833,
          longitude: 72.8621,
          address: "456 Hospital Road, Mumbai",
          distance: 5.2,
          bloodTypes: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"],
        },
        {
          id: "3",
          name: "Red Cross Blood Donation",
          latitude: 19.0976,
          longitude: 72.8194,
          address: "789 Charity Avenue, Mumbai",
          distance: 3.8,
          bloodTypes: ["O+", "O-", "A+", "A-"],
        },
        {
          id: "4",
          name: "Lifeline Blood Bank",
          latitude: 19.1136,
          longitude: 72.8697,
          address: "321 Health Boulevard, Mumbai",
          distance: 7.1,
          bloodTypes: ["B+", "B-", "AB+", "AB-"],
        },
        {
          id: "5",
          name: "Apollo Hospitals Blood Bank",
          latitude: 19.0176,
          longitude: 72.8298,
          address: "555 Apollo Street, Mumbai",
          distance: 4.6,
          bloodTypes: ["A+", "B+", "O+", "O-", "AB+"],
        },
      ]

      setBloodBanks(mockBanks)
      if (mockBanks.length > 0) {
        setSelectedBank(mockBanks[0])
      }
    } catch (error) {
      console.error("Error loading blood banks:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkerPress = (bank: BloodBank) => {
    setSelectedBank(bank)
  }

  const handleCallPress = (phone: string) => {
    console.log("Call:", phone)
    // Implement actual call functionality
  }

  const handleDirectionsPress = () => {
    if (selectedBank) {
      console.log("Open directions to:", selectedBank.name)
      // Implement directions functionality
    }
  }

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
      {/* Map View */}
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: 19.0760,
          longitude: 72.8777,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
        showsMyLocationButton
      >
        {bloodBanks.map((bank) => (
          <Marker
            key={bank.id}
            coordinate={{
              latitude: bank.latitude,
              longitude: bank.longitude,
            }}
            title={bank.name}
            description={bank.address}
            onPress={() => handleMarkerPress(bank)}
          >
            <View style={styles.markerContainer}>
              <View
                style={[
                  styles.markerDot,
                  selectedBank?.id === bank.id && styles.markerDotActive,
                ]}
              >
                <Ionicons name="location" size={20} color="#FFFFFF" />
              </View>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Selected Bank Card */}
      {selectedBank && (
        <View style={styles.bankCard}>
          <View style={styles.bankHeader}>
            <View>
              <Text style={styles.bankName}>{selectedBank.name}</Text>
              <View style={styles.distanceContainer}>
                <Ionicons name="location" size={14} color="#6B7280" />
                <Text style={styles.distance}>{selectedBank.distance} km away</Text>
              </View>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{selectedBank.bloodTypes.length}</Text>
              <Text style={styles.badgeLabel}>Types</Text>
            </View>
          </View>

          <Text style={styles.address}>{selectedBank.address}</Text>

          <View style={styles.bloodTypesContainer}>
            <Text style={styles.bloodTypesLabel}>Available:</Text>
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
              onPress={handleDirectionsPress}
            >
              <Ionicons name="navigate" size={20} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Directions</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.callBtn]}
              onPress={() => handleCallPress("+91 98765 43210")}
            >
              <Ionicons name="call" size={20} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Call</Text>
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
    backgroundColor: "#F9FAFB",
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
  map: {
    flex: 1,
  },
  markerContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  markerDot: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: "#D11B31",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  markerDotActive: {
    backgroundColor: "#059669",
    width: moderateScale(48),
    height: moderateScale(48),
  },
  bankCard: {
    position: "absolute",
    bottom: verticalScale(100),
    left: scale(16),
    right: scale(16),
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(16),
    padding: scale(16),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  bankHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: verticalScale(12),
  },
  bankName: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: "#111827",
    marginBottom: verticalScale(4),
  },
  distanceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
  },
  distance: {
    fontSize: moderateScale(12),
    color: "#6B7280",
  },
  badge: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(6),
    borderRadius: moderateScale(8),
    alignItems: "center",
  },
  badgeText: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: "#D11B31",
  },
  badgeLabel: {
    fontSize: moderateScale(10),
    color: "#6B7280",
    marginTop: verticalScale(2),
  },
  address: {
    fontSize: moderateScale(13),
    color: "#4B5563",
    marginBottom: verticalScale(12),
    lineHeight: moderateScale(20),
  },
  bloodTypesContainer: {
    marginBottom: verticalScale(12),
  },
  bloodTypesLabel: {
    fontSize: moderateScale(12),
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: verticalScale(6),
  },
  bloodTypesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scale(6),
  },
  bloodTypeBadge: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(6),
  },
  bloodTypeText: {
    fontSize: moderateScale(11),
    color: "#DC2626",
    fontWeight: "600",
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
    gap: scale(6),
    paddingVertical: verticalScale(10),
    borderRadius: moderateScale(10),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  directionsBtn: {
    backgroundColor: "#D11B31",
  },
  callBtn: {
    backgroundColor: "#059669",
  },
  actionBtnText: {
    fontSize: moderateScale(13),
    color: "#FFFFFF",
    fontWeight: "600",
  },
})
