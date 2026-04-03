import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { API_ENDPOINTS } from "../../config/api";
import { moderateScale, scale, verticalScale } from "../../utils/responsive";

export default function DonationHistoryScreen() {
    const router = useRouter();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem("authToken");
            if (!token) return;

            const response = await fetch(API_ENDPOINTS.GET_DONOR_HISTORY, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();

            if (response.ok && data.history) {
                setHistory(data.history);
            }
        } catch (error) {
            console.log("Error fetching history:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchHistory();
    };

    const renderItem = ({ item }: { item: any }) => {
        const status = item.status?.toLowerCase();
        const isCompleted = status === 'accepted' || status === 'completed';
        const isRejected = status === 'rejected' || status === 'cancelled';

        const statusColor = isCompleted ? '#059669' : (isRejected ? '#DC2626' : '#D97706');
        const statusBg = isCompleted ? '#ECFDF5' : (isRejected ? '#FEF2F2' : '#FFFBEB');

        const isEmergency = item.type === 'Emergency Response';

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.badgeWrapper}>
                        <View style={[styles.bloodBadge, isEmergency && styles.emergencyBadge]}>
                            <Text style={[styles.bloodTypeText, isEmergency && styles.emergencyText]}>
                                {item.bloodType}
                            </Text>
                        </View>
                        <View style={[styles.typeBadge, { backgroundColor: isEmergency ? '#FEE2E2' : '#E0F2FE' }]}>
                            <Text style={[styles.typeText, { color: isEmergency ? '#DC2626' : '#0369A1' }]}>
                                {isEmergency ? 'EMERGENCY' : 'OFFER'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.headerInfo}>
                        <Text style={styles.nameText} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.timeText}>
                            {new Date(item.date).toLocaleDateString()} at {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>

                    <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>
                            {item.status}
                        </Text>
                    </View>
                </View>

                {item.scheduledDate && (
                    <View style={styles.scheduledBlock}>
                        <View style={styles.scheduledHeader}>
                            <Ionicons name="calendar-outline" size={16} color="#059669" />
                            <Text style={styles.scheduledTitle}>Scheduled Donation</Text>
                        </View>
                        <Text style={styles.scheduledTime}>
                            {new Date(item.scheduledDate).toLocaleDateString()} at {new Date(item.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerRow}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <Ionicons name="chevron-back" size={28} color="#D11B31" />
                    </TouchableOpacity>
                    <View style={styles.titleContainer}>
                        <Text style={styles.title}>Donation History</Text>
                        <Text style={styles.subtitle}>Your contribution to saving lives</Text>
                    </View>
                </View>
            </View>

            {loading && !history.length ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#D11B31" />
                    <Text style={styles.loadingText}>Loading history...</Text>
                </View>
            ) : (
                <FlatList
                    data={history}
                    renderItem={renderItem}
                    keyExtractor={(item) => `${item.type}-${item.id}`}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#D11B31"]} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <View style={styles.emptyIconContainer}>
                                <Ionicons name="time-outline" size={moderateScale(60)} color="#D1D5DB" />
                            </View>
                            <Text style={styles.emptyTitle}>No History Yet</Text>
                            <Text style={styles.emptyText}>When you donate blood, your history will appear here.</Text>
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
        backgroundColor: "#F8F9FA",
    },
    header: {
        paddingTop: verticalScale(50),
        paddingBottom: verticalScale(15),
        paddingHorizontal: scale(16),
        backgroundColor: "#fff",
        borderBottomWidth: 1,
        borderBottomColor: "#F3F4F6",
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    backButton: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: scale(8),
        marginLeft: scale(-4),
        zIndex: 10,
    },
    titleContainer: {
        flex: 1,
    },
    title: {
        fontSize: moderateScale(22),
        fontWeight: "900",
        color: "#111827",
    },
    subtitle: {
        fontSize: moderateScale(13),
        color: "#6B7280",
        marginTop: 2,
    },
    list: {
        padding: scale(16),
        paddingBottom: verticalScale(100),
    },
    card: {
        backgroundColor: "#fff",
        borderRadius: moderateScale(20),
        padding: scale(16),
        marginBottom: verticalScale(16),
        borderWidth: 1,
        borderColor: "#F3F4F6",
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
    badgeWrapper: {
        alignItems: 'center',
        gap: 4,
    },
    bloodBadge: {
        width: moderateScale(40),
        height: moderateScale(40),
        borderRadius: moderateScale(10),
        backgroundColor: "#FEF2F2",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#FEE2E2",
    },
    emergencyBadge: {
        backgroundColor: "#DC2626",
        borderColor: "#DC2626",
    },
    bloodTypeText: {
        fontSize: moderateScale(16),
        fontWeight: "900",
        color: "#D11B31",
    },
    emergencyText: {
        color: "#FFFFFF",
    },
    typeBadge: {
        paddingHorizontal: scale(4),
        paddingVertical: verticalScale(1),
        borderRadius: moderateScale(4),
    },
    typeText: {
        fontSize: moderateScale(7),
        fontWeight: "900",
    },
    headerInfo: {
        marginLeft: scale(12),
        flex: 1,
    },
    nameText: {
        fontSize: moderateScale(16),
        fontWeight: "700",
        color: "#111827",
    },
    timeText: {
        fontSize: moderateScale(11),
        color: "#9CA3AF",
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: scale(8),
        paddingVertical: verticalScale(4),
        borderRadius: moderateScale(8),
    },
    statusText: {
        fontSize: moderateScale(10),
        fontWeight: "800",
        textTransform: "uppercase",
    },
    scheduledBlock: {
        marginTop: verticalScale(12),
        backgroundColor: "#F0FDF4",
        padding: scale(12),
        borderRadius: moderateScale(12),
        borderWidth: 1,
        borderColor: "#DCFCE7",
    },
    scheduledHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(6),
        marginBottom: verticalScale(2),
    },
    scheduledTitle: {
        fontSize: moderateScale(12),
        fontWeight: "700",
        color: "#059669",
    },
    scheduledTime: {
        fontSize: moderateScale(13),
        color: "#059669",
        fontWeight: "600",
        marginLeft: scale(22),
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: {
        marginTop: 12,
        color: "#6B7280",
        fontSize: moderateScale(14),
    },
    emptyState: {
        alignItems: "center",
        justifyContent: "center",
        marginTop: verticalScale(100),
        paddingHorizontal: scale(40),
    },
    emptyIconContainer: {
        width: moderateScale(100),
        height: moderateScale(100),
        borderRadius: moderateScale(50),
        backgroundColor: "#F3F4F6",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: verticalScale(20),
    },
    emptyTitle: {
        fontSize: moderateScale(18),
        fontWeight: "800",
        color: "#374151",
    },
    emptyText: {
        fontSize: moderateScale(14),
        color: "#9CA3AF",
        textAlign: "center",
        marginTop: 8,
    },
});
