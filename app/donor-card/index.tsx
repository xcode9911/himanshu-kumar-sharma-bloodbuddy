import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Path, Svg } from "react-native-svg";
import { API_BASE_URL, API_ENDPOINTS } from "../../config/api";
import { moderateScale, scale, verticalScale } from "../../utils/responsive";
import { getCleanImageUrl } from "../../utils/image";
let ViewShot: any = View;
try {
  const RNVViewShot = require("react-native-view-shot");
  ViewShot = RNVViewShot.default || RNVViewShot;
} catch (e) {
  console.warn("ViewShot not available, falling back to View");
}

const { width, height } = Dimensions.get("window");

type FlowState = "intro" | "sleeve" | "revealed";

// Removed resolveProfileImageUri in favor of getCleanImageUrl utility

export default function SwipeableDonorCardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const viewShotRef = useRef<any>(null);

  const [userData, setUserData] = useState<any>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [igUsername, setIgUsername] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [flowState, setFlowState] = useState<FlowState>("intro");
  const flowStateRef = useRef<FlowState>("intro");

  const profileImageUri = getCleanImageUrl(
    userData?.profileImage ||
      userData?.ProfileImage ||
      userData?.donor?.profileImage ||
      userData?.donor?.ProfileImage ||
      userData?.organization?.ProfileImage,
  );

  const profileImageSource =
    profileImageUri && !avatarLoadFailed
      ? authToken
        ? {
            uri: profileImageUri,
            headers: { Authorization: `Bearer ${authToken}` },
          }
        : { uri: profileImageUri }
      : null;

  // Sync state reference
  useEffect(() => {
    flowStateRef.current = flowState;
  }, [flowState]);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [profileImageUri]);

  const [isEditing, setIsEditing] = useState(false);

  // Animation values
  const cardY = useRef(new Animated.Value(0)).current;
  const sleeveOpacity = useRef(new Animated.Value(1)).current;
  const overlayY = useRef(new Animated.Value(0)).current;
  const actionsOpacity = useRef(new Animated.Value(0)).current;

  // Thresholds
  const REVEAL_THRESHOLD = -verticalScale(140); // Perfectly centered below header

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      setAuthToken(token);
      const userDataString = await AsyncStorage.getItem("userData");
      let resolvedUser = userDataString ? JSON.parse(userDataString) : null;

      if (token) {
        try {
          const headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          };

          const resolvedUserId = String(
            resolvedUser?.id ||
              resolvedUser?.userId ||
              resolvedUser?.UserId ||
              "",
          ).trim();

          let source: any = null;

          // Primary path: profile by user id endpoint used in other screens.
          if (resolvedUserId) {
            const byIdResponse = await fetch(
              API_ENDPOINTS.GET_PROFILE(resolvedUserId),
              {
                method: "GET",
                headers,
              },
            );

            if (byIdResponse.ok) {
              const byIdPayload = await byIdResponse.json();
              source = byIdPayload?.user || byIdPayload?.data || byIdPayload;
            }
          }

          // Fallback path: generic profile endpoint.
          if (!source) {
            const response = await fetch(API_ENDPOINTS.PROFILE, {
              method: "GET",
              headers,
            });

            if (response.ok) {
              const payload = await response.json();
              source = payload?.user || payload?.data || payload;
            }
          }

          if (source) {
            const nextUserId =
              source?.id || source?.userId || source?.UserId || resolvedUserId;

            resolvedUser = {
              ...(resolvedUser || {}),
              ...source,
              id: nextUserId,
              donor: source?.donor || resolvedUser?.donor,
              fullName:
                source?.fullName ||
                source?.name ||
                resolvedUser?.fullName ||
                resolvedUser?.name,
              profileImage:
                source?.ProfileImage ||
                source?.profileImage ||
                source?.donor?.ProfileImage ||
                source?.donor?.profileImage ||
                source?.organization?.ProfileImage ||
                resolvedUser?.profileImage ||
                resolvedUser?.ProfileImage,
              ProfileImage:
                source?.ProfileImage ||
                source?.profileImage ||
                source?.organization?.ProfileImage ||
                resolvedUser?.ProfileImage,
            };

            await AsyncStorage.setItem(
              "userData",
              JSON.stringify(resolvedUser),
            );
          }
        } catch (error) {
          console.log("Using cached donor card user data:", error);
        }
      }

      if (resolvedUser) {
        setUserData(resolvedUser);
        const storedIg = await AsyncStorage.getItem(
          `donor_ig_${resolvedUser.id || resolvedUser.userId || resolvedUser.UserId}`,
        );
        if (storedIg) {
          setIgUsername(storedIg);
        }
      } else {
        Alert.alert("Error", "No user data found. Please go back to profile.");
      }
    } catch (e) {
      Alert.alert(
        "Unable to load card",
        "We could not load your donor card details. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveUsername = async () => {
    if (!userData) return;
    const id = userData.id || userData.userId || userData.UserId;
    const cleanIg = igUsername.replace("@", "").trim();
    try {
      await AsyncStorage.setItem(`donor_ig_${id}`, cleanIg);
      setIgUsername(cleanIg);
      if (flowState === "intro") {
        startSleevePhase();
      } else {
        setIsEditing(false);
      }
    } catch (e) {
      Alert.alert("Error", "Failed to save Instagram username");
    }
  };

  const startSleevePhase = () => {
    setFlowState("sleeve");
    cardY.setValue(0);
    sleeveOpacity.setValue(1);
    overlayY.setValue(0);
    actionsOpacity.setValue(0);
  };

  const revealCardComplete = () => {
    setFlowState("revealed");
    Animated.parallel([
      Animated.spring(cardY, {
        toValue: REVEAL_THRESHOLD,
        useNativeDriver: true,
        bounciness: 6,
      }),
      Animated.timing(overlayY, {
        toValue: height,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(actionsOpacity, {
        toValue: 1,
        duration: 350,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          flowStateRef.current === "sleeve" && Math.abs(gestureState.dy) > 5
        );
      },
      onPanResponderMove: (_, gestureState) => {
        if (flowStateRef.current !== "sleeve") return;
        if (gestureState.dy < 0) {
          cardY.setValue(gestureState.dy);
          const progress = Math.max(0, 1 - Math.abs(gestureState.dy) / 140);
          sleeveOpacity.setValue(progress);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (flowStateRef.current !== "sleeve") return;
        if (gestureState.dy < REVEAL_THRESHOLD / 3 || gestureState.vy < -0.4) {
          revealCardComplete();
        } else {
          Animated.spring(cardY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
          Animated.timing(sleeveOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  const handleShareCard = async () => {
    if (!viewShotRef.current?.capture) return;
    try {
      const uri = await viewShotRef.current.capture();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: "Share my BloodBuddy Donor Card",
        });
      } else {
        handleShareLink();
      }
    } catch (e) {
      Alert.alert(
        "Share Failed",
        "Could not capture and share the card image.",
      );
      handleShareLink();
    }
  };

  const handleShareLink = async () => {
    try {
      const cleanIg = igUsername.replace("@", "").trim();
      const igUrl = cleanIg ? `https://instagram.com/${cleanIg}` : "";
      const message = `Check out my BloodBuddy donor profile!\n\nI am a proud ${
        userData?.donor?.bloodType || userData?.bloodType || ""
      } donor.${cleanIg ? `\n\nConnect with me on Instagram: ${igUrl}` : ""}`;

      await Share.share({
        message,
        title: "My BloodBuddy Profile",
      });
    } catch (e) {
      Alert.alert("Share Failed", "Could not open sharing options.");
    }
  };

  const renderCardInner = () => (
    <View style={styles.cardContainer}>
      <BlurView
        intensity={Platform.OS === "ios" ? 70 : 100}
        tint="light"
        style={StyleSheet.absoluteFill}
      >
        <View style={styles.blurOverlay} />
      </BlurView>

      <View style={styles.cardContent}>
        <View style={styles.cardHeaderArea}>
          <View style={styles.cardAvatarLarge}>
            <View style={styles.avatarInnerFill}>
              {profileImageSource ? (
                <Image
                  source={profileImageSource}
                  style={styles.cardAvatarImage}
                  resizeMode="cover"
                  onError={() => setAvatarLoadFailed(true)}
                />
              ) : (
                <Ionicons name="person" size={50} color="#D11B31" />
              )}
            </View>
            <View style={styles.cardBadge}>
              <Ionicons name="checkmark-sharp" size={12} color="#D11B31" />
            </View>
          </View>
        </View>

        <Text style={styles.cardUserName}>
          {userData?.fullName || userData?.name || "Donor Name"}
        </Text>
        <Text style={styles.cardUserRole}>PROUD DONOR</Text>

        {igUsername ? (
          <View style={styles.cardIgPill}>
            <Ionicons
              name="logo-instagram"
              size={14}
              color="#D11B31"
              style={{ marginRight: scale(6) }}
            />
            <Text style={styles.cardIgText}>
              @{igUsername.replace("@", "")}
            </Text>
          </View>
        ) : (
          <View style={{ height: verticalScale(30) }} />
        )}

        <View style={styles.cardDetailsBox}>
          <View style={styles.cardDetailCol}>
            <Text style={styles.cardDetailLabel}>BLOOD TYPE</Text>
            <Text style={styles.cardDetailStrong}>
              {userData?.donor?.bloodType || userData?.bloodType || "N/A"}
            </Text>
          </View>
          <View style={styles.cardDetailDivider} />
          <View style={styles.cardDetailCol}>
            <Text style={styles.cardDetailLabel}>LOCATION</Text>
            <Text style={styles.cardDetailValue} numberOfLines={2}>
              {userData?.donor?.location || userData?.location || "N/A"}
            </Text>
          </View>
        </View>

        <Text style={styles.cardFooterText}>
          "Saving lives, one drop at a time."
        </Text>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D11B31" />
      </View>
    );
  }

  if (flowState === "intro") {
    return (
      <View style={[styles.introContainer, { paddingTop: insets.top }]}>
        <View style={styles.headerAbsoluteIntro}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={28} color="#D11B31" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.introContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.introIconWrapper}>
              <Ionicons name="id-card" size={80} color="#FFF" />
            </View>
            <Text style={styles.introTitle}>Make Your Identity Card</Text>
            <Text style={styles.introSubtitle}>
              Create a personalized BloodBuddy donor card to share on your
              social media and inspire others to donate.
            </Text>

            <View style={styles.connectPromptCard}>
              <Text style={styles.connectPromptTitle}>Instagram Username</Text>
              <Text style={styles.connectPromptSub}>
                Enter your Instagram handle manually to show it on your donor
                card.
              </Text>
              <View style={styles.igInputWrapper}>
                <Ionicons
                  name="logo-instagram"
                  size={20}
                  color="#D11B31"
                  style={styles.igInputIcon}
                />
                <Text style={styles.igAt}>@</Text>
                <TextInput
                  style={styles.igInput}
                  placeholder="your_username"
                  placeholderTextColor="#9CA3AF"
                  value={igUsername}
                  onChangeText={setIgUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.generateButton,
                {
                  marginTop: igUsername ? verticalScale(20) : verticalScale(10),
                },
              ]}
              onPress={handleSaveUsername}
              activeOpacity={0.85}
            >
              <Text style={styles.generateButtonText}>
                Generate My Identity Card
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  const sleeveTotalHeight = height * 0.45 + height * 0.05;
  const sleeveWidth = width;
  const sideRadius = 32;
  const notchWidth = 140;
  const notchDepth = 45;

  const sleevePath = `
    M 0 ${sideRadius}
    A ${sideRadius} ${sideRadius} 0 0 1 ${sideRadius} 0
    H ${sleeveWidth / 2 - notchWidth / 2}
    Q ${sleeveWidth / 2} ${notchDepth} ${sleeveWidth / 2 + notchWidth / 2} 0
    H ${sleeveWidth - sideRadius}
    A ${sideRadius} ${sideRadius} 0 0 1 ${sleeveWidth} ${sideRadius}
    V ${sleeveTotalHeight}
    H 0
    Z
  `;

  return (
    <View style={styles.screenContainer}>
      <View
        style={[styles.headerTopArea, { top: insets.top + verticalScale(10) }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButtonWhite}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={28} color="#D11B31" />
          </TouchableOpacity>
          <Text style={styles.headerMainTextInline}>Your BloodBuddy Card</Text>
        </View>
        <Text style={styles.headerSubText}>
          Use your card wisely, and share it on your social media to inspire
          others to donate!
        </Text>
      </View>

      <View style={styles.interactionLayer} {...panResponder.panHandlers}>
        <Animated.View
          style={[
            styles.animatedCardContainer,
            { transform: [{ translateY: cardY }] },
          ]}
        >
          <ViewShot
            ref={viewShotRef}
            options={{ format: "png", quality: 1.0 }}
            style={styles.cardShadowWrapper}
          >
            {renderCardInner()}
          </ViewShot>
        </Animated.View>

        <Animated.View
          style={[
            styles.sleeveWrapper,
            {
              opacity: sleeveOpacity,
              transform: [{ translateY: overlayY }],
              height: sleeveTotalHeight,
            },
          ]}
          pointerEvents="none"
        >
          <Svg width={sleeveWidth} height={sleeveTotalHeight}>
            <Path d={sleevePath} fill="#D11B31" />
          </Svg>

          <View style={styles.sleeveContentOverlay}>
            <View style={styles.arrowsWrap}>
              <Ionicons
                name="chevron-up"
                size={36}
                color="#FFF"
                style={{ opacity: 0.4, marginBottom: -20 }}
              />
              <Ionicons
                name="chevron-up"
                size={36}
                color="#FFF"
                style={{ opacity: 0.7, marginBottom: -20 }}
              />
              <Ionicons name="chevron-up" size={36} color="#FFF" />
            </View>
            <Text style={styles.sleeveInstructions}>
              Swipe the card upwards to get started
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.revealActionsContainer,
            {
              opacity: actionsOpacity,
              pointerEvents: flowState === "revealed" ? "auto" : "none",
              bottom: insets.bottom + verticalScale(8),
            },
          ]}
        >
          {isEditing ? (
            <View style={styles.editWrap}>
              <View style={styles.igEditForm}>
                <Ionicons name="logo-instagram" size={22} color="#111" />
                <TextInput
                  style={styles.igEditInput}
                  placeholder="username"
                  placeholderTextColor="#9CA3AF"
                  value={igUsername}
                  onChangeText={setIgUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <TouchableOpacity
                style={styles.btnSaveMini}
                onPress={handleSaveUsername}
              >
                <Text style={styles.btnSaveMiniText}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.bottomButtonsRow}>
              <TouchableOpacity
                style={styles.roundBtnSmall}
                onPress={() => setIsEditing(true)}
              >
                <Ionicons name="pencil" size={24} color="#6B7280" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.roundBtnLarge}
                onPress={handleShareCard}
                activeOpacity={0.8}
              >
                <Ionicons name="share-social" size={32} color="#FFF" />
                <Text style={styles.shareImageText}>SHARE IMAGE</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.roundBtnSmall}
                onPress={() => setFlowState("intro")}
              >
                <Ionicons name="close" size={28} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
  },
  headerAbsoluteIntro: {
    paddingHorizontal: scale(16),
  },
  headerTopArea: {
    position: "absolute",
    left: 0,
    width: "100%",
    paddingHorizontal: scale(20),
    zIndex: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
    marginBottom: verticalScale(8),
  },
  headerMainText: {
    fontSize: moderateScale(22),
    fontWeight: "800",
    color: "#111827",
    marginBottom: verticalScale(6),
  },
  headerMainTextInline: {
    flex: 1,
    fontSize: moderateScale(22),
    fontWeight: "800",
    color: "#111827",
  },
  headerSubText: {
    fontSize: moderateScale(14),
    color: "#4B5563",
    lineHeight: verticalScale(20),
    paddingRight: scale(10),
  },
  backButton: {
    padding: scale(8),
    backgroundColor: "rgba(209, 27, 49, 0.1)",
    borderRadius: scale(20),
    alignSelf: "flex-start",
  },
  backButtonWhite: {
    padding: scale(8),
    backgroundColor: "rgba(0,0,0,0.04)",
    borderRadius: scale(20),
    alignSelf: "flex-start",
  },
  introContainer: {
    flex: 1,
    backgroundColor: "#FFF",
  },
  introContent: {
    flexGrow: 1,
    paddingHorizontal: scale(24),
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: verticalScale(20),
  },
  introIconWrapper: {
    width: scale(110),
    height: scale(110),
    borderRadius: scale(55),
    backgroundColor: "#D11B31",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: verticalScale(32),
  },
  introTitle: {
    fontSize: moderateScale(26),
    fontWeight: "800",
    color: "#111827",
    marginBottom: verticalScale(12),
    textAlign: "center",
  },
  introSubtitle: {
    fontSize: moderateScale(15),
    color: "#6B7280",
    textAlign: "center",
    lineHeight: verticalScale(24),
    marginBottom: verticalScale(40),
  },
  inputSection: {
    width: "100%",
    marginBottom: verticalScale(32),
  },
  inputLabel: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: "#4B5563",
    marginBottom: verticalScale(10),
    marginLeft: scale(4),
  },
  igInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: moderateScale(16),
    paddingHorizontal: scale(16),
    height: verticalScale(56),
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  igInputIcon: {
    marginRight: scale(8),
  },
  igAt: {
    fontSize: moderateScale(16),
    color: "#9CA3AF",
    marginRight: scale(4),
  },
  igInput: {
    flex: 1,
    fontSize: moderateScale(16),
    color: "#111827",
    height: "100%",
  },
  generateButton: {
    width: "100%",
    flexDirection: "row",
    backgroundColor: "#D11B31",
    height: verticalScale(56),
    borderRadius: moderateScale(16),
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#D11B31",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  generateButtonText: {
    color: "#FFF",
    fontSize: moderateScale(16),
    fontWeight: "700",
    marginRight: scale(8),
  },
  screenContainer: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  interactionLayer: {
    flex: 1,
    position: "relative",
  },
  animatedCardContainer: {
    position: "absolute",
    top: height * 0.42,
    width: "100%",
    alignItems: "center",
    zIndex: 5,
  },
  cardShadowWrapper: {
    width: width * 0.88,
    borderRadius: moderateScale(24),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    backgroundColor: "transparent",
  },
  cardContainer: {
    width: "100%",
    minHeight: verticalScale(420),
    borderRadius: moderateScale(24),
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(209, 27, 49, 0.2)",
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
  },
  cardContent: {
    flex: 1,
    alignItems: "center",
    paddingBottom: verticalScale(28),
  },
  cardHeaderArea: {
    marginTop: verticalScale(32),
    marginBottom: verticalScale(16),
    alignItems: "center",
  },
  cardAvatarLarge: {
    width: scale(96),
    height: scale(96),
    borderRadius: scale(48),
    backgroundColor: "rgba(209, 27, 49, 0.05)",
    padding: scale(3),
    borderWidth: 1,
    borderColor: "rgba(209, 27, 49, 0.3)",
    position: "relative",
  },
  avatarInnerFill: {
    flex: 1,
    borderRadius: scale(45),
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(209, 27, 49, 0.1)",
    overflow: "hidden",
  },
  cardAvatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: scale(45),
  },
  cardBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "#FFF",
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#D11B31",
  },
  cardUserName: {
    fontSize: moderateScale(26),
    fontWeight: "800",
    color: "#1F2937",
    textAlign: "center",
  },
  cardUserRole: {
    fontSize: moderateScale(13),
    color: "#D11B31",
    fontWeight: "800",
    letterSpacing: 2,
    marginVertical: verticalScale(8),
  },
  cardIgPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(209, 27, 49, 0.1)",
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(6),
    borderRadius: moderateScale(20),
    marginTop: verticalScale(4),
    marginBottom: verticalScale(24),
  },
  cardIgText: {
    color: "#D11B31",
    fontWeight: "600",
    fontSize: moderateScale(13),
  },
  cardDetailsBox: {
    flexDirection: "row",
    width: "88%",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(209, 27, 49, 0.05)",
    borderRadius: moderateScale(16),
    paddingVertical: verticalScale(24),
    marginBottom: verticalScale(28),
    borderWidth: 1,
    borderColor: "rgba(209, 27, 49, 0.1)",
  },
  cardDetailCol: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: scale(8),
  },
  cardDetailDivider: {
    width: 1,
    height: "100%",
    backgroundColor: "rgba(209, 27, 49, 0.1)",
  },
  cardDetailLabel: {
    fontSize: moderateScale(11),
    color: "#6B7280",
    textTransform: "uppercase",
    fontWeight: "700",
    marginBottom: verticalScale(8),
    letterSpacing: 1,
  },
  cardDetailStrong: {
    fontSize: moderateScale(28),
    fontWeight: "900",
    color: "#D11B31",
  },
  cardDetailValue: {
    fontSize: moderateScale(15),
    fontWeight: "600",
    color: "#1F2937",
    textAlign: "center",
  },
  cardFooterText: {
    fontSize: moderateScale(13),
    fontStyle: "italic",
    color: "#9CA3AF",
    fontWeight: "500",
  },
  sleeveWrapper: {
    position: "absolute",
    bottom: -height * 0.05,
    width: "100%",
    zIndex: 10,
  },
  sleeveContentOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
  },
  arrowsWrap: {
    alignItems: "center",
    marginTop: verticalScale(25),
    marginBottom: verticalScale(12),
  },
  sleeveInstructions: {
    fontSize: moderateScale(16),
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
    letterSpacing: 0.5,
  },
  revealActionsContainer: {
    position: "absolute",
    width: "100%",
    alignItems: "center",
    zIndex: 15,
  },
  bottomButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: width * 0.85,
  },
  roundBtnSmall: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  roundBtnLarge: {
    width: scale(100),
    height: scale(100),
    borderRadius: scale(50),
    backgroundColor: "#D11B31",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#D11B31",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  shareImageText: {
    color: "#FFF",
    fontSize: moderateScale(10),
    fontWeight: "800",
    marginTop: verticalScale(4),
  },
  editWrap: {
    flexDirection: "row",
    gap: scale(12),
    width: width * 0.85,
  },
  igEditForm: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: moderateScale(16),
    paddingHorizontal: scale(16),
    height: verticalScale(54),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  igEditInput: {
    flex: 1,
    fontSize: moderateScale(14),
    color: "#111",
    marginLeft: scale(8),
  },
  btnSaveMini: {
    backgroundColor: "#D11B31",
    paddingHorizontal: scale(20),
    borderRadius: moderateScale(14),
    justifyContent: "center",
  },
  btnSaveMiniText: {
    color: "#FFF",
    fontWeight: "700",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: verticalScale(20),
    width: "100%",
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  dividerText: {
    marginHorizontal: scale(12),
    color: "#9CA3AF",
    fontSize: moderateScale(12),
    fontWeight: "600",
  },
  igLoginButton: {
    width: "100%",
    flexDirection: "row",
    backgroundColor: "#FFF",
    height: verticalScale(56),
    borderRadius: moderateScale(16),
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  igIconbg: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(10),
    backgroundColor: "#E1306C",
    justifyContent: "center",
    alignItems: "center",
    marginRight: scale(12),
  },
  igLoginButtonText: {
    color: "#1F2937",
    fontSize: moderateScale(16),
    fontWeight: "600",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scale(16),
    height: verticalScale(60),
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalCloseBtn: {
    padding: scale(8),
  },
  modalTitle: {
    fontSize: moderateScale(18),
    fontWeight: "700",
    color: "#111",
  },
  mockLoginContainer: {
    padding: scale(20),
    backgroundColor: "#F9FAFB",
    alignItems: "center",
  },
  mockText: {
    fontSize: moderateScale(13),
    color: "#6B7280",
    textAlign: "center",
    marginBottom: verticalScale(16),
  },
  mockBtn: {
    backgroundColor: "#E1306C",
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(20),
    borderRadius: moderateScale(10),
  },
  mockBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: moderateScale(14),
  },
  igLoaderLayer: {
    position: "absolute",
    top: verticalScale(160),
    left: 0,
    right: 0,
    zIndex: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  igLoaderText: {
    marginTop: verticalScale(12),
    color: "#E1306C",
    fontWeight: "600",
    fontSize: moderateScale(14),
  },
  connectedAccountCard: {
    width: "100%",
    backgroundColor: "#F9FAFB",
    borderRadius: moderateScale(20),
    padding: scale(20),
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    marginBottom: verticalScale(10),
  },
  connectedCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: verticalScale(12),
  },
  igIconCircleSmall: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    backgroundColor: "#E1306C",
    justifyContent: "center",
    alignItems: "center",
    marginRight: scale(10),
  },
  connectedLabel: {
    fontSize: moderateScale(11),
    fontWeight: "700",
    color: "#9CA3AF",
    letterSpacing: 1,
    flex: 1,
  },
  changeLinkText: {
    fontSize: moderateScale(13),
    fontWeight: "600",
    color: "#D11B31",
  },
  connectedUserRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  connectedUserName: {
    fontSize: moderateScale(20),
    fontWeight: "800",
    color: "#111827",
  },
  connectPromptCard: {
    width: "100%",
    backgroundColor: "#FFF",
    borderRadius: moderateScale(24),
    padding: scale(24),
    borderWidth: 1.5,
    borderColor: "#F3F4F6",
    alignItems: "center",
    marginBottom: verticalScale(10),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  connectPromptTitle: {
    fontSize: moderateScale(20),
    fontWeight: "800",
    color: "#111827",
    marginBottom: verticalScale(8),
  },
  connectPromptSub: {
    fontSize: moderateScale(14),
    color: "#6B7280",
    textAlign: "center",
    lineHeight: verticalScale(20),
    marginBottom: verticalScale(24),
    paddingHorizontal: scale(10),
  },
  igConnectBtnPremium: {
    width: "100%",
    height: verticalScale(56),
    borderRadius: moderateScale(16),
    overflow: "hidden",
  },
  igGradientBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  igConnectBtnText: {
    color: "#FFF",
    fontSize: moderateScale(16),
    fontWeight: "700",
  },
  skipLink: {
    marginTop: verticalScale(20),
    padding: scale(10),
  },
  skipLinkText: {
    fontSize: moderateScale(14),
    color: "#9CA3AF",
    fontWeight: "500",
    textDecorationLine: "underline",
  },
});
