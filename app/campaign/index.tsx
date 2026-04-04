import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
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
} from "react-native";
import Navigation from "../../components/Navigation";
import { API_ENDPOINTS } from "../../config/api";
import { getUserFriendlyError } from "../../utils/errorMessages";
import { moderateScale, scale, verticalScale } from "../../utils/responsive";
import { getCleanImageUrl } from "../../utils/image";

interface Campaign {
  id: string;
  title: string;
  description: string;
  location: string;
  latitude?: string | number;
  longitude?: string | number;
  startDate: string;
  endDate: string;
  posterUrl: string;
  status: string;
  organizationName?: string;
  organizationLogoUrl?: string;
  organizationPhone?: string;
  organizationEmail?: string;
  collaborationNote?: string;
  collaboratingOrganizations?: Array<{
    id?: string | number;
    organizationId?: string | number;
    name?: string;
    organizationName?: string;
  }>;
}

interface CampaignInvitation {
  invitationId: number;
  status: string;
  message?: string;
  invitedAt: string;
  respondedAt?: string;
  campaign: {
    id: string;
    title: string;
    description?: string;
    location: string;
    startDate: string;
    endDate: string;
    organizationName?: string;
  };
  invitedByOrganization?: {
    id?: number;
    name?: string;
  };
}

export default function CampaignListScreen() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignInvitations, setCampaignInvitations] = useState<
    CampaignInvitation[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [respondingInvitationId, setRespondingInvitationId] = useState<
    number | null
  >(null);
  const [userRole, setUserRole] = useState("donor");
  const [activeTab, setActiveTab] = useState<"current" | "previous">("current");

  useFocusEffect(
    useCallback(() => {
      checkUserRole();
      fetchCampaigns();
    }, []),
  );

  const checkUserRole = async () => {
    const userData = await AsyncStorage.getItem("userData");
    if (userData) {
      const { role } = JSON.parse(userData);
      setUserRole(role?.toLowerCase());
    }
  };

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("authToken");
      const userData = await AsyncStorage.getItem("userData");
      let role = "donor";

      if (userData) {
        const parsed = JSON.parse(userData);
        role = parsed.role?.toLowerCase();
        setUserRole(role);
      }

      const endpoint =
        role === "organization"
          ? API_ENDPOINTS.GET_MY_CAMPAIGNS
          : API_ENDPOINTS.GET_ALL_CAMPAIGNS;

      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token || ""}`,
        },
      }).catch((err) => {
        console.log("Network request failed", err);
        return null;
      });

      if (response && response.ok) {
        const data = await response.json();
        setCampaigns(data.campaigns || []);
      } else {
        console.log("Failed to fetch campaigns");
        if (campaigns.length === 0) setCampaigns([]);
      }

      if (role === "organization") {
        const invitationResponse = await fetch(
          API_ENDPOINTS.GET_CAMPAIGN_INVITATIONS,
          {
            headers: {
              Authorization: `Bearer ${token || ""}`,
            },
          },
        ).catch((err) => {
          console.log("Invitation request failed", err);
          return null;
        });

        if (invitationResponse && invitationResponse.ok) {
          const invitationData = await invitationResponse.json();
          const invitations = Array.isArray(invitationData?.invitations)
            ? invitationData.invitations
            : [];
          setCampaignInvitations(invitations);
        } else {
          setCampaignInvitations([]);
        }
      } else {
        setCampaignInvitations([]);
      }
    } catch (error) {
      console.log("Fetch campaigns error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      "Delete Campaign",
      "Are you sure you want to delete this campaign?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem("authToken");
              const response = await fetch(API_ENDPOINTS.DELETE_CAMPAIGN(id), {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              });

              if (response.ok) {
                setCampaigns((prev) => prev.filter((c) => c.id !== id));
                Alert.alert("Success", "Campaign deleted");
              } else {
                Alert.alert("Error", "Failed to delete campaign");
              }
            } catch (error) {
              Alert.alert("Error", "Something went wrong");
            }
          },
        },
      ],
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchCampaigns();
  };

  const handleInvitationResponse = async (
    invitationId: number,
    decision: "accept" | "reject",
  ) => {
    try {
      setRespondingInvitationId(invitationId);
      const token = await AsyncStorage.getItem("authToken");
      const response = await fetch(
        API_ENDPOINTS.RESPOND_CAMPAIGN_INVITATION(invitationId),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token || ""}`,
          },
          body: JSON.stringify({ action: decision }),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || "Failed to respond to invitation");
      }

      Alert.alert(
        "Success",
        decision === "accept"
          ? "Collaboration request accepted."
          : "Collaboration request rejected.",
      );

      fetchCampaigns();
    } catch (error: any) {
      Alert.alert(
        "Request failed",
        getUserFriendlyError(error, "Something went wrong"),
      );
    } finally {
      setRespondingInvitationId(null);
    }
  };

  const getCollaborators = (campaign: Campaign) => {
    const fromCampaign = campaign.collaboratingOrganizations;
    const fromAny =
      (campaign as any).collaborators ||
      (campaign as any).collaborativeOrganizations;
    const rawList = Array.isArray(fromCampaign)
      ? fromCampaign
      : Array.isArray(fromAny)
        ? fromAny
        : [];

    return rawList
      .map((org: any) => ({
        id: String(org?.organizationId || org?.id || ""),
        name: org?.organizationName || org?.name || "",
      }))
      .filter((org: { id: string; name: string }) => org.id || org.name);
  };

  const renderItem = ({ item }: { item: Campaign }) => {
    const collaboratorOrganizations = getCollaborators(item);
    const collaboratorIds = collaboratorOrganizations
      .map((org) => org.id)
      .filter(Boolean);
    const collaboratorNames = collaboratorOrganizations
      .map((org) => org.name)
      .filter(Boolean);
    const organizationNamesForQr = [
      item.organizationName,
      ...collaboratorNames,
    ].filter(Boolean);

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() =>
          router.push({
            pathname: "/campaign/[id]",
            params: {
              id: item.id,
              title: item.title,
              description: item.description,
              location: item.location,
              latitude: item.latitude as string | undefined,
              longitude: item.longitude as string | undefined,
              startDate: item.startDate,
              endDate: item.endDate,
              posterUrl: item.posterUrl,
              organizationName: item.organizationName,
              organizationLogoUrl: item.organizationLogoUrl,
              organizationPhone: item.organizationPhone,
              organizationEmail: item.organizationEmail,
              collaboratorOrganizationNames: JSON.stringify(collaboratorNames),
              collaborationNote: item.collaborationNote || "",
            },
          })
        }
      >
        <Image
          source={{
            uri: getCleanImageUrl(item.posterUrl) || "https://placehold.co/600x400/png?text=Campaign",
          }}
          style={styles.cardImage}
        />
        {new Date(item.endDate) < new Date() ? (
          <View style={styles.completedBadge}>
            <Text style={styles.completedBadgeText}>Completed</Text>
          </View>
        ) : (
          <View style={[styles.completedBadge, styles.activeBadge]}>
            <Text style={styles.completedBadgeText}>Live</Text>
          </View>
        )}
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {item.organizationName && userRole !== "organization" && (
                <Text style={styles.orgName}>by {item.organizationName}</Text>
              )}
            </View>
            {userRole === "organization" && (
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    router.push({
                      pathname: "/campaign/create",
                      params: {
                        id: item.id,
                        title: item.title,
                        description: item.description,
                        location: item.location,
                        latitude: item.latitude as string | undefined, // from updated backend schema
                        longitude: item.longitude as string | undefined,
                        startDate: item.startDate,
                        endDate: item.endDate,
                        posterUrl: item.posterUrl,
                        collaboratorOrganizationIds:
                          JSON.stringify(collaboratorIds),
                        collaborationNote: item.collaborationNote || "",
                      },
                    });
                  }}
                >
                  <Ionicons name="create-outline" size={20} color="#3B82F6" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDelete(item.id);
                  }}
                >
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
                {new Date(item.startDate).toLocaleDateString()}{" "}
                {new Date(item.startDate).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                - {new Date(item.endDate).toLocaleDateString()}{" "}
                {new Date(item.endDate).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </Text>
          </View>

          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>

          {collaboratorNames.length > 0 && (
            <View style={styles.collaborativeInfoRow}>
              <Ionicons
                name="people-circle-outline"
                size={16}
                color="#7C3AED"
              />
              <Text style={styles.collaborativeInfoText} numberOfLines={1}>
                Collaborative with {collaboratorNames.join(", ")}
              </Text>
            </View>
          )}

          {userRole === "organization" && (
            <View style={styles.orgActions}>
              <TouchableOpacity
                style={[styles.orgActionBtn, styles.qrBtn]}
                onPress={(e) => {
                  e.stopPropagation();
                  router.push({
                    pathname: "/campaign/qr/[id]",
                    params: {
                      id: item.id,
                      title: item.title,
                      location: item.location,
                      orgName: item.organizationName,
                      organizationNames: JSON.stringify(organizationNamesForQr),
                    },
                  });
                }}
              >
                <Ionicons name="qr-code" size={16} color="#FFF" />
                <Text style={styles.orgActionBtnText}>View QR</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.orgActionBtn, styles.attendeesBtn]}
                onPress={(e) => {
                  e.stopPropagation();
                  router.push({
                    pathname: "/campaign/attendees/[id]",
                    params: {
                      id: item.id,
                      title: item.title,
                      organizationName: item.organizationName || "",
                      collaborationPartners: JSON.stringify(collaboratorNames),
                    },
                  });
                }}
              >
                <Ionicons name="people" size={16} color="#FFF" />
                <Text style={styles.orgActionBtnText}>Attendees</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="calendar-outline" size={64} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>No Campaigns Found</Text>
      <Text style={styles.emptySubtitle}>
        {userRole === "organization"
          ? "Create a campaign to reach more donors!"
          : "Check back later for upcoming donation camps."}
      </Text>
    </View>
  );

  const renderSectionHeader = ({
    section: { title },
  }: {
    section: { title: string };
  }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
      <View style={styles.sectionHeaderLine} />
    </View>
  );

  const renderPendingInvitations = () => {
    const pendingInvitations = campaignInvitations.filter(
      (invitation) =>
        String(invitation.status || "").toLowerCase() === "pending",
    );

    if (userRole !== "organization" || activeTab !== "current") {
      return null;
    }

    if (pendingInvitations.length === 0) {
      return null;
    }

    return (
      <View style={styles.invitesSection}>
        <Text style={styles.invitesSectionTitle}>Collaboration Requests</Text>
        {pendingInvitations.map((invitation) => {
          const isResponding =
            respondingInvitationId === invitation.invitationId;

          return (
            <View
              key={String(invitation.invitationId)}
              style={styles.inviteCard}
            >
              <View style={styles.inviteHeaderRow}>
                <Text style={styles.inviteTitle} numberOfLines={1}>
                  {invitation.campaign?.title || "Campaign Request"}
                </Text>
                <View style={styles.invitePendingBadge}>
                  <Text style={styles.invitePendingBadgeText}>Pending</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="business-outline" size={15} color="#6B7280" />
                <Text style={styles.infoText} numberOfLines={1}>
                  From{" "}
                  {invitation.invitedByOrganization?.name ||
                    invitation.campaign?.organizationName ||
                    "Organization"}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={15} color="#6B7280" />
                <Text style={styles.infoText} numberOfLines={1}>
                  {invitation.campaign?.location || "Location not specified"}
                </Text>
              </View>

              {invitation.message ? (
                <Text style={styles.inviteMessage} numberOfLines={2}>
                  {invitation.message}
                </Text>
              ) : null}

              <View style={styles.inviteActionsRow}>
                <TouchableOpacity
                  style={[styles.inviteActionBtn, styles.rejectBtn]}
                  disabled={isResponding}
                  onPress={() =>
                    handleInvitationResponse(invitation.invitationId, "reject")
                  }
                >
                  {isResponding ? (
                    <ActivityIndicator size="small" color="#B91C1C" />
                  ) : (
                    <Text style={styles.rejectBtnText}>Reject</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.inviteActionBtn, styles.acceptBtn]}
                  disabled={isResponding}
                  onPress={() =>
                    handleInvitationResponse(invitation.invitationId, "accept")
                  }
                >
                  {isResponding ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.acceptBtnText}>Accept</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const now = new Date();
  const activeCampaigns = campaigns.filter((c) => new Date(c.endDate) >= now);
  const previousCampaigns = campaigns.filter((c) => new Date(c.endDate) < now);
  const filteredCampaigns =
    activeTab === "current" ? activeCampaigns : previousCampaigns;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[
              styles.backButton,
              { marginLeft: -4, padding: 4, marginRight: scale(8) },
            ]}
          >
            <Ionicons name="chevron-back" size={28} color="#D11B31" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Campaigns</Text>
            <Text style={styles.subtitle}>
              Active blood donation events near you
            </Text>
          </View>
        </View>
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: scale(8) }}
        >
          {userRole !== "organization" && (
            <TouchableOpacity
              style={styles.scanHeaderBtn}
              onPress={() => router.push("/campaign/scan")}
            >
              <Ionicons name="qr-code-outline" size={20} color="#D11B31" />
              <Text style={styles.scanHeaderBtnText}>Scan</Text>
            </TouchableOpacity>
          )}
          {userRole === "organization" && (
            <TouchableOpacity
              style={styles.orgCreateBtn}
              onPress={() => router.push("/campaign/create")}
            >
              <Ionicons name="add" size={moderateScale(28)} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.categoryToggleWrapper}>
        <View style={styles.categoryToggleContainer}>
          <TouchableOpacity
            style={[
              styles.categoryTab,
              activeTab === "current" && styles.activeCategoryTab,
            ]}
            onPress={() => setActiveTab("current")}
          >
            <Text
              style={[
                styles.categoryTabText,
                activeTab === "current" && styles.activeCategoryTabText,
              ]}
            >
              Current
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.categoryTab,
              activeTab === "previous" && styles.activeCategoryTab,
            ]}
            onPress={() => setActiveTab("previous")}
          >
            <Text
              style={[
                styles.categoryTabText,
                activeTab === "previous" && styles.activeCategoryTabText,
              ]}
            >
              Previous
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#D11B31" />
        </View>
      ) : (
        <FlatList
          data={filteredCampaigns}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#D11B31"]}
            />
          }
          ListHeaderComponent={renderPendingInvitations}
          ListEmptyComponent={renderEmpty}
        />
      )}

      <Navigation userType={(userRole as any) || "donor"} initialTab="chat" />
    </View>
  );
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
    fontSize: moderateScale(20),
    fontWeight: "800",
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
  collaborativeInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    marginTop: verticalScale(10),
    backgroundColor: "#F5F3FF",
    borderRadius: moderateScale(8),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(6),
  },
  collaborativeInfoText: {
    flex: 1,
    fontSize: moderateScale(12),
    color: "#5B21B6",
    fontWeight: "600",
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
  scanHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(6),
    borderRadius: moderateScale(10),
    borderWidth: 1,
    borderColor: "#D11B31",
    gap: scale(4),
  },
  scanHeaderBtnText: {
    fontSize: moderateScale(13),
    fontWeight: "700",
    color: "#D11B31",
  },
  orgCreateBtn: {
    backgroundColor: "#D11B31",
    borderRadius: moderateScale(26),
    width: moderateScale(50),
    height: moderateScale(50),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: moderateScale(2) },
    shadowOpacity: 0.1,
    shadowRadius: moderateScale(4),
    elevation: 3,
  },
  orgActions: {
    flexDirection: "row",
    gap: scale(8),
    marginTop: verticalScale(16),
    paddingTop: verticalScale(12),
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  orgActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(6),
    paddingVertical: verticalScale(10),
    borderRadius: moderateScale(10),
  },
  qrBtn: {
    backgroundColor: "#D11B31",
  },
  attendeesBtn: {
    backgroundColor: "#F87171",
  },
  orgActionBtnText: {
    color: "#FFF",
    fontSize: moderateScale(12),
    fontWeight: "700",
  },
  sectionHeader: {
    marginTop: verticalScale(24),
    marginBottom: verticalScale(16),
    paddingHorizontal: scale(4),
  },
  sectionHeaderTitle: {
    fontSize: moderateScale(20),
    fontWeight: "800",
    color: "#111827",
    marginBottom: verticalScale(6),
  },
  sectionHeaderLine: {
    height: 3,
    width: scale(40),
    backgroundColor: "#D11B31",
    borderRadius: 2,
  },
  invitesSection: {
    marginBottom: verticalScale(14),
  },
  invitesSectionTitle: {
    fontSize: moderateScale(16),
    fontWeight: "800",
    color: "#111827",
    marginBottom: verticalScale(10),
  },
  inviteCard: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    borderRadius: moderateScale(12),
    padding: scale(12),
    marginBottom: verticalScale(10),
  },
  inviteHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: scale(8),
    marginBottom: verticalScale(8),
  },
  inviteTitle: {
    flex: 1,
    fontSize: moderateScale(15),
    fontWeight: "700",
    color: "#7C2D12",
  },
  invitePendingBadge: {
    backgroundColor: "#FDBA74",
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(999),
  },
  invitePendingBadgeText: {
    fontSize: moderateScale(10),
    fontWeight: "700",
    color: "#7C2D12",
    textTransform: "uppercase",
  },
  inviteMessage: {
    marginTop: verticalScale(8),
    marginBottom: verticalScale(10),
    fontSize: moderateScale(13),
    color: "#9A3412",
    lineHeight: verticalScale(18),
  },
  inviteActionsRow: {
    flexDirection: "row",
    gap: scale(8),
    marginTop: verticalScale(8),
  },
  inviteActionBtn: {
    flex: 1,
    borderRadius: moderateScale(9),
    paddingVertical: verticalScale(9),
    alignItems: "center",
    justifyContent: "center",
  },
  rejectBtn: {
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
  },
  acceptBtn: {
    backgroundColor: "#15803D",
  },
  rejectBtnText: {
    color: "#B91C1C",
    fontWeight: "700",
    fontSize: moderateScale(12),
  },
  acceptBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: moderateScale(12),
  },
  categoryToggleWrapper: {
    paddingHorizontal: scale(16),
    backgroundColor: "#FFF",
    paddingBottom: verticalScale(12),
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  categoryToggleContainer: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: moderateScale(12),
    padding: scale(4),
  },
  categoryTab: {
    flex: 1,
    paddingVertical: verticalScale(8),
    alignItems: "center",
    borderRadius: moderateScale(8),
  },
  activeCategoryTab: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryTabText: {
    fontSize: moderateScale(14),
    fontWeight: "500",
    color: "#6B7280",
  },
  activeCategoryTabText: {
    color: "#D11B31",
    fontWeight: "600",
  },
  completedBadge: {
    position: "absolute",
    top: verticalScale(12),
    right: scale(12),
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(8),
  },
  completedBadgeText: {
    color: "#FFF",
    fontSize: moderateScale(10),
    fontWeight: "700",
    textTransform: "uppercase",
  },
  activeBadge: {
    backgroundColor: "#10B981",
  },
});
