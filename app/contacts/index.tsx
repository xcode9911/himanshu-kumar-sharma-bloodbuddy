import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    RefreshControl,
    ScrollView,
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

interface Contact {
  id: string;
  name: string;
  phone: string;
  bloodType?: string;
  address: string;
  city: string;
  email: string;
  lastDonation?: string;
  role: string;
  location?: string;
  isAvailable?: boolean;
  inventory?: { bloodType: string; units: number }[];
  profileImage?: any;
}

interface ContactsScreenProps {
  hideNavigation?: boolean;
}

const CONTACTS_PER_PAGE = 5;

export default function ContactsScreen({
  hideNavigation = false,
}: ContactsScreenProps = {}) {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userType, setUserType] = useState<UserType>("donor");
  const [activeCategory, setActiveCategory] = useState<
    "organization" | "donor"
  >("organization");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [contactsPage, setContactsPage] = useState(1);

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    loadContacts();
  }, [userType, activeCategory]);

  useEffect(() => {
    filterContacts();
  }, [searchQuery, contacts]);

  useEffect(() => {
    setContactsPage(1);
  }, [searchQuery, activeCategory]);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem("userData");
      if (userData) {
        const parsed = JSON.parse(userData);
        setUserType(parsed.role || "donor");
      }
    } catch (error) {
      console.log("Error loading user data:", error);
    }
  };

  const loadContacts = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("authToken");

      let url = "";
      if (userType === "gainer") {
        url =
          activeCategory === "organization"
            ? API_ENDPOINTS.GET_ORGANIZATIONS
            : API_ENDPOINTS.GET_DONORS;
      } else {
        // For donors/orgs, maybe show both or just one. Defaulting to organizations if not gainer for now.
        url = API_ENDPOINTS.GET_ORGANIZATIONS;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        let formattedContacts: Contact[] = [];
        if (activeCategory === "organization" || userType !== "gainer") {
          formattedContacts = (data.organizations || []).map((org: any) => ({
            id: org.id,
            organizationId: org.organizationId,
            name: org.organizationName,
            phone: org.phone || org.contact,
            address: org.location,
            city: org.location,
            email: org.email,
            role: "Organization",
            bloodType: "All",
            inventory: org.inventory,
            profileImage: org.profileImage || null,
          }));
        } else {
          // For donors from getAllDonors, id is already userId
          formattedContacts = data.donors || [];
        }
        setContacts(formattedContacts);
        setFilteredContacts(formattedContacts);
      } else {
        console.log("Failed to fetch contacts:", data.message);
      }
    } catch (error) {
      console.log("Error loading contacts:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadContacts();
    setRefreshing(false);
  };

  const filterContacts = () => {
    let filtered = [...contacts];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (contact) =>
          contact.name.toLowerCase().includes(query) ||
          contact.phone.includes(query) ||
          contact.city?.toLowerCase().includes(query) ||
          contact.address?.toLowerCase().includes(query) ||
          contact.bloodType?.toLowerCase().includes(query),
      );
    }
    setFilteredContacts(filtered);
  };

  const getAvatarColor = (role: string) => {
    switch (role.toLowerCase()) {
      case "donor":
        return "#D11B31";
      case "recipient":
      case "gainer":
        return "#2563EB";
      case "organization":
        return "#7C3AED";
      default:
        return "#6B7280";
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleChatPress = (contact: Contact) => {
    console.log("Chat with:", contact.id);
    router.push({
      pathname: "/chat/conversation",
      params: {
        contactId: contact.id,
        contactName: contact.name,
        contactRole: contact.role,
      },
    });
  };

  const handleViewProfile = (contact: Contact) => {
    setSelectedContact(contact);
    setDetailsModalVisible(true);
  };

  const renderContactCard = ({ item }: { item: Contact }) => (
    <TouchableOpacity
      style={styles.contactCard}
      activeOpacity={0.7}
      onPress={() => handleViewProfile(item)}
    >
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.avatarContainer,
            { backgroundColor: getAvatarColor(item.role), overflow: "hidden" },
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
            <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
          )}
        </View>

        <View style={styles.contactInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.contactName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.bloodType && item.role === "Donor" && (
              <View style={styles.bloodBadgeSmall}>
                <Text style={styles.bloodTextSmall}>{item.bloodType}</Text>
              </View>
            )}
          </View>
          <Text style={styles.role}>{item.role}</Text>
          <Text style={styles.phone}>{item.phone}</Text>
        </View>

        <TouchableOpacity
          style={styles.sideChatBtn}
          onPress={() => handleChatPress(item)}
        >
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={24}
            color="#D11B31"
          />
        </TouchableOpacity>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.locationInfo}>
          {item.role === "Organization" && (
            <>
              <Ionicons name="location-outline" size={14} color="#6B7280" />
              <Text style={styles.locationText} numberOfLines={1}>
                {item.address}
              </Text>
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={64} color="#D1D5DB" />
      <Text style={styles.emptyStateTitle}>No contacts found</Text>
      <Text style={styles.emptyStateText}>
        {searchQuery ? "Try adjusting your search" : "No contacts available"}
      </Text>
    </View>
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredContacts.length / CONTACTS_PER_PAGE),
  );

  useEffect(() => {
    setContactsPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const paginatedContacts = useMemo(() => {
    const start = (contactsPage - 1) * CONTACTS_PER_PAGE;
    return filteredContacts.slice(start, start + CONTACTS_PER_PAGE);
  }, [filteredContacts, contactsPage]);

  const showPagination = filteredContacts.length > CONTACTS_PER_PAGE;

  const handleNextPage = () => {
    setContactsPage((prev) => Math.min(prev + 1, totalPages));
  };

  const handlePreviousPage = () => {
    setContactsPage((prev) => Math.max(prev - 1, 1));
  };

  const ProfileDetailsModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={detailsModalVisible}
      onRequestClose={() => setDetailsModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Profile Details</Text>
            <TouchableOpacity onPress={() => setDetailsModalVisible(false)}>
              <Ionicons name="close" size={24} color="#111827" />
            </TouchableOpacity>
          </View>

          {selectedContact && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalProfileSection}>
                <View
                  style={[
                    styles.modalAvatar,
                    {
                      backgroundColor: getAvatarColor(selectedContact.role),
                      overflow: "hidden",
                    },
                  ]}
                >
                  {selectedContact.profileImage ? (
                    <Image
                      source={{
                        uri:
                          getCleanImageUrl(selectedContact.profileImage) || "",
                      }}
                      style={{
                        width: "100%",
                        height: "100%",
                        resizeMode: "cover",
                      }}
                    />
                  ) : (
                    <Text style={styles.modalAvatarText}>
                      {getInitials(selectedContact.name)}
                    </Text>
                  )}
                </View>
                <Text style={styles.modalName}>{selectedContact.name}</Text>
                <Text style={styles.modalRole}>{selectedContact.role}</Text>
              </View>

              <View style={styles.modalInfoSection}>
                <View style={styles.modalInfoRow}>
                  <Ionicons name="call-outline" size={20} color="#D11B31" />
                  <View style={styles.modalInfoTextContainer}>
                    <Text style={styles.modalLabel}>Phone</Text>
                    <Text style={styles.modalValue}>
                      {selectedContact.phone}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalInfoRow}>
                  <Ionicons name="mail-outline" size={20} color="#D11B31" />
                  <View style={styles.modalInfoTextContainer}>
                    <Text style={styles.modalLabel}>Email</Text>
                    <Text style={styles.modalValue}>
                      {selectedContact.email}
                    </Text>
                  </View>
                </View>

                {selectedContact.role === "Organization" && (
                  <View style={styles.modalInfoRow}>
                    <Ionicons
                      name="location-outline"
                      size={20}
                      color="#D11B31"
                    />
                    <View style={styles.modalInfoTextContainer}>
                      <Text style={styles.modalLabel}>Address</Text>
                      <Text style={styles.modalValue}>
                        {selectedContact.address}
                      </Text>
                    </View>
                  </View>
                )}

                {selectedContact.role === "Donor" && (
                  <>
                    <View style={styles.modalInfoRow}>
                      <Ionicons
                        name="water-outline"
                        size={20}
                        color="#D11B31"
                      />
                      <View style={styles.modalInfoTextContainer}>
                        <Text style={styles.modalLabel}>Blood Type</Text>
                        <Text style={styles.modalValue}>
                          {selectedContact.bloodType}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.modalInfoRow}>
                      <Ionicons
                        name="pulse-outline"
                        size={20}
                        color="#D11B31"
                      />
                      <View style={styles.modalInfoTextContainer}>
                        <Text style={styles.modalLabel}>Status</Text>
                        <Text
                          style={[
                            styles.modalValue,
                            {
                              color: selectedContact.isAvailable
                                ? "#10B981"
                                : "#D11B31",
                            },
                          ]}
                        >
                          {selectedContact.isAvailable
                            ? "Available"
                            : "Unavailable"}
                        </Text>
                      </View>
                    </View>
                  </>
                )}

                {selectedContact.role === "Organization" &&
                  selectedContact.inventory && (
                    <View style={styles.inventorySection}>
                      <Text style={styles.inventoryTitle}>Blood Inventory</Text>
                      <View style={styles.inventoryGrid}>
                        {selectedContact.inventory.map((inv, index) => (
                          <View key={index} style={styles.inventoryItem}>
                            <Text style={styles.inventoryBloodType}>
                              {inv.bloodType}
                            </Text>
                            <Text style={styles.inventoryUnits}>
                              {inv.units} Units
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
              </View>

              <TouchableOpacity
                style={styles.modalChatBtn}
                onPress={() => {
                  setDetailsModalVisible(false);
                  handleChatPress(selectedContact);
                }}
              >
                <Ionicons name="chatbubble-outline" size={20} color="#FFFFFF" />
                <Text style={styles.modalChatBtnText}>Message</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D11B31" />
        <Text style={styles.loadingText}>Loading contacts...</Text>
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

        {userType === "gainer" && (
          <View style={styles.categoryToggleContainer}>
            <TouchableOpacity
              style={[
                styles.categoryTab,
                activeCategory === "organization" && styles.activeCategoryTab,
              ]}
              onPress={() => setActiveCategory("organization")}
            >
              <Text
                style={[
                  styles.categoryTabText,
                  activeCategory === "organization" &&
                    styles.activeCategoryTabText,
                ]}
              >
                Organizations
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.categoryTab,
                activeCategory === "donor" && styles.activeCategoryTab,
              ]}
              onPress={() => setActiveCategory("donor")}
            >
              <Text
                style={[
                  styles.categoryTabText,
                  activeCategory === "donor" && styles.activeCategoryTabText,
                ]}
              >
                Donors
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            {filteredContacts.length}{" "}
            {filteredContacts.length === 1 ? "Contact" : "Contacts"}
          </Text>
        </View>
      </View>

      {/* Contacts List */}
      <FlatList
        data={paginatedContacts}
        renderItem={renderContactCard}
        keyExtractor={(item, index) => `${item.id}-${index}`}
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
      />

      {showPagination && (
        <View
          style={[
            styles.paginationContainer,
            !hideNavigation && { marginBottom: verticalScale(86) },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.paginationButton,
              contactsPage <= 1 && styles.paginationButtonDisabled,
            ]}
            onPress={handlePreviousPage}
            disabled={contactsPage <= 1}
          >
            <Ionicons name="chevron-back" size={18} color="#D11B31" />
            <Text style={styles.paginationButtonText}>Previous</Text>
          </TouchableOpacity>

          <Text style={styles.paginationInfo}>
            Page {contactsPage} of {totalPages}
          </Text>

          <TouchableOpacity
            style={[
              styles.paginationButton,
              contactsPage >= totalPages && styles.paginationButtonDisabled,
            ]}
            onPress={handleNextPage}
            disabled={contactsPage >= totalPages}
          >
            <Text style={styles.paginationButtonText}>Next</Text>
            <Ionicons name="chevron-forward" size={18} color="#D11B31" />
          </TouchableOpacity>
        </View>
      )}

      <ProfileDetailsModal />

      {/* Navigation Bar */}
      {!hideNavigation && (
        <Navigation userType={userType} initialTab="contact" />
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
  contactCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(20),
    padding: scale(16),
    marginBottom: verticalScale(16),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    width: moderateScale(50),
    height: moderateScale(50),
    borderRadius: moderateScale(25),
    justifyContent: "center",
    alignItems: "center",
    marginRight: scale(12),
  },
  avatarText: {
    fontSize: moderateScale(18),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: "#111827",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    marginBottom: verticalScale(2),
  },
  bloodBadgeSmall: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    borderRadius: moderateScale(6),
  },
  bloodTextSmall: {
    fontSize: moderateScale(10),
    color: "#D11B31",
    fontWeight: "700",
  },
  role: {
    fontSize: moderateScale(12),
    color: "#D11B31",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: verticalScale(2),
  },
  phone: {
    fontSize: moderateScale(13),
    color: "#6B7280",
  },
  sideChatBtn: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: verticalScale(12),
    paddingTop: verticalScale(12),
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  locationInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: scale(8),
  },
  locationText: {
    fontSize: moderateScale(12),
    color: "#6B7280",
    marginLeft: scale(4),
  },
  bloodBadge: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(8),
  },
  bloodText: {
    fontSize: moderateScale(12),
    color: "#D11B31",
    fontWeight: "700",
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
    borderRadius: moderateScale(15),
    marginTop: verticalScale(16),
    padding: scale(4),
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  categoryTab: {
    flex: 1,
    paddingVertical: verticalScale(10),
    alignItems: "center",
    borderRadius: moderateScale(12),
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
    fontWeight: "600",
    color: "#6B7280",
  },
  activeCategoryTabText: {
    color: "#D11B31",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: moderateScale(30),
    borderTopRightRadius: moderateScale(30),
    paddingHorizontal: scale(24),
    paddingTop: verticalScale(20),
    paddingBottom: verticalScale(40),
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: verticalScale(24),
  },
  modalTitle: {
    fontSize: moderateScale(20),
    fontWeight: "700",
    color: "#111827",
  },
  modalProfileSection: {
    alignItems: "center",
    marginBottom: verticalScale(30),
  },
  modalAvatar: {
    width: moderateScale(80),
    height: moderateScale(80),
    borderRadius: moderateScale(40),
    justifyContent: "center",
    alignItems: "center",
    marginBottom: verticalScale(16),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  modalAvatarText: {
    fontSize: moderateScale(28),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  modalName: {
    fontSize: moderateScale(22),
    fontWeight: "700",
    color: "#111827",
    marginBottom: verticalScale(4),
  },
  modalRole: {
    fontSize: moderateScale(14),
    color: "#D11B31",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  modalInfoSection: {
    gap: verticalScale(20),
    marginBottom: verticalScale(30),
  },
  modalInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(16),
  },
  modalInfoTextContainer: {
    flex: 1,
  },
  modalLabel: {
    fontSize: moderateScale(12),
    color: "#6B7280",
    marginBottom: verticalScale(2),
  },
  modalValue: {
    fontSize: moderateScale(16),
    color: "#111827",
    fontWeight: "500",
  },
  inventorySection: {
    marginTop: verticalScale(10),
  },
  inventoryTitle: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: "#111827",
    marginBottom: verticalScale(12),
  },
  inventoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scale(10),
  },
  inventoryItem: {
    backgroundColor: "#F9FAFB",
    padding: scale(12),
    borderRadius: moderateScale(12),
    width: "47%",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  inventoryBloodType: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: "#D11B31",
    marginBottom: verticalScale(2),
  },
  inventoryUnits: {
    fontSize: moderateScale(12),
    color: "#6B7280",
  },
  modalChatBtn: {
    backgroundColor: "#D11B31",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: verticalScale(14),
    borderRadius: moderateScale(15),
    gap: scale(8),
    shadowColor: "#D11B31",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  modalChatBtnText: {
    color: "#FFFFFF",
    fontSize: moderateScale(16),
    fontWeight: "700",
  },
});
