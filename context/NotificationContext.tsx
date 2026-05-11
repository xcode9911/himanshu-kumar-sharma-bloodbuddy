import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert, Platform } from "react-native";
import { API_ENDPOINTS } from "../config/api";
import { connectSocket, getSocket } from "../config/socket";
import { isDetoxTest } from "../utils/detox";

export interface NotificationItem {
  NotificationId: number | string;
  Title: string;
  Message: string;
  Type: string;
  IsRead: boolean;
  CreatedAt: string;
  RelatedId?: number;
  LocalOnly?: boolean;
  SourceEvent?: string;
}

type InAppNotificationInput = {
  title: string;
  message: string;
  type: string;
  relatedId?: number;
  dedupeKey?: string;
  sourceEvent?: string;
  showAlert?: boolean;
  urgent?: boolean;
};

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: number | string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: number | string) => Promise<void>;
  deleteAllRead: () => Promise<void>;
  pushInAppNotification: (input: InAppNotificationInput) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

const FALLBACK_EVENT_META: Record<string, { title: string; type: string }> = {
  newBookingRequest: {
    title: "New Booking Request",
    type: "booking_request",
  },
  bookingApproved: {
    title: "Booking Approved",
    type: "booking_status",
  },
  bookingRejected: {
    title: "Booking Rejected",
    type: "booking_status",
  },
  newDonationOffer: {
    title: "New Donation Offer",
    type: "donation_request",
  },
  donationStatusUpdated: {
    title: "Donation Status Updated",
    type: "donation_status",
  },
  newEmergencyRequest: {
    title: "Emergency Alert",
    type: "emergency",
  },
  emergencyAccepted: {
    title: "Emergency Accepted",
    type: "emergency",
  },
  emergencyDonorCancelled: {
    title: "Emergency Update",
    type: "emergency",
  },
};

const SOCKET_FALLBACK_EVENTS = Object.keys(FALLBACK_EVENT_META);
const NOTIFICATION_PERMISSION_ASKED_KEY = "notificationPermissionAsked";
const EXPO_PUSH_TOKEN_KEY = "expoPushToken";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const toNotificationItem = (
  raw: any,
  overrides?: Partial<NotificationItem>,
): NotificationItem => {
  const id =
    raw?.NotificationId ??
    raw?.notificationId ??
    raw?.id ??
    `local-${Date.now()}`;

  return {
    NotificationId: id,
    Title: raw?.Title ?? raw?.title ?? overrides?.Title ?? "Notification",
    Message: raw?.Message ?? raw?.message ?? overrides?.Message ?? "",
    Type: raw?.Type ?? raw?.type ?? overrides?.Type ?? "general",
    IsRead: Boolean(raw?.IsRead ?? raw?.isRead ?? overrides?.IsRead ?? false),
    CreatedAt:
      raw?.CreatedAt ??
      raw?.createdAt ??
      overrides?.CreatedAt ??
      new Date().toISOString(),
    RelatedId: raw?.RelatedId ?? raw?.relatedId ?? overrides?.RelatedId,
    LocalOnly: overrides?.LocalOnly,
    SourceEvent: overrides?.SourceEvent,
  };
};

const sortByCreatedAtDesc = (list: NotificationItem[]) => {
  return [...list].sort(
    (a, b) => new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime(),
  );
};

const upsertNotificationList = (
  list: NotificationItem[],
  notification: NotificationItem,
) => {
  const idx = list.findIndex(
    (n) => String(n.NotificationId) === String(notification.NotificationId),
  );
  if (idx === -1) {
    return sortByCreatedAtDesc([notification, ...list]);
  }

  const next = [...list];
  next[idx] = {
    ...next[idx],
    ...notification,
    // Keep existing read state if we are replacing with a local mirror event.
    IsRead:
      next[idx].IsRead && !notification.IsRead
        ? next[idx].IsRead
        : notification.IsRead,
  };
  return sortByCreatedAtDesc(next);
};

const countUnread = (list: NotificationItem[]) =>
  list.filter((n) => !n.IsRead).length;

const extractFallbackMessage = (eventName: string, payload: any) => {
  if (payload?.Message || payload?.message) {
    return payload?.Message || payload?.message;
  }

  const donationDate = payload?.donationDate || payload?.DonationDate;
  const donorName = payload?.donorName || payload?.DonorName;
  const orgName = payload?.organizationName || payload?.OrganizationName;

  switch (eventName) {
    case "newBookingRequest":
      return "A new blood booking request needs your attention.";
    case "bookingApproved":
      return "Your booking request has been approved.";
    case "bookingRejected":
      return "Your booking request was rejected. Please try another blood bank.";
    case "newDonationOffer":
      return "A donor has offered to donate blood to your blood bank.";
    case "donationStatusUpdated":
      if (donationDate) {
        const dt = new Date(donationDate);
        return `Donation updated for ${dt.toLocaleDateString()} at ${dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`;
      }
      return "Your donation status has changed.";
    case "newEmergencyRequest":
      return "A nearby emergency blood request has been received.";
    case "emergencyAccepted":
      return donorName
        ? `${donorName} accepted your emergency request.`
        : "A donor accepted your emergency request.";
    case "emergencyDonorCancelled":
      return "The assigned donor cancelled emergency help. Matching will continue.";
    default:
      return orgName ? `New update from ${orgName}.` : "You have a new update.";
  }
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const localCounterRef = useRef(0);
  const recentDedupeRef = useRef<Record<string, number>>({});

  const updateWithNotifications = (
    updater: (prev: NotificationItem[]) => NotificationItem[],
  ) => {
    setNotifications((prev) => {
      const next = updater(prev);
      setUnreadCount(countUnread(next));
      return next;
    });
  };

  const configureNotificationChannel = async () => {
    if (Platform.OS !== "android") {
      return;
    }

    try {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#D11B31",
      });

      await Notifications.setNotificationChannelAsync("emergency", {
        name: "Emergency Alerts",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 400, 200, 600, 200, 600],
        lightColor: "#D11B31",
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    } catch (error) {
      console.log("Failed to configure notification channel:", error);
    }
  };

  const getProjectId = () => {
    return (
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId
    );
  };

  const canRegisterPushToken = () => {
    if (Platform.OS !== "ios") {
      return true;
    }

    return Boolean(Constants.isDevice);
  };

  const registerExpoPushToken = async () => {
    if (!canRegisterPushToken()) {
      return;
    }

    try {
      const projectId = getProjectId();
      const tokenResponse = projectId
        ? await Notifications.getExpoPushTokenAsync({ projectId })
        : await Notifications.getExpoPushTokenAsync();

      if (tokenResponse?.data) {
        await AsyncStorage.setItem(EXPO_PUSH_TOKEN_KEY, tokenResponse.data);
      }
    } catch (error) {
      console.log("Failed to register Expo push token:", error);
    }
  };

  const requestNotificationPermissionOnce = async () => {
    if (Platform.OS === "web" || isDetoxTest()) {
      return;
    }

    if (!canRegisterPushToken()) {
      return;
    }

    try {
      const alreadyAsked = await AsyncStorage.getItem(
        NOTIFICATION_PERMISSION_ASKED_KEY,
      );
      if (alreadyAsked === "true") {
        return;
      }

      const current = await Notifications.getPermissionsAsync();
      let finalStatus = current.status;

      if (finalStatus !== "granted") {
        const requested = await Notifications.requestPermissionsAsync();
        finalStatus = requested.status;
      }

      await AsyncStorage.setItem(NOTIFICATION_PERMISSION_ASKED_KEY, "true");

      if (finalStatus === "granted") {
        await registerExpoPushToken();
      }
    } catch (error) {
      console.log("Notification permission request failed:", error);
    }
  };

  const syncPushTokenIfGranted = async () => {
    if (Platform.OS === "web" || isDetoxTest()) {
      return;
    }

    if (!canRegisterPushToken()) {
      return;
    }

    try {
      const permissions = await Notifications.getPermissionsAsync();
      if (permissions.status === "granted") {
        await registerExpoPushToken();
      }
    } catch (error) {
      console.log("Failed to sync push token:", error);
    }
  };

  const presentNativeNotification = async (
    title: string,
    message: string,
    data?: Record<string, any>,
    options?: { urgent?: boolean },
  ) => {
    if (Platform.OS === "web" || isDetoxTest()) {
      return;
    }

    try {
      const permissions = await Notifications.getPermissionsAsync();
      if (permissions.status !== "granted") {
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body: message,
          sound: "default",
          data,
          priority: options?.urgent
            ? Notifications.AndroidNotificationPriority.MAX
            : Notifications.AndroidNotificationPriority.HIGH,
          interruptionLevel: options?.urgent ? "timeSensitive" : "active",
        },
        trigger:
          Platform.OS === "android"
            ? {
                channelId: options?.urgent ? "emergency" : "default",
              }
            : null,
      });
    } catch (error) {
      console.log("Failed to present local notification:", error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) return;

      const response = await fetch(API_ENDPOINTS.GET_NOTIFICATIONS, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const serverList = (data.notifications || []).map((n: any) =>
          toNotificationItem(n, { LocalOnly: false }),
        );

        updateWithNotifications((prev) => {
          const localOnly = prev.filter((n) => n.LocalOnly);
          let merged = sortByCreatedAtDesc(serverList);
          for (const localItem of localOnly) {
            merged = upsertNotificationList(merged, localItem);
          }
          return merged;
        });
      }
    } catch (error) {
      console.log("Error fetching notifications:", error);
    }
  };

  const pushInAppNotification = (input: InAppNotificationInput) => {
    const dedupeKey =
      input.dedupeKey ||
      `${input.type}:${input.relatedId ?? "none"}:${input.title}:${input.message}`;
    const now = Date.now();
    const last = recentDedupeRef.current[dedupeKey];

    // Ignore near-duplicate events emitted in quick succession.
    if (last && now - last < 10_000) {
      return;
    }
    recentDedupeRef.current[dedupeKey] = now;

    localCounterRef.current += 1;
    const localNotification: NotificationItem = {
      NotificationId: `local-${now}-${localCounterRef.current}`,
      Title: input.title,
      Message: input.message,
      Type: input.type,
      IsRead: false,
      CreatedAt: new Date().toISOString(),
      RelatedId: input.relatedId,
      LocalOnly: true,
      SourceEvent: input.sourceEvent,
    };

    updateWithNotifications((prev) =>
      upsertNotificationList(prev, localNotification),
    );

    presentNativeNotification(
      input.title,
      input.message,
      {
        type: input.type,
        relatedId: input.relatedId,
        sourceEvent: input.sourceEvent,
      },
      {
        urgent: input.urgent,
      },
    );

    if (input.showAlert && Platform.OS !== "web") {
      Alert.alert(input.title, input.message);
    }
  };

  const setupSocket = async () => {
    const userDataStr = await AsyncStorage.getItem("userData");
    if (!userDataStr) return;
    const user = JSON.parse(userDataStr);

    connectSocket(user.id);
    const socket = getSocket();

    const onNewNotification = (notification: NotificationItem) => {
      const normalized = toNotificationItem(notification, { LocalOnly: false });
      updateWithNotifications((prev) =>
        upsertNotificationList(prev, normalized),
      );

      presentNativeNotification(
        normalized.Title,
        normalized.Message,
        {
          type: normalized.Type,
          relatedId: normalized.RelatedId,
          notificationId: normalized.NotificationId,
        },
        {
          urgent: normalized.Type === "emergency",
        },
      );
    };

    socket.off("newNotification");
    socket.on("newNotification", onNewNotification);

    const fallbackHandlers: Array<{
      eventName: string;
      handler: (payload: any) => void;
    }> = SOCKET_FALLBACK_EVENTS.map((eventName) => {
      socket.off(eventName);
      const handler = (payload: any) => {
        const meta = FALLBACK_EVENT_META[eventName];
        pushInAppNotification({
          title: meta.title,
          message: extractFallbackMessage(eventName, payload),
          type: meta.type,
          relatedId: payload?.RelatedId || payload?.relatedId,
          sourceEvent: eventName,
          dedupeKey: `${eventName}:${payload?.requestId || payload?.RequestId || payload?.offerId || payload?.OfferId || "none"}`,
          showAlert: eventName === "newEmergencyRequest",
          urgent: eventName === "newEmergencyRequest",
        });

        // Keep server state synced if backend also persists notifications.
        fetchNotifications();
      };

      socket.on(eventName, handler);
      return { eventName, handler };
    });

    return () => {
      socket.off("newNotification");
      fallbackHandlers.forEach(({ eventName, handler }) => {
        socket.off(eventName, handler);
      });
    };
  };

  useEffect(() => {
    let cleanup: undefined | (() => void);

    const bootstrap = async () => {
      await configureNotificationChannel();
      await requestNotificationPermissionOnce();
      await syncPushTokenIfGranted();
      await fetchNotifications();

      if (!isDetoxTest()) {
        cleanup = await setupSocket();
      }
    };

    bootstrap();

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  const markAsRead = async (id: number | string) => {
    try {
      const target = notifications.find(
        (n) => String(n.NotificationId) === String(id),
      );

      // Local-only notifications can be marked read without backend calls.
      if (target?.LocalOnly || typeof id !== "number") {
        updateWithNotifications((prev) =>
          prev.map((n) =>
            String(n.NotificationId) === String(id)
              ? { ...n, IsRead: true }
              : n,
          ),
        );
        return;
      }

      const token = await AsyncStorage.getItem("authToken");
      if (!token) return;

      const response = await fetch(
        API_ENDPOINTS.MARK_NOTIFICATION_READ(Number(id)),
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.ok) {
        updateWithNotifications((prev) =>
          prev.map((n) =>
            n.NotificationId === id ? { ...n, IsRead: true } : n,
          ),
        );
      }
    } catch (error) {
      console.log("Error marking as read:", error);
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications
      .filter((n) => !n.IsRead)
      .map((n) => n.NotificationId);

    if (!unreadIds.length) return;

    updateWithNotifications((prev) =>
      prev.map((n) => ({ ...n, IsRead: true })),
    );

    const token = await AsyncStorage.getItem("authToken");
    if (!token) return;

    await Promise.allSettled(
      unreadIds
        .filter((id) => typeof id === "number")
        .map((id) =>
          fetch(API_ENDPOINTS.MARK_NOTIFICATION_READ(Number(id)), {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}` },
          }),
        ),
    );
  };

  const deleteNotification = async (id: number | string) => {
    try {
      const target = notifications.find(
        (n) => String(n.NotificationId) === String(id),
      );

      if (target?.LocalOnly || typeof id !== "number") {
        updateWithNotifications((prev) =>
          prev.filter((n) => String(n.NotificationId) !== String(id)),
        );
        return;
      }

      const token = await AsyncStorage.getItem("authToken");
      if (!token) return;

      const response = await fetch(
        API_ENDPOINTS.DELETE_NOTIFICATION(Number(id)),
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.ok) {
        updateWithNotifications((prev) =>
          prev.filter((n) => String(n.NotificationId) !== String(id)),
        );
      }
    } catch (error) {
      console.log("Error deleting notification:", error);
    }
  };

  const deleteAllRead = async () => {
    const readIds = notifications
      .filter((n) => n.IsRead)
      .map((n) => n.NotificationId);
    if (!readIds.length) return;

    updateWithNotifications((prev) => prev.filter((n) => !n.IsRead));

    const token = await AsyncStorage.getItem("authToken");
    if (!token) return;

    await Promise.allSettled(
      readIds
        .filter((id) => typeof id === "number")
        .map((id) =>
          fetch(API_ENDPOINTS.DELETE_NOTIFICATION(Number(id)), {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }),
        ),
    );
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        setUnreadCount,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        deleteAllRead,
        pushInAppNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider",
    );
  }
  return context;
};
