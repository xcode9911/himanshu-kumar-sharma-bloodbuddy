import { Ionicons } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useRouter } from "expo-router"
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
import ProfileModal from "../../components/ProfileModal"
import { API_BASE_URL, API_ENDPOINTS } from "../../config/api"
import { connectSocket, getSocket } from "../../config/socket"
import { moderateScale, scale, verticalScale } from "../../utils/responsive"

type UserType = "gainer" | "donor" | "organization"

interface Contact {
  id: string
  name: string
  avatar?: string
  lastMessage?: string
  timestamp?: string
  unread?: number
  isOnline: boolean
  role: string
  organizationName?: string | null
}

interface ChatScreenProps {
  hideNavigation?: boolean
}

export default function ChatScreen({ hideNavigation = false }: ChatScreenProps = {}) {
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [donorGroups, setDonorGroups] = useState<{ organizations: Contact[], gainers: Contact[] }>({ organizations: [], gainers: [] })
  const [orgGroups, setOrgGroups] = useState<{ donors: Contact[], gainers: Contact[] }>({ donors: [], gainers: [] })
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userType, setUserType] = useState<UserType>("donor")
  const [activeCategory, setActiveCategory] = useState<"gainer" | "organization" | "donor">("gainer")
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false)
  const [isProfileLoading, setIsProfileLoading] = useState(false)

  useEffect(() => {
    loadUserData()
  }, [])

  useEffect(() => {
    loadContacts()
  }, [userType])

  useEffect(() => {
    filterContacts()
  }, [searchQuery, contacts, donorGroups, orgGroups, activeCategory])

  useEffect(() => {
    const socket = getSocket();

    socket.on("userStatusUpdate", ({ userId, status }: { userId: string, status: "online" | "offline" }) => {
      const isOnline = status === "online";

      const updateFn = (list: Contact[]) =>
        list.map(c => c.id === userId ? { ...c, isOnline } : c);

      setContacts(prev => updateFn(prev));
      setDonorGroups(prev => ({
        organizations: updateFn(prev.organizations),
        gainers: updateFn(prev.gainers)
      }));
      setOrgGroups(prev => ({
        donors: updateFn(prev.donors),
        gainers: updateFn(prev.gainers)
      }));
    });

    socket.on("newMessage", (data: any) => {
      const updateFn = (list: Contact[]) => {
        const index = list.findIndex(c => c.id === data.senderId);
        if (index === -1) return list;

        const newList = [...list];
        newList[index] = {
          ...newList[index],
          lastMessage: data.message,
          timestamp: new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          unread: (newList[index].unread || 0) + 1
        };
        // Move to top
        const contact = newList.splice(index, 1)[0];
        return [contact, ...newList];
      };

      setContacts(prev => updateFn(prev));
      setDonorGroups(prev => ({
        organizations: updateFn(prev.organizations),
        gainers: updateFn(prev.gainers)
      }));
      setOrgGroups(prev => ({
        donors: updateFn(prev.donors),
        gainers: updateFn(prev.gainers)
      }));
    });

    return () => {
      socket.off("userStatusUpdate");
      socket.off("newMessage");
    };
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem("userData")
      if (userData) {
        const parsed = JSON.parse(userData)
        const role = (parsed.role || "donor").toLowerCase() as UserType
        const uid = parsed.userId || parsed.id;
        setUserType(role)
        connectSocket(uid);

        // Set default active category based on role
        if (role === "donor" || role === "organization") {
          setActiveCategory("gainer")
        }
      }
    } catch (error) {
      console.log("Error loading user data:", error)
    }
  }

  const loadContacts = async () => {
    try {
      setLoading(true)
      const token = await AsyncStorage.getItem("authToken")
      const response = await fetch(`${API_BASE_URL}/api/chat/contacts`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text()
        console.error("Non-JSON response received:", text.slice(0, 100))
        throw new Error("Invalid server response")
      }

      const data = await response.json()

      if (response.ok) {
        const mapUser = (u: any) => ({
          id: u.UserId,
          name: u.FullName,
          role: u.Role.charAt(0).toUpperCase() + u.Role.slice(1),
          lastMessage: u.lastMessage,
          timestamp: u.lastMessageTime ? new Date(u.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
          unread: u.unreadCount,
          isOnline: u.isOnline || false,
          organizationName: u.organizationName
        })

        if (userType === "donor") {
          setDonorGroups({
            organizations: (data.organizations || []).map(mapUser),
            gainers: (data.gainers || []).map(mapUser)
          })
        } else if (userType === "organization") {
          setOrgGroups({
            donors: (data.donors || []).map(mapUser),
            gainers: (data.gainers || []).map(mapUser)
          })
        } else if (userType === "gainer") {
          setContacts((data.contacts || []).map(mapUser))
        }
      }
    } catch (error) {
      console.error("Error loading contacts:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleShowProfile = async (userId: string) => {
    try {
      setIsProfileLoading(true)
      const token = await AsyncStorage.getItem("authToken")
      const response = await fetch(API_ENDPOINTS.GET_PROFILE(userId), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await response.json()
      if (response.ok) {
        setSelectedUser(data.user)
        setIsProfileModalVisible(true)
      }
    } catch (error) {
      console.error("Error fetching profile:", error)
    } finally {
      setIsProfileLoading(false)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadContacts()
    setRefreshing(false)
  }

  const filterContacts = () => {
    let base = []
    if (userType === "donor") {
      base = activeCategory === "gainer" ? donorGroups.gainers : donorGroups.organizations
    } else if (userType === "organization") {
      base = activeCategory === "gainer" ? orgGroups.gainers : orgGroups.donors
    } else {
      base = contacts
    }

    let filtered = [...base]

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (contact) =>
          contact.name.toLowerCase().includes(query) ||
          contact.role.toLowerCase().includes(query)
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
    <TouchableOpacity
      style={styles.contactCard}
      activeOpacity={0.7}
      onPress={() => router.push({
        pathname: "/chat/conversation",
        params: {
          contactId: item.id,
          contactName: item.name,
          contactRole: item.role,
          organizationName: item.organizationName
        }
      })}
    >
      <View style={styles.cardContent}>
        <TouchableOpacity
          onPress={() => handleShowProfile(item.id)}
          style={[styles.avatarContainer, { backgroundColor: getAvatarColor(index) }]}
        >
          <Text style={styles.avatarText}>{getInitials(item.organizationName || item.name)}</Text>
          {item.isOnline && <View style={styles.avatarOnlineDot} />}
        </TouchableOpacity>

        <View style={styles.contactInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.contactName} numberOfLines={1}>
              {item.organizationName ? item.organizationName : item.name}{" "}
              <Text style={styles.roleInName}>({item.role})</Text>
            </Text>
            {item.timestamp && (
              <Text style={styles.timestamp}>{item.timestamp}</Text>
            )}
          </View>

          {item.organizationName && (
            <Text style={styles.contactSubtitle} numberOfLines={1}>
              {item.name}
            </Text>
          )}

          <View style={styles.messageRow}>
            {item.lastMessage ? (
              <Text style={styles.lastMessage} numberOfLines={1}>
                {item.lastMessage}
              </Text>
            ) : (
              <Text style={item.isOnline ? styles.activeStatusText : styles.offlineStatusText}>
                {item.isOnline ? "Active now" : "Offline"}
              </Text>
            )}
            {(item.unread ?? 0) > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unread}</Text>
              </View>
            )}
          </View>

          <View style={styles.bottomRow}>
            <View style={[styles.statusIndicatorSmall, { backgroundColor: item.isOnline ? "#10B981" : "#9CA3AF" }]} />
            <Text style={styles.statusTextSmall}>{item.isOnline ? "Online" : "Offline"}</Text>
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

        {(userType === "donor" || userType === "organization") && (
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
              style={[styles.categoryTab, (activeCategory === "organization" || activeCategory === "donor") && styles.activeCategoryTab]}
              onPress={() => setActiveCategory(userType === "donor" ? "organization" : "donor")}
            >
              <Text
                style={[
                  styles.categoryTabText,
                  (activeCategory === "organization" || activeCategory === "donor") && styles.activeCategoryTabText,
                ]}
              >
                {userType === "donor" ? "Organizations" : "Donors"}
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

      {/* Navigation Bar */}
      {!hideNavigation && <Navigation userType={userType} initialTab="chat" />}

      {/* Profile Modal */}
      <ProfileModal
        visible={isProfileModalVisible}
        onClose={() => setIsProfileModalVisible(false)}
        userData={selectedUser}
      />

      {isProfileLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#D11B31" />
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
    position: 'relative',
  },
  avatarOnlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: moderateScale(14),
    height: moderateScale(14),
    borderRadius: moderateScale(7),
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarText: {
    fontSize: moderateScale(18),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  contactInfo: {
    flex: 1,
    justifyContent: 'center',
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
    color: "#000",
    flex: 1,
  },
  contactSubtitle: {
    fontSize: moderateScale(13),
    color: "#666",
    marginTop: verticalScale(1),
    marginBottom: verticalScale(1),
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(6),
  },
  lastMessage: {
    fontSize: moderateScale(14),
    color: "#6B7280",
    flex: 1,
  },
  activeStatusText: {
    fontSize: moderateScale(13),
    color: "#10B981",
    fontWeight: "600",
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: "#D11B31",
    borderRadius: moderateScale(10),
    minWidth: moderateScale(20),
    height: moderateScale(20),
    paddingHorizontal: scale(6),
    justifyContent: "center",
    alignItems: "center",
  },
  unreadText: {
    fontSize: moderateScale(11),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  timestamp: {
    fontSize: moderateScale(12),
    color: "#9CA3AF",
    fontWeight: '500',
  },
  roleInName: {
    fontSize: moderateScale(12),
    color: "#6B7280",
    fontWeight: "400",
  },
  offlineStatusText: {
    fontSize: moderateScale(13),
    color: "#9CA3AF",
    fontWeight: "500",
    flex: 1,
  },
  statusIndicatorSmall: {
    width: moderateScale(6),
    height: moderateScale(6),
    borderRadius: moderateScale(3),
    marginRight: scale(4),
  },
  statusTextSmall: {
    fontSize: moderateScale(11),
    color: "#9CA3AF",
    fontWeight: '500',
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
})
