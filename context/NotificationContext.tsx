import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Alert, Platform } from "react-native";
import { API_ENDPOINTS } from "../config/api";
import { connectSocket, getSocket } from "../config/socket";

interface Notification {
    NotificationId: number;
    Title: string;
    Message: string;
    Type: string;
    IsRead: boolean;
    CreatedAt: string;
    RelatedId?: number;
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
    fetchNotifications: () => Promise<void>;
    markAsRead: (id: number) => Promise<void>;
    deleteNotification: (id: number) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = async () => {
        try {
            const token = await AsyncStorage.getItem("authToken");
            if (!token) return;

            const response = await fetch(API_ENDPOINTS.GET_NOTIFICATIONS, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const data = await response.json();
                const list = data.notifications || [];
                setNotifications(list);
                setUnreadCount(list.filter((n: Notification) => !n.IsRead).length);
            }
        } catch (error) {
            console.error("Error fetching notifications:", error);
        }
    };

    const setupSocket = async () => {
        const userDataStr = await AsyncStorage.getItem("userData");
        if (!userDataStr) return;
        const user = JSON.parse(userDataStr);

        connectSocket(user.id);
        const socket = getSocket();

        socket.on("newNotification", (notification: Notification) => {
            setNotifications((prev) => [notification, ...prev]);
            setUnreadCount((prev) => prev + 1);

            // Show in-app alert/toast
            if (Platform.OS !== 'web') {
                Alert.alert(notification.Title, notification.Message);
            } else {
                console.log("New Notification:", notification.Title, notification.Message);
            }
        });

        return () => {
            socket.off("newNotification");
        };
    };

    useEffect(() => {
        fetchNotifications();
        setupSocket();
    }, []);

    const markAsRead = async (id: number) => {
        try {
            const token = await AsyncStorage.getItem("authToken");
            if (!token) return;

            const response = await fetch(API_ENDPOINTS.MARK_NOTIFICATION_READ(id), {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                setNotifications((prev) =>
                    prev.map((n) => (n.NotificationId === id ? { ...n, IsRead: true } : n))
                );
                setUnreadCount((prev) => Math.max(0, prev - 1));
            }
        } catch (error) {
            console.error("Error marking as read:", error);
        }
    };

    const deleteNotification = async (id: number) => {
        try {
            const token = await AsyncStorage.getItem("authToken");
            if (!token) return;

            const response = await fetch(API_ENDPOINTS.DELETE_NOTIFICATION(id), {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                setNotifications((prev) => {
                    const n = prev.find(item => item.NotificationId === id);
                    if (n && !n.IsRead) setUnreadCount(c => Math.max(0, c - 1));
                    return prev.filter((n) => n.NotificationId !== id);
                });
            }
        } catch (error) {
            console.error("Error deleting notification:", error);
        }
    };

    return (
        <NotificationContext.Provider
            value={{ notifications, unreadCount, setUnreadCount, fetchNotifications, markAsRead, deleteNotification }}
        >
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error("useNotifications must be used within a NotificationProvider");
    }
    return context;
};
