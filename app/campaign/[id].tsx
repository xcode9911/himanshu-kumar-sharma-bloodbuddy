import { Ionicons } from "@expo/vector-icons"
import { useLocalSearchParams, useRouter } from "expo-router"
import React from "react"
import {
    Image,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native"
import { moderateScale, scale, verticalScale } from "../../utils/responsive"

export default function CampaignDetailsScreen() {
    const router = useRouter()
    const params = useLocalSearchParams()

    const {
        title,
        description,
        location,
        startDate,
        endDate,
        posterUrl,
        organizationName,
        organizationPhone,
        organizationEmail
    } = params

    const handleCall = () => {
        if (organizationPhone) {
            Linking.openURL(`tel:${organizationPhone}`)
        }
    }

    const handleEmail = () => {
        if (organizationEmail) {
            Linking.openURL(`mailto:${organizationEmail}`)
        }
    }

    const handleDirections = () => {
        // Open maps with location
        const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
        const latLng = `${location}`;
        const label = 'Campaign Location';
        const url = Platform.select({
            ios: `${scheme}${label}@${latLng}`,
            android: `${scheme}${latLng}(${label})`
        });
        if (url) {
            Linking.openURL(url);
        } else {
            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${location}`);
        }
    }

    return (
        <View style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                <View style={styles.imageContainer}>
                    <Image
                        source={{ uri: (posterUrl as string) || "https://placehold.co/600x400/png?text=Campaign" }}
                        style={styles.image}
                    />
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    <Text style={styles.title}>{title}</Text>

                    {organizationName && (
                        <View style={styles.orgContainer}>
                            <View style={styles.orgIcon}>
                                <Ionicons name="business" size={20} color="#D11B31" />
                            </View>
                            <View>
                                <Text style={styles.orgLabel}>Organized by</Text>
                                <Text style={styles.orgName}>{organizationName}</Text>
                            </View>
                        </View>
                    )}

                    <View style={styles.divider} />

                    <View style={styles.infoSection}>
                        <View style={styles.infoRow}>
                            <View style={styles.infoIcon}>
                                <Ionicons name="calendar" size={20} color="#3B82F6" />
                            </View>
                            <View style={styles.infoTextContainer}>
                                <Text style={styles.infoLabel}>Date & Time</Text>
                                <Text style={styles.infoValue}>
                                    {new Date(startDate as string).toLocaleDateString()} {new Date(startDate as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                                <Text style={styles.infoSubValue}>
                                    to {new Date(endDate as string).toLocaleDateString()} {new Date(endDate as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.infoRow}>
                            <View style={styles.infoIcon}>
                                <Ionicons name="location" size={20} color="#EF4444" />
                            </View>
                            <View style={styles.infoTextContainer}>
                                <Text style={styles.infoLabel}>Location</Text>
                                <Text style={styles.infoValue}>{location}</Text>
                            </View>
                        </View>
                    </View>

                    <Text style={styles.sectionTitle}>About this Campaign</Text>
                    <Text style={styles.description}>{description}</Text>

                    <View style={styles.actionsContainer}>
                        {organizationPhone && (
                            <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
                                <Ionicons name="call" size={24} color="#FFF" />
                                <Text style={styles.actionButtonText}>Call</Text>
                            </TouchableOpacity>
                        )}
                        {organizationEmail && (
                            <TouchableOpacity style={[styles.actionButton, styles.emailButton]} onPress={handleEmail}>
                                <Ionicons name="mail" size={24} color="#FFF" />
                                <Text style={styles.actionButtonText}>Email</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={[styles.actionButton, styles.directionButton]} onPress={handleDirections}>
                            <Ionicons name="map" size={24} color="#FFF" />
                            <Text style={styles.actionButtonText}>Directions</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFF",
    },
    imageContainer: {
        height: verticalScale(250),
        width: "100%",
        position: "relative",
    },
    image: {
        width: "100%",
        height: "100%",
        resizeMode: "cover",
    },
    backButton: {
        position: "absolute",
        top: verticalScale(50),
        left: scale(20),
        width: scale(40),
        height: scale(40),
        borderRadius: scale(20),
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
    },
    content: {
        flex: 1,
        padding: scale(24),
        borderTopLeftRadius: moderateScale(24),
        borderTopRightRadius: moderateScale(24),
        marginTop: -verticalScale(24),
        backgroundColor: "#FFF",
    },
    title: {
        fontSize: moderateScale(24),
        fontWeight: "700",
        color: "#111827",
        marginBottom: verticalScale(16),
    },
    orgContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: scale(12),
        marginBottom: verticalScale(20),
        backgroundColor: "#FEF2F2",
        padding: scale(12),
        borderRadius: moderateScale(12),
    },
    orgIcon: {
        width: scale(40),
        height: scale(40),
        borderRadius: scale(20),
        backgroundColor: "#FFF",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#FEE2E2",
    },
    orgLabel: {
        fontSize: moderateScale(12),
        color: "#6B7280",
    },
    orgName: {
        fontSize: moderateScale(16),
        fontWeight: "600",
        color: "#111827",
    },
    divider: {
        height: 1,
        backgroundColor: "#E5E7EB",
        marginBottom: verticalScale(20),
    },
    infoSection: {
        marginBottom: verticalScale(24),
        gap: verticalScale(16),
    },
    infoRow: {
        flexDirection: "row",
        gap: scale(12),
    },
    infoIcon: {
        width: scale(40),
        height: scale(40),
        borderRadius: scale(12),
        backgroundColor: "#F3F4F6",
        justifyContent: "center",
        alignItems: "center",
    },
    infoTextContainer: {
        flex: 1,
    },
    infoLabel: {
        fontSize: moderateScale(12),
        color: "#6B7280",
        marginBottom: verticalScale(2),
    },
    infoValue: {
        fontSize: moderateScale(15),
        fontWeight: "600",
        color: "#111827",
    },
    infoSubValue: {
        fontSize: moderateScale(14),
        color: "#4B5563",
    },
    sectionTitle: {
        fontSize: moderateScale(18),
        fontWeight: "600",
        color: "#111827",
        marginBottom: verticalScale(8),
    },
    description: {
        fontSize: moderateScale(15),
        lineHeight: verticalScale(24),
        color: "#4B5563",
        marginBottom: verticalScale(30),
    },
    actionsContainer: {
        flexDirection: "row",
        gap: scale(12),
        marginBottom: verticalScale(20),
    },
    actionButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#111827",
        paddingVertical: verticalScale(12),
        borderRadius: moderateScale(12),
        gap: scale(8),
    },
    emailButton: {
        backgroundColor: "#4B5563",
    },
    directionButton: {
        backgroundColor: "#D11B31",
    },
    actionButtonText: {
        fontSize: moderateScale(14),
        fontWeight: "600",
        color: "#FFF",
    },
})
