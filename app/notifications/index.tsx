import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import ThankYouModal from "../../components/ThankYouModal";
import {
    NotificationItem,
    useNotifications,
} from "../../context/NotificationContext";
import { moderateScale, scale, verticalScale } from "../../utils/responsive";

const NotificationsScreen = () => {
  const {
    notifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead,
    fetchNotifications,
    unreadCount,
  } = useNotifications();
  const [thankYouVisible, setThankYouVisible] = useState(false);
  const [thankYouMsg, setThankYouMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const normalizeType = (type: string) =>
    (type || "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");

  const resolveCategory = (notification: NotificationItem) => {
    const type = normalizeType(notification.Type);
    const content =
      `${notification.Title} ${notification.Message}`.toLowerCase();

    if (
      type === "donation_thankyou" ||
      type === "donation_thank_you" ||
      content.includes("thank you")
    ) {
      return "donation_thankyou";
    }

    if (
      type === "donation_day_reminder" ||
      content.includes("scheduled today")
    ) {
      return "donation_day_reminder";
    }

    if (
      type === "donation_request" ||
      type === "new_donation_offer" ||
      type.includes("donation_offer")
    ) {
      return "donation_request";
    }

    if (
      type === "donation_status" ||
      type.includes("donation_accepted") ||
      type.includes("donation_rejected") ||
      type.includes("donation_scheduled") ||
      type.includes("donation_status") ||
      content.includes("donation accepted") ||
      content.includes("donation rejected") ||
      content.includes("donation offer")
    ) {
      return "donation_status";
    }

    if (
      type === "booking_request" ||
      type === "new_booking_request" ||
      content.includes("booking request")
    ) {
      return "booking_request";
    }

    if (
      type === "booking_status" ||
      type.includes("booking_approved") ||
      type.includes("booking_rejected") ||
      content.includes("booking approved") ||
      content.includes("booking rejected")
    ) {
      return "booking_status";
    }

    if (type.includes("emergency") || content.includes("emergency")) {
      return "emergency";
    }

    if (type.includes("payment") || content.includes("payment")) {
      return "payment";
    }

    return "general";
  };

  const getNotificationVisuals = (notification: NotificationItem) => {
    const category = resolveCategory(notification);
    const type = normalizeType(notification.Type);
    const content =
      `${notification.Title} ${notification.Message}`.toLowerCase();

    if (category === "donation_status") {
      if (type.includes("accepted") || content.includes("accepted")) {
        return { icon: "checkmark-circle-outline", color: "#059669" };
      }
      if (type.includes("rejected") || content.includes("rejected")) {
        return { icon: "close-circle-outline", color: "#DC2626" };
      }
      return { icon: "calendar-outline", color: "#0EA5E9" };
    }

    switch (category) {
      case "donation_request":
        return { icon: "water-outline", color: "#D11B31" };
      case "donation_day_reminder":
        return { icon: "alarm-outline", color: "#B45309" };
      case "booking_request":
        return { icon: "clipboard-outline", color: "#3B82F6" };
      case "booking_status":
        return { icon: "document-text-outline", color: "#0EA5E9" };
      case "emergency":
        return { icon: "warning-outline", color: "#DC2626" };
      case "donation_thankyou":
        return { icon: "star-outline", color: "#F59E0B" };
      case "payment":
        return { icon: "card-outline", color: "#7C3AED" };
      default:
        return { icon: "notifications-outline", color: "#6B7280" };
    }
  };

  useEffect(() => {
    refreshNotifications(true);
  }, []);

  const refreshNotifications = async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      await fetchNotifications();
    } catch (error) {
      console.log("Error refreshing notifications:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleNotificationPress = async (notif: NotificationItem) => {
    if (!notif.IsRead) {
      await markAsRead(notif.NotificationId);
    }

    if (resolveCategory(notif) === "donation_thankyou") {
      setThankYouMsg(notif.Message);
      setThankYouVisible(true);
    }
  };

  const handleDeleteOne = (id: number | string) => {
    Alert.alert("Delete notification", "This notification will be removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteNotification(id),
      },
    ]);
  };

  const handleDeleteRead = () => {
    Alert.alert("Delete all read", "This will remove all read notifications.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete Read",
        style: "destructive",
        onPress: () => deleteAllRead(),
      },
    ]);
  };

  const formatWhen = (isoDate: string) => {
    const date = new Date(isoDate);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const mins = Math.floor(diffMs / 60000);

    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;

    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;

    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  const renderItem = ({ item }: { item: NotificationItem }) => {
    if (!item) return null;

    const visuals = getNotificationVisuals(item);

    return (
      <TouchableOpacity
        style={[styles.card, !item.IsRead && styles.unreadCard]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View
            style={[styles.typeIcon, { backgroundColor: visuals.color + "15" }]}
          >
            <Ionicons
              name={visuals.icon as any}
              size={24}
              color={visuals.color}
            />
          </View>
          <View style={styles.headerInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.notifTitle}>{item.Title}</Text>
              {!item.IsRead && <View style={styles.unreadDot} />}
            </View>
            <Text style={styles.notifMessage}>{item.Message}</Text>
            <Text style={styles.timeText}>{formatWhen(item.CreatedAt)}</Text>
          </View>
          <TouchableOpacity
            onPress={() => handleDeleteOne(item.NotificationId)}
            style={styles.deleteButton}
          >
            <Ionicons name="trash-outline" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#D11B31" />
        </TouchableOpacity>

        <View style={styles.titleWrap}>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => markAllAsRead()}
            disabled={unreadCount === 0}
          >
            <Text
              style={[
                styles.headerActionText,
                unreadCount === 0 && styles.disabledHeaderActionText,
              ]}
            >
              Read all
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={handleDeleteRead}
          >
            <Text style={styles.headerActionText}>Delete read</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#D11B31"
          style={{ marginTop: 50 }}
        />
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.NotificationId)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => refreshNotifications(false)}
              tintColor="#D11B31"
            />
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons
                name="notifications-off-outline"
                size={64}
                color="#D1D5DB"
              />
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyText}>You're all caught up!</Text>
            </View>
          }
        />
      )}

      <ThankYouModal
        visible={thankYouVisible}
        onClose={() => setThankYouVisible(false)}
        message={thankYouMsg}
      />
    </SafeAreaView>
  );
};

export default NotificationsScreen;

const styles = StyleSheet.create({
  // ... rest remains same or updated for SafeAreaView
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(10),
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  backButton: {
    padding: 8,
  },
  titleWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontSize: moderateScale(20),
    fontWeight: "800",
    color: "#1F2937",
  },
  unreadBadge: {
    marginLeft: scale(8),
    minWidth: moderateScale(22),
    height: moderateScale(22),
    paddingHorizontal: scale(6),
    borderRadius: moderateScale(11),
    backgroundColor: "#D11B31",
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: {
    color: "#fff",
    fontSize: moderateScale(12),
    fontWeight: "800",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
  },
  headerActionBtn: {
    paddingVertical: verticalScale(5),
    paddingHorizontal: scale(8),
    borderRadius: moderateScale(8),
    backgroundColor: "#F3F4F6",
  },
  headerActionText: {
    fontSize: moderateScale(11),
    fontWeight: "700",
    color: "#374151",
  },
  disabledHeaderActionText: {
    color: "#9CA3AF",
  },
  list: {
    padding: scale(16),
    paddingBottom: verticalScale(24),
  },
  card: {
    backgroundColor: "#fff",
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
  },
  unreadCard: {
    backgroundColor: "#FFF5F5",
    borderColor: "#FED7D7",
    borderWidth: 1,
  },
  typeIcon: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
    justifyContent: "center",
    alignItems: "center",
  },
  headerInfo: {
    marginLeft: scale(12),
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  notifTitle: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: "#111827",
  },
  unreadDot: {
    width: moderateScale(8),
    height: moderateScale(8),
    borderRadius: moderateScale(4),
    backgroundColor: "#D11B31",
  },
  notifMessage: {
    fontSize: moderateScale(14),
    color: "#4B5563",
    marginTop: 4,
  },
  timeText: {
    fontSize: moderateScale(12),
    color: "#9CA3AF",
    marginTop: 4,
  },
  deleteButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: "center",
    marginTop: verticalScale(100),
  },
  emptyTitle: {
    fontSize: moderateScale(18),
    fontWeight: "700",
    color: "#374151",
    marginTop: verticalScale(16),
  },
  emptyText: {
    fontSize: moderateScale(14),
    color: "#6B7280",
    marginTop: verticalScale(4),
  },
});
