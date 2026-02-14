import { Ionicons } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useFocusEffect, useRouter } from "expo-router"
import React, { useCallback, useState } from "react"
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native"
import { API_ENDPOINTS } from "../../config/api"
import { moderateScale, scale, verticalScale } from "../../utils/responsive"

interface Campaign {
    id: string
    title: string
    description: string
    location: string
    startDate: string
    endDate: string
    posterUrl: string
    status: string
}

export default function CampaignListScreen() {
    const router = useRouter()
    const [campaigns, setCampaigns] = useState<Campaign[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [userRole, setUserRole] = useState("donor")

    useFocusEffect(
        useCallback(() => {
            checkUserRole()
            fetchCampaigns()
        }, [])
    )

    const checkUserRole = async () => {
        const userData = await AsyncStorage.getItem("userData")
        if (userData) {
            const { role } = JSON.parse(userData)
            setUserRole(role?.toLowerCase())
        }
    }

    const fetchCampaigns = async () => {
        try {
            setLoading(true)
            const token = await AsyncStorage.getItem("authToken")
            const userData = await AsyncStorage.getItem("userData")
            let role = "donor"

            if (userData) {
                const parsed = JSON.parse(userData)
                role = parsed.role?.toLowerCase()
                setUserRole(role)
            }

            const endpoint = role === 'organization'
                ? API_ENDPOINTS.GET_MY_CAMPAIGNS
                : API_ENDPOINTS.GET_ALL_CAMPAIGNS

            const response = await fetch(endpoint, {
                headers: {
                    Authorization: `Bearer ${token || ""}`,
                },
            }).catch(err => {
                console.log("Network request failed", err)
                return null
            })

            if (response && response.ok) {
                const data = await response.json()
                setCampaigns(data.campaigns || [])
            } else {
                console.log("Failed to fetch campaigns")
                if (campaigns.length === 0) setCampaigns([])
            }
        } catch (error) {
            console.error("Fetch campaigns error:", error)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    const handleDelete = async (id: string) => {
        Alert.alert(
            "Delete Campaign",
            "Are you sure you want to delete this campaign?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete", style: "destructive", onPress: async () => {
                        try {
                            const token = await AsyncStorage.getItem("authToken")
                            const response = await fetch(API_ENDPOINTS.DELETE_CAMPAIGN(id), {
                                method: "DELETE",
                                headers: { Authorization: `Bearer ${token}` }
                            })

                            if (response.ok) {
                                setCampaigns(prev => prev.filter(c => c.id !== id))
                                Alert.alert("Success", "Campaign deleted")
                            } else {
                                Alert.alert("Error", "Failed to delete campaign")
                            }
                        } catch (error) {
                            Alert.alert("Error", "Something went wrong")
                        }
                    }
                }
            ]
        )
    }

    const onRefresh = () => {
        setRefreshing(true)
        fetchCampaigns()
    }

    const renderItem = ({ item }: { item: Campaign }) => (
        <TouchableOpacity
            style={styles.card}
            activeOpacity={0.9}
            onPress={() => router.push({
                pathname: "/campaign/[id]",
                params: {
                    id: item.id,
                    title: item.title,
                    description: item.description,
                    location: item.location,
                    startDate: item.startDate,
                    endDate: item.endDate,
                    posterUrl: item.posterUrl,
                    organizationName: (item as any).organizationName,
                    organizationPhone: (item as any).organizationPhone,
                    organizationEmail: (item as any).organizationEmail
                }
            })}
        >
            <Image
                source={{ uri: item.posterUrl || "https://placehold.co/600x400/png?text=Campaign" }}
                style={styles.cardImage}
            />
            <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>{item.title}</Text>
                        {(item as any).organizationName && userRole !== 'organization' && (
                            <Text style={styles.orgName}>by {(item as any).organizationName}</Text>
                        )}
                    </View>
                    {userRole === 'organization' && (
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity onPress={(e) => {
                                e.stopPropagation();
                                router.push({
                                    pathname: "/campaign/create",
                                    params: {
                                        id: item.id,
                                        title: item.title,
                                        description: item.description,
                                        location: item.location,
                                        startDate: item.startDate,
                                        endDate: item.endDate,
                                        posterUrl: item.posterUrl
                                    }
                                });
                            }}>
                                <Ionicons name="create-outline" size={20} color="#3B82F6" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={(e) => {
                                e.stopPropagation();
                                handleDelete(item.id);
                            }}>
                                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={16} color="#6B7280" />
                    <Text style={styles.infoText}>{item.location}</Text>
                </View>

                <View style={styles.infoRow}>
                    <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                    <Text style={styles.infoText}>
                        <Text style={styles.infoText}>
                            {new Date(item.startDate).toLocaleDateString()} {new Date(item.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(item.endDate).toLocaleDateString()} {new Date(item.endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </Text>
                </View>

                <Text style={styles.description} numberOfLines={2}>
                    {item.description}
                </Text>
            </View>
        </TouchableOpacity>
    )

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No Campaigns Found</Text>
            <Text style={styles.emptySubtitle}>
                {userRole === 'organization'
                    ? "Create a campaign to reach more donors!"
                    : "Check back later for upcoming donation camps."}
            </Text>
        </View>
    )

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { marginLeft: -4, padding: 4, marginRight: scale(8) }]}>
                        <Ionicons name="chevron-back" size={28} color="#D11B31" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>Campaigns</Text>
                        <Text style={styles.subtitle}>Active blood donation events near you</Text>
                    </View>
                </View>
                {userRole === 'organization' && (
                    <TouchableOpacity onPress={() => router.push("/campaign/create")}>
                        <Ionicons name="add-circle" size={28} color="#D11B31" />
                    </TouchableOpacity>
                )}
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#D11B31" />
                </View>
            ) : (
                <FlatList
                    data={campaigns}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#D11B31"]} />}
                    ListEmptyComponent={renderEmpty}
                />
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F9FAFB",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: scale(16),
        paddingTop: verticalScale(60),
        paddingBottom: verticalScale(16),
        backgroundColor: "#FFF",
        borderBottomWidth: 1,
        borderBottomColor: "#E5E7EB",
    },
    headerTitle: {
        fontSize: moderateScale(22),
        fontWeight: "900",
        color: "#111827",
    },
    subtitle: {
        fontSize: moderateScale(13),
        color: "#6B7280",
        marginTop: 2,
    },
    backButton: {
        padding: scale(4),
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    listContent: {
        padding: scale(16),
    },
    card: {
        backgroundColor: "#FFF",
        borderRadius: moderateScale(16),
        marginBottom: verticalScale(16),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        overflow: "hidden",
    },
    cardImage: {
        width: "100%",
        height: verticalScale(150),
        resizeMode: "cover",
    },
    cardContent: {
        padding: scale(16),
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: verticalScale(8),
    },
    cardTitle: {
        flex: 1,
        fontSize: moderateScale(18),
        fontWeight: "700",
        color: "#111827",
        marginRight: scale(8),
    },
    orgName: {
        fontSize: moderateScale(12),
        color: "#D11B31",
        fontWeight: "600",
        marginTop: verticalScale(2),
    },
    infoRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(6),
        marginBottom: verticalScale(4),
    },
    infoText: {
        fontSize: moderateScale(14),
        color: "#6B7280",
    },
    description: {
        fontSize: moderateScale(14),
        color: "#4B5563",
        marginTop: verticalScale(8),
        lineHeight: verticalScale(20),
    },
    emptyContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingTop: verticalScale(100),
        paddingHorizontal: scale(40),
    },
    emptyTitle: {
        fontSize: moderateScale(18),
        fontWeight: "600",
        color: "#374151",
        marginTop: verticalScale(16),
    },
    emptySubtitle: {
        fontSize: moderateScale(14),
        color: "#9CA3AF",
        textAlign: "center",
        marginTop: verticalScale(8),
    },
})
