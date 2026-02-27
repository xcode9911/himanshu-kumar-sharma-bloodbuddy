import { Ionicons } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useLocalSearchParams, useRouter } from "expo-router"
import React, { useEffect, useState } from "react"
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native"
import { API_ENDPOINTS } from "../../../config/api"
import { moderateScale, scale, verticalScale } from "../../../utils/responsive"

interface Attendee {
    id: number
    fullName: string
    email: string
    phone: string
    bloodType: string
    units: number
    attendedAt: string
}

export default function CampaignAttendeesScreen() {
    const router = useRouter()
    const { id, title } = useLocalSearchParams()
    const [attendees, setAttendees] = useState<Attendee[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    useEffect(() => {
        fetchAttendees()
    }, [])

    const fetchAttendees = async () => {
        try {
            setLoading(true)
            const token = await AsyncStorage.getItem("authToken")
            const response = await fetch(API_ENDPOINTS.GET_ATTENDEES(id as string), {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })

            if (response.ok) {
                const data = await response.json()
                setAttendees(data.attendees || [])
            }
        } catch (error) {
            console.error("Fetch attendees error:", error)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    const onRefresh = () => {
        setRefreshing(true)
        fetchAttendees()
    }

    const renderItem = ({ item }: { item: Attendee }) => (
        <View style={styles.attendeeCard}>
            <View style={styles.attendeeHeader}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.fullName.charAt(0)}</Text>
                </View>
                <View style={styles.attendeeMainInfo}>
                    <Text style={styles.attendeeName}>{item.fullName}</Text>
                    <Text style={styles.attendeeContact}>{item.phone || item.email}</Text>
                </View>
                <View style={styles.bloodBadge}>
                    <Text style={styles.bloodTypeText}>{item.bloodType}</Text>
                    <Text style={styles.unitsText}>{item.units} Unit</Text>
                </View>
            </View>
            <View style={styles.attendeeFooter}>
                <Ionicons name="time-outline" size={14} color="#9CA3AF" />
                <Text style={styles.attendedAt}>
                    {new Date(item.attendedAt).toLocaleString()}
                </Text>
            </View>
        </View>
    )

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No Attendees Yet</Text>
            <Text style={styles.emptySubtitle}>People who scan your camp QR will appear here.</Text>
        </View>
    )

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color="#D11B31" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>Camp Attendees</Text>
                    <Text style={styles.headerSubtitle} numberOfLines={1}>{title}</Text>
                </View>
            </View>

            {loading && !refreshing ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#D11B31" />
                </View>
            ) : (
                <FlatList
                    data={attendees}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
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
        paddingHorizontal: scale(16),
        paddingTop: verticalScale(60),
        paddingBottom: verticalScale(16),
        backgroundColor: "#FFF",
        borderBottomWidth: 1,
        borderBottomColor: "#E5E7EB",
    },
    backButton: {
        marginRight: scale(16),
    },
    headerTitle: {
        fontSize: moderateScale(20),
        fontWeight: "900",
        color: "#111827",
    },
    headerSubtitle: {
        fontSize: moderateScale(13),
        color: "#6B7280",
        width: scale(250),
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    listContent: {
        padding: scale(16),
    },
    attendeeCard: {
        backgroundColor: "#FFF",
        borderRadius: moderateScale(16),
        padding: scale(16),
        marginBottom: verticalScale(12),
        borderWidth: 1,
        borderColor: "#E5E7EB",
    },
    attendeeHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: verticalScale(12),
    },
    avatar: {
        width: moderateScale(40),
        height: moderateScale(40),
        borderRadius: moderateScale(20),
        backgroundColor: "#FEE2E2",
        justifyContent: "center",
        alignItems: "center",
        marginRight: scale(12),
    },
    avatarText: {
        fontSize: moderateScale(18),
        fontWeight: "700",
        color: "#D11B31",
    },
    attendeeMainInfo: {
        flex: 1,
    },
    attendeeName: {
        fontSize: moderateScale(16),
        fontWeight: "700",
        color: "#111827",
    },
    attendeeContact: {
        fontSize: moderateScale(12),
        color: "#6B7280",
    },
    bloodBadge: {
        alignItems: "center",
        backgroundColor: "#F3F4F6",
        paddingHorizontal: scale(10),
        paddingVertical: verticalScale(4),
        borderRadius: moderateScale(8),
    },
    bloodTypeText: {
        fontSize: moderateScale(14),
        fontWeight: "800",
        color: "#D11B31",
    },
    unitsText: {
        fontSize: moderateScale(10),
        color: "#6B7280",
        fontWeight: "600",
    },
    attendeeFooter: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(4),
        borderTopWidth: 1,
        borderTopColor: "#F3F4F6",
        paddingTop: verticalScale(8),
    },
    attendedAt: {
        fontSize: moderateScale(12),
        color: "#9CA3AF",
    },
    emptyContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingTop: verticalScale(100),
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
