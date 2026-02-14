import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { API_ENDPOINTS } from "../../config/api";
import { connectSocket, getSocket } from "../../config/socket";
import { moderateScale, scale, verticalScale } from "../../utils/responsive";

export default function ScheduleScreen() {
    const [donations, setDonations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<string>("");
    const [selectedDonation, setSelectedDonation] = useState<any>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [visitDate, setVisitDate] = useState(new Date());
    const [accepting, setAccepting] = useState(false);
    const [orgTab, setOrgTab] = useState<'requests' | 'confirmed'>('requests');
    const router = useRouter();

    useEffect(() => {
        fetchDonations();
        setupSocket();
    }, [orgTab]);

    const fetchDonations = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem("authToken");
            const userData = await AsyncStorage.getItem("userData");
            if (!token || !userData) return;

            const user = JSON.parse(userData);
            const role = user.role?.toLowerCase() || "";
            setUserRole(role);

            let endpoint = API_ENDPOINTS.GET_DONOR_SCHEDULE;
            if (role === 'organization') {
                endpoint = orgTab === 'requests'
                    ? API_ENDPOINTS.GET_ORG_REQUESTS
                    : API_ENDPOINTS.GET_ORG_CONFIRMED;
            }

            const response = await fetch(endpoint, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();

            if (response.ok && data.offers) {
                setDonations(data.offers.map((o: any) => ({
                    id: o.OfferId,
                    name: role === 'organization' ? (o.donor?.user?.FullName || "Donor") : (o.organization?.OrganizationName || "Organization"),
                    bloodType: o.donor?.BloodType || "Unknown",
                    timestamp: o.CreatedAt,
                    status: o.Status || "Pending",
                    phone: role === 'organization' ? (o.donor?.user?.Phone || "N/A") : (o.organization?.Contact || o.organization?.Phone || "N/A"),
                    donationDate: o.DonationDate,
                    organizationName: o.organization?.OrganizationName
                })));
            }
        } catch (error) {
            console.error("Error fetching donations:", error);
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

        // Specific legacy events or new real-time triggers to refresh list
        socket.on("newDonationOffer", () => fetchDonations());
        socket.on("donationStatusUpdated", () => fetchDonations());
        socket.on("bookingApproved", () => fetchDonations());
        socket.on("bookingRejected", () => fetchDonations());
        socket.on("newBookingRequest", () => fetchDonations());
    };

    const handleAcceptPress = (donation: any) => {
        setVisitDate(new Date()); // Reset to current time before opening picker
        setSelectedDonation(donation);
        setShowDatePicker(true);
    };

    const onDateChange = (event: any, selectedDate?: Date) => {
        const currentDate = selectedDate || visitDate;
        setShowDatePicker(Platform.OS === 'ios');
        setVisitDate(currentDate);
    };

    const confirmAcceptance = async () => {
        if (!selectedDonation) return;

        // Prevent scheduling in the past
        if (visitDate < new Date()) {
            Alert.alert("Error", "You cannot schedule a visit for a past date or time.");
            return;
        }

        try {
            setAccepting(true);
            const token = await AsyncStorage.getItem("authToken");
            if (!token) return;

            const response = await fetch(API_ENDPOINTS.UPDATE_DONATION_STATUS(selectedDonation.id), {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    status: 'accepted',
                    donationDate: visitDate.toISOString()
                })
            });

            const data = await response.json();
            if (response.ok) {
                Alert.alert("Success", "Donation scheduled successfully. Donor will be notified.");
                setShowDatePicker(false);
                setSelectedDonation(null);
                fetchDonations();
            } else {
                Alert.alert("Error", data?.message || "Failed to schedule donation");
            }
        } catch (error) {
            Alert.alert("Error", "Something went wrong. Please try again.");
        } finally {
            setAccepting(false);
        }
    };

    const handleReject = async (id: number) => {
        Alert.alert(
            "Reject Donation",
            "Are you sure you want to reject this donation offer?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Reject",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const token = await AsyncStorage.getItem("authToken");
                            const response = await fetch(API_ENDPOINTS.UPDATE_DONATION_STATUS(id), {
                                method: "PATCH",
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({ status: 'rejected' })
                            });

                            if (response.ok) {
                                Alert.alert("Success", "Donation offer rejected");
                                fetchDonations();
                            }
                        } catch (error) {
                            Alert.alert("Error", "Failed to reject donation");
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.bloodBadge}>
                    <Text style={styles.bloodTypeText}>{item.bloodType}</Text>
                </View>
                <View style={styles.headerInfo}>
                    <Text style={styles.nameText}>{item.name}</Text>
                    <Text style={styles.timeText}>
                        {item.status.toLowerCase() === 'accepted' ? 'Scheduled for' : 'Offered on'} {new Date(item.status.toLowerCase() === 'accepted' ? item.donationDate : item.timestamp).toLocaleDateString()}
                    </Text>
                </View>
                <View style={[
                    styles.statusBadge,
                    { backgroundColor: item.status.toLowerCase() === 'accepted' ? '#ECFDF5' : item.status.toLowerCase() === 'rejected' ? '#FEF2F2' : '#FFFBEB' }
                ]}>
                    <Text style={[
                        styles.statusText,
                        { color: item.status.toLowerCase() === 'accepted' ? '#059669' : item.status.toLowerCase() === 'rejected' ? '#DC2626' : '#D97706' }
                    ]}>
                        {item.status}
                    </Text>
                </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.cardBody}>
                <View style={styles.detailItem}>
                    <Ionicons name="call" size={16} color="#4B5563" />
                    <Text style={styles.detailLabel}>Contact:</Text>
                    <Text style={styles.detailValue}>{item.phone}</Text>
                </View>
                {item.status.toLowerCase() === 'accepted' && (
                    <>
                        <View style={[styles.detailItem, { marginTop: 8 }]}>
                            <Ionicons name="calendar-outline" size={16} color="#4B5563" />
                            <Text style={styles.detailLabel}>Visit Date:</Text>
                            <Text style={styles.detailValue}>
                                {new Date(item.donationDate).toLocaleDateString()}
                            </Text>
                        </View>
                        <View style={[styles.detailItem, { marginTop: 8 }]}>
                            <Ionicons name="time-outline" size={16} color="#4B5563" />
                            <Text style={styles.detailLabel}>Visit Time:</Text>
                            <Text style={styles.detailValue}>
                                {new Date(item.donationDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                            </Text>
                        </View>
                    </>
                )}
            </View>

            {userRole === 'organization' && item.status.toLowerCase() === 'pending' && (
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => handleReject(item.id)}
                    >
                        <Text style={styles.rejectButtonText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.approveButton]}
                        onPress={() => handleAcceptPress(item)}
                    >
                        <Text style={styles.approveButtonText}>Accept & Schedule</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginLeft: -4, marginRight: scale(8) }}>
                        <Ionicons name="chevron-back" size={28} color="#D11B31" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>Donation Schedule</Text>
                        <Text style={styles.subtitle}>Your confirmed and pending visits</Text>
                    </View>
                </View>
            </View>

            {userRole === 'organization' && (
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, orgTab === 'requests' && styles.activeTab]}
                        onPress={() => setOrgTab('requests')}
                    >
                        <Text style={[styles.tabText, orgTab === 'requests' && styles.activeTabText]}>Requests</Text>
                        {orgTab === 'requests' && <View style={styles.tabIndicator} />}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, orgTab === 'confirmed' && styles.activeTab]}
                        onPress={() => setOrgTab('confirmed')}
                    >
                        <Text style={[styles.tabText, orgTab === 'confirmed' && styles.activeTabText]}>Confirmed</Text>
                        {orgTab === 'confirmed' && <View style={styles.tabIndicator} />}
                    </TouchableOpacity>
                </View>
            )}

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#D11B31" />
                </View>
            ) : (
                <FlatList
                    data={donations}
                    renderItem={renderItem}
                    keyExtractor={(item) => `donation-${item.id}`}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="calendar-outline" size={80} color="#D1D5DB" />
                            <Text style={styles.emptyTitle}>
                                {userRole === 'organization' ? 'No Pending Donations' : 'No Scheduled Donations'}
                            </Text>
                            <Text style={styles.emptyText}>
                                {userRole === 'organization'
                                    ? 'New donation offers will appear here for scheduling.'
                                    : 'Your accepted or rejected donation offers will appear here.'}
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Date/Time Picker Modal */}
            <Modal
                transparent={true}
                visible={showDatePicker}
                animationType="fade"
                onRequestClose={() => setShowDatePicker(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Schedule Donation Visit</Text>
                        <Text style={styles.modalSubtitle}>Pick a date and time for the donor to visit your organization.</Text>

                        <View style={styles.pickerContainer}>
                            <DateTimePicker
                                value={visitDate}
                                mode="datetime"
                                is24Hour={false}
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={onDateChange}
                                minimumDate={new Date()}
                            />
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelModalButton]}
                                onPress={() => setShowDatePicker(false)}
                            >
                                <Text style={styles.cancelModalText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.confirmModalButton]}
                                onPress={confirmAcceptance}
                                disabled={accepting}
                            >
                                {accepting ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmModalText}>Confirm Visit</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F3F4F6",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: scale(20),
        paddingTop: verticalScale(60),
        paddingBottom: verticalScale(20),
        backgroundColor: "#fff",
        borderBottomWidth: 1,
        borderBottomColor: "#E5E7EB",
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
        padding: scale(20),
        marginBottom: verticalScale(16),
        elevation: 2,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
    },
    bloodBadge: {
        width: moderateScale(50),
        height: moderateScale(50),
        borderRadius: moderateScale(15),
        backgroundColor: "#FEF2F2",
        justifyContent: "center",
        alignItems: "center",
    },
    bloodTypeText: {
        fontSize: moderateScale(20),
        fontWeight: "800",
        color: "#FF3B30",
    },
    headerInfo: {
        marginLeft: scale(14),
        flex: 1,
    },
    nameText: {
        fontSize: moderateScale(17),
        fontWeight: "700",
        color: "#1F2937",
    },
    timeText: {
        fontSize: moderateScale(12),
        color: "#9CA3AF",
    },
    statusBadge: {
        paddingHorizontal: scale(10),
        paddingVertical: verticalScale(6),
        borderRadius: moderateScale(12),
    },
    statusText: {
        fontSize: moderateScale(10),
        fontWeight: "800",
        textTransform: "uppercase",
    },
    divider: {
        height: 1,
        backgroundColor: "#F3F4F6",
        marginVertical: verticalScale(12),
    },
    cardBody: {
        marginBottom: verticalScale(12),
    },
    detailItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(8),
    },
    detailLabel: {
        fontSize: moderateScale(13),
        color: "#6B7280",
    },
    detailValue: {
        fontSize: moderateScale(14),
        color: "#374151",
        fontWeight: "700",
    },
    actionRow: {
        flexDirection: "row",
        gap: scale(12),
    },
    actionButton: {
        flex: 1,
        paddingVertical: verticalScale(12),
        borderRadius: moderateScale(12),
        alignItems: "center",
    },
    approveButton: {
        backgroundColor: "#059669",
    },
    approveButtonText: {
        color: "#fff",
        fontWeight: "700",
    },
    rejectButton: {
        backgroundColor: "#F3F4F6",
    },
    rejectButtonText: {
        color: "#6B7280",
        fontWeight: "700",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    emptyState: {
        alignItems: "center",
        marginTop: verticalScale(100),
    },
    emptyTitle: {
        fontSize: moderateScale(20),
        fontWeight: "700",
        color: "#374151",
        marginTop: scale(20),
    },
    emptyText: {
        fontSize: moderateScale(14),
        color: "#9CA3AF",
        textAlign: "center",
        marginTop: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: scale(20),
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: moderateScale(24),
        padding: scale(24),
        width: '100%',
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: moderateScale(20),
        fontWeight: '800',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: moderateScale(14),
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 20,
    },
    pickerContainer: {
        marginVertical: 10,
        alignItems: 'center',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    modalButton: {
        flex: 1,
        paddingVertical: verticalScale(14),
        borderRadius: moderateScale(14),
        alignItems: 'center',
    },
    cancelModalButton: {
        backgroundColor: '#F3F4F6',
    },
    confirmModalButton: {
        backgroundColor: '#D11B31',
    },
    cancelModalText: {
        color: '#4B5563',
        fontWeight: '700',
    },
    confirmModalText: {
        color: '#fff',
        fontWeight: '700',
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingHorizontal: scale(20),
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    tab: {
        flex: 1,
        paddingVertical: verticalScale(14),
        alignItems: 'center',
        position: 'relative',
    },
    activeTab: {
    },
    tabText: {
        fontSize: moderateScale(14),
        fontWeight: '600',
        color: '#6B7280',
    },
    activeTabText: {
        color: '#D11B31',
        fontWeight: '700',
    },
    tabIndicator: {
        position: 'absolute',
        bottom: 0,
        height: 3,
        width: '60%',
        backgroundColor: '#D11B31',
        borderTopLeftRadius: 3,
        borderTopRightRadius: 3,
    }
});
