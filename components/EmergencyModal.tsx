import { Ionicons } from "@expo/vector-icons"
import React from "react"
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { moderateScale, scale, verticalScale } from "../utils/responsive"

type Props = {
    visible: boolean
    onClose: () => void
    onConfirm: () => void
    loading: boolean
    bloodType: string
    setBloodType: (v: string) => void
}

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]

export default function EmergencyModal({
    visible,
    onClose,
    onConfirm,
    loading,
    bloodType,
    setBloodType,
}: Props) {
    return (
        <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.emergencyModalContent}>
                    <View style={styles.modalHandle} />
                    <View style={styles.emergencyHeader}>
                        <View style={styles.emergencyIconContainer}>
                            <Ionicons name="warning" size={moderateScale(32)} color="#D11B31" />
                        </View>
                        <Text style={styles.emergencyTitle}>Emergency Request</Text>
                        <Text style={styles.emergencySubtitle}>
                            Broadcast an urgent blood request to all matching donors in your area.
                        </Text>
                    </View>
                    <View style={styles.pickerSection}>
                        <Text style={styles.pickerLabel}>Required Blood Type</Text>
                        <View style={styles.chipsRow}>
                            {BLOOD_TYPES.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[styles.chip, bloodType === type && styles.chipSelected]}
                                    onPress={() => setBloodType(type)}
                                >
                                    <Text style={[styles.chipText, bloodType === type && styles.chipTextSelected]}>
                                        {type}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                    <View style={styles.emergencyActions}>
                        <TouchableOpacity style={styles.cancelEmergencyBtn} onPress={onClose}>
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.confirmEmergencyBtn, loading && styles.disabledBtn]}
                            onPress={onConfirm}
                            disabled={loading}
                        >
                            <Ionicons name="megaphone" size={18} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.confirmBtnText}>{loading ? "Broadcasting..." : "Request Help"}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    )
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.18)",
        justifyContent: "flex-end",
    },
    emergencyModalContent: {
        backgroundColor: "#fff",
        borderTopLeftRadius: moderateScale(26),
        borderTopRightRadius: moderateScale(26),
        paddingHorizontal: scale(16),
        paddingTop: verticalScale(10),
        paddingBottom: verticalScale(22),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: moderateScale(6) },
        shadowOpacity: 0.18,
        shadowRadius: moderateScale(16),
        elevation: 12,
    },
    modalHandle: {
        alignSelf: "center",
        width: scale(44),
        height: verticalScale(5),
        borderRadius: moderateScale(99),
        backgroundColor: "#E5E7EB",
        marginBottom: verticalScale(16),
    },
    emergencyHeader: {
        alignItems: "center",
        marginBottom: verticalScale(24),
    },
    emergencyIconContainer: {
        width: moderateScale(64),
        height: moderateScale(64),
        borderRadius: moderateScale(32),
        backgroundColor: "#FEF2F2",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: verticalScale(16),
    },
    emergencyTitle: {
        fontSize: moderateScale(20),
        fontWeight: "800",
        color: "#D11B31",
        textAlign: "center",
        marginBottom: verticalScale(4),
    },
    emergencySubtitle: {
        fontSize: moderateScale(14),
        color: "#6B7280",
        textAlign: "center",
        lineHeight: verticalScale(20),
    },
    pickerSection: {
        marginBottom: verticalScale(30),
    },
    pickerLabel: {
        fontSize: moderateScale(14),
        fontWeight: "700",
        color: "#374151",
        marginBottom: verticalScale(16),
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    chipsRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: scale(8),
        marginBottom: verticalScale(10),
    },
    chip: {
        backgroundColor: "#FEE2E2",
        borderRadius: moderateScale(20),
        paddingVertical: verticalScale(8),
        paddingHorizontal: scale(14),
    },
    chipSelected: {
        backgroundColor: "#D11B31",
    },
    chipText: {
        fontSize: moderateScale(13),
        fontWeight: "700",
        color: "#666666",
    },
    chipTextSelected: {
        color: "#FFFFFF",
    },
    emergencyActions: {
        flexDirection: "row",
        gap: scale(12),
    },
    cancelEmergencyBtn: {
        flex: 1,
        height: verticalScale(50),
        justifyContent: "center",
        alignItems: "center",
        borderRadius: moderateScale(20),
        backgroundColor: "#FEE2E2",
    },
    confirmEmergencyBtn: {
        flex: 2,
        flexDirection: "row",
        height: verticalScale(50),
        justifyContent: "center",
        alignItems: "center",
        borderRadius: moderateScale(20),
        backgroundColor: "#D11B31",
    },
    cancelBtnText: {
        fontSize: moderateScale(15),
        fontWeight: "700",
        color: "#666666",
    },
    confirmBtnText: {
        fontSize: moderateScale(15),
        fontWeight: "700",
        color: "#fff",
    },
    disabledBtn: {
        opacity: 0.6,
    },
})
