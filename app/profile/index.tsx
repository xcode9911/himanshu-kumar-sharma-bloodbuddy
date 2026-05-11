import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { jwtDecode } from "jwt-decode";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Linking,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import DonationStatusModal from "../../components/DonationStatusModal";
import Navigation from "../../components/Navigation";
import { API_ENDPOINTS } from "../../config/api";
import { getUserFriendlyError } from "../../utils/errorMessages";
import { getCleanImageUrl } from "../../utils/image";
import { moderateScale, scale, verticalScale } from "../../utils/responsive";

const { width } = Dimensions.get("window");

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
  lastDonationDate?: string;
  profileImage?: any;
};

export default function ProfileScreen() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isTogglingAvailability, setIsTogglingAvailability] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusModalData, setStatusModalData] = useState<{
    status: "available" | "unavailable" | "cooling";
    lastDonation?: string;
    nextEligible?: string;
    message?: string;
  }>({ status: "unavailable" });

  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, []),
  );

  const handleHelpSupport = async () => {
    const email = "blood.officiallybuddy@gmail.com";
    const mailtoUrl = `mailto:${email}`;

    try {
      const supported = await Linking.canOpenURL(mailtoUrl);
      if (!supported) {
        Alert.alert("Mail App Not Found", `Please email us at ${email}`);
        return;
      }

      await Linking.openURL(mailtoUrl);
    } catch (error) {
      Alert.alert("Unable to Open Mail", `Please email us at ${email}`);
    }
  };

  const loadUserData = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
        const userDataString = await AsyncStorage.getItem("userData");
        if (userDataString) {
          setUserData(JSON.parse(userDataString));
          setIsLoading(false);
          return;
        }
        Alert.alert("Error", "No user data found. Please login again.");
        router.replace("/auth/login");
        return;
      }

      try {
        const payload: any = jwtDecode(token);
        const jwtUser = payload?.user || payload || {};
        const userId = String(
          jwtUser.userId || jwtUser.id || jwtUser._id || "",
        );

        // Fetch fresh profile from API to ensure we have the correct relative paths
        // and latest organization details.
        let freshUser = jwtUser;
        try {
          const response = await fetch(API_ENDPOINTS.GET_PROFILE(userId), {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            const data = await response.json();
            freshUser = data.user || freshUser;
          }
        } catch (apiError) {
          console.log(
            "Failed to fetch fresh profile, using token data:",
            apiError,
          );
        }

        const role = (freshUser.role || "").toString().toLowerCase();
        const roleData = freshUser[role] || {};

        const normalized: UserData = {
          id: userId,
          fullName:
            freshUser.fullName || freshUser.FullName || freshUser.name || "",
          email: freshUser.email || freshUser.Email || "",
          role: role,
          phone:
            freshUser.phone || freshUser.Phone || freshUser.phoneNumber || "",
          bloodType:
            freshUser.bloodType || roleData.bloodType || roleData.BloodType,
          location:
            freshUser.location || roleData.location || roleData.Location,
          address: freshUser.address || roleData.address || roleData.Address,
          organizationName:
            freshUser.organizationName ||
            freshUser.OrganizationName ||
            roleData.organizationName ||
            roleData.OrganizationName,
          eligibilityStatus:
            typeof freshUser.eligibilityStatus === "boolean"
              ? freshUser.eligibilityStatus
                ? "eligible"
                : "ineligible"
              : freshUser.eligibilityStatus ||
                roleData.eligibilityStatus ||
                roleData.EligibilityStatus,
          lastDonationDate:
            freshUser.lastDonationDate ||
            roleData.lastDonationDate ||
            roleData.LastDonationDate,
          profileImage: getCleanImageUrl(
            freshUser.profileImage ||
              freshUser.ProfileImage ||
              roleData.profileImage ||
              roleData.ProfileImage ||
              freshUser.avatar,
          ),
        };

        if (role === "donor") {
          setIsAvailable(!!roleData.isAvailable);
        }

        setUserData(normalized);
        // Also update local cache
        await AsyncStorage.setItem("userData", JSON.stringify(normalized));
      } catch (e) {
        // Fallback to cached data
        const userDataString = await AsyncStorage.getItem("userData");
        if (userDataString) {
          setUserData(JSON.parse(userDataString));
        } else {
          Alert.alert("Error", "No user data found. Please login again.");
          router.replace("/auth/login");
        }
      }
    } catch (error) {
      console.log("Error loading user data:", error);
      Alert.alert("Error", "Failed to load profile data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem("authToken");
          await AsyncStorage.removeItem("userData");
          router.replace("/auth/login");
        },
      },
    ]);
  };

  const handleAvailabilityToggle = async (value: boolean) => {
    setIsTogglingAvailability(true);
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token || !userData) {
        Alert.alert("Error", "Please login again");
        return;
      }

      console.log("Toggling availability to:", value);
      const response = await fetch(API_ENDPOINTS.DONOR_AVAILABILITY, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          isAvailable: value,
        }),
      });

      const data = await response.json();
      console.log("API Response status:", response.status);

      if (!response.ok) {
        // Handle 3-month restriction specifically
        if (data.nextAvailableDate || data.message?.includes("3 months")) {
          setStatusModalData({
            status: "cooling",
            lastDonation: data.lastDonationDate || userData.lastDonationDate,
            nextEligible: data.nextAvailableDate,
            message: data.message,
          });
          setStatusModalVisible(true);
          setIsAvailable(false); // Force false
          return;
        }
        throw new Error(data.message || "Failed to update availability");
      }

      console.log("API Response data:", data);
      setIsAvailable(value);

      // Persist the new token and user data returned by the server
      if (data.token && data.user) {
        await AsyncStorage.setItem("authToken", data.token);
        await AsyncStorage.setItem("userData", JSON.stringify(data.user));
      }

      // Show success modal
      setStatusModalData({
        status: value ? "available" : "unavailable",
        lastDonation: userData.lastDonationDate,
        message: `You are now ${value ? "available" : "unavailable"} for donations.`,
      });
      setStatusModalVisible(true);
    } catch (error: any) {
      console.log("Availability toggle error:", error);
      Alert.alert(
        "Update failed",
        getUserFriendlyError(error, "Failed to update availability status"),
      );
      setIsAvailable(!value); // Revert toggle on error
    } finally {
      setIsTogglingAvailability(false);
    }
  };

  const handleEdit = () => {
    router.push("/edit-profile" as any);
  };

  const getRoleIcon = (role: string) => {
    switch (role?.toLowerCase()) {
      case "donor":
        return "water";
      case "gainer":
        return "person";
      case "organization":
        return "business";
      default:
        return "person";
    }
  };

  const getRoleColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case "donor":
        return "#FF6B6B";
      case "gainer":
        return "#4ECDC4";
      case "organization":
        return "#95E1D3";
      default:
        return "#D11B31";
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D11B31" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!userData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>No user data available</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadUserData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const profileImageUri = getCleanImageUrl(userData.profileImage);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={28} color="#D11B31" />
        </TouchableOpacity>
        <View style={styles.headerSpacer} />
        <TouchableOpacity
          testID="profileEditButton"
          style={styles.editIconButton}
          onPress={handleEdit}
        >
          <Ionicons name="create-outline" size={24} color="#D11B31" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Image Section */}
        <View style={styles.profileImageSection}>
          <View
            style={[
              styles.profileImageContainer,
              { borderColor: getRoleColor(userData.role) },
            ]}
          >
            {profileImageUri ? (
              <Image
                source={{ uri: profileImageUri }}
                style={styles.profileImage}
                resizeMode="cover"
                onError={(e) => {
                  console.log(
                    "Profile Image Load Error:",
                    e.nativeEvent.error,
                    "URI:",
                    profileImageUri,
                  );
                }}
              />
            ) : (
              <Image
                source={require("../../assets/images/logo.png")}
                style={styles.profileImage}
                resizeMode="cover"
              />
            )}
            <View
              style={[
                styles.roleBadge,
                { backgroundColor: getRoleColor(userData.role) },
              ]}
            >
              <Ionicons
                name={getRoleIcon(userData.role)}
                size={16}
                color="#FFF"
              />
            </View>
          </View>
          <Text style={styles.profileName}>{userData.fullName}</Text>
          <Text style={styles.profileRole}>{userData.role?.toUpperCase()}</Text>
        </View>

        {/* Availability Toggle - Only for Donors */}
        {userData.role?.toLowerCase() === "donor" && (
          <View style={styles.availabilityContainer}>
            <TouchableOpacity
              style={styles.availabilityCard}
              onPress={() => {
                setStatusModalData({
                  status: isAvailable ? "available" : "unavailable",
                  lastDonation: userData.lastDonationDate,
                  message: isAvailable
                    ? "You are currently available for emergency donations."
                    : "You are currently unavailable. Toggle the switch to change your status.",
                });
                setStatusModalVisible(true);
              }}
            >
              <View style={styles.availabilityHeader}>
                <View style={styles.availabilityIconContainer}>
                  <Ionicons
                    name="checkmark-done-outline"
                    size={24}
                    color="#D11B31"
                  />
                </View>
                <View style={styles.availabilityContent}>
                  <Text style={styles.availabilityTitle}>
                    Available for Donation
                  </Text>
                  <Text style={styles.availabilityDescription}>
                    {isAvailable
                      ? "You are currently available"
                      : "You are currently unavailable"}
                  </Text>
                </View>
                <Switch
                  value={isAvailable}
                  onValueChange={handleAvailabilityToggle}
                  disabled={isTogglingAvailability}
                  trackColor={{ false: "#D1D5DB", true: "#FFB6C6" }}
                  thumbColor={isAvailable ? "#D11B31" : "#6B7280"}
                />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Your Card - Donor only */}
        {userData.role?.toLowerCase() === "donor" && (
          <View style={styles.cardContainer}>
            <TouchableOpacity
              style={styles.yourCardButton}
              activeOpacity={0.85}
              onPress={() => router.push("/donor-card" as any)}
            >
              <View style={styles.yourCardIconContainer}>
                <Ionicons name="card-outline" size={24} color="#D11B31" />
              </View>
              <View style={styles.yourCardContent}>
                <Text style={styles.yourCardTitle}>Your Card</Text>
                <Text style={styles.yourCardDescription}>
                  View your donor identity card
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          </View>
        )}

        {/* Details Section */}
        <View style={styles.detailsContainer}>
          <Text style={styles.sectionTitle}>Personal Information</Text>

          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <Ionicons name="mail-outline" size={20} color="#D11B31" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Email</Text>
                <Text style={styles.detailValue}>{userData.email}</Text>
              </View>
            </View>

            {userData.phone && (
              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Ionicons name="call-outline" size={20} color="#D11B31" />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Phone</Text>
                  <Text style={styles.detailValue}>{userData.phone}</Text>
                </View>
              </View>
            )}

            {userData.role?.toLowerCase() === "donor" && (
              <>
                {userData.bloodType && (
                  <View style={styles.detailRow}>
                    <View style={styles.detailIconContainer}>
                      <Ionicons
                        name="water-outline"
                        size={20}
                        color="#D11B31"
                      />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Blood Type</Text>
                      <Text style={styles.detailValue}>
                        {userData.bloodType}
                      </Text>
                    </View>
                  </View>
                )}

                {userData.location && (
                  <View style={styles.detailRow}>
                    <View style={styles.detailIconContainer}>
                      <Ionicons
                        name="location-outline"
                        size={20}
                        color="#D11B31"
                      />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Location</Text>
                      <Text style={styles.detailValue}>
                        {userData.location}
                      </Text>
                    </View>
                  </View>
                )}

                {userData.eligibilityStatus && (
                  <View style={styles.detailRow}>
                    <View style={styles.detailIconContainer}>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={20}
                        color="#D11B31"
                      />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Eligibility Status</Text>
                      <Text style={styles.detailValue}>
                        {userData.eligibilityStatus}
                      </Text>
                    </View>
                  </View>
                )}

                {userData.lastDonationDate && (
                  <View style={styles.detailRow}>
                    <View style={styles.detailIconContainer}>
                      <Ionicons
                        name="calendar-outline"
                        size={20}
                        color="#D11B31"
                      />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Last Donation</Text>
                      <Text style={styles.detailValue}>
                        {new Date(
                          userData.lastDonationDate,
                        ).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}

            {userData.role?.toLowerCase() === "gainer" && userData.address && (
              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Ionicons name="home-outline" size={20} color="#D11B31" />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Address</Text>
                  <Text style={styles.detailValue}>{userData.address}</Text>
                </View>
              </View>
            )}

            {userData.role?.toLowerCase() === "organization" && (
              <>
                {userData.organizationName && (
                  <View style={styles.detailRow}>
                    <View style={styles.detailIconContainer}>
                      <Ionicons
                        name="business-outline"
                        size={20}
                        color="#D11B31"
                      />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Organization Name</Text>
                      <Text style={styles.detailValue}>
                        {userData.organizationName}
                      </Text>
                    </View>
                  </View>
                )}

                {userData.location && (
                  <View style={styles.detailRow}>
                    <View style={styles.detailIconContainer}>
                      <Ionicons
                        name="location-outline"
                        size={20}
                        color="#D11B31"
                      />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Location</Text>
                      <Text style={styles.detailValue}>
                        {userData.location}
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* Account Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleHelpSupport}
          >
            <Ionicons name="help-circle-outline" size={22} color="#666" />
            <Text style={styles.actionButtonText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push("/privacy-policy")}
          >
            <Ionicons name="shield-checkmark-outline" size={22} color="#666" />
            <Text style={styles.actionButtonText}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color="#D11B31" />
            <Text style={[styles.actionButtonText, styles.logoutText]}>
              Logout
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        <DonationStatusModal
          visible={statusModalVisible}
          onClose={() => setStatusModalVisible(false)}
          {...statusModalData}
        />
      </ScrollView>

      <Navigation
        userType={(userData?.role as any) || "donor"}
        initialTab="profile"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    paddingTop: verticalScale(32),
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
    fontSize: moderateScale(16),
    color: "#D11B31",
    marginBottom: verticalScale(16),
  },
  retryButton: {
    backgroundColor: "#D11B31",
    paddingHorizontal: scale(24),
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(20),
  },
  retryButtonText: {
    color: "#FFF",
    fontSize: moderateScale(16),
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(12),
    paddingBottom: verticalScale(12),
    backgroundColor: "#FFF",
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
    fontWeight: "400",
  },
  headerSpacer: {
    flex: 1,
  },
  editIconButton: {
    padding: scale(8),
  },
  logoutText: {
    color: "#D11B31",
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: verticalScale(120),
  },
  profileImageSection: {
    alignItems: "center",
    paddingVertical: verticalScale(32),
    backgroundColor: "#FFF",
  },
  profileImageContainer: {
    width: scale(140),
    height: verticalScale(140),
    borderRadius: moderateScale(70),
    borderWidth: moderateScale(4),
    padding: scale(4),
    backgroundColor: "#FFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    position: "relative",
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: moderateScale(70),
  },
  roleBadge: {
    position: "absolute",
    bottom: verticalScale(8),
    right: scale(8),
    width: scale(36),
    height: scale(36),
    borderRadius: moderateScale(18),
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFF",
  },
  profileName: {
    fontSize: moderateScale(26),
    fontWeight: "700",
    color: "#000",
    marginTop: verticalScale(16),
  },
  profileRole: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: "#D11B31",
    marginTop: verticalScale(4),
    letterSpacing: 1,
  },
  detailsContainer: {
    paddingHorizontal: scale(20),
    marginTop: verticalScale(24),
  },
  sectionTitle: {
    fontSize: moderateScale(18),
    fontWeight: "700",
    color: "#000",
    marginBottom: verticalScale(12),
  },
  detailCard: {
    backgroundColor: "#FFF",
    borderRadius: moderateScale(16),
    padding: scale(16),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: verticalScale(12),
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  detailIconContainer: {
    width: scale(40),
    height: scale(40),
    borderRadius: moderateScale(20),
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    marginRight: scale(12),
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: moderateScale(13),
    color: "#666",
    marginBottom: verticalScale(2),
  },
  detailValue: {
    fontSize: moderateScale(16),
    color: "#000",
    fontWeight: "500",
  },
  availabilityContainer: {
    paddingHorizontal: scale(20),
    marginTop: verticalScale(24),
    marginBottom: verticalScale(12),
  },
  availabilityCard: {
    backgroundColor: "#FFF",
    borderRadius: moderateScale(16),
    padding: scale(16),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  availabilityHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  availabilityIconContainer: {
    width: scale(48),
    height: scale(48),
    borderRadius: moderateScale(24),
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    marginRight: scale(12),
  },
  availabilityContent: {
    flex: 1,
  },
  availabilityTitle: {
    fontSize: moderateScale(16),
    fontWeight: "600",
    color: "#000",
    marginBottom: verticalScale(2),
  },
  availabilityDescription: {
    fontSize: moderateScale(13),
    color: "#666",
  },
  actionsContainer: {
    paddingHorizontal: scale(20),
    marginTop: verticalScale(24),
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    paddingVertical: verticalScale(16),
    paddingHorizontal: scale(16),
    borderRadius: moderateScale(12),
    marginBottom: verticalScale(12),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  actionButtonText: {
    flex: 1,
    fontSize: moderateScale(16),
    color: "#333",
    marginLeft: scale(12),
    fontWeight: "500",
  },
  cardContainer: {
    paddingHorizontal: scale(20),
    marginTop: verticalScale(16),
  },
  yourCardButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: moderateScale(16),
    padding: scale(16),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  yourCardIconContainer: {
    width: scale(48),
    height: scale(48),
    borderRadius: moderateScale(24),
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    marginRight: scale(12),
  },
  yourCardContent: {
    flex: 1,
  },
  yourCardTitle: {
    fontSize: moderateScale(16),
    fontWeight: "600",
    color: "#000",
    marginBottom: verticalScale(2),
  },
  yourCardDescription: {
    fontSize: moderateScale(13),
    color: "#666",
  },
});
