import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import AddInventorySvg from "../../assets/images/add-inventory.svg";
import AppointmentsSvg from "../../assets/images/appointments.svg";
import CampSvg from "../../assets/images/camp.svg";
import HistorySvg from "../../assets/images/donation-history.svg";
import DonationSvg from "../../assets/images/donation.svg";
import PaymentSvg from "../../assets/images/payment.svg";
import ScheduleSvg from "../../assets/images/schedule.svg";
import AddInventoryModal from "../../components/AddInventoryModal";
import AppointmentsModal from "../../components/AppointmentsModal";
import EsewaPaymentModal from "../../components/EsewaPaymentModal";
import KhaltiPaymentModal from "../../components/KhaltiPaymentModal";
import Navigation from "../../components/Navigation";
import QuickDonationModal from "../../components/QuickDonationModal";
import ReceivedPaymentsModal from "../../components/ReceivedPaymentsModal";
import { API_ENDPOINTS } from "../../config/api";
import { connectSocket, getSocket } from "../../config/socket";
import { moderateScale, scale, verticalScale } from "../../utils/responsive";

type UserType = "gainer" | "donor" | "organization";

type QuickActionIcon =
  | keyof typeof Ionicons.glyphMap
  | "donation"
  | "schedule"
  | "history"
  | "camp"
  | "add-inventory"
  | "appointments"
  | "payment";

interface QuickAction {
  icon: QuickActionIcon;
  label: string;
  route: string;
  color: string;
}

export default function Home() {
  const router = useRouter();
  const [userType, setUserType] = useState<UserType>("donor");
  const [userName, setUserName] = useState<string>("User");
  const [userId, setUserId] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Modal States
  const [addInventoryModalVisible, setAddInventoryModalVisible] = useState(false);
  const [inventoryBloodType, setInventoryBloodType] = useState("AB+");
  const [inventoryUnits, setInventoryUnits] = useState("");

  // ... existing code ...

  const [donationModalVisible, setDonationModalVisible] = useState(false);
  const [donorBloodType, setDonorBloodType] = useState<string>("A+");
  const [appointmentsModalVisible, setAppointmentsModalVisible] = useState(false);

  // Payment State
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [esewaModalVisible, setEsewaModalVisible] = useState(false);
  const [paymentBooking, setPaymentBooking] = useState<any>(null);
  const [receivedPaymentsModalVisible, setReceivedPaymentsModalVisible] = useState(false);

  // Bookings Data
  const [bookings, setBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  // Campaign Data
  const [activeCampaigns, setActiveCampaigns] = useState<any[]>([]);

  const mockBubbles = [
    { id: '1', initials: 'SK', color: '#D11B31' },
    { id: '2', initials: 'AM', color: '#2563EB' },
    { id: '3', initials: 'RP', color: '#059669' },
    { id: '4', initials: 'VG', color: '#7C3AED' },
    { id: '5', initials: 'NS', color: '#F59E0B' },
  ];

  // Animation for Donor Bubbles (Gainer visual)
  const slideAnim = useRef(new Animated.Value(1)).current; // Scale anim
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const staggeredAnims = useRef(mockBubbles.map(() => new Animated.Value(0))).current;

  // Banner State
  const bannerImages = [
    require("../../assets/images/banner1.jpeg"),
    require("../../assets/images/banner2.jpeg"),
    require("../../assets/images/banner3.jpeg"),
    require("../../assets/images/banner4.jpeg"),
  ];
  const screenWidth = Dimensions.get("window").width;
  const bannerWidth = screenWidth - scale(40);
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerScrollRef = useRef<ScrollView>(null);

  const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

  useEffect(() => {
    loadUserData();
    fetchCampaigns();
  }, []);

  useEffect(() => {
    if (userType === "gainer" || userType === "organization") {
      fetchBookings();
    }
  }, [userType]);

  useEffect(() => {
    const imagesLength = activeCampaigns.length > 0 ? activeCampaigns.length : bannerImages.length;

    const interval = setInterval(() => {
      setBannerIndex((prev) => {
        const next = (prev + 1) % imagesLength;
        bannerScrollRef.current?.scrollTo({
          x: next * bannerWidth,
          animated: true,
        });
        return next;
      });
    }, 3500);

    return () => clearInterval(interval);
  }, [bannerImages.length, bannerWidth, activeCampaigns.length]);

  useEffect(() => {
    if (userType === "gainer") {
      // Fade in the group container
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();

      // Staggered entrance for each circle
      Animated.stagger(150, staggeredAnims.map(anim =>
        Animated.spring(anim, {
          toValue: 1,
          tension: 40,
          friction: 8,
          useNativeDriver: true
        })
      )).start();

      // Slow pulse for the whole group after they've entered
      Animated.loop(
        Animated.sequence([
          Animated.delay(1500),
          Animated.timing(slideAnim, { toValue: 1.03, duration: 1500, useNativeDriver: true }),
          Animated.timing(slideAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [userType]);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem("userData");
      if (userData) {
        const parsed = JSON.parse(userData);
        const role = (parsed.role || "donor").toLowerCase();
        setUserType(role as UserType);
        setUserName(parsed.fullName || "User");
        setUserId(parsed.id || null);
        setDonorBloodType(parsed.bloodType || "A+");
        if (parsed.id) {
          connectSocket(parsed.id);
          setupNotifications(role);
        }
      }
    } catch (error) {
      console.log("Error loading user data:", error);
    }
  };

  const setupNotifications = (role: string) => {
    const socket = getSocket();
    if (!socket) return;

    socket.off("newBookingRequest");
    if (role === "organization") {
      socket.on("newBookingRequest", (data: any) => {
        setUnreadNotifications((prev) => prev + 1);
        Alert.alert(
          "New Booking Request",
          `${data.gainerName} requested ${data.units} units of ${data.bloodType}.`,
          [
            { text: "Later", style: "cancel" },
            { text: "View", onPress: () => router.push("/notifications") }
          ]
        );
      });
    }

    socket.off("bookingApproved");
    socket.off("bookingRejected");
    if (role === "gainer") {
      socket.on("bookingApproved", (data: any) => {
        setUnreadNotifications((prev) => prev + 1);
        Alert.alert("Booking Approved!", `Your request for ${data.bloodType} has been approved.`);
        fetchBookings();
      });

      socket.on("bookingRejected", (data: any) => {
        setUnreadNotifications((prev) => prev + 1);
        Alert.alert("Booking Rejected", `Your request for ${data.bloodType} was rejected.`);
        fetchBookings();
      });
    }
  };

  const fetchBookings = async () => {
    try {
      setLoadingBookings(true);
      const token = await AsyncStorage.getItem("authToken");
      const userData = await AsyncStorage.getItem("userData");
      if (!token || !userData) return;

      const user = JSON.parse(userData);
      const role = (user.role || "").toLowerCase();

      const bookingResponse = await fetch(API_ENDPOINTS.GET_USER_BOOKINGS(user.id), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const bookingData = await bookingResponse.json();

      const donationResponse = await fetch(API_ENDPOINTS.GET_DONATIONS, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const donationData = await donationResponse.json();

      let combinedData: any[] = [];

      if (bookingResponse.ok && bookingData.requests) combinedData = [...combinedData, ...bookingData.requests.map((r: any) => ({
        requestId: r.RequestId,
        type: 'booking',
        userName: role === 'organization' ? (r.gainer?.user?.FullName || "User") : (r.organization?.OrganizationName || "Blood Bank"),
        bloodType: r.BloodType,
        units: r.Units,
        createdAt: r.RequestDate,
        status: r.Status?.toLowerCase() || "pending",
        paymentStatus: r.PaymentStatus || "Pending",
        phone: r.gainer?.user?.Phone || "N/A"
      }))];

      if (donationResponse.ok && donationData.offers) {
        const offers = donationData.offers;
        if (role === 'donor') {
          combinedData = [...combinedData, ...offers.map((o: any) => ({
            requestId: o.OfferId,
            type: 'donation',
            userName: o.organization?.OrganizationName || "Blood Bank",
            bloodType: o.donor?.BloodType || "Unknown",
            units: 1,
            createdAt: o.CreatedAt,
            status: o.Status?.toLowerCase() || "pending",
            paymentStatus: "N/A"
          }))];
        } else if (role === 'organization') {
          const history = offers.filter((o: any) => o.Status?.toLowerCase() !== 'pending');
          combinedData = [...combinedData, ...history.map((o: any) => ({
            requestId: o.OfferId,
            type: 'donation',
            userName: o.donor?.user?.FullName || "Donor",
            bloodType: o.donor?.BloodType || "Unknown",
            units: 1,
            createdAt: o.CreatedAt,
            status: o.Status?.toLowerCase() || "pending",
            phone: o.donor?.user?.Phone || "N/A",
            paymentStatus: "N/A"
          }))];
        }
      }

      combinedData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBookings(combinedData);

      if (role === 'organization' && bookingResponse.ok && bookingData.requests) {
        const pendingCount = bookingData.requests.filter((r: any) => r.Status === "Pending").length;
        setUnreadNotifications(pendingCount);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoadingBookings(false);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken"); // Optional: if API requires auth

      const response = await fetch(API_ENDPOINTS.GET_ALL_CAMPAIGNS, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.ok) {
        const data = await response.json();
        // Filter only active campaigns that have a poster
        const campaignsWithPosters = (data.campaigns || []).filter(
          (c: any) => c.status === 'active' && c.posterUrl
        );
        setActiveCampaigns(campaignsWithPosters);
      }
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    }
  };

  const handleCancelBooking = async (requestId: number) => {
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this blood request?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem("authToken");
              if (!token) return;

              const response = await fetch(API_ENDPOINTS.CANCEL_BOOKING, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ requestId }),
              });

              const data = await response.json();
              if (response.ok) {
                Alert.alert("Success", "Booking cancelled successfully");
                setBookings((prev) => prev.filter((b) => b.requestId !== requestId));
              } else {
                Alert.alert("Error", data.message || "Failed to cancel booking");
              }
            } catch (error) {
              console.error("Cancel error:", error);
              Alert.alert("Error", "Something went wrong. Please try again.");
            }
          },
        },
      ]
    );
  };

  const handlePayNow = (booking: any) => {
    // Open Khalti Payment Modal
    setPaymentBooking(booking);
    setPaymentModalVisible(true);
  };

  const handleEsewaPay = (booking: any) => {
    // Open eSewa Payment Modal
    setPaymentBooking(booking);
    setEsewaModalVisible(true);
  };

  const handlePaymentSuccess = () => {
    setPaymentModalVisible(false);
    setEsewaModalVisible(false);
    fetchBookings(); // Refresh to show PAID status
    Alert.alert("Success", "Payment confirmed! Your booking is now secured.");
  };

  const handleAddInventorySuccess = () => {
    setAddInventoryModalVisible(false);
    setInventoryUnits("");
    setInventoryBloodType("AB+");
  };

  // ... existing code ...

  const getQuickActions = (): QuickAction[] => {
    switch (userType) {
      case "gainer":
        return [
          { icon: "search", label: "Find Donors", route: "/search", color: "#D11B31" },
          { icon: "location", label: "Nearby", route: "/nearby", color: "#E63946" },
          { icon: "calendar", label: "Requests", route: "/requests", color: "#F77F00" },
          { icon: "medical", label: "Emergency", route: "/emergency", color: "#DC2626" },
        ];
      case "donor":
        return [
          { icon: "donation", label: "Donate", route: "/donate", color: "#D11B31" },
          { icon: "schedule", label: "Schedule", route: "/schedule", color: "#F77F00" },
          { icon: "history", label: "History", route: "/history", color: "#6366F1" },
          { icon: "camp", label: "Camp", route: "/campaign", color: "#10B981" },
        ];
      case "organization":
        return [
          { icon: "add-inventory", label: "Add", route: "/add-blood", color: "#D11B31" },
          { icon: "donation", label: "Requests", route: "/schedule", color: "#F77F00" },
          { icon: "appointments", label: "Appointment", route: "/bookings", color: "#6366F1" },
          { icon: "payment", label: "Payments", route: "/payments", color: "#10B981" },
          { icon: "camp", label: "Camp", route: "/campaign", color: "#10B981" },
        ];
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const getWelcomeMessage = () => {
    switch (userType) {
      case "gainer": return "Find donors and manage your blood requests";
      case "donor": return "Your next donation can save a life";
      case "organization": return "Manage inventory and coordinate donations";
    }
  };

  const handleBannerMomentum = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / bannerWidth);
    setBannerIndex(newIndex);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.push("/profile")} activeOpacity={0.8}>
          <ImageBackground
            source={require("../../assets/images/background.png")}
            style={styles.header}
            imageStyle={styles.headerImage}
          >
            <View style={styles.headerOverlay} />
            <View style={styles.headerContent}>
              <View style={styles.headerTop}>
                <View>
                  <Text style={styles.greeting}>{getGreeting()}!</Text>
                  <Text style={styles.userName}>{userName}</Text>
                </View>
                <TouchableOpacity
                  style={styles.notificationIconButton}
                  onPress={() => {
                    setUnreadNotifications(0);
                    router.push("/notifications");
                  }}
                >
                  <View style={styles.iconContainer}>
                    <Ionicons name="notifications-outline" size={moderateScale(24)} color="#FFFFFF" />
                    {unreadNotifications > 0 && (
                      <View style={styles.badgeContainer}>
                        <Text style={styles.badgeText}>{unreadNotifications}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
              <Text style={styles.welcomeMessage}>{getWelcomeMessage()}</Text>

              {userType !== "gainer" ? (
                <View style={styles.headerStatsRow}>
                  <View style={styles.headerStatItem}>
                    <Text style={styles.headerStatValue}>
                      {userType === "donor" ? "3" : "245"}
                    </Text>
                    <Text style={styles.headerStatLabel}>
                      {userType === "donor" ? "Donations" : "Units"}
                    </Text>
                  </View>
                  <View style={styles.headerStatDivider} />
                  <View style={styles.headerStatItem}>
                    <Text style={styles.headerStatValue}>A+</Text>
                    <Text style={styles.headerStatLabel}>My Blood</Text>
                  </View>
                  <View style={styles.headerStatDivider} />
                  <View style={styles.headerStatItem}>
                    <Text style={styles.headerStatValue}>
                      {userType === "donor" ? "45" : "15"}
                    </Text>
                    <Text style={styles.headerStatLabel}>
                      {userType === "donor" ? "Days Left" : "Today"}
                    </Text>
                  </View>
                </View>
              ) : (
                <Animated.View style={[styles.gainerHeaderPromo, { opacity: fadeAnim, transform: [{ scale: slideAnim }] }]}>
                  <View style={styles.avatarGroup}>
                    {mockBubbles.slice(0, 4).map((bubble, index) => (
                      <Animated.View
                        key={bubble.id}
                        style={[
                          styles.avatarCircle,
                          {
                            backgroundColor: bubble.color,
                            zIndex: 10 - index,
                            marginLeft: index === 0 ? 0 : -scale(15),
                            opacity: staggeredAnims[index],
                            transform: [
                              { scale: staggeredAnims[index] },
                              {
                                translateX: staggeredAnims[index].interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [20, 0]
                                })
                              }
                            ]
                          }
                        ]}
                      >
                        <Text style={styles.avatarText}>{bubble.initials}</Text>
                      </Animated.View>
                    ))}
                    <Animated.View
                      style={[
                        styles.avatarCircle,
                        styles.moreCircle,
                        {
                          zIndex: 0,
                          marginLeft: -scale(15),
                          opacity: staggeredAnims[4],
                          transform: [{ scale: staggeredAnims[4] }]
                        }
                      ]}
                    >
                      <Text style={styles.avatarText}>+42</Text>
                    </Animated.View>
                  </View>
                  <View style={styles.activeInfoContainer}>
                    <Text style={styles.activeDonorsTitle}>42 Active Donors</Text>
                    <Text style={styles.activeDonorsSub}>Ready to help in your current location</Text>
                  </View>
                </Animated.View>
              )}
            </View>
          </ImageBackground>
        </TouchableOpacity>

        {/* Banner Section */}
        <View style={styles.section}>
          <View style={styles.bannerContainer}>
            <ScrollView
              ref={bannerScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleBannerMomentum}
              style={[styles.bannerSlider, { width: bannerWidth }]}
            >
              {activeCampaigns.length > 0 ? (
                activeCampaigns.map((campaign, index) => (
                  <TouchableOpacity
                    key={campaign.id || index}
                    style={[styles.bannerSlide, { width: bannerWidth }]}
                    activeOpacity={0.9}
                    onPress={() => router.push("/campaign")}
                  >
                    <Image
                      source={{ uri: campaign.posterUrl }}
                      style={styles.bannerImage}
                      resizeMode="cover"
                    />
                    <View style={styles.campaignOverlay}>
                      <Text style={styles.campaignTitle} numberOfLines={1}>{campaign.title}</Text>
                      <Text style={styles.campaignOrg} numberOfLines={1}>{campaign.organizationName}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                bannerImages.map((source, index) => (
                  <View key={index} style={[styles.bannerSlide, { width: bannerWidth }]}>
                    <Image source={source} style={styles.bannerImage} resizeMode="cover" />
                  </View>
                ))
              )}
            </ScrollView>
            <View style={styles.bannerDots}>
              {(activeCampaigns.length > 0 ? activeCampaigns : bannerImages).map((_, idx) => (
                <View key={idx} style={[styles.bannerDot, idx === bannerIndex && styles.bannerDotActive]} />
              ))}
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        {userType !== "gainer" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActionsContainer}>
              <View style={styles.quickActionsGrid}>
                {getQuickActions().map((action, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.quickActionItem}
                    activeOpacity={0.85}
                    onPress={() => {
                      if (userType === "organization" && action.icon === "add-inventory") {
                        setAddInventoryModalVisible(true);
                        return;
                      }
                      if (userType === "donor" && (action.icon === "donation" || action.label === "Donate")) {
                        setDonationModalVisible(true);
                        return;
                      }
                      if (userType === "organization" && (action.icon === "appointments" || action.label === "Appointment")) {
                        setAppointmentsModalVisible(true);
                        return;
                      }
                      if (action.label === "Payments") {
                        setReceivedPaymentsModalVisible(true);
                        return;
                      }
                      router.push(action.route as any);
                    }}
                  >
                    <View style={styles.quickActionIcon}>
                      {action.icon === "donation" ? (
                        <DonationSvg width={moderateScale(30)} height={moderateScale(30)} />
                      ) : action.icon === "schedule" ? (
                        <ScheduleSvg width={moderateScale(30)} height={moderateScale(30)} />
                      ) : action.icon === "history" ? (
                        <HistorySvg width={moderateScale(30)} height={moderateScale(30)} />
                      ) : action.icon === "camp" ? (
                        <CampSvg width={moderateScale(30)} height={moderateScale(30)} />
                      ) : action.icon === "add-inventory" ? (
                        <AddInventorySvg width={moderateScale(30)} height={moderateScale(30)} />
                      ) : action.icon === "appointments" ? (
                        <AppointmentsSvg width={moderateScale(30)} height={moderateScale(30)} />
                      ) : action.icon === "payment" ? (
                        <PaymentSvg width={moderateScale(30)} height={moderateScale(30)} />
                      ) : (
                        <Ionicons name={action.icon as any} size={moderateScale(28)} color={action.color} />
                      )}
                    </View>
                    <Text style={styles.quickActionLabel} numberOfLines={2}>{action.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Appreciation Quote */}
        {userType === "donor" && (
          <View style={styles.quoteSection}>
            <View style={styles.quoteCard}>
              <Text style={styles.quoteText}>
                "Let’s take a moment to appreciate you — because your kindness saves lives."
              </Text>
            </View>
          </View>
        )}

        {/* Viral Bubbles Animation for Gainer Removed and Integrated Into Header */}

        {/* My Bookings Section */}
        {userType === "gainer" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Bookings</Text>
            {loadingBookings ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.activityTime}>Loading bookings...</Text>
              </View>
            ) : bookings.length > 0 ? (
              <View style={styles.bookingsList}>
                {bookings.slice(0, 2).map((booking, index) => (
                  <View key={`${booking.type}-${booking.requestId}` || index} style={styles.bookingCard}>
                    <View style={styles.bookingCardHeader}>
                      <View style={styles.bloodBadge}>
                        <Text style={styles.bloodBadgeText}>{booking.bloodType}</Text>
                      </View>
                      <View style={styles.bookingInfo}>
                        <Text style={styles.orgNameLabel}>{booking.userName || "Hospital/Bank"}</Text>
                        <Text style={styles.bookingDate}>
                          {new Date(booking.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={[
                        styles.statusBadge,
                        { backgroundColor: booking.status === 'approved' ? '#ECFDF5' : booking.status === 'rejected' ? '#FEF2F2' : '#FFFBEB' }
                      ]}>
                        <Text style={[
                          styles.statusText,
                          { color: booking.status === 'approved' ? '#059669' : booking.status === 'rejected' ? '#DC2626' : '#D97706' }
                        ]}>
                          {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.bookingCardFooter}>
                      <Text style={styles.unitsCount}>{booking.units} Units Requested</Text>
                      {booking.status === 'pending' && (
                        <TouchableOpacity
                          style={styles.cancelButton}
                          onPress={() => handleCancelBooking(booking.requestId)}
                        >
                          <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                      )}
                      {booking.status === 'approved' && (
                        <View style={styles.paymentActions}>
                          <TouchableOpacity
                            style={[styles.payButton]}
                            onPress={() => handlePayNow(booking)}
                          >
                            <Image
                              source={require('../../assets/images/khalti-logo.png')}
                              style={styles.khaltiLogo}
                            />
                            <Text style={[styles.payButtonText]}>
                              {booking.paymentStatus === 'Paid' ? 'Paid' : 'Pay Now'}
                            </Text>
                          </TouchableOpacity>

                          {booking.paymentStatus !== 'Paid' && (
                            <TouchableOpacity
                              style={[styles.esewaButton]}
                              onPress={() => handleEsewaPay(booking)}
                            >
                              <Image
                                source={require('../../assets/images/esewa-logo.png')}
                                style={styles.esewaLogo}
                              />
                              <Text style={[styles.esewaButtonText]}>Pay Now</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                ))}
                {bookings.length > 2 && (
                  <TouchableOpacity
                    style={styles.viewMoreButton}
                    onPress={() => router.push("/bookings")}
                  >
                    <Text style={styles.viewMoreText}>View More</Text>
                    <Ionicons name="chevron-forward" size={moderateScale(16)} color="#D11B31" />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.activityCard}>
                <Text style={styles.emptyText}>You haven't made any blood bookings yet.</Text>
              </View>
            )}
          </View>
        )}

        <AddInventoryModal
          visible={addInventoryModalVisible}
          onClose={() => setAddInventoryModalVisible(false)}
          onSuccess={handleAddInventorySuccess}
          bloodType={inventoryBloodType}
          setBloodType={setInventoryBloodType}
          units={inventoryUnits}
          setUnits={setInventoryUnits}
          bloodTypes={BLOOD_TYPES}
        />

        <QuickDonationModal
          visible={donationModalVisible}
          onClose={() => setDonationModalVisible(false)}
          donorBloodType={donorBloodType}
        />

        <AppointmentsModal
          visible={appointmentsModalVisible}
          onClose={() => setAppointmentsModalVisible(false)}
          bookings={bookings}
          onPay={handlePayNow}
        />

        <KhaltiPaymentModal
          visible={paymentModalVisible}
          onClose={() => setPaymentModalVisible(false)}
          onSuccess={handlePaymentSuccess}
          requestId={paymentBooking?.requestId}
          amount={1000} // Hardcoded 1000 NPR
          productName={`Blood Request #${paymentBooking?.requestId}`}
        />

        <EsewaPaymentModal
          visible={esewaModalVisible}
          onClose={() => setEsewaModalVisible(false)}
          onSuccess={handlePaymentSuccess}
          requestId={paymentBooking?.requestId}
          amount={1000}
        />

        <ReceivedPaymentsModal
          visible={receivedPaymentsModalVisible}
          onClose={() => setReceivedPaymentsModalVisible(false)}
        />
        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Navigation userType={userType} initialTab="home" />
    </View>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(60),
    paddingBottom: verticalScale(30),
    overflow: "hidden",
  },
  headerImage: {
    borderBottomLeftRadius: moderateScale(30),
    borderBottomRightRadius: moderateScale(30),
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(209, 27, 49, 0.75)",
    borderBottomLeftRadius: moderateScale(30),
    borderBottomRightRadius: moderateScale(30),
  },
  headerContent: {
    zIndex: 1,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: verticalScale(10),
  },
  greeting: {
    fontSize: moderateScale(16),
    color: "#FEE2E2",
    fontWeight: "500",
  },
  userName: {
    fontSize: moderateScale(24),
    color: "#FFFFFF",
    fontWeight: "700",
    marginTop: verticalScale(4),
  },
  notificationIconButton: {
    padding: scale(8),
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: moderateScale(12),
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  iconContainer: {
    position: "relative",
  },
  badgeContainer: {
    position: "absolute",
    top: -scale(2),
    right: -scale(2),
    backgroundColor: "#FF3B30",
    borderRadius: moderateScale(10),
    minWidth: scale(18),
    height: scale(18),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: moderateScale(10),
    fontWeight: "800",
    lineHeight: scale(14),
  },
  welcomeMessage: {
    fontSize: moderateScale(14),
    color: "#FEE2E2",
    marginTop: verticalScale(8),
    marginBottom: verticalScale(20),
  },
  headerStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: verticalScale(8),
  },
  headerStatItem: {
    flex: 1,
    alignItems: "center",
  },
  headerStatValue: {
    fontSize: moderateScale(20),
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: verticalScale(2),
  },
  headerStatLabel: {
    fontSize: moderateScale(11),
    color: "#FEE2E2",
    fontWeight: "500",
  },
  headerStatDivider: {
    width: 1,
    height: verticalScale(30),
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    marginHorizontal: scale(8),
  },
  section: {
    marginTop: verticalScale(24),
    paddingHorizontal: scale(20),
  },
  sectionTitle: {
    fontSize: moderateScale(18),
    fontWeight: "700",
    color: "#111827",
    marginBottom: verticalScale(12),
  },
  bannerContainer: {
    alignItems: "center",
  },
  bannerSlider: {
    borderRadius: moderateScale(18),
    overflow: "hidden",
  },
  bannerSlide: {
    height: verticalScale(170),
    borderRadius: moderateScale(20),
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  bannerDots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: scale(8),
    marginTop: verticalScale(10),
  },
  bannerDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: moderateScale(4),
    backgroundColor: "#D1D5DB",
  },
  bannerDotActive: {
    width: scale(18),
    backgroundColor: "#D11B31",
  },
  campaignOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: scale(10),
  },
  campaignTitle: {
    color: '#FFFFFF',
    fontSize: moderateScale(14),
    fontWeight: '700',
  },
  campaignOrg: {
    color: '#E5E7EB',
    fontSize: moderateScale(12),
    fontWeight: '500',
  },
  quickActionsContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(22),
    padding: scale(16),
    borderWidth: 1,
    borderColor: "#FEE2E2",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: verticalScale(18),
  },
  quickActionItem: {
    alignItems: "center",
    justifyContent: "center",
    width: "25%",
    paddingVertical: verticalScale(10),
  },
  quickActionIcon: {
    width: moderateScale(52),
    height: moderateScale(52),
    borderRadius: moderateScale(18),
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: verticalScale(8),
  },
  quickActionLabel: {
    fontSize: moderateScale(12),
    fontWeight: "600",
    color: "#111827",
    lineHeight: moderateScale(16),
    textAlign: "center",
    width: "100%",
  },
  gainerHeaderPromo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: scale(12),
    borderRadius: moderateScale(20),
    marginTop: verticalScale(10),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: moderateScale(34),
    height: moderateScale(34),
    borderRadius: moderateScale(17),
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  moreCircle: {
    backgroundColor: '#374151',
  },
  avatarText: {
    color: '#FFF',
    fontSize: moderateScale(10),
    fontWeight: '800',
  },
  activeInfoContainer: {
    marginLeft: scale(12),
    flex: 1,
  },
  activeDonorsTitle: {
    color: '#FFF',
    fontSize: moderateScale(14),
    fontWeight: '700',
  },
  activeDonorsSub: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: moderateScale(10),
    marginTop: verticalScale(1),
  },
  loadingContainer: {
    padding: verticalScale(40),
    alignItems: "center",
    justifyContent: "center",
  },
  activityTime: {
    fontSize: moderateScale(12),
    color: "#9CA3AF",
    marginTop: verticalScale(2),
  },
  bookingsList: {
    gap: verticalScale(16),
    marginTop: verticalScale(8),
  },
  bookingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(20),
    padding: scale(16),
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  bookingCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(12),
    marginBottom: verticalScale(14),
  },
  bloodBadge: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(12),
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  bloodBadgeText: {
    fontSize: moderateScale(18),
    fontWeight: "800",
    color: "#D11B31",
  },
  bookingInfo: {
    flex: 1,
  },
  orgNameLabel: {
    fontSize: moderateScale(15),
    fontWeight: "700",
    color: "#111827",
    marginBottom: verticalScale(2),
  },
  bookingDate: {
    fontSize: moderateScale(12),
    color: "#6B7280",
    fontWeight: "500",
  },
  statusBadge: {
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(12),
  },
  statusText: {
    fontSize: moderateScale(12),
    fontWeight: "600",
  },
  bookingCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: verticalScale(12),
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  unitsCount: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: "#4B5563",
  },
  cancelButton: {
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(6),
    borderRadius: moderateScale(12),
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  cancelButtonText: {
    fontSize: moderateScale(13),
    fontWeight: "700",
    color: "#DC2626",
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(12),
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#D32F2F",
    gap: 8,
    minWidth: scale(150),
    justifyContent: 'center',
  },
  khaltiLogo: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  payButtonText: {
    fontSize: moderateScale(13),
    fontWeight: "700",
    color: "#D32F2F",
  },
  esewaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(12),
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#41A124",
    gap: 8,
    minWidth: scale(150),
    justifyContent: 'center',
  },
  esewaLogo: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  esewaButtonText: {
    fontSize: moderateScale(13),
    fontWeight: "700",
    color: "#41A124",
  },
  paymentActions: {
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-end',
  },
  activityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(16),
    padding: scale(16),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyText: {
    fontSize: moderateScale(14),
    color: "#9CA3AF",
    textAlign: "center",
  },
  quoteSection: {
    marginTop: verticalScale(24),
    paddingHorizontal: scale(20),
  },
  quoteCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: moderateScale(22),
    padding: scale(20),
    paddingRight: scale(85), // Space for Emergency FAB to prevent overlap
    borderWidth: 1,
    borderColor: "#FEE2E2",
    borderStyle: "dashed",
    justifyContent: "center",
  },
  quoteText: {
    fontSize: moderateScale(15),
    color: "#4B5563",
    fontWeight: "600",
    fontStyle: "italic",
    lineHeight: moderateScale(22),
  },
  bottomSpacer: {
    height: verticalScale(100),
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: verticalScale(12),
    paddingVertical: verticalScale(8),
  },
  viewMoreText: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: "#D11B31",
    marginRight: scale(4),
  },
});
