import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Navigation from "../../components/Navigation";
import { API_ENDPOINTS } from "../../config/api";
import { getCleanImageUrl } from "../../utils/image";
import { moderateScale, scale, verticalScale } from "../../utils/responsive";

type UserType = "gainer" | "donor" | "organization";

interface Organization {
  id: string;
  name: string;
  type: string;
  address: string;
  state: string;
  phone: string;
  email: string;
  bloodTypes: string[];
  distance?: number;
  availableUnits?: number;
  profileImage?: any;
}

interface OrganizationScreenProps {
  hideNavigation?: boolean;
}

const ORGANIZATIONS_PER_PAGE = 2;
const PAYMENTS_PER_PAGE = 5;

export default function OrganizationScreen({
  hideNavigation = false,
}: OrganizationScreenProps = {}) {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [filteredOrganizations, setFilteredOrganizations] = useState<
    Organization[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userType, setUserType] = useState<UserType>("donor");
  const [activeCategory, setActiveCategory] = useState<
    "organizations" | "payments"
  >("organizations");
  const [payments, setPayments] = useState<any[]>([]);
  const [organizationPage, setOrganizationPage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);

  const isDonorUser = userType === "donor";
  const isPaymentsView = activeCategory === "payments" && !isDonorUser;

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (isDonorUser && activeCategory === "payments") {
      setActiveCategory("organizations");
      return;
    }

    if (activeCategory === "organizations") {
      loadOrganizations();
    } else {
      loadPayments();
    }
  }, [activeCategory, isDonorUser]);

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

  useEffect(() => {
    filterOrganizations();
  }, [searchQuery, organizations]);

  useEffect(() => {
    setOrganizationPage(1);
  }, [searchQuery, activeCategory]);

  useEffect(() => {
    setPaymentPage(1);
  }, [activeCategory]);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("authToken");
      // Start with empty to clear potentially stale data if needed, or keep to flicker less options

      const response = await fetch(API_ENDPOINTS.GET_ORGANIZATIONS, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        console.log("Failed to fetch organizations:", data);
        // Fallback to empty if failed, or handle error
        // For now, just log it so we don't break the UI completely
      }

      // Handle different possible response structures
      const list =
        data?.organizations || data?.data || (Array.isArray(data) ? data : []);

      const normalized: Organization[] = Array.isArray(list)
        ? list.map((org: any) => {
            const inventory = Array.isArray(org.inventory) ? org.inventory : [];
            const bloodTypes = inventory.map((item: any) => item.bloodType);
            const totalUnits = inventory.reduce(
              (sum: number, item: any) => sum + (Number(item.units) || 0),
              0,
            );

            return {
              id: String(org.organizationId || org.id || Math.random()),
              name: org.organizationName || org.name || "Unknown Organization",
              type: "Blood Bank",
              address: org.location || org.address || "",
              state: org.state || "",
              phone: org.phone || org.contact || "",
              email: org.email || "",
              bloodTypes: bloodTypes,
              distance: org.distance,
              availableUnits: totalUnits,
              inventory: inventory,
              profileImage: org.profileImage,
            };
          })
        : [];

      setOrganizations(normalized);
      setFilteredOrganizations(normalized);
    } catch (error) {
      console.log("Error loading organizations:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (isPaymentsView) {
      await loadPayments();
    } else {
      await loadOrganizations();
    }
    setRefreshing(false);
  };

  const loadPayments = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("authToken");
      if (!token) return;

      const response = await fetch(API_ENDPOINTS.GET_PAYMENT_HISTORY, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setPayments(data.payments || []);
      }
    } catch (error) {
      console.log("Error loading payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterOrganizations = () => {
    if (!searchQuery.trim()) {
      setFilteredOrganizations(organizations);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = organizations.filter(
      (org) =>
        org.name.toLowerCase().includes(query) ||
        org.type.toLowerCase().includes(query) ||
        org.bloodTypes.some((type) => type.toLowerCase().includes(query)),
    );
    setFilteredOrganizations(filtered);
  };

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "blood bank":
        return "#D11B31";
      case "hospital":
        return "#2563EB";
      case "non-profit":
        return "#059669";
      case "community center":
        return "#7C3AED";
      default:
        return "#6B7280";
    }
  };

  const renderOrganizationCard = ({ item }: { item: Organization }) => (
    <TouchableOpacity
      testID="orgCard"
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => {
        const logoUrl = getCleanImageUrl(item.profileImage) || "";

        router.push({
          pathname: "/organization/[id]",
          params: {
            id: item.id,
            name: item.name,
            address: item.address,
            phone: item.phone,
            email: item.email,
            logoUrl,
            availableUnits: item.availableUnits,
            bloodTypes: JSON.stringify(item.bloodTypes),
            inventory: JSON.stringify((item as any).inventory || []),
          },
        });
      }}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: `${getTypeColor(item.type)}20`,
                overflow: "hidden",
              },
            ]}
          >
            {item.profileImage ? (
              <Image
                source={{
                  uri: getCleanImageUrl(item.profileImage) || "",
                }}
                style={{ width: "100%", height: "100%", resizeMode: "cover" }}
              />
            ) : (
              <Ionicons
                name="business"
                size={24}
                color={getTypeColor(item.type)}
              />
            )}
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.organizationName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.typeContainer}>
              <Text
                style={[styles.typeText, { color: getTypeColor(item.type) }]}
              >
                {item.type}
              </Text>
            </View>
          </View>
        </View>
        {item.distance && (
          <View style={styles.distanceContainer}>
            <Ionicons name="location" size={16} color="#6B7280" />
            <Text style={styles.distanceText}>{item.distance} km</Text>
          </View>
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={18} color="#6B7280" />
          <Text style={styles.infoText} numberOfLines={1}>
            {item.address}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="call-outline" size={18} color="#6B7280" />
          <Text style={styles.infoText}>{item.phone}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="mail-outline" size={18} color="#6B7280" />
          <Text style={styles.infoText} numberOfLines={1}>
            {item.email}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.bloodTypesContainer}>
          <Text style={styles.bloodTypesLabel}>Available:</Text>
          <View style={styles.bloodTypesList}>
            {item.bloodTypes.slice(0, 4).map((type) => (
              <View key={type} style={styles.bloodTypeBadge}>
                <Text style={styles.bloodTypeText}>{type}</Text>
              </View>
            ))}
            {item.bloodTypes.length > 4 && (
              <Text style={styles.moreText}>+{item.bloodTypes.length - 4}</Text>
            )}
          </View>
        </View>

        {item.availableUnits !== undefined && (
          <View style={styles.unitsContainer}>
            <Ionicons name="water" size={16} color="#D11B31" />
            <Text style={styles.unitsText}>{item.availableUnits} units</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderPaymentCard = ({ item }: { item: any }) => {
    const provider = item.Provider?.toLowerCase() || "";

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor:
                    provider === "khalti"
                      ? "#5C2D9120"
                      : provider === "esewa"
                        ? "#60BB4620"
                        : "#6366F120",
                },
              ]}
            >
              {provider === "khalti" ? (
                <Image
                  source={require("../../assets/images/khalti-logo.png")}
                  style={{ width: 24, height: 24, resizeMode: "contain" }}
                />
              ) : provider === "esewa" ? (
                <Image
                  source={require("../../assets/images/esewa-logo.png")}
                  style={{ width: 24, height: 24, resizeMode: "contain" }}
                />
              ) : (
                <Ionicons name="card" size={24} color="#D11B31" />
              )}
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.organizationName} numberOfLines={1}>
                {item.request?.organization?.OrganizationName ||
                  "Blood Payment"}
              </Text>
              <Text style={styles.typeText}>{item.Provider} Payment</Text>
            </View>
          </View>
          <View style={styles.statusBadge}>
            <Text style={[styles.statusText, { color: "#059669" }]}>
              ₹{item.Amount}
            </Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Ionicons name="receipt-outline" size={18} color="#6B7280" />
            <Text style={styles.infoText}>Payment ID: {item.PaymentId}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={18} color="#6B7280" />
            <Text style={styles.infoText}>
              {new Date(item.PaymentDate).toLocaleDateString()} at{" "}
              {new Date(item.PaymentDate).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="water-outline" size={18} color="#6B7280" />
            <Text style={styles.infoText}>
              {item.request?.BloodType} - {item.request?.Units} units
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="search-outline" size={64} color="#D1D5DB" />
      <Text style={styles.emptyStateTitle}>
        {isPaymentsView ? "No payments found" : "No organizations found"}
      </Text>
      <Text style={styles.emptyStateText}>
        {isPaymentsView
          ? "No payment records are available"
          : searchQuery
            ? "Try adjusting your search"
            : "No organizations available"}
      </Text>
    </View>
  );

  const organizationTotalPages = Math.max(
    1,
    Math.ceil(filteredOrganizations.length / ORGANIZATIONS_PER_PAGE),
  );
  const paymentTotalPages = Math.max(
    1,
    Math.ceil(payments.length / PAYMENTS_PER_PAGE),
  );

  useEffect(() => {
    setOrganizationPage((prev) => Math.min(prev, organizationTotalPages));
  }, [organizationTotalPages]);

  useEffect(() => {
    setPaymentPage((prev) => Math.min(prev, paymentTotalPages));
  }, [paymentTotalPages]);

  const paginatedOrganizations = useMemo(() => {
    const start = (organizationPage - 1) * ORGANIZATIONS_PER_PAGE;
    return filteredOrganizations.slice(start, start + ORGANIZATIONS_PER_PAGE);
  }, [filteredOrganizations, organizationPage]);

  const paginatedPayments = useMemo(() => {
    const start = (paymentPage - 1) * PAYMENTS_PER_PAGE;
    return payments.slice(start, start + PAYMENTS_PER_PAGE);
  }, [payments, paymentPage]);

  const listData = isPaymentsView ? paginatedPayments : paginatedOrganizations;
  const totalItems = isPaymentsView
    ? payments.length
    : filteredOrganizations.length;
  const totalPages = isPaymentsView
    ? paymentTotalPages
    : organizationTotalPages;
  const currentPage = isPaymentsView ? paymentPage : organizationPage;
  const perPage = isPaymentsView ? PAYMENTS_PER_PAGE : ORGANIZATIONS_PER_PAGE;
  const showPagination = totalItems > perPage;

  const handleNextPage = () => {
    if (isPaymentsView) {
      setPaymentPage((prev) => Math.min(prev + 1, paymentTotalPages));
      return;
    }

    setOrganizationPage((prev) => Math.min(prev + 1, organizationTotalPages));
  };

  const handlePreviousPage = () => {
    if (isPaymentsView) {
      setPaymentPage((prev) => Math.max(prev - 1, 1));
      return;
    }

    setOrganizationPage((prev) => Math.max(prev - 1, 1));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D11B31" />
        <Text style={styles.loadingText}>Loading organizations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, city, or blood type..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {!isDonorUser && (
          <View style={styles.categoryToggleContainer}>
            <TouchableOpacity
              style={[
                styles.categoryTab,
                activeCategory === "organizations" && styles.activeCategoryTab,
              ]}
              onPress={() => setActiveCategory("organizations")}
            >
              <Text
                style={[
                  styles.categoryTabText,
                  activeCategory === "organizations" &&
                    styles.activeCategoryTabText,
                ]}
              >
                Organizations
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.categoryTab,
                activeCategory === "payments" && styles.activeCategoryTab,
              ]}
              onPress={() => setActiveCategory("payments")}
            >
              <Text
                style={[
                  styles.categoryTabText,
                  activeCategory === "payments" && styles.activeCategoryTabText,
                ]}
              >
                Payments
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            {isPaymentsView
              ? `${payments.length} ${payments.length === 1 ? "Payment" : "Payments"}`
              : `${filteredOrganizations.length} ${
                  filteredOrganizations.length === 1
                    ? "Organization"
                    : "Organizations"
                }`}
          </Text>
        </View>
      </View>

      {/* List content based on category */}
      <FlatList
        data={listData}
        renderItem={isPaymentsView ? renderPaymentCard : renderOrganizationCard}
        keyExtractor={(item: any) =>
          isPaymentsView ? String(item.PaymentId) : item.id
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#D11B31"]}
          />
        }
        ListFooterComponent={() =>
          showPagination ? (
            <View
              style={[
                styles.paginationContainer,
                !hideNavigation && { marginBottom: verticalScale(86) },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  currentPage <= 1 && styles.paginationButtonDisabled,
                ]}
                onPress={handlePreviousPage}
                disabled={currentPage <= 1}
              >
                <Ionicons name="chevron-back" size={18} color="#D11B31" />
                <Text style={styles.paginationButtonText}>Previous</Text>
              </TouchableOpacity>

              <Text style={styles.paginationInfo}>
                Page {currentPage} of {totalPages}
              </Text>

              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  currentPage >= totalPages && styles.paginationButtonDisabled,
                ]}
                onPress={handleNextPage}
                disabled={currentPage >= totalPages}
              >
                <Text style={styles.paginationButtonText}>Next</Text>
                <Ionicons name="chevron-forward" size={18} color="#D11B31" />
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      {/* Pagination moved into FlatList footer to appear after the second card */}

      {/* Navigation Bar - only show if not hidden */}
      {!hideNavigation && (
        <Navigation userType={userType} initialTab="organization" />
      )}
    </View>
  );
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
  searchContainer: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(60),
    paddingBottom: verticalScale(12),
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
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
  searchInput: {
    flex: 1,
    fontSize: moderateScale(15),
    color: "#111827",
  },
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: verticalScale(12),
  },
  resultsCount: {
    fontSize: moderateScale(14),
    color: "#6B7280",
    fontWeight: "500",
    textAlign: "center",
  },
  listContainer: {
    padding: scale(16),
    paddingBottom: verticalScale(100),
  },
  paginationContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(10),
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  paginationButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(10),
    borderRadius: moderateScale(10),
    backgroundColor: "#FEE2E2",
  },
  paginationButtonDisabled: {
    opacity: 0.45,
  },
  paginationButtonText: {
    fontSize: moderateScale(13),
    fontWeight: "700",
    color: "#D11B31",
  },
  paginationInfo: {
    fontSize: moderateScale(13),
    color: "#6B7280",
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(16),
    padding: scale(16),
    marginBottom: verticalScale(16),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: scale(12),
  },
  iconContainer: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(12),
    justifyContent: "center",
    alignItems: "center",
  },
  cardHeaderText: {
    flex: 1,
  },
  organizationName: {
    fontSize: moderateScale(16),
    fontWeight: "600",
    color: "#111827",
    marginBottom: verticalScale(4),
  },
  typeContainer: {
    alignSelf: "flex-start",
  },
  typeText: {
    fontSize: moderateScale(12),
    fontWeight: "600",
  },
  distanceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
    backgroundColor: "#F3F4F6",
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(8),
  },
  distanceText: {
    fontSize: moderateScale(12),
    color: "#6B7280",
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: verticalScale(12),
  },
  cardBody: {
    gap: verticalScale(8),
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
  },
  infoText: {
    flex: 1,
    fontSize: moderateScale(14),
    color: "#4B5563",
  },
  cardFooter: {
    marginTop: verticalScale(12),
    paddingTop: verticalScale(12),
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bloodTypesContainer: {
    flex: 1,
  },
  bloodTypesLabel: {
    fontSize: moderateScale(12),
    color: "#6B7280",
    marginBottom: verticalScale(6),
    fontWeight: "500",
  },
  bloodTypesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scale(6),
    alignItems: "center",
  },
  bloodTypeBadge: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(6),
  },
  bloodTypeText: {
    fontSize: moderateScale(12),
    color: "#DC2626",
    fontWeight: "600",
  },
  moreText: {
    fontSize: moderateScale(12),
    color: "#6B7280",
    fontWeight: "500",
  },
  unitsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
    backgroundColor: "#FEF2F2",
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(6),
    borderRadius: moderateScale(8),
  },
  unitsText: {
    fontSize: moderateScale(12),
    color: "#D11B31",
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: verticalScale(60),
  },
  emptyStateTitle: {
    fontSize: moderateScale(18),
    fontWeight: "600",
    color: "#111827",
    marginTop: verticalScale(16),
    marginBottom: verticalScale(8),
  },
  emptyStateText: {
    fontSize: moderateScale(14),
    color: "#6B7280",
    textAlign: "center",
  },
  categoryToggleContainer: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: moderateScale(12),
    marginTop: verticalScale(16),
    padding: scale(4),
  },
  categoryTab: {
    flex: 1,
    paddingVertical: verticalScale(8),
    alignItems: "center",
    borderRadius: moderateScale(8),
  },
  activeCategoryTab: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryTabText: {
    fontSize: moderateScale(14),
    fontWeight: "500",
    color: "#6B7280",
  },
  activeCategoryTabText: {
    color: "#D11B31",
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(10),
    backgroundColor: "#ECFDF5",
  },
  statusText: {
    fontSize: moderateScale(12),
    fontWeight: "700",
  },
});
