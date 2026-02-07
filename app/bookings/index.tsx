import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { API_ENDPOINTS } from "../../config/api";
import { connectSocket, getSocket } from "../../config/socket";
import { moderateScale, scale, verticalScale } from "../../utils/responsive";

export default function BookingsScreen() {
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<string>("");
    const router = useRouter();

    useEffect(() => {
        fetchBookings();
        setupSocket();
    }, []);

    const fetchBookings = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem("authToken");
            const userData = await AsyncStorage.getItem("userData");
            if (!token || !userData) return;

            const user = JSON.parse(userData);
            const role = (user.role || "").toLowerCase();
            setUserRole(role);

            // Fetch bookings
            const bookingResponse = await fetch(API_ENDPOINTS.GET_USER_BOOKINGS(user.id), {
                headers: { Authorization: `Bearer ${token}` },
            });
            const bookingData = await bookingResponse.json();

            // Fetch donations
            const donationResponse = await fetch(API_ENDPOINTS.GET_DONATIONS, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const donationData = await donationResponse.json();

            let combinedData: any[] = [];

            if (bookingResponse.ok && bookingData.requests) {
                combinedData = [...combinedData, ...bookingData.requests.map((r: any) => ({
                    id: r.RequestId,
                    type: 'booking',
                    name: role === 'organization' ? (r.gainer?.user?.FullName || "User") : (r.organization?.OrganizationName || "Blood Bank"),
                    bloodType: r.BloodType,
                    units: r.Units,
                    timestamp: r.RequestDate,
                    status: r.Status || "Pending",
                    phone: r.gainer?.user?.Phone || "N/A"
                }))];
            }

            if (donationResponse.ok && donationData.offers) {
                const offers = donationData.offers;
                // Only include donations for donors. 
                // Organizations now manage donations in the Schedule page.
                if (role === 'donor') {
                    combinedData = [...combinedData, ...offers.map((o: any) => ({
                        id: o.OfferId,
                        type: 'donation',
                        name: o.organization?.OrganizationName || "Blood Bank",
                        bloodType: o.donor?.BloodType || "Unknown",
                        units: 1,
                        timestamp: o.CreatedAt,
                        status: o.Status || "Pending",
                        scheduledDate: o.DonationDate // Include scheduled visit time
                    }))];
                } else if (role === 'organization') {
                    // Include accepted/rejected donations for record history
                    const history = offers.filter((o: any) => o.Status?.toLowerCase() !== 'pending');
                    combinedData = [...combinedData, ...history.map((o: any) => ({
                        id: o.OfferId,
                        type: 'donation',
                        name: o.donor?.user?.FullName || "Donor",
                        bloodType: o.donor?.BloodType || "Unknown",
                        units: 1,
                        timestamp: o.CreatedAt,
                        status: o.Status || "Pending",
                        phone: o.donor?.user?.Phone || "N/A",
                        scheduledDate: o.DonationDate
                    }))];
                }
            }

            // Sort by timestamp desc
            combinedData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setBookings(combinedData);
        } catch (error) {
            console.error("Error fetching data:", error);
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

        // Comprehensive Real-time Updates for Bookings and Donations
        const refreshEvents = [
            "newBookingRequest",
            "bookingApproved",
            "bookingRejected",
            "newDonationOffer",
            "donationStatusUpdated"
        ];

        refreshEvents.forEach(event => {
            socket.off(event);
            socket.on(event, () => {
                fetchBookings();
            });
        });
    };

    const handleAction = async (id: number, action: "approve" | "reject", type: 'booking' | 'donation') => {
        try {
            const token = await AsyncStorage.getItem("authToken");
            if (!token) return;

            let endpoint;
            let method: string = "PATCH";

            if (type === 'booking') {
                endpoint = action === "approve"
                    ? API_ENDPOINTS.APPROVE_BOOKING(id)
                    : API_ENDPOINTS.REJECT_BOOKING(id);
            } else {
                endpoint = API_ENDPOINTS.UPDATE_DONATION_STATUS(id);
                // For donations, backend expects { status: 'accepted' | 'rejected' } in body
            }

            const response = await fetch(endpoint, {
                method: method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: type === 'donation' ? JSON.stringify({ status: action === 'approve' ? 'accepted' : 'rejected' }) : undefined
            });

            const data = await response.json().catch(() => null);
            if (response.ok) {
                Alert.alert("Success", `${type === 'booking' ? 'Booking' : 'Donation'} ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
                fetchBookings();
            } else {
                Alert.alert("Error", data?.message || `Failed to ${action} ${type}`);
            }
        } catch (error) {
            Alert.alert("Error", "Something went wrong. Please try again.");
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        const isOrg = userRole === "organization";
        const status = item.status?.toLowerCase();

        // Define colors based on status
        const isCompleted = status === 'approved' || status === 'accepted';
        const isRejected = status === 'rejected';

        const statusColor = isCompleted ? '#059669' : (isRejected ? '#DC2626' : '#D97706');
        const statusBg = isCompleted ? '#ECFDF5' : (isRejected ? '#FEF2F2' : '#FFFBEB');

        const isBooking = item.type === 'booking';

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.bloodBadge}>
                        <Text style={styles.bloodTypeText}>{item.bloodType}</Text>
                    </View>
                    <View style={styles.headerInfo}>
                        <View style={styles.nameRow}>
                            <Text style={styles.nameText} numberOfLines={1}>{item.name}</Text>
                            <View style={[styles.typeBadge, { backgroundColor: isBooking ? '#E0F2FE' : '#F3E8FF' }]}>
                                <Text style={[styles.typeText, { color: isBooking ? '#0369A1' : '#7E22CE' }]}>
                                    {isBooking ? 'REQUEST' : 'DONATION'}
                                </Text>
                            </View>
                        </View>
                        <Text style={styles.timeText}>
                            {new Date(item.timestamp).toLocaleDateString()} at {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>
                            {item.status}
                        </Text>
                    </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.cardBody}>
                    <View style={styles.detailItem}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="water" size={14} color="#D11B31" />
                        </View>
                        <Text style={styles.detailLabel}>Units:</Text>
                        <Text style={styles.detailValue}>{item.units} Units</Text>
                    </View>

                    {isOrg && (
                        <View style={styles.detailItem}>
                            <View style={[styles.iconContainer, { backgroundColor: '#F3F4F6' }]}>
                                <Ionicons name="call" size={14} color="#6B7280" />
                            </View>
                            <Text style={styles.detailLabel}>Contact:</Text>
                            <Text style={styles.detailValue}>{item.phone}</Text>
                        </View>
                    )}

                    {item.scheduledDate && (
                        <View style={styles.scheduledBlock}>
                            <View style={styles.scheduledHeader}>
                                <Ionicons name="calendar" size={16} color="#059669" />
                                <Text style={styles.scheduledTitle}>Scheduled Visit</Text>
                            </View>
                            <Text style={styles.scheduledTime}>
                                {new Date(item.scheduledDate).toLocaleDateString()} at {new Date(item.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </View>
                    )}
                </View>

                {isOrg && (status === "pending") && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.rejectButton]}
                            onPress={() => handleAction(item.id, "reject", item.type)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.rejectButtonText}>Reject</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.approveButton]}
                            onPress={() => handleAction(item.id, "approve", item.type)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.approveButtonText}>Approve</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Bookings Record</Text>
            </View>

            {loading && !bookings.length ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#D11B31" />
                    <Text style={styles.loadingText}>Fetching Records...</Text>
                </View>
            ) : (
                <FlatList
                    data={bookings}
                    renderItem={renderItem}
                    keyExtractor={(item) => `${item.type}-${item.id}`}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <View style={styles.emptyIconContainer}>
                                <Ionicons name="clipboard-outline" size={moderateScale(60)} color="#D1D5DB" />
                            </View>
                            <Text style={styles.emptyTitle}>No Bookings Found</Text>
                            <Text style={styles.emptyText}>Your booking history will appear here.</Text>
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
        paddingHorizontal: scale(20),
        paddingTop: verticalScale(60),
        paddingBottom: verticalScale(20),
        backgroundColor: "#fff",
        borderBottomWidth: 1,
        borderBottomColor: "#F3F4F6",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 2,
    },
    title: {
        fontSize: moderateScale(24),
        fontWeight: "900",
        color: "#111827",
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(6),
        marginBottom: 2,
    },
    typeBadge: {
        paddingHorizontal: scale(6),
        paddingVertical: verticalScale(2),
        borderRadius: moderateScale(6),
    },
    typeText: {
        fontSize: moderateScale(8),
        fontWeight: "900",
        letterSpacing: 0.3,
    },
    list: {
        padding: scale(16),
        paddingBottom: verticalScale(30),
    },
    card: {
        backgroundColor: "#fff",
        borderRadius: moderateScale(24),
        padding: scale(16),
        marginBottom: verticalScale(16),
        borderWidth: 1,
        borderColor: "#F3F4F6",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
    },
    bloodBadge: {
        width: moderateScale(48),
        height: moderateScale(48),
        borderRadius: moderateScale(14),
        backgroundColor: "#FEF2F2",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#FEE2E2",
    },
    bloodTypeText: {
        fontSize: moderateScale(18),
        fontWeight: "900",
        color: "#D11B31",
    },
    headerInfo: {
        marginLeft: scale(12),
        flex: 1,
    },
    nameText: {
        fontSize: moderateScale(16),
        fontWeight: "700",
        color: "#111827",
        maxWidth: '65%',
    },
    timeText: {
        fontSize: moderateScale(11),
        color: "#9CA3AF",
        fontWeight: "500",
    },
    statusBadge: {
        paddingHorizontal: scale(10),
        paddingVertical: verticalScale(4),
        borderRadius: moderateScale(10),
    },
    statusText: {
        fontSize: moderateScale(10),
        fontWeight: "800",
        textTransform: "uppercase",
    },
    divider: {
        height: 1,
        backgroundColor: "#F9FAFB",
        marginVertical: verticalScale(16),
    },
    cardBody: {
        gap: verticalScale(10),
    },
    detailItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(10),
    },
    iconContainer: {
        width: moderateScale(28),
        height: moderateScale(28),
        borderRadius: moderateScale(8),
        backgroundColor: "#FEF2F2",
        justifyContent: "center",
        alignItems: "center",
    },
    detailLabel: {
        fontSize: moderateScale(14),
        color: "#6B7280",
        fontWeight: "500",
    },
    detailValue: {
        fontSize: moderateScale(14),
        color: "#374151",
        fontWeight: "700",
        flex: 1,
    },
    scheduledBlock: {
        marginTop: verticalScale(6),
        backgroundColor: "#F0FDF4",
        padding: scale(12),
        borderRadius: moderateScale(16),
        borderWidth: 1,
        borderColor: "#DCFCE7",
    },
    scheduledHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(6),
        marginBottom: verticalScale(4),
    },
    scheduledTitle: {
        fontSize: moderateScale(13),
        fontWeight: "700",
        color: "#059669",
    },
    scheduledTime: {
        fontSize: moderateScale(14),
        color: "#059669",
        fontWeight: "600",
        marginLeft: scale(22),
    },
    actionRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        gap: scale(12),
        marginTop: verticalScale(16),
    },
    actionButton: {
        flex: 1,
        paddingVertical: verticalScale(14),
        borderRadius: moderateScale(16),
        alignItems: "center",
        justifyContent: "center",
    },
    approveButton: {
        backgroundColor: "#D11B31",
        shadowColor: "#D11B31",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    approveButtonText: {
        color: "#fff",
        fontWeight: "800",
        fontSize: moderateScale(14),
    },
    rejectButton: {
        backgroundColor: "#F3F4F6",
    },
    rejectButtonText: {
        color: "#6B7280",
        fontWeight: "700",
        fontSize: moderateScale(14),
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
        fontWeight: "500",
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
        marginBottom: verticalScale(24),
    },
    emptyTitle: {
        fontSize: moderateScale(20),
        fontWeight: "800",
        color: "#374151",
        marginBottom: verticalScale(8),
    },
    emptyText: {
        fontSize: moderateScale(14),
        color: "#9CA3AF",
        textAlign: "center",
        lineHeight: moderateScale(20),
    },
});
