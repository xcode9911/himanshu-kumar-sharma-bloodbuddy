import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
    Alert,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import DonationSvg from "../../assets/images/donation.svg";
import { API_ENDPOINTS } from "../../config/api";
import { moderateScale, scale, verticalScale } from "../../utils/responsive";

export default function OrganizationDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [selectedBloodType, setSelectedBloodType] = useState("");
  const [units, setUnits] = useState("");
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [donorBloodType, setDonorBloodType] = useState("");
  const logoUrl = typeof params.logoUrl === "string" ? params.logoUrl : "";

  const bloodTypes = params.bloodTypes
    ? JSON.parse(params.bloodTypes as string)
    : [];
  const inventory = params.inventory
    ? JSON.parse(params.inventory as string)
    : [];

  React.useEffect(() => {
    const loadRole = async () => {
      const userData = await AsyncStorage.getItem("userData");
      if (userData) {
        const parsed = JSON.parse(userData);
        setUserRole(parsed.role?.toLowerCase() || "");
        setDonorBloodType(parsed.bloodType || "");
      }
    };
    loadRole();
  }, []);

  const handleActionPress = (type: string) => {
    setSelectedBloodType(type);
    setUnits("1"); // Default to 1 unit
    setBookingModalVisible(true);
  };

  const submitBooking = async () => {
    const parsedUnits = parseInt(units);
    if (!units || parsedUnits <= 0) {
      Alert.alert("Error", "Please enter a valid number of units");
      return;
    }

    // Frontend check for available units if gainer is booking
    if (userRole === "gainer") {
      const invItem = inventory.find(
        (i: any) => i.bloodType === selectedBloodType,
      );
      const availableForType = invItem ? Number(invItem.units) : 0;
      if (parsedUnits > availableForType) {
        Alert.alert(
          "Error",
          `Insufficient units. Only ${availableForType} unit(s) available for ${selectedBloodType}.`,
        );
        return;
      }
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("authToken");

      if (!token) {
        Alert.alert(
          "Error",
          `Please login to ${userRole === "donor" ? "donate" : "book"} units`,
        );
        return;
      }

      const isDonation = userRole === "donor";
      const endpoint = isDonation
        ? API_ENDPOINTS.CREATE_DONATION
        : API_ENDPOINTS.CREATE_BOOKING;

      const payload = {
        organizationId: Number(params.id),
        bloodType: selectedBloodType,
        units: Number(units),
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (response.ok) {
        Alert.alert(
          "Success",
          isDonation
            ? "Donation offer submitted successfully!"
            : "Booking request submitted successfully!",
        );
        setBookingModalVisible(false);
      } else {
        Alert.alert(
          "Error",
          data?.message ||
            `Failed to submit ${isDonation ? "donation offer" : "booking request"}`,
        );
      }
    } catch (error) {
      console.log("Booking error:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ padding: 4, marginLeft: -4, marginRight: scale(8) }}
          >
            <Ionicons name="chevron-back" size={28} color="#D11B31" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Organization Details</Text>
            <Text style={styles.subtitle}>
              View information and blood availability
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="business" size={40} color="#D11B31" />
            )}
          </View>
          <Text style={styles.orgName}>{params.name}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Verified Blood Bank</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={20} color="#6B7280" />
            <Text style={styles.infoText}>{params.address}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={20} color="#6B7280" />
            <Text style={styles.infoText}>{params.phone}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color="#6B7280" />
            <Text style={styles.infoText}>{params.email}</Text>
          </View>
        </View>

        {userRole === "donor" && (
          <TouchableOpacity
            style={[
              styles.mainActionButton,
              styles.donateButton,
              { marginHorizontal: scale(4) },
            ]}
            onPress={() => handleActionPress(donorBloodType)}
          >
            <DonationSvg width={28} height={28} fill="#FFFFFF" />
            <Text style={styles.mainActionButtonText}>
              Donate Now ({donorBloodType})
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Inventory</Text>
          {bloodTypes.length > 0 ? (
            bloodTypes.map((type: string) => (
              <View key={type} style={styles.inventoryRow}>
                <View style={styles.inventoryInfo}>
                  <View style={styles.bloodTypeBadge}>
                    <Text style={styles.bloodTypeText}>{type}</Text>
                  </View>
                  <Text style={styles.availableText}>Available</Text>
                </View>
                {userRole === "gainer" && (
                  <TouchableOpacity
                    testID={`bookButton_${type}`}
                    style={styles.bookButton}
                    onPress={() => handleActionPress(type)}
                  >
                    <Text style={styles.bookButtonText}>Book Now</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>
              No blood inventory available currently.
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Booking Modal */}
      <Modal
        visible={bookingModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBookingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {userRole === "donor" ? "Donate Blood Units" : "Book Blood Units"}
            </Text>
            <Text style={styles.modalSubtitle}>
              Blood Type: {selectedBloodType}
            </Text>

            <Text style={styles.label}>Number of Units</Text>
            <TextInput
              testID="bookingUnitsInput"
              style={styles.input}
              value={units}
              onChangeText={setUnits}
              keyboardType="numeric"
              placeholder="Enter units"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setBookingModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="confirmBookingButton"
                style={[
                  styles.modalButton,
                  styles.confirmButton,
                  userRole === "donor" && styles.donateButton,
                ]}
                onPress={submitBooking}
                disabled={loading}
              >
                <Text style={styles.confirmButtonText}>
                  {loading
                    ? "Submitting..."
                    : userRole === "donor"
                      ? "Confirm Donation"
                      : "Confirm Booking"}
                </Text>
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
    backgroundColor: "#F9FAFB",
  },
  header: {
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(60),
    paddingBottom: verticalScale(20),
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: {
    fontSize: moderateScale(22),
    fontWeight: "900",
    color: "#111827",
  },
  subtitle: {
    fontSize: moderateScale(13),
    color: "#6B7280",
    marginTop: 2,
  },
  scrollContent: {
    padding: scale(16),
    paddingBottom: verticalScale(40),
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(24),
    padding: scale(24),
    alignItems: "center",
    marginBottom: verticalScale(20),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  avatarContainer: {
    width: moderateScale(80),
    height: moderateScale(80),
    borderRadius: moderateScale(40),
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: verticalScale(16),
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  orgName: {
    fontSize: moderateScale(22),
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: verticalScale(8),
  },
  badge: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(20),
  },
  badgeText: {
    fontSize: moderateScale(12),
    color: "#059669",
    fontWeight: "600",
  },
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(20),
    padding: scale(20),
    marginBottom: verticalScale(20),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: "#111827",
    marginBottom: verticalScale(16),
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(12),
    marginBottom: verticalScale(12),
  },
  infoText: {
    fontSize: moderateScale(15),
    color: "#4B5563",
    flex: 1,
  },
  inventoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: verticalScale(12),
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  inventoryInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(12),
  },
  bloodTypeBadge: {
    backgroundColor: "#FEF2F2",
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(12),
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  bloodTypeText: {
    fontSize: moderateScale(18),
    fontWeight: "800",
    color: "#D11B31",
  },
  availableText: {
    fontSize: moderateScale(14),
    color: "#6B7280",
    fontWeight: "500",
  },
  bookButton: {
    backgroundColor: "#D11B31",
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(12),
  },
  donateButton: {
    backgroundColor: "#059669",
  },
  bookButtonText: {
    color: "#FFFFFF",
    fontSize: moderateScale(14),
    fontWeight: "600",
  },
  emptyText: {
    fontSize: moderateScale(14),
    color: "#9CA3AF",
    textAlign: "center",
  },
  mainActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: verticalScale(16),
    borderRadius: moderateScale(16),
    gap: scale(12),
    marginTop: verticalScale(8),
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  mainActionButtonText: {
    color: "#FFFFFF",
    fontSize: moderateScale(16),
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: scale(20),
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(24),
    padding: scale(24),
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: moderateScale(20),
    fontWeight: "800",
    color: "#111827",
    marginBottom: verticalScale(8),
  },
  modalSubtitle: {
    fontSize: moderateScale(16),
    color: "#6B7280",
    marginBottom: verticalScale(20),
  },
  label: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: "#374151",
    marginBottom: verticalScale(8),
  },
  input: {
    backgroundColor: "#F3F4F6",
    borderRadius: moderateScale(12),
    padding: scale(16),
    fontSize: moderateScale(16),
    color: "#111827",
    marginBottom: verticalScale(24),
  },
  modalButtons: {
    flexDirection: "row",
    gap: scale(12),
  },
  modalButton: {
    flex: 1,
    paddingVertical: verticalScale(14),
    borderRadius: moderateScale(12),
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#F3F4F6",
  },
  confirmButton: {
    backgroundColor: "#D11B31",
  },
  cancelButtonText: {
    color: "#4B5563",
    fontWeight: "600",
    fontSize: moderateScale(15),
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: moderateScale(15),
  },
});
