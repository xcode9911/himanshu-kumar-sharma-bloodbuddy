import { Ionicons } from "@expo/vector-icons"
import * as Print from "expo-print"
import { useLocalSearchParams, useRouter } from "expo-router"
import React, { useRef } from "react"
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native"
import QRCode from "react-native-qrcode-svg"
import { moderateScale, scale, verticalScale } from "../../../utils/responsive"

export default function CampaignQRScreen() {
    const router = useRouter()
    const { id, title, location, orgName } = useLocalSearchParams()
    const qrRef = useRef<any>(null)

    const qrValue = JSON.stringify({
        type: "CAMPAIGN_ATTENDANCE",
        campaignId: id,
        title: title
    })

    const handlePrint = async () => {
        try {
            const html = `
                <html>
                <head>
                    <style>
                        body { font-family: 'Helvetica', sans-serif; text-align: center; padding: 40px; }
                        .header { color: #D11B31; font-size: 32px; font-weight: bold; margin-bottom: 10px; }
                        .tagline { color: #6B7280; font-size: 18px; margin-bottom: 40px; }
                        .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
                        .location { font-size: 16px; color: #4B5563; margin-bottom: 30px; }
                        .qr-container { margin: 40px auto; padding: 20px; border: 2px solid #E5E7EB; display: inline-block; border-radius: 20px; }
                        .footer { margin-top: 50px; font-size: 14px; color: #9CA3AF; }
                    </style>
                </head>
                <body>
                    <div class="header">BLOOD BUDDY</div>
                    <div class="tagline">Be a Hero, Save a Life</div>
                    <div style="border-top: 1px solid #F3F4F6; margin: 30px 0;"></div>
                    <div style="font-size: 20px; color: #D11B31; font-weight: bold; margin-bottom: 5px;">${orgName}</div>
                    <div class="title">${title}</div>
                    <div class="location">${location}</div>
                    <p>Scan this QR code to record your attendance</p>
                    <div class="qr-container">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrValue)}" width="300" height="300" />
                    </div>
                    <div class="footer">Organized via Blood Buddy Platform</div>
                </body>
                </html>
            `;
            await Print.printAsync({ html });
        } catch (error) {
            console.error("Print error:", error);
        }
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color="#D11B31" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Camp QR Code</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.qrCard}>
                    <Image source={require("../../../assets/images/logo.png")} style={styles.logo} />
                    <Text style={styles.appBranding}>BLOOD BUDDY</Text>
                    <View style={styles.orgBadge}>
                        <Text style={styles.orgNameText}>{orgName || "BLOOD BANK"}</Text>
                    </View>
                    <Text style={styles.campTitle}>{title}</Text>
                    <Text style={styles.campLocation}>{location}</Text>

                    <View style={styles.qrContainer}>
                        <QRCode
                            value={qrValue}
                            size={scale(220)}
                            color="#000"
                            backgroundColor="white"
                            logo={require("../../../assets/images/logo.png")}
                            logoSize={50}
                            logoBackgroundColor="white"
                            logoBorderRadius={10}
                        />
                    </View>

                    <Text style={styles.instruction}>Scan to record attendance & auto-update inventory</Text>
                </View>

                <TouchableOpacity style={styles.printButton} onPress={handlePrint}>
                    <Ionicons name="print" size={24} color="#FFF" />
                    <Text style={styles.printButtonText}>Print QR Poster</Text>
                </TouchableOpacity>
            </ScrollView>
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
    content: {
        padding: scale(20),
        alignItems: "center",
    },
    qrCard: {
        backgroundColor: "#FFF",
        borderRadius: moderateScale(32),
        padding: scale(30),
        alignItems: "center",
        width: "100%",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 5,
        marginBottom: verticalScale(30),
    },
    appBranding: {
        fontSize: moderateScale(22),
        fontWeight: "900",
        color: "#D11B31",
        letterSpacing: 2,
        marginBottom: verticalScale(16),
    },
    logo: {
        width: moderateScale(80),
        height: moderateScale(80),
        resizeMode: "contain",
        marginBottom: verticalScale(10),
    },
    orgBadge: {
        backgroundColor: "#FEE2E2",
        paddingHorizontal: scale(16),
        paddingVertical: verticalScale(6),
        borderRadius: moderateScale(20),
        marginBottom: verticalScale(12),
    },
    orgNameText: {
        color: "#D11B31",
        fontSize: moderateScale(14),
        fontWeight: "800",
        textTransform: "uppercase",
    },
    campTitle: {
        fontSize: moderateScale(18),
        fontWeight: "700",
        color: "#111827",
        textAlign: "center",
        marginBottom: verticalScale(4),
    },
    campLocation: {
        fontSize: moderateScale(14),
        color: "#6B7280",
        textAlign: "center",
        marginBottom: verticalScale(30),
    },
    qrContainer: {
        padding: scale(16),
        backgroundColor: "#FFF",
        borderRadius: moderateScale(20),
        borderWidth: 1,
        borderColor: "#F3F4F6",
        marginBottom: verticalScale(20),
    },
    instruction: {
        fontSize: moderateScale(13),
        color: "#9CA3AF",
        textAlign: "center",
        fontStyle: "italic",
    },
    printButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#D11B31",
        paddingVertical: verticalScale(16),
        paddingHorizontal: scale(40),
        borderRadius: moderateScale(16),
        gap: scale(12),
        shadowColor: "#D11B31",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    printButtonText: {
        color: "#FFF",
        fontSize: moderateScale(16),
        fontWeight: "700",
    },
})
