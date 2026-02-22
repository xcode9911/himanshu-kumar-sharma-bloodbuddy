import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "./api";

let socket: Socket | null = null;

export const getSocket = () => {
    if (!socket) {
        socket = io(API_BASE_URL, {
            transports: ["websocket"],
            autoConnect: false,
        });
    }
    return socket;
};

export const connectSocket = (userId: string) => {
    const s = getSocket();
    if (!s.connected) {
        s.connect();
        s.once("connect", () => {
            console.log("Connected to socket server");
            s.emit("join", userId);
        });
    } else {
        s.emit("join", userId);
    }
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};

export const emitPrivateMessage = (receiverId: string, message: string, senderId: string, senderName: string) => {
    const s = getSocket();
    if (s.connected) {
        s.emit("privateMessage", { receiverId, message, senderId, senderName });
    }
};
