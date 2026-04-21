import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import BannerCreationModal from "../../components/BannerCreationModal";
import CampaignCollaborateModal, {
    type CollaborateOrganization,
} from "../../components/CampaignCollaborateModal";
import LeafletMapView from "../../components/LeafletMapView";
import { API_ENDPOINTS } from "../../config/api";
import { getUserFriendlyError } from "../../utils/errorMessages";
import {
    loadExpoMapsModule,
    type AppleMapMarker,
    type GoogleMapMarker,
} from "../../utils/expoMapsRuntime";
import { getCleanImageUrl } from "../../utils/image";
import { moderateScale, scale, verticalScale } from "../../utils/responsive";

interface InviteOrganization extends CollaborateOrganization {
  userId?: string;
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

const DEFAULT_MAP_COORDINATES: Coordinates = {
  latitude: 27.7172,
  longitude: 85.324,
};

const parseCollaboratorIds = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw.map((id) => String(id)).filter(Boolean);
  }

  if (!raw || typeof raw !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((id) => String(id)).filter(Boolean);
    }
    return [];
  } catch {
    return raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }
};

export default function CreateCampaignScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const expoMapsModule = loadExpoMapsModule();
  const AppleMapsView = expoMapsModule?.AppleMaps?.View;
  const isEditing = !!params.id;
  const [loading, setLoading] = useState(false);

  // Form State
  const [title, setTitle] = useState((params.title as string) || "");
  const [description, setDescription] = useState(
    (params.description as string) || "",
  );
  const [location, setLocation] = useState((params.location as string) || "");

  const [startDate, setStartDate] = useState(
    params.startDate ? new Date(params.startDate as string) : new Date(),
  );
  const [startTime, setStartTime] = useState(
    params.startDate ? new Date(params.startDate as string) : new Date(),
  );
  const [endDate, setEndDate] = useState(
    params.endDate ? new Date(params.endDate as string) : new Date(),
  );
  const [endTime, setEndTime] = useState(
    params.endDate ? new Date(params.endDate as string) : new Date(),
  );
  const [imageUri, setImageUri] = useState<string | null>(() => {
    const rawPosterUrl =
      typeof params.posterUrl === "string" ? params.posterUrl : null;
    return getCleanImageUrl(rawPosterUrl);
  });

  // Picker visibility
  const [showStartDate, setShowStartDate] = useState(false);
  const [showStartTime, setShowStartTime] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);
  const [showEndTime, setShowEndTime] = useState(false);
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [showCollaborateModal, setShowCollaborateModal] = useState(false);
  const [showCampaignMapPicker, setShowCampaignMapPicker] = useState(false);
  const [posterSource, setPosterSource] = useState<"upload" | "create">(
    "upload",
  );
  const [inviteOrganizations, setInviteOrganizations] = useState<
    InviteOrganization[]
  >([]);
  const [selectedCollaboratorIds, setSelectedCollaboratorIds] = useState<
    string[]
  >(() => parseCollaboratorIds(params.collaboratorOrganizationIds));
  const [collaborationNote, setCollaborationNote] = useState(
    (params.collaborationNote as string) || "",
  );
  const [loadingOrganizations, setLoadingOrganizations] = useState(false);
  const [campaignCoordinates, setCampaignCoordinates] =
    useState<Coordinates | null>(null);
  const [campaignMapCenter, setCampaignMapCenter] = useState<Coordinates>(
    DEFAULT_MAP_COORDINATES,
  );
  const [isCampaignMapLoadingLocation, setIsCampaignMapLoadingLocation] =
    useState(false);
  const [campaignLocationSearchQuery, setCampaignLocationSearchQuery] =
    useState("");
  const [isCampaignSearchingLocation, setIsCampaignSearchingLocation] =
    useState(false);
  const [campaignLocationSearchError, setCampaignLocationSearchError] =
    useState<string | null>(null);

  const campaignMapRef = useRef<any>(null);
  const selectedCollaborators = inviteOrganizations.filter((organization) =>
    selectedCollaboratorIds.includes(organization.id),
  );

  const campaignMapAppleMarkers = useMemo<AppleMapMarker[]>(() => {
    if (!campaignCoordinates) {
      return [];
    }

    return [
      {
        id: "campaign-location",
        title: "Campaign Location",
        coordinates: campaignCoordinates,
        tintColor: "#D11B31",
        systemImage: "mappin.and.ellipse",
      },
    ];
  }, [campaignCoordinates]);

  const campaignMapGoogleMarkers = useMemo<GoogleMapMarker[]>(() => {
    if (!campaignCoordinates) {
      return [];
    }

    return [
      {
        id: "campaign-location",
        title: "Campaign Location",
        coordinates: campaignCoordinates,
      },
    ];
  }, [campaignCoordinates]);

  const toValidCoordinates = (value: any): Coordinates | null => {
    const latitude = Number(value?.latitude);
    const longitude = Number(value?.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return { latitude, longitude };
  };

  const moveCampaignMapCamera = (
    coordinates: Coordinates,
    zoom = 13,
    duration = 350,
  ) => {
    if (!campaignMapRef.current?.setCameraPosition) {
      return;
    }

    const nextCamera =
      Platform.OS === "android"
        ? { coordinates, zoom, duration }
        : { coordinates, zoom };

    campaignMapRef.current.setCameraPosition(nextCamera);
  };

  const openCampaignMapPicker = async () => {
    setShowCampaignMapPicker(true);
    setCampaignLocationSearchError(null);
    setCampaignLocationSearchQuery("");
    setIsCampaignMapLoadingLocation(true);

    try {
      if (campaignCoordinates) {
        setCampaignMapCenter(campaignCoordinates);
        moveCampaignMapCamera(campaignCoordinates);
        return;
      }

      if (location.trim()) {
        const geocoded = await Location.geocodeAsync(location.trim());
        if (geocoded.length > 0) {
          const nextCoordinates: Coordinates = {
            latitude: geocoded[0].latitude,
            longitude: geocoded[0].longitude,
          };
          setCampaignCoordinates(nextCoordinates);
          setCampaignMapCenter(nextCoordinates);
          moveCampaignMapCamera(nextCoordinates);
          return;
        }
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setCampaignMapCenter(DEFAULT_MAP_COORDINATES);
        return;
      }

      const current = await Location.getCurrentPositionAsync({});
      const nextCoordinates: Coordinates = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };

      setCampaignCoordinates(nextCoordinates);
      setCampaignMapCenter(nextCoordinates);
      moveCampaignMapCamera(nextCoordinates);
    } catch (error) {
      setCampaignMapCenter(DEFAULT_MAP_COORDINATES);
    } finally {
      setIsCampaignMapLoadingLocation(false);
    }
  };

  const searchCampaignMapLocation = async () => {
    const query = campaignLocationSearchQuery.trim();
    if (!query) {
      setCampaignLocationSearchError("Enter a location to search.");
      return;
    }

    try {
      setIsCampaignSearchingLocation(true);
      setCampaignLocationSearchError(null);

      const geocoded = await Location.geocodeAsync(query);
      if (geocoded.length === 0) {
        setCampaignLocationSearchError("No matching location found.");
        return;
      }

      const nextCoordinates: Coordinates = {
        latitude: geocoded[0].latitude,
        longitude: geocoded[0].longitude,
      };

      setCampaignCoordinates(nextCoordinates);
      setCampaignMapCenter(nextCoordinates);
      moveCampaignMapCamera(nextCoordinates, 15, 380);
    } catch (error) {
      setCampaignLocationSearchError("Location search failed. Try again.");
    } finally {
      setIsCampaignSearchingLocation(false);
    }
  };

  const confirmCampaignMapLocation = async () => {
    if (!campaignCoordinates) {
      return;
    }

    try {
      const reversed = await Location.reverseGeocodeAsync(campaignCoordinates);
      const first = reversed[0];

      if (first) {
        const parts = [
          first.name,
          first.street,
          first.district,
          first.city,
          first.region,
          first.country,
        ].filter(Boolean);

        if (parts.length > 0) {
          setLocation(parts.join(", "));
        } else {
          setLocation(
            `${campaignCoordinates.latitude.toFixed(6)}, ${campaignCoordinates.longitude.toFixed(6)}`,
          );
        }
      } else {
        setLocation(
          `${campaignCoordinates.latitude.toFixed(6)}, ${campaignCoordinates.longitude.toFixed(6)}`,
        );
      }
    } catch (error) {
      setLocation(
        `${campaignCoordinates.latitude.toFixed(6)}, ${campaignCoordinates.longitude.toFixed(6)}`,
      );
    }

    setShowCampaignMapPicker(false);
    setCampaignLocationSearchQuery("");
    setCampaignLocationSearchError(null);
  };

  useEffect(() => {
    loadInviteOrganizations();
  }, []);

  const loadInviteOrganizations = async () => {
    setLoadingOrganizations(true);

    try {
      const token = await AsyncStorage.getItem("authToken");
      const userData = await AsyncStorage.getItem("userData");
      let myOrgId = "";

      if (userData) {
        const parsed = JSON.parse(userData);
        myOrgId = String(parsed.organizationId || parsed.OrganizationId || "");
      }

      let myUserId = "";
      let myOrgName = "";

      if (userData) {
        const parsed = JSON.parse(userData);
        myUserId = String(parsed.userId || parsed.UserId || parsed.id || "");
        myOrgName = String(
          parsed.organizationName || parsed.OrganizationName || "",
        )
          .trim()
          .toLowerCase();
      }

      if (token && (!myOrgId || !myOrgName)) {
        const profileResponse = await fetch(API_ENDPOINTS.PROFILE, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => null);

        if (profileResponse?.ok) {
          const profileData = await profileResponse.json().catch(() => null);
          const source = profileData?.user || profileData?.data || profileData;

          myOrgId =
            myOrgId ||
            String(
              source?.organization?.OrganizationId ||
                source?.organizationId ||
                source?.OrganizationId ||
                "",
            );

          myUserId =
            myUserId ||
            String(source?.UserId || source?.userId || source?.id || "");

          myOrgName =
            myOrgName ||
            String(
              source?.organization?.OrganizationName ||
                source?.organizationName ||
                source?.OrganizationName ||
                "",
            )
              .trim()
              .toLowerCase();
        }
      }

      const response = await fetch(API_ENDPOINTS.GET_ORGANIZATIONS, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await response.json().catch(() => null);
      const list =
        data?.organizations || data?.data || (Array.isArray(data) ? data : []);

      if (!Array.isArray(list)) {
        setInviteOrganizations([]);
        return;
      }

      const normalizedOrganizations: InviteOrganization[] = list
        .map((org: any) => ({
          id: String(org.organizationId || org.id || ""),
          name: org.organizationName || org.name || "Unknown Organization",
          userId: String(org.userId || org.UserId || org.user?.UserId || ""),
        }))
        .filter((organization: InviteOrganization) => {
          if (!organization.id) {
            return false;
          }

          const normalizedOrgName = organization.name.trim().toLowerCase();
          const isSameOrganization =
            (myOrgId && organization.id === myOrgId) ||
            (myUserId && organization.userId === myUserId) ||
            (myOrgName && normalizedOrgName === myOrgName);

          return !isSameOrganization;
        });

      setInviteOrganizations(normalizedOrganizations);
      setSelectedCollaboratorIds((previous) =>
        previous.filter((id) =>
          normalizedOrganizations.some((org) => org.id === id),
        ),
      );
    } catch (error) {
      console.log("Load organizations for collaboration failed:", error);
      setInviteOrganizations([]);
    } finally {
      setLoadingOrganizations(false);
    }
  };

  const toggleCollaborator = (organizationId: string) => {
    setSelectedCollaboratorIds((previous) => {
      if (previous.includes(organizationId)) {
        return previous.filter((id) => id !== organizationId);
      }
      return [...previous, organizationId];
    });
  };

  const inviteCollaborators = async (
    campaignId: string | number,
    token: string,
  ) => {
    if (selectedCollaboratorIds.length === 0) {
      return;
    }

    const response = await fetch(
      API_ENDPOINTS.INVITE_CAMPAIGN_COLLABORATORS(campaignId),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          organizationIds: selectedCollaboratorIds,
          message: collaborationNote.trim() || undefined,
        }),
      },
    );

    if (!response.ok) {
      if (response.status === 404 || response.status === 405) {
        throw new Error(
          "Campaign saved, but invite endpoint is not available on backend yet.",
        );
      }

      const data = await response.json().catch(() => ({}));
      throw new Error(
        data.message ||
          "Campaign saved, but sending collaboration invites failed.",
      );
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please grant permission to access your gallery to upload a poster.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !location.trim()) {
      Alert.alert("Error", "Please fill all required fields.");
      return;
    }

    if (!isEditing && !imageUri) {
      Alert.alert("Error", "Please upload a poster.");
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) throw new Error("Not authenticated");

      const startDateTime = new Date(startDate);
      startDateTime.setHours(startTime.getHours());
      startDateTime.setMinutes(startTime.getMinutes());

      const endDateTime = new Date(endDate);
      endDateTime.setHours(endTime.getHours());
      endDateTime.setMinutes(endTime.getMinutes());

      if (endDateTime <= startDateTime) {
        Alert.alert("Error", "End time must be after start time");
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("location", location.replace(/\s*\([^)]+\)$/, "").trim());
      if (campaignCoordinates) {
        formData.append("latitude", campaignCoordinates.latitude.toString());
        formData.append("longitude", campaignCoordinates.longitude.toString());
      }
      formData.append("startDate", startDateTime.toISOString());
      formData.append("endDate", endDateTime.toISOString());
      formData.append(
        "isCollaborativeCampaign",
        selectedCollaboratorIds.length > 0 ? "true" : "false",
      );
      formData.append(
        "collaboratorOrganizationIds",
        JSON.stringify(selectedCollaboratorIds),
      );

      if (collaborationNote.trim()) {
        formData.append("collaborationNote", collaborationNote.trim());
      }

      if (imageUri && !imageUri.startsWith("http")) {
        const filename = imageUri.split("/").pop();
        const match = /\.(\w+)$/.exec(filename || "");
        const type = match ? `image/${match[1]}` : `image`;

        formData.append("poster", {
          uri: imageUri,
          name: filename || "poster.jpg",
          type,
        } as any);
      }

      let url = API_ENDPOINTS.CREATE_CAMPAIGN;
      let method = "POST";

      if (isEditing) {
        url = API_ENDPOINTS.UPDATE_CAMPAIGN(params.id as string);
        method = "PUT";
      }

      const response = await fetch(url, {
        method: method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        let inviteWarning = "";

        if (selectedCollaboratorIds.length > 0) {
          const campaignId =
            data?.campaign?.id || data?.campaignId || params.id;

          if (campaignId) {
            try {
              await inviteCollaborators(campaignId as string, token);
            } catch (inviteError: any) {
              inviteWarning = getUserFriendlyError(
                inviteError,
                "Campaign saved, but collaboration invites could not be sent.",
              );
            }
          } else {
            inviteWarning =
              "Campaign saved, but invite dispatch is pending because campaign id was not returned.";
          }
        }

        const successMessage = inviteWarning
          ? `Campaign ${isEditing ? "updated" : "created"} successfully!\n\n${inviteWarning}`
          : `Campaign ${isEditing ? "updated" : "created"} successfully!`;

        Alert.alert("Success", successMessage, [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        throw new Error(
          data.message ||
            `Failed to ${isEditing ? "update" : "create"} campaign`,
        );
      }
    } catch (error: any) {
      console.log("Campaign submit error:", error);
      Alert.alert(
        "Campaign failed",
        getUserFriendlyError(error, "Something went wrong"),
      );
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Helper for cross-platform date picking
  const showPicker = (
    mode: "date" | "time",
    current: Date,
    setDate: (d: Date) => void,
    setShow: (v: boolean) => void,
  ) => {
    if (Platform.OS === "android") {
      return (
        <DateTimePicker
          value={current}
          mode={mode}
          onChange={(event, date) => {
            setShow(false);
            if (date) setDate(date);
          }}
        />
      );
    }

    // iOS Modal Picker
    return (
      <Modal transparent animationType="slide" visible={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShow(false)}>
                <Text style={styles.modalButton}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                Select {mode === "date" ? "Date" : "Time"}
              </Text>
              <TouchableOpacity onPress={() => setShow(false)}>
                <Text style={[styles.modalButton, styles.doneButton]}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={current}
              mode={mode}
              display="spinner"
              onChange={(event, date) => {
                if (date) setDate(date);
              }}
              textColor="#000"
            />
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={28} color="#D11B31" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? "Edit Campaign" : "Create Campaign"}
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Poster Source Selector */}
        <View style={styles.posterSourceSelector}>
          <TouchableOpacity
            style={[
              styles.sourceButton,
              posterSource === "upload" && styles.activeSourceButton,
            ]}
            onPress={() => setPosterSource("upload")}
          >
            <Ionicons
              name="cloud-upload-outline"
              size={20}
              color={posterSource === "upload" ? "#FFF" : "#6B7280"}
            />
            <Text
              style={[
                styles.sourceButtonText,
                posterSource === "upload" && styles.activeSourceButtonText,
              ]}
            >
              Upload Image
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.sourceButton,
              posterSource === "create" && styles.activeSourceButton,
            ]}
            onPress={() => setPosterSource("create")}
          >
            <Ionicons
              name="color-palette-outline"
              size={20}
              color={posterSource === "create" ? "#FFF" : "#6B7280"}
            />
            <Text
              style={[
                styles.sourceButtonText,
                posterSource === "create" && styles.activeSourceButtonText,
              ]}
            >
              Create Banner
            </Text>
          </TouchableOpacity>
        </View>

        {/* Poster Content */}
        {posterSource === "upload" ? (
          <TouchableOpacity style={styles.imageUpload} onPress={pickImage}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.uploadedImage} />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Ionicons name="image-outline" size={40} color="#9CA3AF" />
                <Text style={styles.uploadText}>
                  {isEditing ? "Change Poster" : "Upload Campaign Poster"}
                </Text>
                <Text style={styles.uploadSubText}>
                  {isEditing
                    ? "(Tap to update)"
                    : "(16:9 aspect ratio recommended)"}
                </Text>
              </View>
            )}
            {imageUri && (
              <View style={styles.editImageOverlay}>
                <Ionicons name="camera" size={20} color="#FFF" />
              </View>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.imageUpload, styles.bannerCreatorArea]}
            onPress={() => setShowBannerModal(true)}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.uploadedImage} />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Ionicons
                  name="color-palette-outline"
                  size={40}
                  color="#D11B31"
                />
                <Text style={[styles.uploadText, { color: "#D11B31" }]}>
                  Create Custom Banner
                </Text>
                <Text style={styles.uploadSubText}>
                  Personalize with your campaign title
                </Text>
              </View>
            )}
            <View style={styles.createOverlay}>
              <Ionicons name="create" size={20} color="#FFF" />
              <Text style={styles.createOverlayText}>Design</Text>
            </View>
          </TouchableOpacity>
        )}

        <BannerCreationModal
          visible={showBannerModal}
          onClose={() => setShowBannerModal(false)}
          onBannerCreated={(uri) => setImageUri(uri)}
          defaultTitle={title}
        />

        <CampaignCollaborateModal
          visible={showCollaborateModal}
          onClose={() => setShowCollaborateModal(false)}
          organizations={inviteOrganizations}
          selectedIds={selectedCollaboratorIds}
          onToggleOrganization={toggleCollaborator}
          loading={loadingOrganizations}
          onReload={loadInviteOrganizations}
        />

        <Text style={styles.label}>Campaign Title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Annual Blood Drive 2024"
          value={title}
          onChangeText={setTitle}
          placeholderTextColor="#9CA3AF"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe the campaign, goals, and requirements..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          placeholderTextColor="#9CA3AF"
        />

        <Text style={styles.label}>Location</Text>
        <TouchableOpacity
          style={[styles.input, styles.mapPickerButton]}
          activeOpacity={0.85}
          onPress={openCampaignMapPicker}
        >
          <View style={styles.mapPickerButtonRow}>
            <Ionicons name="location-outline" size={20} color="#6B7280" />
            <Text
              style={[
                styles.mapPickerButtonText,
                !location && styles.mapPickerPlaceholderText,
              ]}
              numberOfLines={2}
            >
              {location || "Tap to pick campaign location on map"}
            </Text>
          </View>
          <Ionicons name="map-outline" size={20} color="#6B7280" />
        </TouchableOpacity>

        {campaignCoordinates && (
          <Text style={styles.mapCoordinateText}>
            Lat {campaignCoordinates.latitude.toFixed(6)} | Lng{" "}
            {campaignCoordinates.longitude.toFixed(6)}
          </Text>
        )}

        <View style={styles.collaborationSection}>
          <Text style={styles.label}>Collaborative Campaign (Optional)</Text>
          <Text style={styles.collaborationHelpText}>
            Invite one or more organizations to run this campaign together.
          </Text>

          <TouchableOpacity
            style={styles.collaborateButton}
            activeOpacity={0.85}
            onPress={() => setShowCollaborateModal(true)}
            disabled={loadingOrganizations}
          >
            {loadingOrganizations ? (
              <ActivityIndicator size="small" color="#D11B31" />
            ) : (
              <Ionicons name="people-outline" size={18} color="#D11B31" />
            )}
            <Text style={styles.collaborateButtonText}>Collaborate</Text>
            <View style={styles.collaborateCountBadge}>
              <Text style={styles.collaborateCountText}>
                {selectedCollaboratorIds.length}
              </Text>
            </View>
          </TouchableOpacity>

          {!loadingOrganizations && inviteOrganizations.length === 0 ? (
            <Text style={styles.emptyOrganizationsText}>
              No organizations available to invite right now.
            </Text>
          ) : null}

          {selectedCollaborators.length > 0 ? (
            <View style={styles.collaborationChipWrap}>
              {selectedCollaborators.map((organization) => (
                <TouchableOpacity
                  key={organization.id}
                  style={[
                    styles.collaborationChip,
                    styles.collaborationChipSelected,
                  ]}
                  onPress={() => toggleCollaborator(organization.id)}
                >
                  <Text
                    style={styles.collaborationChipTextSelected}
                    numberOfLines={1}
                  >
                    {organization.name}
                  </Text>
                  <Ionicons name="close-circle" size={16} color="#FFF" />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          <Text style={styles.collaborationSelectedText}>
            {selectedCollaboratorIds.length} organization
            {selectedCollaboratorIds.length === 1 ? "" : "s"} selected
          </Text>

          <TextInput
            style={[styles.input, styles.collaborationNoteInput]}
            placeholder="Invite message (optional)"
            value={collaborationNote}
            onChangeText={setCollaborationNote}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>Start Date</Text>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setShowStartDate(true)}
            >
              <Text style={styles.dateText}>{formatDate(startDate)}</Text>
              <Ionicons name="calendar-outline" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>Start Time</Text>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setShowStartTime(true)}
            >
              <Text style={styles.dateText}>{formatTime(startTime)}</Text>
              <Ionicons name="time-outline" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>End Date</Text>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setShowEndDate(true)}
            >
              <Text style={styles.dateText}>{formatDate(endDate)}</Text>
              <Ionicons name="calendar-outline" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>End Time</Text>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setShowEndTime(true)}
            >
              <Text style={styles.dateText}>{formatTime(endTime)}</Text>
              <Ionicons name="time-outline" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Render Pickers */}
        {showStartDate &&
          showPicker("date", startDate, setStartDate, setShowStartDate)}
        {showStartTime &&
          showPicker("time", startTime, setStartTime, setShowStartTime)}
        {showEndDate && showPicker("date", endDate, setEndDate, setShowEndDate)}
        {showEndTime && showPicker("time", endTime, setEndTime, setShowEndTime)}

        <Modal
          visible={showCampaignMapPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCampaignMapPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.mapModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Pick Campaign Location</Text>
                <TouchableOpacity
                  onPress={() => setShowCampaignMapPicker(false)}
                >
                  <Ionicons name="close-circle" size={28} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <Text style={styles.mapHintText}>
                Search for a place or tap the map to choose campaign location.
              </Text>

              <View style={styles.mapSearchRow}>
                <View style={styles.mapSearchInputWrap}>
                  <Ionicons
                    name="search-outline"
                    size={18}
                    color="#6B7280"
                    style={styles.mapSearchIcon}
                  />
                  <TextInput
                    style={styles.mapSearchInput}
                    placeholder="Search location"
                    placeholderTextColor="#9CA3AF"
                    value={campaignLocationSearchQuery}
                    onChangeText={(text) => {
                      setCampaignLocationSearchQuery(text);
                      if (campaignLocationSearchError) {
                        setCampaignLocationSearchError(null);
                      }
                    }}
                    onSubmitEditing={searchCampaignMapLocation}
                    returnKeyType="search"
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.searchButton,
                    isCampaignSearchingLocation && styles.searchButtonDisabled,
                  ]}
                  disabled={isCampaignSearchingLocation}
                  onPress={searchCampaignMapLocation}
                >
                  {isCampaignSearchingLocation ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.searchButtonText}>Search</Text>
                  )}
                </TouchableOpacity>
              </View>

              {campaignLocationSearchError ? (
                <Text style={styles.mapSearchErrorText}>
                  {campaignLocationSearchError}
                </Text>
              ) : null}

              <View style={styles.mapPickerContainer}>
                {isCampaignMapLoadingLocation ? (
                  <View style={styles.mapLoadingContainer}>
                    <ActivityIndicator size="large" color="#D11B31" />
                    <Text style={styles.mapLoadingText}>
                      Getting your current location...
                    </Text>
                  </View>
                ) : Platform.OS === "ios" && AppleMapsView ? (
                  <AppleMapsView
                    ref={(ref) => {
                      campaignMapRef.current = ref;
                    }}
                    style={styles.mapPickerMap}
                    cameraPosition={{
                      coordinates: campaignMapCenter,
                      zoom: 13,
                    }}
                    markers={campaignMapAppleMarkers}
                    uiSettings={{
                      compassEnabled: true,
                      myLocationButtonEnabled: true,
                      scaleBarEnabled: true,
                    }}
                    properties={{
                      isMyLocationEnabled: true,
                    }}
                    onMapClick={(event) => {
                      const next = toValidCoordinates(event.coordinates);
                      if (!next) return;
                      setCampaignCoordinates(next);
                      setCampaignLocationSearchError(null);
                    }}
                  />
                ) : Platform.OS === "android" ? (
                  <LeafletMapView
                    ref={(ref) => {
                      campaignMapRef.current = ref;
                    }}
                    style={styles.mapPickerMap}
                    cameraPosition={{
                      coordinates: campaignMapCenter,
                      zoom: 13,
                    }}
                    markers={campaignMapGoogleMarkers}
                    onMapClick={(event) => {
                      const next = toValidCoordinates(event.coordinates);
                      if (!next) return;
                      setCampaignCoordinates(next);
                      setCampaignLocationSearchError(null);
                    }}
                    onMapLongClick={(event) => {
                      const next = toValidCoordinates(event.coordinates);
                      if (!next) return;
                      setCampaignCoordinates(next);
                      setCampaignLocationSearchError(null);
                    }}
                  />
                ) : (
                  <View style={styles.mapLoadingContainer}>
                    <Text style={styles.mapLoadingText}>
                      Map module is unavailable in this build.
                    </Text>
                    <Text style={styles.mapLoadingText}>
                      Rebuild using expo run:ios or expo run:android.
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.mapActionsRow}>
                <TouchableOpacity
                  style={[styles.mapActionButton, styles.mapCancelButton]}
                  onPress={() => setShowCampaignMapPicker(false)}
                >
                  <Text style={[styles.mapActionText, styles.mapCancelText]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.mapActionButton,
                    styles.mapConfirmButton,
                    !campaignCoordinates && styles.buttonDisabled,
                  ]}
                  disabled={!campaignCoordinates}
                  onPress={confirmCampaignMapLocation}
                >
                  <Text style={styles.mapActionText}>Use This Location</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>
              {isEditing ? "Update Campaign" : "Create Campaign"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
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
    fontSize: moderateScale(18),
    fontWeight: "600",
    color: "#111827",
  },
  backButton: {
    marginLeft: -scale(4),
    padding: scale(4),
  },
  content: {
    padding: scale(20),
    paddingBottom: verticalScale(100),
  },
  imageUpload: {
    height: verticalScale(180),
    backgroundColor: "#F3F4F6",
    borderRadius: moderateScale(12),
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: verticalScale(24),
    overflow: "hidden",
  },
  bannerCreatorArea: {
    borderColor: "#FEE2E2",
    borderStyle: "solid",
    backgroundColor: "#FFF5F5",
  },
  posterSourceSelector: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: moderateScale(10),
    padding: scale(4),
    marginBottom: verticalScale(16),
  },
  sourceButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(8),
    gap: scale(8),
  },
  activeSourceButton: {
    backgroundColor: "#D11B31",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  sourceButtonText: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: "#6B7280",
  },
  activeSourceButtonText: {
    color: "#FFF",
  },
  createOverlay: {
    position: "absolute",
    bottom: scale(10),
    right: scale(10),
    backgroundColor: "#D11B31",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: moderateScale(20),
    gap: scale(4),
  },
  createOverlayText: {
    color: "#FFF",
    fontSize: moderateScale(12),
    fontWeight: "700",
  },
  uploadedImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  uploadPlaceholder: {
    alignItems: "center",
    gap: verticalScale(8),
  },
  uploadText: {
    fontSize: moderateScale(16),
    fontWeight: "500",
    color: "#4B5563",
  },
  uploadSubText: {
    fontSize: moderateScale(12),
    color: "#9CA3AF",
  },
  editImageOverlay: {
    position: "absolute",
    bottom: scale(10),
    right: scale(10),
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: scale(8),
    borderRadius: moderateScale(20),
  },
  label: {
    fontSize: moderateScale(14),
    fontWeight: "500",
    color: "#374151",
    marginBottom: verticalScale(6),
  },
  input: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: moderateScale(8),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(10),
    fontSize: moderateScale(15),
    color: "#1F2937",
    marginBottom: verticalScale(16),
  },
  mapPickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: verticalScale(52),
  },
  mapPickerButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
    flex: 1,
    marginRight: scale(10),
  },
  mapPickerButtonText: {
    flex: 1,
    fontSize: moderateScale(15),
    color: "#1F2937",
    lineHeight: moderateScale(20),
  },
  mapPickerPlaceholderText: {
    color: "#9CA3AF",
  },
  mapCoordinateText: {
    fontSize: moderateScale(12),
    color: "#6B7280",
    marginTop: verticalScale(-10),
    marginBottom: verticalScale(14),
  },
  textArea: {
    height: verticalScale(100),
  },
  collaborationSection: {
    marginBottom: verticalScale(4),
  },
  collaborationHelpText: {
    fontSize: moderateScale(12),
    color: "#6B7280",
    marginBottom: verticalScale(10),
  },
  collaborateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(8),
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FFF1F2",
    borderRadius: moderateScale(10),
    paddingVertical: verticalScale(11),
    paddingHorizontal: scale(12),
    marginBottom: verticalScale(10),
  },
  collaborateButtonText: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: "#B91C1C",
  },
  collaborateCountBadge: {
    minWidth: scale(24),
    borderRadius: moderateScale(999),
    backgroundColor: "#D11B31",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
  },
  collaborateCountText: {
    color: "#FFF",
    fontSize: moderateScale(11),
    fontWeight: "700",
  },
  loadingOrganizationsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    marginBottom: verticalScale(10),
  },
  loadingOrganizationsText: {
    fontSize: moderateScale(13),
    color: "#6B7280",
  },
  emptyOrganizationsText: {
    fontSize: moderateScale(13),
    color: "#9CA3AF",
    marginBottom: verticalScale(10),
  },
  collaborationChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scale(8),
    marginBottom: verticalScale(10),
  },
  collaborationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    borderRadius: moderateScale(20),
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFF",
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(8),
    maxWidth: "100%",
  },
  collaborationChipSelected: {
    backgroundColor: "#D11B31",
    borderColor: "#D11B31",
  },
  collaborationChipText: {
    color: "#374151",
    fontSize: moderateScale(12),
    fontWeight: "600",
    maxWidth: scale(180),
  },
  collaborationChipTextSelected: {
    color: "#FFF",
  },
  collaborationSelectedText: {
    fontSize: moderateScale(12),
    color: "#6B7280",
    marginBottom: verticalScale(10),
  },
  collaborationNoteInput: {
    minHeight: verticalScale(76),
  },
  row: {
    flexDirection: "row",
    gap: scale(16),
    marginBottom: verticalScale(16),
  },
  halfWidth: {
    flex: 1,
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: moderateScale(8),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(10),
  },
  dateText: {
    fontSize: moderateScale(15),
    color: "#1F2937",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: scale(20),
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  button: {
    backgroundColor: "#D11B31",
    paddingVertical: verticalScale(14),
    borderRadius: moderateScale(8),
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    backgroundColor: "#FCA5A5",
  },
  buttonText: {
    color: "#FFF",
    fontSize: moderateScale(16),
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: moderateScale(20),
    borderTopRightRadius: moderateScale(20),
    paddingBottom: verticalScale(20),
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: moderateScale(16),
    fontWeight: "600",
    color: "#111827",
  },
  modalButton: {
    fontSize: moderateScale(16),
    color: "#6B7280",
  },
  doneButton: {
    color: "#D11B31",
    fontWeight: "600",
  },
  mapModalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: moderateScale(20),
    borderTopRightRadius: moderateScale(20),
    paddingBottom: verticalScale(16),
    maxHeight: "88%",
  },
  mapHintText: {
    fontSize: moderateScale(13),
    color: "#6B7280",
    paddingHorizontal: scale(16),
    marginTop: verticalScale(10),
    marginBottom: verticalScale(10),
  },
  mapSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    paddingHorizontal: scale(16),
    marginBottom: verticalScale(10),
  },
  mapSearchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: moderateScale(10),
    backgroundColor: "#F9FAFB",
    paddingHorizontal: scale(10),
    height: verticalScale(42),
  },
  mapSearchIcon: {
    marginRight: scale(6),
  },
  mapSearchInput: {
    flex: 1,
    fontSize: moderateScale(14),
    color: "#111827",
  },
  searchButton: {
    backgroundColor: "#D11B31",
    borderRadius: moderateScale(10),
    height: verticalScale(42),
    minWidth: scale(84),
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: scale(14),
  },
  searchButtonDisabled: {
    opacity: 0.7,
  },
  searchButtonText: {
    color: "#FFF",
    fontSize: moderateScale(13),
    fontWeight: "700",
  },
  mapSearchErrorText: {
    color: "#DC2626",
    fontSize: moderateScale(12),
    paddingHorizontal: scale(16),
    marginBottom: verticalScale(8),
  },
  mapPickerContainer: {
    height: verticalScale(320),
    marginHorizontal: scale(16),
    borderRadius: moderateScale(12),
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F3F4F6",
  },
  mapPickerMap: {
    flex: 1,
  },
  mapLoadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: scale(20),
  },
  mapLoadingText: {
    marginTop: verticalScale(8),
    fontSize: moderateScale(13),
    color: "#6B7280",
    textAlign: "center",
  },
  mapActionsRow: {
    flexDirection: "row",
    gap: scale(10),
    paddingHorizontal: scale(16),
    marginTop: verticalScale(14),
  },
  mapActionButton: {
    flex: 1,
    borderRadius: moderateScale(10),
    paddingVertical: verticalScale(12),
    alignItems: "center",
    justifyContent: "center",
  },
  mapCancelButton: {
    backgroundColor: "#F3F4F6",
  },
  mapConfirmButton: {
    backgroundColor: "#D11B31",
  },
  mapActionText: {
    color: "#FFF",
    fontSize: moderateScale(14),
    fontWeight: "700",
  },
  mapCancelText: {
    color: "#374151",
  },
});
