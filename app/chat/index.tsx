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
  avatar?: string
  lastMessage: string
  timestamp: string
  unread: number
  status: "online" | "offline"
  role: string
}

interface ChatScreenProps {
  hideNavigation?: boolean
}

export default function ChatScreen({ hideNavigation = false }: ChatScreenProps = {}) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userType, setUserType] = useState<UserType>("donor")
  const [activeCategory, setActiveCategory] = useState<"gainer" | "organization">("gainer")

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
      // Mock data for now
      const mockContacts: Contact[] = [
        {
          id: "1",
          name: "Dr. Rajesh Kumar",
          lastMessage: "Your blood test results are ready",
          timestamp: "2 min ago",
          unread: 2,
          status: "online",
          role: "Doctor",
        },
        {
          id: "2",
          name: "Central Blood Bank",
          lastMessage: "Thank you for your donation!",
          timestamp: "1 hour ago",
          unread: 0,
          status: "online",
          role: "Organization",
        },
        {
          id: "3",
          name: "Priya Sharma",
          lastMessage: "When can you donate next?",
          timestamp: "3 hours ago",
          unread: 1,
          status: "offline",
          role: "Recipient",
        },
        {
          id: "4",
          name: "Apollo Hospitals",
          lastMessage: "Blood drive scheduled for next week",
          timestamp: "Yesterday",
          unread: 0,
          status: "online",
          role: "Organization",
        },
        {
          id: "5",
          name: "Amit Patel",
          lastMessage: "Thanks for saving my life!",
          timestamp: "2 days ago",
          unread: 0,
          status: "offline",
          role: "Recipient",
        },
        {
          id: "6",
          name: "Red Cross Support",
          lastMessage: "How can we help you today?",
          timestamp: "3 days ago",
          unread: 0,
          status: "online",
          role: "Organization",
        },
        {
          id: "7",
          name: "Sneha Gupta",
          lastMessage: "Emergency blood needed!",
          timestamp: "1 week ago",
          unread: 0,
          status: "offline",
          role: "Recipient",
        },
        {
          id: "8",
          name: "City Hospital",
          lastMessage: "Your eligibility has been approved",
          timestamp: "1 week ago",
          unread: 0,
          status: "online",
          role: "Organization",
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

    // Filter by category if donor
    if (userType === "donor") {
      const roleToMatch = activeCategory === "gainer" ? "Recipient" : "Organization"
      filtered = filtered.filter((contact) => contact.role === roleToMatch)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (contact) =>
          contact.name.toLowerCase().includes(query) ||
          contact.role.toLowerCase().includes(query) ||
          contact.lastMessage.toLowerCase().includes(query)
      )
    }
    setFilteredContacts(filtered)
  }

  const getAvatarColor = (index: number) => {
    const colors = ["#D11B31", "#2563EB", "#059669", "#7C3AED", "#F77F00"]
    return colors[index % colors.length]
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const renderContactCard = ({ item, index }: { item: Contact; index: number }) => (
    <TouchableOpacity style={styles.contactCard} activeOpacity={0.7}>
      <View style={styles.cardContent}>
        <View style={[styles.avatarContainer, { backgroundColor: getAvatarColor(index) }]}>
          <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
        </View>

        <View style={styles.contactInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.contactName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unread}</Text>
              </View>
            )}
          </View>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage}
          </Text>
          <View style={styles.bottomRow}>
            <Text style={styles.timestamp}>{item.timestamp}</Text>
            <View style={styles.statusDot}>
              <View
                style={[
                  styles.statusIndicator,
                  { backgroundColor: item.status === "online" ? "#10B981" : "#9CA3AF" },
                ]}
              />
              <Text style={styles.statusText}>{item.role}</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={64} color="#D1D5DB" />
      <Text style={styles.emptyStateTitle}>No conversations</Text>
      <Text style={styles.emptyStateText}>
        {searchQuery ? "No contacts match your search" : "Start a new conversation"}
      </Text>
    </View>
  )

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D11B31" />
        <Text style={styles.loadingText}>Loading conversations...</Text>
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
            placeholder="Search contacts..."
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

        {userType === "donor" && (
          <View style={styles.categoryToggleContainer}>
            <TouchableOpacity
              style={[styles.categoryTab, activeCategory === "gainer" && styles.activeCategoryTab]}
              onPress={() => setActiveCategory("gainer")}
            >
              <Text
                style={[
                  styles.categoryTabText,
                  activeCategory === "gainer" && styles.activeCategoryTabText,
                ]}
              >
                Gainers
              </Text>
            </TouchableOpacity>
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
                Organization
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            {filteredContacts.length} {filteredContacts.length === 1 ? "Contact" : "Contacts"}
          </Text>
          <TouchableOpacity style={styles.filterButton}>
            <Ionicons name="options" size={20} color="#6B7280" />
          </TouchableOpacity>
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

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Navigation Bar */}
      {!hideNavigation && <Navigation userType={userType} initialTab="chat" />}
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
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
    paddingVertical: verticalScale(4),
    paddingHorizontal: scale(8),
  },
  listContainer: {
    padding: scale(16),
    paddingBottom: verticalScale(100),
  },
  contactCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(16),
    padding: scale(12),
    marginBottom: verticalScale(12),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: scale(12),
  },
  avatarContainer: {
    width: moderateScale(56),
    height: moderateScale(56),
    borderRadius: moderateScale(28),
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: moderateScale(18),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  contactInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: verticalScale(4),
  },
  contactName: {
    fontSize: moderateScale(16),
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: "#D11B31",
    borderRadius: moderateScale(12),
    minWidth: moderateScale(24),
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    justifyContent: "center",
    alignItems: "center",
    marginLeft: scale(8),
  },
  unreadText: {
    fontSize: moderateScale(12),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  lastMessage: {
    fontSize: moderateScale(14),
    color: "#6B7280",
    marginBottom: verticalScale(6),
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timestamp: {
    fontSize: moderateScale(12),
    color: "#9CA3AF",
  },
  statusDot: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
  },
  statusIndicator: {
    width: moderateScale(8),
    height: moderateScale(8),
    borderRadius: moderateScale(4),
  },
  statusText: {
    fontSize: moderateScale(12),
    color: "#6B7280",
  },
  fab: {
    position: "absolute",
    bottom: verticalScale(100),
    right: scale(20),
    width: moderateScale(56),
    height: moderateScale(56),
    borderRadius: moderateScale(28),
    backgroundColor: "#D11B31",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
