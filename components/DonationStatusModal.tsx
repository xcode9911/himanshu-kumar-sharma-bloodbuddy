import { Ionicons } from "@expo/vector-icons"
import React from "react"
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { moderateScale, scale, verticalScale } from "../utils/responsive"

type Props = {
    visible: boolean
    onClose: () => void
    status: 'available' | 'unavailable' | 'cooling'
    lastDonation?: string
    nextEligible?: string
    message?: string
}

export default function DonationStatusModal({
    visible,
    onClose,
    status,
    lastDonation,
    nextEligible,
    message,
}: Props) {
    const isAvailable = status === 'available'
    const isCooling = status === 'cooling'

    return (
        <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    {/* Header Icon */}
                    <View style={[styles.iconCircle, { backgroundColor: isAvailable ? "#27AE60" : isCooling ? "#F59E0B" : "#D1D5DB" }]}>
                        <Ionicons
                            name={isAvailable ? "checkmark-circle" : isCooling ? "calendar" : "pause-circle"}
                            size={48}
                            color="#FFF"
                        />
                    </View>

                    {/* Title */}
                    <Text style={styles.title}>
                        {isAvailable ? "Ready to Save Lives!" : isCooling ? "Regeneration Period" : "Currently Unavailable"}
                    </Text>

                    {/* Message */}
                    <Text style={styles.message}>
                        {message || (isAvailable
                            ? "Your status is set to active. Organizations can now find you for emergency blood needs."
                            : isCooling
                                ? "You've recently donated! Your body needs time to replenish its blood cells."
                                : "You are currently hidden from blood request searches.")
                        }
                    </Text>

                    {/* Info Card */}
                    {(lastDonation || nextEligible) && (
                        <View style={styles.infoCard}>
                            {lastDonation && (
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Last Donation</Text>
                                    <Text style={styles.infoValue}>{new Date(lastDonation).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                                </View>
                            )}
                            {isCooling && nextEligible && (
                                <View style={[styles.infoRow, styles.nextDateRow]}>
                                    <Text style={styles.infoLabel}>Next Eligible Date</Text>
                                    <Text style={[styles.infoValue, styles.nextDateValue]}>
                                        {new Date(nextEligible).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Close Button */}
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={styles.closeButtonText}>Understood</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    )
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: scale(20),
    },
    modalContent: {
        width: "100%",
        backgroundColor: "#FFF",
        borderRadius: moderateScale(28),
        padding: scale(24),
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
    },
    iconCircle: {
        width: scale(90),
        height: scale(90),
        borderRadius: moderateScale(45),
        justifyContent: "center",
        alignItems: "center",
        marginBottom: verticalScale(20),
        marginTop: verticalScale(-65), // Pop out effect
        borderWidth: 6,
        borderColor: "#FFF",
    },
    title: {
        fontSize: moderateScale(22),
        fontWeight: "800",
        color: "#111827",
        textAlign: "center",
        marginBottom: verticalScale(12),
    },
    message: {
        fontSize: moderateScale(15),
        color: "#4B5563",
        textAlign: "center",
        lineHeight: verticalScale(22),
        marginBottom: verticalScale(24),
        paddingHorizontal: scale(10),
    },
    infoCard: {
        width: "100%",
        backgroundColor: "#F9FAFB",
        borderRadius: moderateScale(20),
        padding: scale(16),
        marginBottom: verticalScale(24),
        borderWidth: 1,
        borderColor: "#F3F4F6",
    },
    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: verticalScale(8),
    },
    infoLabel: {
        fontSize: moderateScale(14),
        color: "#6B7280",
        fontWeight: "500",
    },
    infoValue: {
        fontSize: moderateScale(15),
        color: "#111827",
        fontWeight: "700",
    },
    nextDateRow: {
        borderTopWidth: 1,
        borderTopColor: "#E5E7EB",
        marginTop: verticalScale(8),
        paddingTop: verticalScale(12),
    },
    nextDateValue: {
        color: "#F59E0B",
    },
    closeButton: {
        width: "100%",
        height: verticalScale(56),
        backgroundColor: "#D11B31",
        borderRadius: moderateScale(16),
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#D11B31",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    closeButtonText: {
        fontSize: moderateScale(16),
        fontWeight: "700",
        color: "#FFF",
    },
})
