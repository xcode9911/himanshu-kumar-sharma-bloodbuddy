import { Ionicons } from "@expo/vector-icons"
import React, { useEffect, useRef } from "react"
import { Animated, Image, StyleSheet, TouchableOpacity, View } from "react-native"
import { moderateScale, scale, verticalScale } from "../utils/responsive"

type Props = {
    onPress: () => void
    isActive: boolean
    isAlert?: boolean
}

export default function EmergencyFAB({ onPress, isActive, isAlert }: Props) {
    const pulseAnim = useRef(new Animated.Value(1)).current
    const pulseOpacity = useRef(new Animated.Value(0.6)).current
    const pulseAnim2 = useRef(new Animated.Value(1)).current
    const pulseOpacity2 = useRef(new Animated.Value(0.4)).current

    useEffect(() => {
        if (!isActive && !isAlert) {
            pulseAnim.setValue(1);
            pulseOpacity.setValue(0);
            pulseAnim2.setValue(1);
            pulseOpacity2.setValue(0);
            return;
        }

        const pulse1 = Animated.loop(
            Animated.sequence([
                Animated.parallel([
                    Animated.timing(pulseAnim, {
                        toValue: 2,
                        duration: 2000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseOpacity, {
                        toValue: 0,
                        duration: 2000,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.parallel([
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 0,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseOpacity, {
                        toValue: 0.6,
                        duration: 0,
                        useNativeDriver: true,
                    }),
                ]),
            ])
        );

        const pulse2 = Animated.loop(
            Animated.sequence([
                Animated.delay(1000),
                Animated.parallel([
                    Animated.timing(pulseAnim2, {
                        toValue: 2.2,
                        duration: 2000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseOpacity2, {
                        toValue: 0,
                        duration: 2000,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.parallel([
                    Animated.timing(pulseAnim2, {
                        toValue: 1,
                        duration: 0,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseOpacity2, {
                        toValue: 0.4,
                        duration: 0,
                        useNativeDriver: true,
                    }),
                ]),
            ])
        );

        Animated.parallel([pulse1, pulse2]).start();

        return () => {
            pulse1.stop();
            pulse2.stop();
        };
    }, [isActive, isAlert]);

    return (
        <View style={styles.emergencyFabContainer}>
            <Animated.View
                style={[
                    styles.pulseRing,
                    { transform: [{ scale: pulseAnim }], opacity: pulseOpacity },
                ]}
            />
            <Animated.View
                style={[
                    styles.pulseRing,
                    { transform: [{ scale: pulseAnim2 }], opacity: pulseOpacity2 },
                ]}
            />
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={onPress}
                style={[styles.emergencyFab, isActive && styles.activeEmergencyFab]}
            >
                <View style={styles.emergencyFabInner}>
                    {isActive ? (
                        <Ionicons name="close" size={32} color="#fff" />
                    ) : (
                        <Image
                            source={require("../assets/images/logo.png")}
                            style={styles.emergencyLogo}
                            resizeMode="contain"
                        />
                    )}
                </View>
                {(isAlert || isActive) && <View style={styles.emergencyAlertDot} />}
            </TouchableOpacity>
        </View>
    )
}

const styles = StyleSheet.create({
    emergencyFabContainer: {
        position: "absolute",
        bottom: verticalScale(100), // Adjusted to sit above Navigation
        right: scale(20),
        zIndex: 1000,
        alignItems: "center",
        justifyContent: "center",
    },
    emergencyFab: {
        width: moderateScale(66),
        height: moderateScale(66),
        borderRadius: moderateScale(38),
        backgroundColor: "#fff",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#D11B31",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 15,
        borderWidth: 2,
        borderColor: "#D11B31",
    },
    activeEmergencyFab: {
        backgroundColor: "#D11B31",
    },
    emergencyFabInner: {
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
    },
    emergencyLogo: {
        width: moderateScale(48),
        height: moderateScale(48),
    },
    pulseRing: {
        position: "absolute",
        width: moderateScale(76),
        height: moderateScale(76),
        borderRadius: moderateScale(38),
        borderWidth: 2,
        borderColor: "#D11B31",
        backgroundColor: "rgba(209, 27, 49, 0.1)",
    },
    emergencyAlertDot: {
        position: "absolute",
        top: scale(5),
        right: scale(5),
        width: moderateScale(16),
        height: moderateScale(16),
        borderRadius: moderateScale(8),
        backgroundColor: "#10B981",
        borderWidth: 2,
        borderColor: "#fff",
        zIndex: 10,
    },
})
