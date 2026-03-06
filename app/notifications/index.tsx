import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import ThankYouModal from "../../components/ThankYouModal";
import { connectSocket, getSocket } from "../../config/socket";
import { useNotifications } from "../../context/NotificationContext";
import { moderateScale, scale, verticalScale } from "../../utils/responsive";

const NotificationsScreen = () => {
    const { notifications, markAsRead, deleteNotification, fetchNotifications, unreadCount } = useNotifications();
    const [thankYouVisible, setThankYouVisible] = useState(false);
    const [thankYouMsg, setThankYouMsg] = useState("");
    const [loading, setLoading] = useState(false); // Context handles initial load, but we can track refreshing
    const router = useRouter();

    useEffect(() => {
        setupSocket();
    }, []);

    const setupSocket = async () => {
        try {
            const userData = await AsyncStorage.getItem("userData");
            if (!userData) return;
            const user = JSON.parse(userData);

            connectSocket(user.id);
            const socket = getSocket();

            socket.on("newNotification", () => {
                fetchNotifications();
            });

            socket.on("newBookingRequest", () => fetchNotifications());
            socket.on("bookingApproved", () => fetchNotifications());
            socket.on("bookingRejected", () => fetchNotifications());
            socket.on("donationStatusUpdated", () => fetchNotifications());
            socket.on("newDonationOffer", () => fetchNotifications());
        } catch (error) {
            console.error("Error setting up socket:", error);
        }
    };

    const handleNotificationPress = (notif: any) => {
        markAsRead(notif.NotificationId);
        if (notif.Type === "donation_thankyou") {
            setThankYouMsg(notif.Message);
            setThankYouVisible(true);
        }
    };

    const getIconForType = (type: string) => {
        switch (type) {
            case 'donation_request': return 'heart-circle-outline';
            case 'donation_status': return 'calendar-check-outline';
            case 'booking_request': return 'water-outline';
            case 'donation_thankyou': return 'star-outline';
            default: return 'notifications-outline';
        }
    };

    const getIconColor = (type: string) => {
        switch (type) {
            case 'donation_request': return '#D11B31';
            case 'donation_status': return '#059669';
            case 'booking_request': return '#3B82F6';
            case 'donation_thankyou': return '#F59E0B';
            default: return '#6B7280';
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        if (!item) return null;

        return (
            <TouchableOpacity
                style={[styles.card, !item.IsRead && styles.unreadCard]}
                onPress={() => handleNotificationPress(item)}
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
        <SafeAreaView style={styles.container}>
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
        borderBottomColor: '#F3F4F6'
    },
    backButton: {
        padding: 8,
    },
    title: {
        fontSize: moderateScale(20),
        fontWeight: "800",
        color: "#1F2937",
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
