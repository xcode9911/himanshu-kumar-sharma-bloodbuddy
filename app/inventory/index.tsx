import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";
import AddInventoryModal from "../../components/AddInventoryModal";
import InventoryHistoryModal from "../../components/InventoryHistoryModal";
import { API_ENDPOINTS } from "../../config/api";
import { Fonts } from "../../constants/theme";
import { getUserFriendlyError } from "../../utils/errorMessages";
import { moderateScale, scale, verticalScale } from "../../utils/responsive";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const initialInventory = [
  { id: 1, bloodType: "A+", units: 50 },
  { id: 2, bloodType: "O-", units: 30 },
  { id: 3, bloodType: "AB+", units: 80 },
  { id: 4, bloodType: "B+", units: 20 },
];

export default function InventoryScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [modalVisible, setModalVisible] = useState(false);
  const [bloodType, setBloodType] = useState("AB+");
  const [units, setUnits] = useState("");
  const [inventory, setInventory] = useState(initialInventory);
  const [filter, setFilter] = useState("All");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    id: number;
    bloodType: string;
    units: number;
  } | null>(null);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [organizationName, setOrganizationName] = useState("");

  // Responsive logic
  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const numColumns = isDesktop ? 3 : isTablet ? 2 : 1;
  const GAP_SIZE = 16;
  const contentWidth = Math.min(width, 1200); // Max container width

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
        Alert.alert("Error", "Please login again.");
        return;
      }

      const response = await fetch(API_ENDPOINTS.GET_INVENTORY, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const msg =
          (data && (data.message || data.error)) || "Failed to fetch inventory";
        throw new Error(msg);
      }

      const list = data?.inventory || data?.data || data?.items || data || [];

      setOrganizationName(data?.organizationName || "");

      const normalized = Array.isArray(list)
        ? list.map((it: any) => ({
            id: it?.id || it?._id || Date.now() + Math.random(),
            bloodType: it?.bloodType || it?.blood_group || it?.type,
            units: Number(it?.units ?? it?.quantity ?? 0),
          }))
        : [];

      setInventory(normalized);
    } catch (e: any) {
      Alert.alert(
        "Unable to load inventory",
        getUserFriendlyError(e, "Failed to fetch inventory"),
      );
      // keep existing inventory (fallback)
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleAddInventorySuccess = async () => {
    setModalVisible(false);
    setUnits("");
    setBloodType("AB+");
    setEditingItem(null);
    await fetchInventory(); // Refresh list
  };

  const handleDeleteInventory = async (item: {
    id: number;
    bloodType: string;
    units: number;
  }) => {
    Alert.alert(
      "Delete Inventory",
      `Are you sure you want to delete ${item.bloodType} with ${item.units} units?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem("authToken");
              if (!token) {
                Alert.alert("Error", "Please login again.");
                return;
              }

              const response = await fetch(
                API_ENDPOINTS.DELETE_INVENTORY(item.bloodType),
                {
                  method: "DELETE",
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                },
              );

              const data = await response.json().catch(() => null);
              if (!response.ok) {
                const msg =
                  (data && (data.message || data.error)) ||
                  "Failed to delete inventory";
                throw new Error(msg);
              }

              setInventory((prev) => prev.filter((i) => i.id !== item.id));
              Alert.alert("Success", "Inventory deleted successfully");
            } catch (e: any) {
              Alert.alert(
                "Delete failed",
                getUserFriendlyError(e, "Failed to delete inventory"),
              );
            }
          },
        },
      ],
    );
  };

  const handleEditInventory = (item: {
    id: number;
    bloodType: string;
    units: number;
  }) => {
    setEditingItem(item);
    setBloodType(item.bloodType);
    setUnits(item.units.toString());
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setUnits("");
    setBloodType("AB+");
    setEditingItem(null);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchInventory();
    setRefreshing(false);
  };

  const filteredInventory = inventory.filter(
    (item) => filter === "All" || item.bloodType === filter,
  );

  const renderInventoryCard = ({
    item,
  }: {
    item: { id: number; bloodType: string; units: number };
  }) => (
    <View style={[styles.premiumCardContainer, { flex: 1 / numColumns }]}>
      <View style={styles.cardGradient}>
        <View style={styles.cardTopSection}>
          <View style={styles.bloodTypeBadge}>
            <Ionicons name="water" size={moderateScale(28)} color="#FFFFFF" />
          </View>
          <View style={styles.cardHeaderContent}>
            <Text style={styles.bloodTypeLabel}>Blood Type</Text>
            <Text style={styles.bloodType}>{item.bloodType}</Text>
          </View>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => handleEditInventory(item)}
              activeOpacity={0.6}
            >
              <Ionicons
                name="create-outline"
                size={moderateScale(20)}
                color="#007AFF"
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteInventory(item)}
              activeOpacity={0.6}
            >
              <Ionicons
                name="trash-outline"
                size={moderateScale(20)}
                color="#FF3B30"
              />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.cardDivider} />
        <View style={styles.cardBottomSection}>
          <View style={styles.unitsSection}>
            <Text style={styles.unitsLabel}>Available Units</Text>
            <View style={styles.unitsDisplay}>
              <Text style={styles.unitsNumber}>{item.units}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name="search-outline"
        size={moderateScale(64)}
        color="#D1D5DB"
      />
      <Text style={styles.emptyStateTitle}>No inventory found</Text>
      <Text style={styles.emptyStateText}>
        {filter === "All"
          ? "No inventory available"
          : "No inventory for this blood type"}
      </Text>
    </View>
  );

  if (loading && inventory.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading inventory...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.contentContainer,
          { width: contentWidth, alignSelf: "center" },
        ]}
      >
        {/* Dropdown and Add Button Row */}
        <View style={styles.topRow}>
          <View style={styles.dropdownContainer}>
            <TouchableOpacity
              style={styles.dropdown}
              activeOpacity={0.8}
              onPress={() => setDropdownOpen((open) => !open)}
            >
              <Text style={styles.dropdownText}>
                {filter === "All" ? "All Blood Types" : filter}
              </Text>
              <Ionicons
                name={dropdownOpen ? "chevron-up" : "chevron-down"}
                size={moderateScale(18)}
                color="#D11B31"
                style={{ marginLeft: scale(8) }}
              />
            </TouchableOpacity>
            {dropdownOpen && (
              <View style={styles.dropdownList}>
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    filter === "All" && styles.dropdownItemActive,
                  ]}
                  onPress={() => {
                    setFilter("All");
                    setDropdownOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      filter === "All" && styles.dropdownItemTextActive,
                    ]}
                  >
                    All Blood Types
                  </Text>
                  {filter === "All" && (
                    <Ionicons
                      name="checkmark"
                      size={moderateScale(20)}
                      color="#FFFFFF"
                    />
                  )}
                </TouchableOpacity>
                {BLOOD_TYPES.map((type, index) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.dropdownItem,
                      filter === type && styles.dropdownItemActive,
                      index < BLOOD_TYPES.length - 1 &&
                        styles.dropdownItemBorder,
                    ]}
                    onPress={() => {
                      setFilter(type);
                      setDropdownOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        filter === type && styles.dropdownItemTextActive,
                      ]}
                    >
                      {type}
                    </Text>
                    {filter === type && (
                      <Ionicons
                        name="checkmark"
                        size={moderateScale(20)}
                        color="#FFFFFF"
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <TouchableOpacity
            testID="addInventoryOpenButton"
            style={styles.redAddButton}
            onPress={() => {
              setEditingItem(null);
              setBloodType("AB+");
              setUnits("");
              setModalVisible(true);
            }}
          >
            <Ionicons name="add" size={moderateScale(28)} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.reportButton}
            onPress={() => {
              setHistoryModalVisible(true);
            }}
          >
            <Ionicons
              name="document-text-outline"
              size={moderateScale(28)}
              color="#fff"
            />
          </TouchableOpacity>
        </View>

        {/* Inventory List as Responsive Grid */}
        <FlatList
          key={`grid-${numColumns}`} // Force re-render when columns change
          data={filteredInventory}
          renderItem={renderInventoryCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.gridListContainer}
          columnWrapperStyle={numColumns > 1 ? { gap: GAP_SIZE } : undefined}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#D11B31"]}
            />
          }
          numColumns={numColumns}
        />

        <AddInventoryModal
          visible={modalVisible}
          onClose={handleCloseModal}
          onSuccess={handleAddInventorySuccess}
          bloodType={bloodType}
          setBloodType={setBloodType}
          units={units}
          setUnits={setUnits}
          bloodTypes={BLOOD_TYPES}
          title={editingItem ? "Edit Inventory" : "Add Inventory"}
          submitButtonText={editingItem ? "Update" : "Add"}
          isEditMode={!!editingItem}
          editingBloodType={editingItem?.bloodType}
        />

        <InventoryHistoryModal
          visible={historyModalVisible}
          onClose={() => setHistoryModalVisible(false)}
          organizationName={organizationName}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  contentContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#202020",
  },
  loadingText: {
    marginTop: verticalScale(12),
    fontSize: moderateScale(14),
    color: "#AAAAAA",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(60),
    paddingBottom: verticalScale(12),
    backgroundColor: "#fff",
    zIndex: 10,
  },
  dropdownContainer: {
    flex: 1,
    position: "relative",
    zIndex: 20,
    maxWidth: 400, // Limit dropdown width on large screens
  },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FEE2E2",
    borderRadius: moderateScale(20),
    paddingHorizontal: scale(18),
    paddingVertical: verticalScale(14),
    borderWidth: moderateScale(2),
    borderColor: "#D11B31",
  },
  dropdownText: {
    fontSize: moderateScale(15),
    color: "#333333",
    fontWeight: "600",
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
  dropdownItemText: {
    fontSize: moderateScale(16),
    color: "#111827",
    fontWeight: "500",
  },
  dropdownItemTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  redAddButton: {
    backgroundColor: "#D11B31",
    borderRadius: moderateScale(26),
    width: moderateScale(50),
    height: moderateScale(50),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: moderateScale(2) },
    shadowOpacity: 0.1,
    shadowRadius: moderateScale(4),
    elevation: 3,
    marginLeft: scale(12),
  },
  notificationButton: {
    backgroundColor: "#FEE2E2",
    borderRadius: moderateScale(20),
    width: moderateScale(50),
    height: moderateScale(50),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: moderateScale(1),
    borderColor: "#D11B31",
    marginLeft: scale(12),
  },
  reportButton: {
    backgroundColor: "#D11B31",
    borderRadius: moderateScale(26),
    width: moderateScale(50),
    height: moderateScale(50),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: moderateScale(2) },
    shadowOpacity: 0.1,
    shadowRadius: moderateScale(4),
    elevation: 3,
    marginLeft: scale(12),
  },
  gridListContainer: {
    padding: scale(16),
    paddingBottom: verticalScale(100),
  },
  premiumCardContainer: {
    marginBottom: verticalScale(16),
    // When 1 column, adding extra margin here ensures consistency with standard list view
    // But in grid we handle spacing via gap/margin
  },
  cardGradient: {
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(24),
    padding: scale(20),
    shadowColor: "#D11B31",
    shadowOffset: { width: 0, height: moderateScale(4) },
    shadowOpacity: 0.15,
    shadowRadius: moderateScale(12),
    elevation: 5,
    borderWidth: moderateScale(2),
    borderColor: "#FEE2E2",
    overflow: "hidden",
    flex: 1, // Ensure card fills height in grid
  },
  cardTopSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: verticalScale(16),
  },
  bloodTypeBadge: {
    width: moderateScale(56),
    height: moderateScale(56),
    borderRadius: moderateScale(20),
    backgroundColor: "#D11B31",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#D11B31",
    shadowOffset: { width: 0, height: moderateScale(2) },
    shadowOpacity: 0.3,
    shadowRadius: moderateScale(4),
    elevation: 3,
  },
  cardHeaderContent: {
    flex: 1,
    marginLeft: scale(14),
  },
  actionButtons: {
    flexDirection: "row",
    gap: scale(6),
  },
  editButton: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(18),
    backgroundColor: "rgba(0, 122, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButton: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(18),
    backgroundColor: "rgba(255, 59, 48, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  bloodTypeLabel: {
    fontSize: moderateScale(11),
    color: "#6B7280",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: verticalScale(4),
  },
  bloodType: {
    fontSize: moderateScale(28),
    fontWeight: "800",
    color: "#D11B31",
    fontFamily: Fonts.rounded || Fonts.sans,
    letterSpacing: -0.5,
  },
  cardDivider: {
    height: moderateScale(1),
    backgroundColor: "#FEE2E2",
    marginVertical: verticalScale(12),
  },
  cardBottomSection: {
    marginTop: verticalScale(4),
  },
  unitsSection: {
    alignItems: "flex-start",
  },
  unitsLabel: {
    fontSize: moderateScale(11),
    color: "#6B7280",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: verticalScale(6),
  },
  unitsDisplay: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  unitsNumber: {
    fontSize: moderateScale(32),
    fontWeight: "800",
    color: "#111827",
    fontFamily: Fonts.rounded || Fonts.sans,
    letterSpacing: -1,
  },
  unitsText: {
    fontSize: moderateScale(14),
    color: "#6B7280",
    fontWeight: "600",
    marginLeft: scale(2),
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: verticalScale(60),
    width: "100%", // ensure it takes full width
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
  // Modal styles (inherited, no major changes needed as Modal adjusts)
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    maxWidth: scale(400),
    backgroundColor: "#fff",
    borderRadius: moderateScale(26),
    padding: moderateScale(28),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: moderateScale(4) },
    shadowOpacity: 0.15,
    shadowRadius: moderateScale(16),
    elevation: 8,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: moderateScale(22),
    fontWeight: "700",
    color: "#D11B31",
    marginBottom: verticalScale(18),
    fontFamily: Fonts.rounded || Fonts.sans,
  },
  label: {
    alignSelf: "flex-start",
    fontSize: moderateScale(16),
    color: "#000000",
    marginTop: verticalScale(10),
    marginBottom: verticalScale(8),
    fontWeight: "600",
  },
  bloodTypeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scale(8),
    marginBottom: verticalScale(10),
  },
  bloodTypeButton: {
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(16),
    borderRadius: moderateScale(20),
    backgroundColor: "#FEE2E2",
    marginRight: scale(6),
    marginBottom: verticalScale(6),
  },
  bloodTypeSelected: {
    backgroundColor: "#D11B31",
  },
  bloodTypeText: {
    color: "#888",
    fontWeight: "500",
    fontSize: moderateScale(14),
  },
  bloodTypeTextSelected: {
    color: "#fff",
    fontWeight: "700",
  },
  input: {
    width: "100%",
    borderWidth: 0,
    borderRadius: moderateScale(20),
    paddingHorizontal: scale(18),
    paddingVertical: verticalScale(14),
    fontSize: moderateScale(15),
    marginBottom: verticalScale(18),
    color: "#333333",
    backgroundColor: "#FEE2E2",
  },
  saveButton: {
    width: "100%",
    backgroundColor: "#D11B31",
    borderRadius: moderateScale(26),
    paddingVertical: verticalScale(16),
    alignItems: "center",
    marginBottom: verticalScale(10),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: moderateScale(2) },
    shadowOpacity: 0.1,
    shadowRadius: moderateScale(4),
    elevation: 3,
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: moderateScale(16),
    letterSpacing: 0.5,
  },
  cancelButton: {
    width: "100%",
    backgroundColor: "#FEE2E2",
    borderRadius: moderateScale(20),
    paddingVertical: verticalScale(14),
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#666666",
    fontWeight: "600",
    fontSize: moderateScale(15),
  },
});
