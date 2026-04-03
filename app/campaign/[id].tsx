import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
    Alert,
    Image,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { moderateScale, scale, verticalScale } from "../../utils/responsive";

export default function CampaignDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const {
    title,
    description,
    location,
    latitude,
    longitude,
    startDate,
    endDate,
    posterUrl,
    organizationName,
    organizationLogo,
    organizationLogoUrl,
    organizationPhone,
    organizationEmail,
    collaboratorOrganizationNames,
    collaborationNote,
  } = params;

  const getSingleParam = (value: string | string[] | undefined): string => {
    if (Array.isArray(value)) {
      return value[0] ?? "";
    }
    return value ?? "";
  };

  const titleValue = getSingleParam(title as string | string[] | undefined);
  const descriptionValue = getSingleParam(
    description as string | string[] | undefined,
  );
  const locationValue = getSingleParam(
    location as string | string[] | undefined,
  );
  const latitudeValue = getSingleParam(
    latitude as string | string[] | undefined,
  );
  const longitudeValue = getSingleParam(
    longitude as string | string[] | undefined,
  );
  const startDateValue = getSingleParam(
    startDate as string | string[] | undefined,
  );
  const endDateValue = getSingleParam(endDate as string | string[] | undefined);
  const posterUrlValue = getSingleParam(
    posterUrl as string | string[] | undefined,
  );
  const organizationNameValue = getSingleParam(
    organizationName as string | string[] | undefined,
  );
  const organizationLogoValue = getSingleParam(
    (organizationLogo as string | string[] | undefined) ??
      (organizationLogoUrl as string | string[] | undefined),
  );
  const organizationPhoneValue = getSingleParam(
    organizationPhone as string | string[] | undefined,
  );
  const organizationEmailValue = getSingleParam(
    organizationEmail as string | string[] | undefined,
  );
  const collaboratorOrganizationNamesValue = getSingleParam(
    collaboratorOrganizationNames as string | string[] | undefined,
  );
  const collaborationNoteValue = getSingleParam(
    collaborationNote as string | string[] | undefined,
  );

  const collaborationPartners = (() => {
    if (
      !collaboratorOrganizationNamesValue ||
      typeof collaboratorOrganizationNamesValue !== "string"
    ) {
      return [] as string[];
    }

    try {
      const parsed = JSON.parse(collaboratorOrganizationNamesValue);
      return Array.isArray(parsed)
        ? parsed.map((item) => String(item)).filter(Boolean)
        : [];
    } catch {
      return collaboratorOrganizationNamesValue
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  })();

  const handleCall = async () => {
    if (!organizationPhoneValue) {
      Alert.alert("Phone unavailable", "No contact phone number was provided.");
      return;
    }

    const phoneUrl = `tel:${organizationPhoneValue.replace(/\s+/g, "")}`;

    try {
      const supported = await Linking.canOpenURL(phoneUrl);
      if (!supported) {
        Alert.alert(
          "Cannot place call",
          "Your device does not support opening the phone dialer.",
        );
        return;
      }
      await Linking.openURL(phoneUrl);
    } catch {
      Alert.alert("Call failed", "Unable to open the phone dialer right now.");
    }
  };

  const handleEmail = async () => {
    if (!organizationEmailValue) {
      Alert.alert("Email unavailable", "No email address was provided.");
      return;
    }

    const emailUrl = `mailto:${organizationEmailValue}`;

    try {
      const supported = await Linking.canOpenURL(emailUrl);
      if (!supported) {
        Alert.alert(
          "Cannot open email",
          "No compatible mail app is available on this device.",
        );
        return;
      }
      await Linking.openURL(emailUrl);
    } catch {
      Alert.alert("Email failed", "Unable to open your email app right now.");
    }
  };

  const handleDirections = () => {
    if (!locationValue && !latitudeValue && !longitudeValue) {
      Alert.alert("Location unavailable", "No campaign location was provided.");
      return;
    }

    const hasDedicatedCoordinates = Boolean(latitudeValue && longitudeValue);

    // Look for exact coordinates or embedded coordinates in parentheses "(lat, lng)" for backward compatibility
    const pureCoordinateMatch = locationValue
      .trim()
      .match(/^([-+]?\d{1,2}(?:\.\d+)?)\s*,\s*([-+]?\d{1,3}(?:\.\d+)?)$/);
    const complexCoordinateMatch = locationValue
      .trim()
      .match(/\(([-+]?\d{1,2}(?:\.\d+)?)\s*,\s*([-+]?\d{1,3}(?:\.\d+)?)\)$/);

    const finalLatLngMatch = pureCoordinateMatch || complexCoordinateMatch;

    const navLatitude = hasDedicatedCoordinates
      ? latitudeValue
      : finalLatLngMatch
        ? finalLatLngMatch[1]
        : undefined;
    const navLongitude = hasDedicatedCoordinates
      ? longitudeValue
      : finalLatLngMatch
        ? finalLatLngMatch[2]
        : undefined;

    router.push({
      pathname: "/map",
      params: {
        destinationName: titleValue || "Campaign Location",
        destinationAddress: locationValue.replace(/\s*\([^)]+\)$/, "").trim(),
        ...(navLatitude && navLongitude
          ? {
              destinationLatitude: navLatitude,
              destinationLongitude: navLongitude,
            }
          : {}),
      },
    });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Custom Floating Back Button to match app style */}
      <View
        style={{
          position: "absolute",
          top: verticalScale(50), // Position below status bar
          left: scale(16),
          zIndex: 10,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            backgroundColor: "#FFFFFF",
            width: scale(40),
            height: scale(40),
            borderRadius: scale(20),
            justifyContent: "center",
            alignItems: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 4,
            elevation: 4,
          }}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color="#D11B31"
            style={{ marginLeft: -2 }}
          />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.imageContainer}>
          <Image
            source={{
              uri:
                posterUrlValue ||
                "https://placehold.co/600x400/png?text=Campaign",
            }}
            style={styles.image}
          />
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{titleValue}</Text>

          {organizationNameValue && (
            <View style={styles.orgContainer}>
              <View style={styles.orgIcon}>
                <Image
                  source={
                    organizationLogoValue
                      ? { uri: organizationLogoValue }
                      : require("../../assets/images/logo.png")
                  }
                  style={styles.orgLogo}
                />
              </View>
              <View>
                <Text style={styles.orgLabel}>Organized by</Text>
                <Text style={styles.orgName}>{organizationNameValue}</Text>
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
                  {new Date(startDateValue).toLocaleDateString()}{" "}
                  {new Date(startDateValue).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
                <Text style={styles.infoSubValue}>
                  to {new Date(endDateValue).toLocaleDateString()}{" "}
                  {new Date(endDateValue).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="location" size={20} color="#EF4444" />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Location</Text>
                <Text style={styles.infoValue}>{locationValue}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>About this Campaign</Text>
          <Text style={styles.description}>{descriptionValue}</Text>

          {collaborationPartners.length > 0 && (
            <View style={styles.collaborationSection}>
              <Text style={styles.sectionTitle}>Collaboration</Text>
              <Text style={styles.collaborationText}>
                Partners: {collaborationPartners.join(", ")}
              </Text>
              {!!collaborationNoteValue && (
                <Text style={styles.collaborationNote}>
                  {String(collaborationNoteValue)}
                </Text>
              )}
            </View>
          )}

          <View style={styles.actionsContainer}>
            {organizationPhoneValue && (
              <TouchableOpacity
                style={[styles.actionButton, styles.callButton]}
                onPress={handleCall}
                accessibilityRole="button"
                accessibilityLabel="Call organizer"
              >
                <Ionicons name="call" size={22} color="#FFF" />
              </TouchableOpacity>
            )}
            {organizationEmailValue && (
              <TouchableOpacity
                style={[styles.actionButton, styles.emailButton]}
                onPress={handleEmail}
                accessibilityRole="button"
                accessibilityLabel="Email organizer"
              >
                <Ionicons name="mail" size={22} color="#FFF" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionButton, styles.directionButton]}
              onPress={handleDirections}
              accessibilityRole="button"
              accessibilityLabel="Open directions"
            >
              <Ionicons name="navigate" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
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
    overflow: "hidden",
  },
  orgLogo: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
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
  collaborationSection: {
    marginBottom: verticalScale(24),
    backgroundColor: "#EEF2FF",
    borderRadius: moderateScale(12),
    padding: scale(12),
  },
  collaborationText: {
    fontSize: moderateScale(14),
    color: "#312E81",
    fontWeight: "600",
  },
  collaborationNote: {
    fontSize: moderateScale(13),
    color: "#4338CA",
    marginTop: verticalScale(6),
  },
  actionsContainer: {
    flexDirection: "row",
    gap: scale(12),
    marginBottom: verticalScale(20),
    justifyContent: "center",
    alignItems: "center",
  },
  actionButton: {
    width: scale(52),
    height: scale(52),
    borderRadius: moderateScale(14),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D11B31",
  },
  callButton: {
    backgroundColor: "#D11B31",
  },
  emailButton: {
    backgroundColor: "#B91C1C",
  },
  directionButton: {
    backgroundColor: "#EF4444",
  },
});
