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
                    <View style={styles.emergencyHeader}>
                        <View style={styles.emergencyIconContainer}>
                            <Ionicons name="warning" size={32} color="#D11B31" />
                        </View>
                        <Text style={styles.emergencyTitle}>Emergency Request</Text>
                        <Text style={styles.emergencySubtitle}>
                            Broadcast an urgent blood request to all matching donors in your area.
                        </Text>
                    </View>
                    <View style={styles.pickerSection}>
                        <Text style={styles.pickerLabel}>Required Blood Type</Text>
                        <View style={styles.bloodTypeGrid}>
                            {BLOOD_TYPES.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[styles.bloodTypeBox, bloodType === type && styles.selectedBloodTypeBox]}
                                    onPress={() => setBloodType(type)}
                                >
                                    <Text style={[styles.bloodTypeText, bloodType === type && styles.selectedBloodTypeText]}>
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
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    emergencyModalContent: {
        backgroundColor: "#fff",
        borderTopLeftRadius: moderateScale(32),
        borderTopRightRadius: moderateScale(32),
        padding: scale(24),
        paddingBottom: verticalScale(40),
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
        fontSize: moderateScale(22),
        fontWeight: "800",
        color: "#111827",
        marginBottom: verticalScale(8),
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
    bloodTypeGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: scale(10),
        justifyContent: "space-between",
    },
    bloodTypeBox: {
        width: "23%",
        height: verticalScale(45),
        borderRadius: moderateScale(12),
        borderWidth: 1,
        borderColor: "#E5E7EB",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: verticalScale(8),
    },
    selectedBloodTypeBox: {
        borderColor: "#D11B31",
        backgroundColor: "#FEF2F2",
    },
    bloodTypeText: {
        fontSize: moderateScale(14),
        fontWeight: "600",
        color: "#4B5563",
    },
    selectedBloodTypeText: {
        color: "#D11B31",
        fontWeight: "700",
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
        borderRadius: moderateScale(14),
        backgroundColor: "#F3F4F6",
    },
    confirmEmergencyBtn: {
        flex: 2,
        flexDirection: "row",
        height: verticalScale(50),
        justifyContent: "center",
        alignItems: "center",
        borderRadius: moderateScale(14),
        backgroundColor: "#D11B31",
    },
    cancelBtnText: {
        fontSize: moderateScale(15),
        fontWeight: "600",
        color: "#4B5563",
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
