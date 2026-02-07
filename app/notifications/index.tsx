import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { API_ENDPOINTS } from "../../config/api";
import { connectSocket, getSocket } from "../../config/socket";
import { Fonts } from "../../constants/theme";
import { moderateScale, scale, verticalScale } from "../../utils/responsive";

export default function NotificationsScreen() {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<string>("");
    const router = useRouter();

    useEffect(() => {
        fetchNotifications();
        setupSocket();
    }, []);

    const fetchNotifications = async () => {
        try {
            const token = await AsyncStorage.getItem("authToken");
            if (!token) return;

            const response = await fetch(API_ENDPOINTS.GET_NOTIFICATIONS, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await response.json();
            if (response.ok) {
                setNotifications(data.notifications || []);
            }
        } catch (error) {
            console.error("Error fetching notifications:", error);
        } finally {
            setLoading(false);
        }
    };

    const setupSocket = async () => {
        const userData = await AsyncStorage.getItem("userData");
        if (!userData) return;
        const user = JSON.parse(userData);

        connectSocket(user.id);
        const socket = getSocket();

        // Premium Real-time Experience: Listen for any new notification
        socket.on("newNotification", (notification: any) => {
            setNotifications((prev) => [notification, ...prev]);
        });

        // Specific legacy events or new real-time triggers to refresh list
        socket.on("newBookingRequest", () => fetchNotifications());
        socket.on("bookingApproved", () => fetchNotifications());
        socket.on("bookingRejected", () => fetchNotifications());
        socket.on("donationStatusUpdated", () => fetchNotifications());
        socket.on("newDonationOffer", () => fetchNotifications());
    };

    const markAsRead = async (id: number) => {
        try {
            const token = await AsyncStorage.getItem("authToken");
            if (!token) return;

            const response = await fetch(API_ENDPOINTS.MARK_NOTIFICATION_READ(id), {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                setNotifications((prev) =>
                    prev.map((n) => (n.NotificationId === id ? { ...n, IsRead: true } : n))
                );
            }
        } catch (error) {
            console.error("Error marking as read:", error);
        }
    };

    const deleteNotification = async (id: number) => {
        try {
            const token = await AsyncStorage.getItem("authToken");
            if (!token) return;

            const response = await fetch(API_ENDPOINTS.DELETE_NOTIFICATION(id), {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                setNotifications((prev) => prev.filter((n) => n.NotificationId !== id));
            }
        } catch (error) {
            console.error("Error deleting notification:", error);
        }
    };

    const getIconForType = (type: string) => {
        switch (type) {
            case 'donation_request': return 'heart-circle-outline';
            case 'donation_status': return 'calendar-check-outline';
            case 'booking_request': return 'water-outline';
            case 'booking_status': return 'notifications-outline';
            default: return 'notifications-outline';
        }
    };

    const getIconColor = (type: string) => {
        switch (type) {
            case 'donation_request': return '#D11B31';
            case 'donation_status': return '#059669';
            case 'booking_request': return '#3B82F6';
            default: return '#6B7280';
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        if (!item) return null;

        return (
            <TouchableOpacity
                style={[styles.card, !item.IsRead && styles.unreadCard]}
                onPress={() => markAsRead(item.NotificationId)}
                activeOpacity={0.7}
            >
                <View style={styles.cardHeader}>
                    <View style={[styles.typeIcon, { backgroundColor: getIconColor(item.Type) + '15' }]}>
                        <Ionicons name={getIconForType(item.Type) as any} size={24} color={getIconColor(item.Type)} />
                    </View>
                    <View style={styles.headerInfo}>
                        <View style={styles.titleRow}>
                            <Text style={styles.notifTitle}>{item.Title}</Text>
                            {!item.IsRead && <View style={styles.unreadDot} />}
                        </View>
                        <Text style={styles.notifMessage}>{item.Message}</Text>
                        <Text style={styles.timeText}>{new Date(item.CreatedAt).toLocaleString()}</Text>
                    </View>
                    <TouchableOpacity onPress={() => deleteNotification(item.NotificationId)} style={styles.deleteButton}>
                        <Ionicons name="trash-outline" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#D11B31" />
                </TouchableOpacity>
                <Text style={styles.title}>Notifications</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#D11B31" style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={notifications}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.NotificationId.toString()}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="notifications-off-outline" size={64} color="#D1D5DB" />
                            <Text style={styles.emptyTitle}>No notifications yet</Text>
                            <Text style={styles.emptyText}>You're all caught up!</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F9FAFB",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: scale(16),
        paddingTop: verticalScale(60),
        paddingBottom: verticalScale(20),
        backgroundColor: "#fff",
    },
    backButton: {
        padding: 8,
    },
    title: {
        fontSize: moderateScale(20),
        fontWeight: "800",
        color: "#1F2937",
        fontFamily: Fonts.rounded || Fonts.sans,
    },
    list: {
        padding: scale(16),
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
        elevation: 3,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: verticalScale(12),
    },
    unreadCard: {
        backgroundColor: "#F0F9FF",
        borderColor: "#BAE6FD",
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
        backgroundColor: "#3B82F6",
    },
    notifMessage: {
        fontSize: moderateScale(14),
        color: "#4B5563",
        marginTop: 4,
        lineHeight: moderateScale(20),
    },
    timeText: {
        fontSize: moderateScale(12),
        color: "#6B7280",
        marginTop: 4,
    },
    deleteButton: {
        padding: 4,
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
