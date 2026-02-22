import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { API_ENDPOINTS } from "../config/api";
import { moderateScale, scale, verticalScale } from "../utils/responsive";

interface ReceivedPaymentsModalProps {
    visible: boolean;
    onClose: () => void;
}

const ReceivedPaymentsModal = ({ visible, onClose }: ReceivedPaymentsModalProps) => {
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible) {
            loadPayments();
        }
    }, [visible]);

    const loadPayments = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem("authToken");
            if (!token) return;

            const response = await fetch(API_ENDPOINTS.GET_PAYMENT_HISTORY, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            if (response.ok) {
                setPayments(data.payments || []);
            }
        } catch (error) {
            console.error("Error loading received payments:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
                <View style={styles.modalContent}>
                    <View style={styles.modalHandle} />

                    <View style={styles.header}>
                        <Text style={styles.modalTitle}>Received Payments</Text>
                        <Text style={styles.modalSubtitle}>History of all payments received from gainers.</Text>
                    </View>

                    {loading ? (
                        <View style={styles.centerContainer}>
                            <ActivityIndicator size="large" color="#D11B31" />
                            <Text style={styles.loadingText}>Fetching payments...</Text>
                        </View>
                    ) : (
                        <ScrollView
                            style={styles.scrollArea}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.scrollContent}
                        >
                            {payments.length > 0 ? (
                                payments.map((item, index) => (
                                    <View key={item.PaymentId || index} style={styles.paymentCard}>
                                        <View style={styles.cardHeader}>
                                            <View style={styles.iconBadge}>
                                                <Ionicons name="person" size={moderateScale(20)} color="#D11B31" />
                                            </View>

                                            <View style={styles.mainInfo}>
                                                <Text style={styles.gainerName} numberOfLines={1}>
                                                    {item.gainer?.user?.FullName || "Anonymous Gainer"}
                                                </Text>
                                                <Text style={styles.subtext}>
                                                    {new Date(item.PaymentDate).toLocaleDateString()} at {new Date(item.PaymentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </Text>
                                            </View>

                                            <View style={styles.amountBadge}>
                                                <Text style={styles.amountText}>₹{item.Amount}</Text>
                                            </View>
                                        </View>

                                        <View style={styles.divider} />

                                        <View style={styles.cardFooter}>
                                            <View style={styles.detailItem}>
                                                <Ionicons name="receipt-outline" size={moderateScale(14)} color="#6B7280" />
                                                <Text style={styles.detailLabel}>Payment ID: {item.PaymentId}</Text>
                                            </View>
                                            <View style={styles.detailItem}>
                                                <Ionicons name="water-outline" size={moderateScale(14)} color="#D11B31" />
                                                <Text style={styles.detailLabel}>
                                                    {item.request?.BloodType} • {item.request?.Units} units
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                ))
                            ) : (
                                <View style={styles.emptyState}>
                                    <Ionicons name="card-outline" size={moderateScale(48)} color="#D1D5DB" />
                                    <Text style={styles.emptyText}>No payments received yet</Text>
                                </View>
                            )}
                        </ScrollView>
                    )}

                    <TouchableOpacity
                        style={styles.dismissButton}
                        onPress={onClose}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.dismissButtonText}>Dismiss</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "flex-end",
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    modalContent: {
        backgroundColor: "#fff",
        borderTopLeftRadius: moderateScale(32),
        borderTopRightRadius: moderateScale(32),
        paddingHorizontal: scale(20),
        paddingTop: verticalScale(12),
        paddingBottom: verticalScale(30),
        maxHeight: '90%',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -moderateScale(4) },
        shadowOpacity: 0.1,
        shadowRadius: moderateScale(12),
        elevation: 20,
    },
    modalHandle: {
        width: scale(40),
        height: verticalScale(5),
        backgroundColor: "#E5E7EB",
        borderRadius: 10,
        alignSelf: "center",
        marginBottom: verticalScale(20),
    },
    header: {
        marginBottom: verticalScale(20),
    },
    modalTitle: {
        fontSize: moderateScale(24),
        fontWeight: "800",
        color: "#D11B31",
        marginBottom: verticalScale(4),
    },
    modalSubtitle: {
        fontSize: moderateScale(14),
        color: "#6B7280",
        lineHeight: moderateScale(20),
    },
    scrollArea: {
        width: "100%",
    },
    scrollContent: {
        paddingBottom: verticalScale(20),
    },
    paymentCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: moderateScale(20),
        padding: scale(16),
        marginBottom: verticalScale(12),
        borderWidth: 1,
        borderColor: "#F3F4F6",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
    },
    iconBadge: {
        width: moderateScale(40),
        height: moderateScale(40),
        borderRadius: moderateScale(12),
        backgroundColor: "#FEF2F2",
        justifyContent: "center",
        alignItems: "center",
        marginRight: scale(12),
    },
    mainInfo: {
        flex: 1,
        marginRight: scale(8),
    },
    gainerName: {
        fontSize: moderateScale(16),
        fontWeight: "700",
        color: "#111827",
    },
    subtext: {
        fontSize: moderateScale(12),
        color: "#6B7280",
        fontWeight: "500",
        marginTop: 2,
    },
    amountBadge: {
        backgroundColor: "#ECFDF5",
        paddingHorizontal: scale(10),
        paddingVertical: verticalScale(4),
        borderRadius: moderateScale(10),
    },
    amountText: {
        fontSize: moderateScale(16),
        fontWeight: "800",
        color: "#059669",
    },
    divider: {
        height: 1,
        backgroundColor: "#F3F4F6",
        marginVertical: verticalScale(12),
    },
    cardFooter: {
        gap: verticalScale(6),
    },
    detailItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(6),
    },
    detailLabel: {
        fontSize: moderateScale(12),
        color: "#6B7280",
        fontWeight: "500",
    },
    centerContainer: {
        paddingVertical: verticalScale(60),
        alignItems: "center",
    },
    loadingText: {
        marginTop: verticalScale(12),
        fontSize: moderateScale(14),
        color: "#6B7280",
        fontWeight: "500",
    },
    emptyState: {
        paddingVertical: verticalScale(60),
        alignItems: "center",
    },
    emptyText: {
        marginTop: verticalScale(16),
        fontSize: moderateScale(15),
        color: "#9CA3AF",
        fontWeight: "500",
    },
    dismissButton: {
        width: "100%",
        backgroundColor: "#D11B31",
        borderRadius: moderateScale(24),
        paddingVertical: verticalScale(16),
        alignItems: "center",
        marginTop: verticalScale(10),
        shadowColor: "#D11B31",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    dismissButtonText: {
        color: "#fff",
        fontWeight: "800",
        fontSize: moderateScale(17),
        letterSpacing: 0.5,
    },
});

export default ReceivedPaymentsModal;
