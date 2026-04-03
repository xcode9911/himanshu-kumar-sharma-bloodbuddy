import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    Dimensions,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { API_BASE_URL } from "../config/api";
import { moderateScale, scale, verticalScale } from "../utils/responsive";

const { width } = Dimensions.get("window");

interface ProfileModalProps {
    visible: boolean;
    onClose: () => void;
    userData: any;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ visible, onClose, userData }) => {
    if (!userData) return null;

    const getInitials = (name: string) => {
        if (!name) return "?";
        return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    };

    const renderDetailRow = (icon: any, label: string, value: string) => {
        if (!value) return null;
        return (
            <View style={styles.detailRow}>
                <View style={styles.iconContainer}>
                    <Ionicons name={icon} size={20} color="#D11B31" />
                </View>
                <View style={styles.detailTextContainer}>
                    <Text style={styles.detailLabel}>{label}</Text>
                    <Text style={styles.detailValue}>{value}</Text>
                </View>
            </View>
        );
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>User Profile</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                        <View style={styles.profileHeader}>
                            <View style={[styles.avatar, (userData.ProfileImage || userData.profileImage) && { borderWidth: 0 }]}>
                                {userData.ProfileImage || userData.profileImage ? (
                                    <Image 
                                        source={{ uri: `${API_BASE_URL}/${(userData.ProfileImage || userData.profileImage).path}` }}
                                        style={styles.avatarImage}
                                    />
                                ) : (
                                    <Text style={styles.avatarText}>
                                        {getInitials(userData.organization?.organizationName || userData.fullName)}
                                    </Text>
                                )}
                            </View>
                            <Text style={styles.userName}>{userData.fullName}</Text>
                            <View style={styles.roleBadge}>
                                <Text style={styles.roleText}>{userData.role?.toUpperCase()}</Text>
                            </View>
                        </View>

                        <View style={styles.detailsSection}>
                            {renderDetailRow("mail-outline", "Email", userData.email)}
                            {renderDetailRow("call-outline", "Phone", userData.phone)}

                            {userData.role === 'donor' && userData.donor && (
                                <>
                                    {renderDetailRow("water-outline", "Blood Type", userData.donor.bloodType)}
                                    {renderDetailRow("location-outline", "Location", userData.donor.location)}
                                    {renderDetailRow("calendar-outline", "Last Donation", userData.donor.lastDonationDate ? new Date(userData.donor.lastDonationDate).toLocaleDateString() : 'Never')}
                                </>
                            )}

                            {userData.role === 'organization' && userData.organization && (
                                <>
                                    {renderDetailRow("business-outline", "Organization", userData.organization.organizationName)}
                                    {renderDetailRow("location-outline", "Location", userData.organization.location)}
                                    {renderDetailRow("call-outline", "Contact", userData.organization.contact)}
                                </>
                            )}

                            {userData.role === 'gainer' && userData.gainer && (
                                <>
                                    {renderDetailRow("home-outline", "Address", userData.gainer.address)}
                                </>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "flex-end",
    },
    modalContent: {
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: moderateScale(24),
        borderTopRightRadius: moderateScale(24),
        height: "70%",
        paddingBottom: verticalScale(20),
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: scale(20),
        paddingVertical: verticalScale(16),
        borderBottomWidth: 1,
        borderBottomColor: "#F3F4F6",
    },
    headerTitle: {
        fontSize: moderateScale(18),
        fontWeight: "700",
        color: "#1F2937",
    },
    closeButton: {
        padding: scale(4),
    },
    scrollContent: {
        padding: scale(20),
    },
    profileHeader: {
        alignItems: "center",
        marginBottom: verticalScale(24),
    },
    avatar: {
        width: moderateScale(80),
        height: moderateScale(80),
        borderRadius: moderateScale(40),
        backgroundColor: "#FEE2E2",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 2,
        borderColor: "#D11B31",
        marginBottom: verticalScale(12),
    },
    avatarText: {
        fontSize: moderateScale(28),
        fontWeight: "700",
        color: "#D11B31",
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: moderateScale(40),
    },
    userName: {
        fontSize: moderateScale(22),
        fontWeight: "700",
        color: "#111827",
        marginBottom: verticalScale(6),
    },
    roleBadge: {
        backgroundColor: "#F3F4F6",
        paddingHorizontal: scale(12),
        paddingVertical: verticalScale(4),
        borderRadius: moderateScale(12),
    },
    roleText: {
        fontSize: moderateScale(11),
        fontWeight: "600",
        color: "#6B7280",
        letterSpacing: 0.5,
    },
    detailsSection: {
        backgroundColor: "#F9FAFB",
        borderRadius: moderateScale(16),
        padding: scale(16),
    },
    detailRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: verticalScale(16),
    },
    iconContainer: {
        width: moderateScale(40),
        height: moderateScale(40),
        borderRadius: moderateScale(20),
        backgroundColor: "#FFFFFF",
        justifyContent: "center",
        alignItems: "center",
        marginRight: scale(12),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    detailTextContainer: {
        flex: 1,
    },
    detailLabel: {
        fontSize: moderateScale(12),
        color: "#6B7280",
        marginBottom: verticalScale(2),
    },
    detailValue: {
        fontSize: moderateScale(15),
        fontWeight: "600",
        color: "#1F2937",
    },
});

export default ProfileModal;
