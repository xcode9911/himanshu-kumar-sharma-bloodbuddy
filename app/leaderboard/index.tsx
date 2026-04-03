import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { API_ENDPOINTS } from "../../config/api";
import { moderateScale, scale, verticalScale } from "../../utils/responsive";

const LeaderboardScreen = () => {
    const [activeTab, setActiveTab] = useState<"monthly" | "yearly">("monthly");
    const [leaderboard, setLeaderboard] = useState<{ monthly: any[]; yearly: any[] }>({ monthly: [], yearly: [] });
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        fetchLeaderboard();
    }, []);

    const fetchLeaderboard = async () => {
        try {
            const token = await AsyncStorage.getItem("authToken");
            const response = await fetch(API_ENDPOINTS.GET_LEADERBOARD, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (response.ok) {
                const data = await response.json();
                setLeaderboard(data);
            }
        } catch (error) {
            console.log("Error fetching leaderboard:", error);
        } finally {
            setLoading(false);
        }
    };

    const currentList = activeTab === "monthly" ? leaderboard.monthly : leaderboard.yearly;
    const top3 = currentList.slice(0, 3);
    const rest = currentList.slice(3);

    const getMetric = (item: any) =>
        activeTab === "monthly"
            ? new Date(item.monthlyFirstDate).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : `${item.yearlyCount} donations`;

    const renderPodium = () => {
        const first = top3[0];
        const second = top3[1];
        const third = top3[2];

        return (
            <View style={styles.podiumSection}>
                {/* 2nd Place */}
                <View style={[styles.podiumSide]}>
                    {second ? (
                        <>
                            <View style={styles.rankBadgeWrapper2}>
                                <Image source={require("../../assets/images/rank2.png")} style={styles.rankBadgeImage} />
                            </View>
                            <Text style={styles.podiumName2} numberOfLines={1}>{second.name}</Text>
                            <Text style={styles.podiumMetric}>{getMetric(second)}</Text>
                        </>
                    ) : <View />}
                </View>

                {/* 1st Place */}
                <View style={styles.podiumCenter}>
                    {first ? (
                        <>
                            <Ionicons name="trophy" size={moderateScale(28)} color="#D11B31" style={styles.crownIcon} />
                            <View style={styles.rankBadgeWrapper1}>
                                <Image source={require("../../assets/images/rank1.png")} style={styles.rankBadgeImage} />
                            </View>
                            <Text style={styles.podiumName1} numberOfLines={1}>{first.name}</Text>
                            <Text style={styles.podiumMetric}>{getMetric(first)}</Text>
                        </>
                    ) : <View />}
                </View>

                {/* 3rd Place */}
                <View style={styles.podiumSide}>
                    {third ? (
                        <>
                            <View style={styles.rankBadgeWrapper3}>
                                <Image source={require("../../assets/images/rank3.png")} style={styles.rankBadgeImage} />
                            </View>
                            <Text style={styles.podiumName2} numberOfLines={1}>{third.name}</Text>
                            <Text style={styles.podiumMetric}>{getMetric(third)}</Text>
                        </>
                    ) : <View />}
                </View>
            </View>
        );
    };

    const renderRestItem = ({ item, index }: { item: any; index: number }) => {
        const rank = index + 4;
        return (
            <View style={styles.restRow}>
                <View style={styles.restRankBadge}>
                    <Text style={styles.restRankText}>{rank}</Text>
                </View>
                <View style={styles.restAvatar}>
                    <Text style={styles.restAvatarText}>{item.name.charAt(0)}</Text>
                </View>
                <Text style={styles.restName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.restMetric}>{getMetric(item)}</Text>
            </View>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color="#D11B31" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Leaderboard</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#D11B31" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color="#D11B31" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Leaderboard</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Tabs */}
            <View style={styles.tabsRow}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === "monthly" && styles.tabActive]}
                    onPress={() => setActiveTab("monthly")}
                >
                    <Text style={[styles.tabText, activeTab === "monthly" && styles.tabTextActive]}>Monthly</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === "yearly" && styles.tabActive]}
                    onPress={() => setActiveTab("yearly")}
                >
                    <Text style={[styles.tabText, activeTab === "yearly" && styles.tabTextActive]}>Yearly</Text>
                </TouchableOpacity>
            </View>

            {currentList.length > 0 ? (
                <>
                    {renderPodium()}

                    {/* Table Header */}
                    {rest.length > 0 && (
                        <View style={styles.tableHeader}>
                            <Text style={styles.tableHeaderText}>Rank</Text>
                            <Text style={[styles.tableHeaderText, { flex: 1, marginLeft: scale(52) }]}>Player</Text>
                            <Text style={styles.tableHeaderText}>{activeTab === "monthly" ? "Date" : "Donations"}</Text>
                        </View>
                    )}

                    {/* Ranks 4+ */}
                    <FlatList
                        data={rest}
                        renderItem={renderRestItem}
                        keyExtractor={(item) => item.userId}
                        contentContainerStyle={styles.restList}
                        showsVerticalScrollIndicator={false}
                    />
                </>
            ) : (
                <View style={styles.emptyContainer}>
                    <Ionicons name="trophy-outline" size={moderateScale(64)} color="#D1D5DB" />
                    <Text style={styles.emptyText}>No rankings yet this {activeTab === "monthly" ? "month" : "year"}.</Text>
                </View>
            )}
        </SafeAreaView>
    );
};

export default LeaderboardScreen;

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
        paddingVertical: verticalScale(10),
        backgroundColor: "#FFF",
        borderBottomWidth: 1,
        borderBottomColor: "#F3F4F6",
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: "center",
    },
    headerTitle: {
        fontSize: moderateScale(20),
        fontWeight: "800",
        color: "#1F2937",
    },
    tabsRow: {
        flexDirection: "row",
        marginHorizontal: scale(16),
        marginVertical: verticalScale(12),
        backgroundColor: "#F3F4F6",
        borderRadius: moderateScale(16),
        padding: scale(4),
    },
    tab: {
        flex: 1,
        paddingVertical: verticalScale(10),
        borderRadius: moderateScale(12),
        alignItems: "center",
    },
    tabActive: {
        backgroundColor: "#D11B31",
        shadowColor: "#D11B31",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    tabText: {
        fontSize: moderateScale(14),
        fontWeight: "600",
        color: "#6B7280",
    },
    tabTextActive: {
        color: "#FFFFFF",
    },
    podiumSection: {
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "center",
        paddingHorizontal: scale(16),
        paddingBottom: verticalScale(16),
        marginTop: verticalScale(8),
        minHeight: verticalScale(190),
        backgroundColor: "#FFF",
        marginHorizontal: scale(16),
        borderRadius: moderateScale(22),
        borderWidth: 1,
        borderColor: "#FEE2E2",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    podiumSide: {
        flex: 1,
        alignItems: "center",
        paddingBottom: verticalScale(8),
    },
    podiumCenter: {
        flex: 1,
        alignItems: "center",
        marginBottom: verticalScale(20),
    },
    crownIcon: {
        marginBottom: verticalScale(4),
    },
    rankBadgeWrapper1: {
        width: moderateScale(96),
        height: moderateScale(96),
        borderRadius: moderateScale(48),
        overflow: "hidden",
        borderWidth: 3,
        borderColor: "#D11B31",
        marginBottom: verticalScale(8),
    },
    rankBadgeWrapper2: {
        width: moderateScale(72),
        height: moderateScale(72),
        borderRadius: moderateScale(36),
        overflow: "hidden",
        borderWidth: 2,
        borderColor: "#9CA3AF",
        marginBottom: verticalScale(8),
    },
    rankBadgeWrapper3: {
        width: moderateScale(72),
        height: moderateScale(72),
        borderRadius: moderateScale(36),
        overflow: "hidden",
        borderWidth: 2,
        borderColor: "#F59E0B",
        marginBottom: verticalScale(8),
    },
    rankBadgeImage: {
        width: "100%",
        height: "100%",
        resizeMode: "cover",
    },
    podiumName1: {
        fontSize: moderateScale(14),
        fontWeight: "800",
        color: "#111827",
        textAlign: "center",
        maxWidth: scale(100),
    },
    podiumName2: {
        fontSize: moderateScale(12),
        fontWeight: "700",
        color: "#374151",
        textAlign: "center",
        maxWidth: scale(80),
    },
    podiumMetric: {
        fontSize: moderateScale(11),
        color: "#9CA3AF",
        marginTop: verticalScale(2),
        textAlign: "center",
    },
    tableHeader: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: scale(20),
        paddingVertical: verticalScale(10),
        marginTop: verticalScale(12),
    },
    tableHeaderText: {
        fontSize: moderateScale(13),
        fontWeight: "700",
        color: "#9CA3AF",
    },
    restList: {
        paddingHorizontal: scale(16),
        paddingBottom: verticalScale(30),
    },
    restRow: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFF",
        borderRadius: moderateScale(14),
        paddingVertical: verticalScale(12),
        paddingHorizontal: scale(14),
        marginBottom: verticalScale(10),
        borderWidth: 1,
        borderColor: "#F3F4F6",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    restRankBadge: {
        width: moderateScale(30),
        height: moderateScale(30),
        borderRadius: moderateScale(15),
        backgroundColor: "#FEF2F2",
        justifyContent: "center",
        alignItems: "center",
        marginRight: scale(10),
        borderWidth: 1,
        borderColor: "#FEE2E2",
    },
    restRankText: {
        fontSize: moderateScale(13),
        fontWeight: "800",
        color: "#D11B31",
    },
    restAvatar: {
        width: moderateScale(36),
        height: moderateScale(36),
        borderRadius: moderateScale(18),
        backgroundColor: "#FEE2E2",
        justifyContent: "center",
        alignItems: "center",
        marginRight: scale(12),
    },
    restAvatarText: {
        fontSize: moderateScale(16),
        fontWeight: "800",
        color: "#D11B31",
    },
    restName: {
        flex: 1,
        fontSize: moderateScale(14),
        fontWeight: "700",
        color: "#111827",
    },
    restMetric: {
        fontSize: moderateScale(12),
        color: "#6B7280",
        fontWeight: "600",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    emptyContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: verticalScale(16),
    },
    emptyText: {
        fontSize: moderateScale(15),
        color: "#9CA3AF",
        textAlign: "center",
    },
});
