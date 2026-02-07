import { Ionicons } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import React, { useEffect, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"
import Navigation from "../../components/Navigation"
import { moderateScale, scale, verticalScale } from "../../utils/responsive"

type UserType = "gainer" | "donor" | "organization"

interface Contact {
  id: string
  name: string
  phone: string
  bloodType?: string
  address: string
  city: string
  email: string
  lastDonation?: string
  role: string
}

interface ContactsScreenProps {
  hideNavigation?: boolean
}

export default function ContactsScreen({ hideNavigation = false }: ContactsScreenProps = {}) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userType, setUserType] = useState<UserType>("donor")
  const [activeCategory, setActiveCategory] = useState<"organization" | "donor">("organization")

  useEffect(() => {
    loadUserData()
    loadContacts()
  }, [])

  useEffect(() => {
    filterContacts()
  }, [searchQuery, contacts, activeCategory])

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

  const loadContacts = async () => {
    try {
      setLoading(true)
      // Mock data for now - expanded to include Organizations
      const mockContacts: Contact[] = [
        {
          id: "1",
          name: "City Central Blood Bank",
          phone: "+91 98765 43210",
          bloodType: "All",
          address: "123 Medical Street",
          city: "Mumbai",
          email: "support@citybloodbank.com",
          role: "Organization",
        },
        {
          id: "2",
          name: "Priya Sharma",
          phone: "+91 98765 43211",
          bloodType: "B+",
          address: "456 Park Avenue",
          city: "Mumbai",
          email: "priya.sharma@email.com",
          lastDonation: "2024-01-10",
          role: "Donor",
        },
        {
          id: "3",
          name: "Hope Charity Hospital",
          phone: "+91 98765 43212",
          bloodType: "A+",
          address: "789 Charity Lane",
          city: "Mumbai",
          email: "contact@hopehospital.org",
          role: "Organization",
        },
        {
          id: "4",
          name: "Sneha Gupta",
          phone: "+91 98765 43213",
          bloodType: "AB-",
          address: "321 Health Boulevard",
          city: "Mumbai",
          email: "sneha.gupta@email.com",
          lastDonation: "2024-01-08",
          role: "Donor",
        },
        {
          id: "5",
          name: "Red Cross Mumbai",
          phone: "+91 98765 43214",
          bloodType: "All Types",
          address: "555 Apollo Street",
          city: "Mumbai",
          email: "mumbai@redcross.in",
          role: "Organization",
        },
        {
          id: "6",
          name: "Anjali Desai",
          phone: "+91 98765 43215",
          bloodType: "B-",
          address: "888 Community Lane",
          city: "Mumbai",
          email: "anjali.desai@email.com",
          lastDonation: "2024-01-12",
          role: "Donor",
        },
        {
          id: "7",
          name: "Metro Life Care",
          phone: "+91 98765 43216",
          bloodType: "O+",
          address: "222 Hope Street",
          city: "Mumbai",
          email: "info@metrolife.com",
          role: "Organization",
        },
        {
          id: "8",
          name: "Neha Malhotra",
          phone: "+91 98765 43217",
          bloodType: "AB+",
          address: "999 Care Road",
          city: "Mumbai",
          email: "neha.malhotra@email.com",
          lastDonation: "2024-01-11",
          role: "Donor",
        },
      ]

      setContacts(mockContacts)
      setFilteredContacts(mockContacts)
    } catch (error) {
      console.error("Error loading contacts:", error)
    } finally {
      setLoading(false)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadContacts()
    setRefreshing(false)
  }

  const filterContacts = () => {
    let filtered = [...contacts]

    // Gainer specific role filtering
    if (userType === "gainer") {
      const roleToMatch = activeCategory === "organization" ? "Organization" : "Donor"
      filtered = filtered.filter((contact) => contact.role.toLowerCase() === roleToMatch.toLowerCase())
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (contact) =>
          contact.name.toLowerCase().includes(query) ||
          contact.phone.includes(query) ||
          contact.city.toLowerCase().includes(query) ||
          contact.bloodType?.toLowerCase().includes(query)
      )
    }
    setFilteredContacts(filtered)
  }

  const getAvatarColor = (role: string) => {
    switch (role.toLowerCase()) {
      case "donor":
        return "#D11B31"
      case "recipient":
      case "gainer":
        return "#2563EB"
      case "doctor":
        return "#059669"
      case "organization":
        return "#7C3AED"
      case "coordinator":
        return "#7C3AED"
      default:
        return "#6B7280"
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const handleCallPress = (phone: string) => {
    console.log("Calling:", phone)
    // Implement actual call functionality
  }

  const handleChatPress = (contactId: string) => {
    console.log("Chat with:", contactId)
    // Navigate to chat screen
  }

  const handleViewProfile = (contactId: string) => {
    console.log("View profile:", contactId)
    // Navigate to profile screen
  }

  const renderContactCard = ({ item }: { item: Contact }) => (
    <View style={styles.contactCard}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatarContainer, { backgroundColor: getAvatarColor(item.role) }]}>
          <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
        </View>

        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.role}>{item.role}</Text>
          <Text style={styles.phone}>{item.phone}</Text>
        </View>

        {item.bloodType && (
          <View style={styles.bloodTypeBadge}>
            <Ionicons name="water" size={14} color="#D11B31" />
            <Text style={styles.bloodTypeText}>{item.bloodType}</Text>
          </View>
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={16} color="#6B7280" />
          <Text style={styles.infoText}>{item.address}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="mail-outline" size={16} color="#6B7280" />
          <Text style={styles.infoText}>{item.email}</Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.chatBtn]}
          onPress={() => handleChatPress(item.id)}
        >
          <Ionicons name="chatbubble-outline" size={18} color="#FFFFFF" />
          <Text style={styles.actionBtnText}>Chat Now</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.callBtn]}
          onPress={() => handleCallPress(item.phone)}
        >
          <Ionicons name="call" size={18} color="#FFFFFF" />
          <Text style={styles.actionBtnText}>Call</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.profileBtn]}
          onPress={() => handleViewProfile(item.id)}
        >
          <Ionicons name="information-circle-outline" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  )

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={64} color="#D1D5DB" />
      <Text style={styles.emptyStateTitle}>No contacts found</Text>
      <Text style={styles.emptyStateText}>
        {searchQuery ? "Try adjusting your search" : "No contacts available"}
      </Text>
    </View>
  )

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D11B31" />
        <Text style={styles.loadingText}>Loading contacts...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or phone..."
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
              style={[styles.categoryTab, activeCategory === "organization" && styles.activeCategoryTab]}
              onPress={() => setActiveCategory("organization")}
            >
              <Text
                style={[
                  styles.categoryTabText,
                  activeCategory === "organization" && styles.activeCategoryTabText,
                ]}
              >
                Organizations
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.categoryTab, activeCategory === "donor" && styles.activeCategoryTab]}
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
            {filteredContacts.length} {filteredContacts.length === 1 ? "Contact" : "Contacts"}
          </Text>
        </View>
      </View>

      {/* Contacts List */}
      <FlatList
        data={filteredContacts}
        renderItem={renderContactCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#D11B31"]} />}
      />

      {/* Navigation Bar */}
      {!hideNavigation && <Navigation userType={userType} initialTab="contact" />}
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
    justifyContent: "space-between",
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
  contactCard: {
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
    alignItems: "center",
    gap: scale(12),
  },
  avatarContainer: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: moderateScale(16),
    fontWeight: "600",
    color: "#111827",
    marginBottom: verticalScale(2),
  },
  role: {
    fontSize: moderateScale(12),
    color: "#6B7280",
    marginBottom: verticalScale(2),
  },
  phone: {
    fontSize: moderateScale(12),
    color: "#6B7280",
  },
  bloodTypeBadge: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(6),
    borderRadius: moderateScale(8),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
  },
  bloodTypeText: {
    fontSize: moderateScale(12),
    color: "#D11B31",
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: verticalScale(12),
  },
  cardBody: {
    gap: verticalScale(8),
    marginBottom: verticalScale(12),
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
  },
  infoText: {
    flex: 1,
    fontSize: moderateScale(13),
    color: "#4B5563",
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
  chatBtn: {
    backgroundColor: "#D11B31",
    flex: 1.5,
  },
  callBtn: {
    backgroundColor: "#059669",
  },
  profileBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: scale(8),
  },
  actionBtnText: {
    fontSize: moderateScale(12),
    color: "#FFFFFF",
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
})
