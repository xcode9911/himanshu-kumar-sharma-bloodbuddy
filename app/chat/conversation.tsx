import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import ProfileModal from "../../components/ProfileModal";
import { API_BASE_URL, API_ENDPOINTS } from "../../config/api";
import {
    connectSocket,
    emitPrivateMessage,
    getSocket,
} from "../../config/socket";
import { getCleanImageUrl } from "../../utils/image";
import { moderateScale, scale, verticalScale } from "../../utils/responsive";

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  message: string;
  timestamp: string;
  status?: "sent" | "read" | "delivered";
}

export default function ConversationScreen() {
  const { contactId, contactName, contactRole, organizationName } =
    useLocalSearchParams();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [partnerProfileImage, setPartnerProfileImage] = useState<any>(null);
  const flatListRef = useRef<FlatList>(null);
  const keyboardAvoidingBehavior = Platform.select<"height" | "padding" | "position" | undefined>({
    ios: "padding",
    android: "height",
    default: undefined,
  });

  useEffect(() => {
    loadData();

    const socket = getSocket();
    if (socket) {
      socket.on("newMessage", (data: any) => {
        if (data.senderId === contactId) {
          setMessages((prev) => [
            ...prev,
            {
              id: Math.random().toString(),
              senderId: data.senderId,
              receiverId: currentUserId,
              message: data.message,
              timestamp: data.timestamp,
              status: "read",
            },
          ]);
          // Auto mark new message as read
          markAsRead();
        }
      });

      socket.on("messagesRead", ({ readerId }: { readerId: string }) => {
        if (readerId === contactId) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.senderId === currentUserId && msg.status !== "read"
                ? { ...msg, status: "read" as const }
                : msg,
            ),
          );
        }
      });

      socket.on(
        "userStatusUpdate",
        ({
          userId,
          status,
        }: {
          userId: string;
          status: "online" | "offline";
        }) => {
          if (userId === contactId) {
            setIsPartnerOnline(status === "online");
          }
        },
      );
    }

    return () => {
      if (socket) {
        socket.off("newMessage");
        socket.off("messagesRead");
        socket.off("userStatusUpdate");
      }
    };
  }, [contactId, currentUserId]);

  const loadData = async () => {
    try {
      const userData = await AsyncStorage.getItem("userData");
      if (userData) {
        const parsed = JSON.parse(userData);
        const uid = parsed.userId || parsed.id;
        setCurrentUserId(uid);
        setUserName(parsed.fullName || parsed.FullName);
        connectSocket(uid);
      }
      await fetchPartnerProfile();
      await fetchMessages();
      await markAsRead();
    } catch (error) {
      console.log("Error loading conversation data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const response = await fetch(
        `${API_BASE_URL}/api/chat/messages/${contactId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.log(
          "Non-JSON response received (fetchMessages):",
          text.slice(0, 100),
        );
        return;
      }

      const data = await response.json();
      if (response.ok) {
        setIsPartnerOnline(data.isOnline || false);
        const formatted = (data.messages || []).map((m: any) => ({
          id: m.ChatId.toString(),
          senderId: m.SenderId,
          receiverId: m.ReceiverId,
          message: m.Message,
          timestamp: m.Timestamp,
          status: m.Status || "read",
        }));
        setMessages(formatted);
      }
    } catch (error) {
      console.log("Error fetching messages:", error);
    }
  };

  const markAsRead = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      await fetch(`${API_BASE_URL}/api/chat/read/${contactId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      // Update local state for any unread messages from contact
      setMessages((prev) =>
        prev.map((msg) =>
          msg.senderId === contactId && msg.status !== "read"
            ? { ...msg, status: "read" as const }
            : msg,
        ),
      );
    } catch (error) {
      console.log("Error marking as read:", error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const text = inputText.trim();
    setInputText("");

    try {
      const token = await AsyncStorage.getItem("authToken");
      const response = await fetch(`${API_BASE_URL}/api/chat/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          receiverId: contactId,
          message: text,
        }),
      });

      if (response.ok) {
        const now = new Date().toISOString();
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            senderId: currentUserId,
            receiverId: contactId as string,
            message: text,
            timestamp: now,
            status: "sent",
          },
        ]);
        emitPrivateMessage(contactId as string, text, currentUserId, userName);
      }
    } catch (error) {
      console.log("Error sending message:", error);
    }
  };

  const fetchPartnerProfile = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const response = await fetch(
        API_ENDPOINTS.GET_PROFILE(contactId as string),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await response.json();
      if (response.ok) {
        setPartnerProfileImage(
          data.user?.ProfileImage || data.user?.profileImage,
        );
      }
    } catch (error) {
      console.log("Error fetching partner profile:", error);
    }
  };

  const handleShowProfile = async () => {
    try {
      setIsProfileLoading(true);
      const token = await AsyncStorage.getItem("authToken");
      const response = await fetch(
        API_ENDPOINTS.GET_PROFILE(contactId as string),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await response.json();
      if (response.ok) {
        setSelectedUser(data.user);
        setIsProfileModalVisible(true);
      }
    } catch (error) {
      console.log("Error fetching profile:", error);
    } finally {
      setIsProfileLoading(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.senderId === currentUserId;
    return (
      <View
        style={[
          styles.messageWrapper,
          isMine ? styles.myMessageWrapper : styles.theirMessageWrapper,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isMine ? styles.myBubble : styles.theirBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isMine ? styles.myMessageText : styles.theirMessageText,
            ]}
          >
            {item.message}
          </Text>
          <View style={styles.messageFooter}>
            <Text
              style={[
                styles.timeText,
                isMine ? styles.myTimeText : styles.theirTimeText,
              ]}
            >
              {new Date(item.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            {isMine && (
              <Ionicons
                name={
                  item.status === "read" ? "checkmark-done" : "checkmark-done"
                }
                size={16}
                color={
                  item.status === "read"
                    ? "#3B82F6"
                    : "rgba(255, 255, 255, 0.6)"
                }
                style={styles.statusIcon}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D11B31" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={keyboardAvoidingBehavior}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <BlurView intensity={80} tint="light" style={styles.headerBlur}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={28} color="#D11B31" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleShowProfile}
              style={styles.headerAvatarContainer}
            >
              <View
                style={[
                  styles.headerAvatar,
                  partnerProfileImage && { borderWidth: 0 },
                ]}
              >
                {partnerProfileImage ? (
                  <Image
                    source={{
                      uri: getCleanImageUrl(partnerProfileImage) || "",
                    }}
                    style={styles.headerAvatarImage}
                  />
                ) : (
                  <Text style={styles.headerAvatarText}>
                    {getInitials(
                      (organizationName as string) || (contactName as string),
                    )}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {organizationName
                  ? (organizationName as string)
                  : (contactName as string)}{" "}
                <Text style={styles.headerRole}>({contactRole})</Text>
              </Text>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.onlineDot,
                    {
                      backgroundColor: isPartnerOnline ? "#10B981" : "#9CA3AF",
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.headerSubtitleText,
                    !isPartnerOnline && styles.offlineSubtitle,
                  ]}
                >
                  {organizationName ? `${contactName} • ` : ""}
                  {isPartnerOnline ? "Active now" : "Offline"}
                </Text>
              </View>
            </View>
          </View>
        </BlurView>

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />

        <View style={styles.footer}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              value={inputText}
              onChangeText={setInputText}
              multiline
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                !inputText.trim() && styles.sendButtonDisabled,
              ]}
              onPress={handleSendMessage}
              disabled={!inputText.trim()}
            >
              <Ionicons name="send" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerBlur: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  header: {
    paddingTop: Platform.OS === "ios" ? verticalScale(10) : verticalScale(40),
    paddingBottom: verticalScale(15),
    paddingHorizontal: scale(16),
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    marginRight: scale(10),
    padding: scale(4),
  },
  headerAvatar: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    marginRight: scale(12),
    borderWidth: 1,
    borderColor: "#D11B31",
  },
  headerAvatarText: {
    color: "#D11B31",
    fontSize: moderateScale(14),
    fontWeight: "700",
  },
  headerAvatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: moderateScale(20),
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    color: "#111827",
    fontSize: moderateScale(17),
    fontWeight: "700",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 1,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
    marginRight: 6,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  headerSubtitleText: {
    color: "#10B981",
    fontSize: moderateScale(11),
    fontWeight: "600",
  },
  offlineSubtitle: {
    color: "#9CA3AF",
  },
  headerRole: {
    fontSize: moderateScale(13),
    color: "#6B7280",
    fontWeight: "400",
  },
  messagesList: {
    padding: scale(16),
    paddingTop: verticalScale(100),
    paddingBottom: verticalScale(20),
  },
  messageWrapper: {
    marginVertical: verticalScale(4),
    maxWidth: "80%",
  },
  myMessageWrapper: {
    alignSelf: "flex-end",
  },
  theirMessageWrapper: {
    alignSelf: "flex-start",
  },
  messageBubble: {
    paddingHorizontal: scale(14),
    paddingVertical: scale(10),
    borderRadius: moderateScale(20),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  myBubble: {
    backgroundColor: "#D11B31",
    borderBottomRightRadius: moderateScale(4),
  },
  theirBubble: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: moderateScale(4),
  },
  messageText: {
    fontSize: moderateScale(15),
    lineHeight: moderateScale(20),
  },
  myMessageText: {
    color: "#FFFFFF",
  },
  theirMessageText: {
    color: "#1F2937",
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: verticalScale(2),
    gap: scale(4),
  },
  timeText: {
    fontSize: moderateScale(9),
    fontWeight: "500",
  },
  myTimeText: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  theirTimeText: {
    color: "#9CA3AF",
  },
  statusIcon: {
    marginLeft: scale(2),
  },
  footer: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(10),
    paddingBottom:
      Platform.OS === "ios" ? verticalScale(30) : verticalScale(15),
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#D11B31",
    borderRadius: moderateScale(24),
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(6),
  },
  input: {
    flex: 1,
    color: "#111827",
    fontSize: moderateScale(15),
    paddingHorizontal: scale(4),
    paddingVertical: verticalScale(8),
    maxHeight: verticalScale(80),
  },
  sendButton: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(18),
    backgroundColor: "#D11B31",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: scale(4),
  },
  sendButtonDisabled: {
    backgroundColor: "#D1D5DB",
  },
  headerAvatarContainer: {
    position: "relative",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
});
