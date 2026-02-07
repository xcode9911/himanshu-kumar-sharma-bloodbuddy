import { Ionicons } from "@expo/vector-icons"
import React from "react"
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { moderateScale, scale, verticalScale } from "../utils/responsive"

interface Booking {
    requestId: number
    type: 'booking' | 'donation'
    bloodType: string
    units: number
    status: string
    createdAt: string
    organizationName: string
    organizationId: number
    userName: string
    phone?: string
}

interface AppointmentsModalProps {
    visible: boolean
    onClose: () => void
    bookings: Booking[]
}

export default function AppointmentsModal({ visible, onClose, bookings }: AppointmentsModalProps) {
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
                <View style={styles.modalContent}>
                    <View style={styles.modalHandle} />

                    <View style={styles.header}>
                        <Text style={styles.modalTitle}>Appointments</Text>
                        <Text style={styles.modalSubtitle}>List of recent blood booking requests and donations.</Text>
                    </View>

                    <ScrollView
                        style={styles.scrollArea}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        {bookings.length > 0 ? (
                            bookings.map((booking, index) => (
                                <View key={booking.requestId || index} style={styles.bookingCard}>
                                    <View style={styles.cardHeader}>
                                        <View style={styles.bloodBadgeContainer}>
                                            <Text style={styles.bloodBadgeText}>{booking.bloodType}</Text>
                                        </View>

                                        <View style={styles.mainInfo}>
                                            <View style={styles.nameRow}>
                                                <Text style={styles.requesterName} numberOfLines={1}>{booking.userName || "Requester"}</Text>
                                                <View style={[
                                                    styles.typeBadge,
                                                    { backgroundColor: booking.type === 'booking' ? '#E0F2FE' : '#F3E8FF' }
                                                ]}>
                                                    <Text style={[
                                                        styles.typeBadgeText,
                                                        { color: booking.type === 'booking' ? '#0369A1' : '#7E22CE' }
                                                    ]}>
                                                        {booking.type}
                                                    </Text>
                                                </View>
                                            </View>

                                            <Text style={styles.subtext}>
                                                {new Date(booking.createdAt).toLocaleDateString()}
                                                {booking.phone && booking.phone !== 'N/A' ? ` • ${booking.phone}` : ''}
                                            </Text>
                                        </View>

                                        <View style={[
                                            styles.statusBadge,
                                            {
                                                backgroundColor:
                                                    booking.status === "approved" || booking.status === "accepted"
                                                        ? "#ECFDF5"
                                                        : booking.status === "rejected"
                                                            ? "#FEF2F2"
                                                            : "#FFFBEB",
                                            },
                                        ]}>
                                            <Text style={[
                                                styles.statusText,
                                                {
                                                    color:
                                                        booking.status === "approved" || booking.status === "accepted"
                                                            ? "#059669"
                                                            : booking.status === "rejected"
                                                                ? "#DC2626"
                                                                : "#D97706",
                                                },
                                            ]}>
                                                {booking.status}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            ))
                        ) : (
                            <View style={styles.emptyState}>
                                <Ionicons name="calendar-outline" size={moderateScale(48)} color="#D1D5DB" />
                                <Text style={styles.emptyText}>No appointments yet</Text>
                            </View>
                        )}
                    </ScrollView>

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
    )
}

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
    bookingCard: {
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
    bloodBadgeContainer: {
        width: moderateScale(44),
        height: moderateScale(44),
        borderRadius: moderateScale(12),
        backgroundColor: "#FEF2F2",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#FEE2E2",
        marginRight: scale(12),
    },
    bloodBadgeText: {
        fontSize: moderateScale(16),
        fontWeight: "900",
        color: "#D11B31",
    },
    mainInfo: {
        flex: 1,
        marginRight: scale(8),
    },
    nameRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(6),
        marginBottom: verticalScale(2),
    },
    requesterName: {
        fontSize: moderateScale(15),
        fontWeight: "700",
        color: "#111827",
        maxWidth: '70%',
    },
    subtext: {
        fontSize: moderateScale(12),
        color: "#6B7280",
        fontWeight: "500",
    },
    typeBadge: {
        paddingHorizontal: scale(6),
        paddingVertical: verticalScale(2),
        borderRadius: moderateScale(4),
    },
    typeBadgeText: {
        fontSize: moderateScale(8),
        fontWeight: "800",
        textTransform: "uppercase",
    },
    statusBadge: {
        paddingHorizontal: scale(10),
        paddingVertical: verticalScale(4),
        borderRadius: moderateScale(10),
    },
    statusText: {
        fontSize: moderateScale(11),
        fontWeight: "700",
        textTransform: "capitalize",
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
})
