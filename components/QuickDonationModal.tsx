import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { API_ENDPOINTS } from "../config/api";
import { moderateScale, scale, verticalScale } from "../utils/responsive";

interface Organization {
    id: string;
    name: string;
    address: string;
    bloodTypes: string[];
}

interface QuickDonationModalProps {
    visible: boolean;
    onClose: () => void;
    donorBloodType: string;
}

export default function QuickDonationModal({ visible, onClose, donorBloodType }: QuickDonationModalProps) {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [filteredOrganizations, setFilteredOrganizations] = useState<Organization[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
    const [units, setUnits] = useState("1");

    useEffect(() => {
        if (visible) {
            loadOrganizations();
        }
    }, [visible]);

    useEffect(() => {
        if (searchQuery.trim() === "") {
            setFilteredOrganizations(organizations);
        } else {
            const query = searchQuery.toLowerCase();
            const filtered = organizations.filter(
                (org) =>
                    org.name.toLowerCase().includes(query) ||
                    org.address.toLowerCase().includes(query)
            );
            setFilteredOrganizations(filtered);
        }
    }, [searchQuery, organizations]);

    const loadOrganizations = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem("authToken");
            const response = await fetch(API_ENDPOINTS.GET_ORGANIZATIONS, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            const data = await response.json();
            if (response.ok) {
                const list = data.organizations || data.data || (Array.isArray(data) ? data : []);
                const normalized = list.map((org: any) => ({
                    id: String(org.organizationId || org.id),
                    name: org.organizationName || org.name,
                    address: org.location || org.address,
                    bloodTypes: (org.inventory || []).map((i: any) => i.bloodType),
                }));
                setOrganizations(normalized);
                setFilteredOrganizations(normalized);
            }
        } catch (error) {
            console.error("Error loading organizations:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectOrg = (org: Organization) => {
        setSelectedOrg(org);
    };

    const handleDonate = async () => {
        if (!selectedOrg) return;
        if (!units || parseInt(units) <= 0) {
            Alert.alert("Error", "Please enter a valid number of units");
            return;
        }

        try {
            setSubmitting(true);
            const token = await AsyncStorage.getItem("authToken");

            const payload = {
                organizationId: Number(selectedOrg.id),
                bloodType: donorBloodType,
                units: Number(units),
            };

            const response = await fetch(API_ENDPOINTS.CREATE_DONATION, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (response.ok) {
                Alert.alert("Success", "Donation offer submitted successfully!");
                onClose();
                setSelectedOrg(null);
                setUnits("1");
                setSearchQuery("");
            } else {
                Alert.alert("Error", data.message || "Failed to submit donation offer");
            }
        } catch (error) {
            console.error("Donation error:", error);
            Alert.alert("Error", "Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const renderOrgItem = ({ item }: { item: Organization }) => (
        <TouchableOpacity
            style={[styles.orgItem, selectedOrg?.id === item.id && styles.selectedOrgItem]}
            onPress={() => handleSelectOrg(item)}
        >
            <View style={styles.orgInfo}>
                <Text style={styles.orgName}>{item.name}</Text>
                <Text style={styles.orgAddress} numberOfLines={1}>{item.address}</Text>
            </View>
            {selectedOrg?.id === item.id && (
                <Ionicons name="checkmark-circle" size={24} color="#059669" />
            )}
        </TouchableOpacity>
    );

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, selectedOrg && { height: '50%' }]}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Quick Donation</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={28} color="#1F2937" />
                        </TouchableOpacity>
                    </View>

                    {!selectedOrg ? (
                        <>
                            <View style={styles.searchBar}>
                                <Ionicons name="search" size={20} color="#9CA3AF" />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search blood bank..."
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                            </View>

                            {loading ? (
                                <ActivityIndicator size="large" color="#D11B31" style={{ marginTop: 20 }} />
                            ) : (
                                <FlatList
                                    data={filteredOrganizations}
                                    renderItem={renderOrgItem}
                                    keyExtractor={(item) => item.id}
                                    style={styles.orgList}
                                    ListEmptyComponent={
                                        <Text style={styles.emptyText}>No organizations found</Text>
                                    }
                                />
                            )}
                        </>
                    ) : (
                        <View style={styles.donationForm}>
                            <TouchableOpacity
                                style={styles.backToSearch}
                                onPress={() => setSelectedOrg(null)}
                            >
                                <Ionicons name="arrow-back" size={20} color="#D11B31" />
                                <Text style={styles.backToSearchText}>Change Organization</Text>
                            </TouchableOpacity>

                            <View style={styles.selectedOrgCard}>
                                <Text style={styles.selectedOrgName}>{selectedOrg.name}</Text>
                                <Text style={styles.selectedOrgAddress}>{selectedOrg.address}</Text>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>My Blood Type: <Text style={{ color: '#D11B31', fontWeight: 'bold' }}>{donorBloodType}</Text></Text>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Number of Units</Text>
                                <TextInput
                                    style={styles.input}
                                    value={units}
                                    onChangeText={setUnits}
                                    keyboardType="numeric"
                                    placeholder="Enter units"
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.donateButton, submitting && styles.disabledButton]}
                                onPress={handleDonate}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.donateButtonText}>Confirm Donation</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "flex-end",
    },
    modalContent: {
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: moderateScale(30),
        borderTopRightRadius: moderateScale(30),
        padding: scale(24),
        height: '80%',
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: verticalScale(20),
    },
    modalTitle: {
        fontSize: moderateScale(22),
        fontWeight: "800",
        color: "#111827",
    },
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F3F4F6",
        borderRadius: moderateScale(12),
        paddingHorizontal: scale(12),
        paddingVertical: verticalScale(10),
        marginBottom: verticalScale(16),
    },
    searchInput: {
        flex: 1,
        marginLeft: scale(8),
        fontSize: moderateScale(16),
    },
    orgList: {
        flex: 1,
    },
    orgItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: verticalScale(14),
        borderBottomWidth: 1,
        borderBottomColor: "#F3F4F6",
    },
    selectedOrgItem: {
        backgroundColor: "#F0FDF4",
        borderRadius: moderateScale(12),
        paddingHorizontal: scale(8),
    },
    orgInfo: {
        flex: 1,
    },
    orgName: {
        fontSize: moderateScale(16),
        fontWeight: "600",
        color: "#111827",
    },
    orgAddress: {
        fontSize: moderateScale(14),
        color: "#6B7280",
        marginTop: 2,
    },
    emptyText: {
        textAlign: "center",
        color: "#9CA3AF",
        marginTop: verticalScale(20),
    },
    donationForm: {
        gap: verticalScale(20),
    },
    backToSearch: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    backToSearchText: {
        color: "#D11B31",
        fontWeight: "600",
    },
    selectedOrgCard: {
        backgroundColor: "#F9FAFB",
        padding: scale(16),
        borderRadius: moderateScale(16),
        borderWidth: 1,
        borderColor: "#E5E7EB",
    },
    selectedOrgName: {
        fontSize: moderateScale(18),
        fontWeight: "700",
        color: "#111827",
    },
    selectedOrgAddress: {
        fontSize: moderateScale(14),
        color: "#6B7280",
        marginTop: 4,
    },
    inputGroup: {
        gap: verticalScale(8),
    },
    label: {
        fontSize: moderateScale(15),
        fontWeight: "600",
        color: "#374151",
    },
    input: {
        backgroundColor: "#F3F4F6",
        borderRadius: moderateScale(12),
        padding: scale(16),
        fontSize: moderateScale(16),
    },
    donateButton: {
        backgroundColor: "#059669",
        paddingVertical: verticalScale(16),
        borderRadius: moderateScale(16),
        alignItems: "center",
        marginTop: verticalScale(10),
    },
    disabledButton: {
        opacity: 0.6,
    },
    donateButtonText: {
        color: "#FFFFFF",
        fontSize: moderateScale(16),
        fontWeight: "700",
    },
});
