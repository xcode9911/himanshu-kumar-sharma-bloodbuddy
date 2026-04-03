import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
    Animated,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { moderateScale, scale, verticalScale } from "../../utils/responsive";

const POLICY_SECTIONS = [
  {
    title: "Legal Framework (Nepal)",
    icon: "library-outline",
    content:
      "This policy is drafted for BloodBuddy services in Nepal and is designed to align with core Nepali privacy and digital-law principles, including the Constitution of Nepal (Right to Privacy), the Privacy Act 2075 (2018), the Privacy Regulation 2077 (2020), the Electronic Transactions Act 2063 (2006), and applicable consumer and health confidentiality obligations.",
  },
  {
    title: "Data We Collect",
    icon: "albums-outline",
    content:
      "We collect account data (name, email, phone, role), profile and eligibility details (blood type, donor status, organization details), campaign and attendance records, chat content, emergency sharing data (location where enabled), payment metadata for Khalti/eSewa flows, and app technical logs needed for security and reliability.",
  },
  {
    title: "Why We Use Your Data",
    icon: "construct-outline",
    content:
      "Your data is used to run blood donation workflows: matching donors and gainers, organization inventory updates, campaign creation and attendance verification via QR, donation history, emergency response support, notifications, fraud prevention, customer support, and legal compliance.",
  },
  {
    title: "Data Sharing",
    icon: "git-network-outline",
    content:
      "Data is shared only when necessary: with the relevant donor/gainer/organization for active workflows, with payment processors for payment verification, with infrastructure providers operating under confidentiality controls, or when required by Nepali law or competent authority. We do not sell personal data.",
  },
  {
    title: "Retention and Deletion",
    icon: "archive-outline",
    content:
      "We keep personal data only as long as needed for service delivery, safety, dispute handling, and legal/regulatory duties. Users may request correction, access, or deletion of eligible data. Certain transaction and safety records may be retained where mandatory by law.",
  },
  {
    title: "Security Safeguards",
    icon: "shield-checkmark-outline",
    content:
      "BloodBuddy applies role-based access, authentication checks, transport security controls, server-side validations, and audit-aware handling of sensitive operations. No system is risk-free, but we continuously improve safeguards to reduce unauthorized access and misuse.",
  },
  {
    title: "Your Rights",
    icon: "person-circle-outline",
    content:
      "Subject to Nepali law, you may request to review your data, correct inaccuracies, withdraw certain consents, and request deletion where legally permissible. For unresolved concerns, you may pursue remedies through the competent authority or court as available under Nepal law.",
  },
  {
    title: "Children and Sensitive Data",
    icon: "alert-circle-outline",
    content:
      "BloodBuddy is intended for lawful users and healthcare-related workflows. We process health-adjacent information with elevated care. If you believe unauthorized child or invalid account data was submitted, contact support immediately for investigation and removal steps.",
  },
  {
    title: "Policy Updates",
    icon: "refresh-circle-outline",
    content:
      "We may revise this policy as features, legal obligations, or security practices evolve. Material updates will be posted in-app with an updated effective date.",
  },
];

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 520,
        useNativeDriver: true,
      }),
      Animated.spring(slide, {
        toValue: 0,
        damping: 16,
        stiffness: 130,
        mass: 0.8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, slide]);

  const openSupportMail = async () => {
    const supportEmail = "blood.officiallybuddy@gmail.com";
    const subject = encodeURIComponent("Privacy Policy Request - BloodBuddy");
    const url = `mailto:${supportEmail}?subject=${subject}`;

    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      return;
    }

    await Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <View style={styles.bgBlobTop} />
      <View style={styles.bgBlobBottom} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={26} color="#B91C1C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Animated.View
        style={{
          flex: 1,
          opacity: fade,
          transform: [{ translateY: slide }],
        }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>Your Data, Your Trust</Text>
            <Text style={styles.heroText}>
              Effective Date: April 1, 2026. This policy explains how BloodBuddy
              collects, uses, protects, and shares personal data across donor,
              gainer, and organization workflows in Nepal.
            </Text>
          </View>

          {POLICY_SECTIONS.map((section) => (
            <View key={section.title} style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.iconWrap}>
                  <Ionicons
                    name={section.icon as any}
                    size={18}
                    color="#B91C1C"
                  />
                </View>
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
              <Text style={styles.sectionBody}>{section.content}</Text>
            </View>
          ))}

          <View style={styles.footerCard}>
            <Text style={styles.footerTitle}>Contact for Privacy Requests</Text>
            <Text style={styles.footerText}>
              For data access, correction, deletion, or complaints, contact:
              blood.officiallybuddy@gmail.com
            </Text>
            <TouchableOpacity
              style={styles.mailButton}
              onPress={openSupportMail}
            >
              <Ionicons name="mail-outline" size={18} color="#FFFFFF" />
              <Text style={styles.mailButtonText}>Email Privacy Support</Text>
            </TouchableOpacity>
            <Text style={styles.disclaimerText}>
              This notice is an operational privacy policy for app users and is
              not a substitute for independent legal advice.
            </Text>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF8F8",
  },
  bgBlobTop: {
    position: "absolute",
    top: -80,
    right: -90,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#FECACA",
    opacity: 0.5,
  },
  bgBlobBottom: {
    position: "absolute",
    bottom: -120,
    left: -80,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: "#FCA5A5",
    opacity: 0.35,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(58),
    paddingBottom: verticalScale(14),
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  backButton: {
    width: scale(36),
    height: scale(36),
    borderRadius: moderateScale(18),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1F2",
  },
  headerTitle: {
    fontSize: moderateScale(18),
    fontWeight: "800",
    color: "#111827",
  },
  headerSpacer: {
    width: scale(36),
    height: scale(36),
  },
  content: {
    padding: scale(16),
    paddingBottom: verticalScale(36),
  },
  heroCard: {
    backgroundColor: "#B91C1C",
    borderRadius: moderateScale(18),
    padding: scale(16),
    marginBottom: verticalScale(14),
    shadowColor: "#7F1D1D",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: moderateScale(20),
    fontWeight: "900",
    marginBottom: verticalScale(8),
  },
  heroText: {
    color: "#FEE2E2",
    fontSize: moderateScale(13),
    lineHeight: verticalScale(20),
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(14),
    padding: scale(14),
    marginBottom: verticalScale(10),
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    marginBottom: verticalScale(8),
  },
  iconWrap: {
    width: scale(28),
    height: scale(28),
    borderRadius: moderateScale(14),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
  },
  sectionTitle: {
    flex: 1,
    fontSize: moderateScale(15),
    fontWeight: "800",
    color: "#991B1B",
  },
  sectionBody: {
    color: "#374151",
    fontSize: moderateScale(13),
    lineHeight: verticalScale(20),
  },
  footerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(14),
    padding: scale(14),
    marginTop: verticalScale(4),
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  footerTitle: {
    fontSize: moderateScale(15),
    fontWeight: "800",
    color: "#7F1D1D",
    marginBottom: verticalScale(6),
  },
  footerText: {
    color: "#4B5563",
    fontSize: moderateScale(13),
    lineHeight: verticalScale(19),
  },
  mailButton: {
    marginTop: verticalScale(12),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(8),
    backgroundColor: "#D11B31",
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(10),
  },
  mailButtonText: {
    color: "#FFFFFF",
    fontSize: moderateScale(13),
    fontWeight: "800",
  },
  disclaimerText: {
    marginTop: verticalScale(10),
    color: "#6B7280",
    fontSize: moderateScale(11),
    lineHeight: verticalScale(17),
  },
});
