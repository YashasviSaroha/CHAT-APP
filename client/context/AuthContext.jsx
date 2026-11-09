import { createContext, useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import { apiError } from "../src/lib/apiError";

const backendUrl = import.meta.env.VITE_BACKEND_URL;
axios.defaults.baseURL = backendUrl;

// Attach auth token to all outgoing requests
axios.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.token = token;
    }
    return config;
});

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(localStorage.getItem("token"));
    const [authUser, setAuthUser] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [socket, setSocket] = useState(null);

    // Check to see if user is authenticated and if so connect the socket and set the user data
    const checkAuth = async () => {
        try {
            const { data } = await axios.get("/api/auth/check");

            if (data.success) {
                setAuthUser({ ...data.user, isAdmin: Boolean(data.isAdmin) });
                connectSocket(data.user, token);
            } else {
                localStorage.removeItem("token");
                setToken(null);
                setAuthUser(null);
            }
        } catch (error) {
            localStorage.removeItem("token");
            setToken(null);
            setAuthUser(null);
            if (error?.response?.status !== 401) toast.error(apiError(error));
        }
    };

    // login function to handle user authentication and socket connection
    const login = async (state, credentials) => {
        try {
            const { data } = await axios.post(`/api/auth/${state}`, credentials);

            if (data.success) {
                setAuthUser({ ...data.userData, isAdmin: Boolean(data.isAdmin) });
                setToken(data.token);
                localStorage.setItem("token", data.token);
                connectSocket(data.userData, data.token);
                toast.success(data.message);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(apiError(error));
        }
    };

    // Logout function to handle user logout and socket disconnect
    const logout = async () => {
        localStorage.removeItem("token");
        setToken(null);
        setAuthUser(null);
        setOnlineUsers([]);
        toast.success("Logged out successfully");
        if (socket) {
            socket.disconnect();
            setSocket(null);
        }
    };

    // Update profile function to handle user profile update
    const updateProfile = async (body) => {
        try {
            const { data } = await axios.put("/api/auth/update-profile", body);

            if (data.success) {
                setAuthUser({ ...data.user, isAdmin: authUser?.isAdmin });
                toast.success("Profile updated Successfully");
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(apiError(error));
        }
    };

    const updateNotifications = async (body) => {
        try {
            const { data } = await axios.put("/api/auth/notifications", body);
            if (data.success) {
                setAuthUser({ ...data.user, isAdmin: authUser?.isAdmin });
                toast.success("Notification settings saved");
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(apiError(error));
        }
    };

    // Connect socket function using JWT token authentication
    const connectSocket = (userData, userToken) => {
        const authToken = userToken || token || localStorage.getItem("token");
        if (!userData || !authToken) {
            return;
        }

        if (socket?.connected) {
            return;
        }

        if (socket) {
            socket.disconnect();
        }

        const newSocket = io(backendUrl, {
            auth: {
                token: authToken,
            },
        });

        newSocket.connect();
        setSocket(newSocket);

        newSocket.on("getOnlineUsers", (userIds) => {
            setOnlineUsers(userIds);
        });
    };

    useEffect(() => {
        checkAuth();
    }, []);

    useEffect(() => {
        if (authUser && (!socket || !socket.connected)) {
            connectSocket(authUser, token);
        }
        if (!authUser && socket) {
            socket.disconnect();
            setSocket(null);
        }
    }, [authUser]);

    const value = {
        axios,
        authUser,
        onlineUsers,
        socket,
        login,
        logout,
        updateProfile,
        updateNotifications,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};