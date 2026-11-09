import { createContext, useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "./AuthContext";
import toast from "react-hot-toast";
import { apiError } from "../src/lib/apiError";

const DB_NAME = "QuickChatDB";
const DB_VERSION = 1;
const STORE_NAME = "messages";

const openDB = () => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not supported in this environment"));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "messageId" });
        store.createIndex("conversationId", "conversationId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("sequenceNumber", "sequenceNumber", { unique: false });
      }
    };
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
};

const dbSaveMessage = async (message) => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const request = tx.objectStore(STORE_NAME).put(message);
      request.onsuccess = () => resolve(message);
      request.onerror = (event) => reject(event.target.error);
    });
  } catch (error) {
    console.error("IndexedDB save error");
  }
};

const dbDeleteMessage = async (messageId) => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const request = tx.objectStore(STORE_NAME).delete(messageId);
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  } catch {
    console.error("IndexedDB delete error");
  }
};

const dbGetConversationMessages = async (conversationId) => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).index("conversationId").getAll(conversationId);
      request.onsuccess = () => {
        const list = request.result || [];
        list.sort((a, b) => {
          if (a.sequenceNumber !== undefined && b.sequenceNumber !== undefined) return a.sequenceNumber - b.sequenceNumber;
          return new Date(a.createdAt) - new Date(b.createdAt);
        });
        resolve(list);
      };
      request.onerror = (event) => reject(event.target.error);
    });
  } catch {
    return [];
  }
};

const dbUpdateMessageStatus = async (messageId, status) => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(messageId);
      getReq.onsuccess = () => {
        const data = getReq.result;
        if (data) {
          data.status = status;
          store.put(data);
        }
        resolve();
      };
      getReq.onerror = (event) => reject(event.target.error);
    });
  } catch {
    console.error("IndexedDB update status error");
  }
};

const dbBatchUpdateStatus = async (messageIds, status) => {
  if (!messageIds?.length) return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      messageIds.forEach((id) => {
        const getReq = store.get(id);
        getReq.onsuccess = () => {
          const data = getReq.result;
          if (data) {
            data.status = status;
            store.put(data);
          }
        };
      });
      tx.oncomplete = () => resolve();
      tx.onerror = (event) => reject(event.target.error);
    });
  } catch {
    console.error("IndexedDB batch update status error");
  }
};

const getConversationKey = (id1, id2) => [id1, id2].sort().join("_");

function playTone() {
  const audioContext = new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.frequency.value = 880;
  gain.gain.value = 0.04;
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.12);
}

export const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [requests, setRequests] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [unseenMessages, setUnseenMessages] = useState({});
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [retentionHours, setRetentionHours] = useState(24);
  const [replyTo, setReplyTo] = useState(null);

  const { socket, axios, authUser } = useContext(AuthContext);
  const selectedUserRef = useRef(selectedUser);
  const authUserRef = useRef(authUser);
  const outbox = useRef([]);

  useEffect(() => { selectedUserRef.current = selectedUser; }, [selectedUser]);
  useEffect(() => { authUserRef.current = authUser; }, [authUser]);

  const getUsers = async () => {
    try {
      const { data } = await axios.get("/api/messages/users");
      if (data.success) {
        setUsers(data.users);
        setUnseenMessages(data.unseenMessages || {});
      }
    } catch (error) {
      toast.error(apiError(error));
    }
  };

  const getGroups = async () => {
    try {
      const { data } = await axios.get("/api/conversations");
      if (data.success) {
        setGroups((data.conversations || []).filter((item) => item.type === "group").map((item) => ({
          ...item,
          fullName: item.name,
          isGroup: true,
        })));
      }
    } catch (error) {
      toast.error(apiError(error));
    }
  };

  const getRequests = async () => {
    try {
      const { data } = await axios.get("/api/messages/requests");
      if (data.success) setRequests(data.requests || []);
    } catch (error) {
      toast.error(apiError(error));
    }
  };

  const lookupUsername = async (query) => {
    const username = query.trim().replace(/^@/, "").toLowerCase();
    if (username.length < 3) return null;
    try {
      const { data } = await axios.get(`/api/auth/lookup/${encodeURIComponent(username)}`);
      return data.success ? data.user : null;
    } catch {
      return null;
    }
  };

  const searchUsers = async (query) => {
    const exact = await lookupUsername(query);
    return exact ? [exact] : [];
  };

  const requestContact = async (contactId) => {
    try {
      const { data } = await axios.post(`/api/messages/request/${contactId}`);
      if (data.success) {
        toast.success(data.message || "Request sent");
        if (data.alreadyConnected && data.user) setSelectedUser(data.user);
        await getUsers();
        return true;
      }
      toast.error(data.message || "Could not send the request");
      return false;
    } catch (error) {
      toast.error(apiError(error));
      return false;
    }
  };

  const acceptRequest = async (requestId) => {
    try {
      const { data } = await axios.post(`/api/messages/requests/${requestId}/accept`);
      if (data.success) {
        toast.success("Connected");
        await Promise.all([getUsers(), getRequests()]);
        if (data.user) setSelectedUser(data.user);
      } else toast.error(data.message);
    } catch (error) {
      toast.error(apiError(error));
    }
  };

  const rejectRequest = async (requestId) => {
    try {
      const { data } = await axios.post(`/api/messages/requests/${requestId}/reject`);
      if (data.success) {
        toast.success("Request declined");
        await getRequests();
      } else toast.error(data.message);
    } catch (error) {
      toast.error(apiError(error));
    }
  };

  const addContact = requestContact;

  const getMessages = async (userId) => {
    const currentUser = authUserRef.current;
    const selected = selectedUserRef.current;
    if (!currentUser || !userId) return;
    setMessagesLoading(true);
    try {
      const path = selected?.isGroup ? `/api/messages/conversation/${userId}` : `/api/messages/history/${userId}`;
      const { data } = await axios.get(path);
      const conversationId = selected?.isGroup ? String(userId) : getConversationKey(currentUser._id, userId);
      if (!data.success) return;
      for (const id of data.removals || []) await dbDeleteMessage(id);
      const local = await dbGetConversationMessages(conversationId);
      const serverMessages = (data.messages || []).map((message) => ({ ...message, conversationId: message.conversationId || conversationId }));
      const serverIds = new Set(serverMessages.map((message) => message.messageId));
      const legacy = local.filter((message) => !message.sequenceNumber && !serverIds.has(message.messageId) && !(data.removals || []).includes(message.messageId));
      for (const message of serverMessages) await dbSaveMessage({ ...message, conversationId });
      const merged = [...legacy, ...serverMessages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      setMessages(merged);
      setRetentionHours(data.retentionHours || 24);
      const unread = serverMessages.filter((message) => message.senderId !== String(currentUser._id)).map((message) => message.messageId);
      if (unread.length && socket?.connected) socket.emit("message_read", { messageIds: unread });
      setUnseenMessages((prev) => ({ ...prev, [userId]: 0 }));
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setMessagesLoading(false);
    }
  };

  const loadEarlier = async () => {
    const currentUser = authUserRef.current;
    const selected = selectedUserRef.current;
    if (!currentUser || !selected || !messages.length) return;
    const oldest = messages.find((message) => message.sequenceNumber)?.sequenceNumber;
    if (!oldest) return;
    const path = selected.isGroup
      ? `/api/messages/conversation/${selected._id}?cursor=${oldest}`
      : `/api/messages/history/${selected._id}?cursor=${oldest}`;
    const { data } = await axios.get(path);
    if (data.success && data.messages?.length) {
      setMessages((prev) => {
        const ids = new Set(prev.map((message) => message.messageId));
        return [...data.messages.filter((message) => !ids.has(message.messageId)), ...prev];
      });
    }
  };

  const sendMessage = async (messageData) => {
    const currentUser = authUserRef.current;
    const selected = selectedUserRef.current;
    if (!selected || !currentUser) return;
    try {
      let imageUrl = null;
      let audioUrl = null;
      let publicId = "";
      let resourceType = "";
      const file = messageData.audio || messageData.image;
      if (file) {
        const body = messageData.audio ? { audio: messageData.audio } : { image: messageData.image };
        const { data } = await axios.post("/api/messages/upload", body);
        if (!data.success) {
          toast.error(data.message || "Upload failed");
          return;
        }
        publicId = data.publicId || "";
        resourceType = data.resourceType || "";
        if (messageData.audio) audioUrl = data.url || data.imageUrl;
        else imageUrl = data.imageUrl;
      }

      const messageId = crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const conversationId = selected.isGroup ? String(selected._id) : getConversationKey(currentUser._id, selected._id);
      const optimistic = {
        messageId,
        conversationId,
        senderId: String(currentUser._id),
        receiverId: selected.isGroup ? null : String(selected._id),
        text: messageData.text || null,
        image: imageUrl,
        audio: audioUrl,
        messageType: audioUrl ? "audio" : imageUrl ? "image" : "text",
        createdAt: new Date().toISOString(),
        status: "sending",
        replyToMessageId: replyTo?.messageId || null,
        replyPreview: replyTo ? (replyTo.text || (replyTo.audio ? "Voice message" : "Photo")) : null,
      };
      await dbSaveMessage(optimistic);
      setMessages((prev) => [...prev, optimistic]);
      const payload = {
        messageId,
        text: messageData.text || null,
        image: imageUrl,
        audio: audioUrl,
        publicId,
        resourceType,
        replyToMessageId: replyTo?.messageId || "",
        ...(selected.isGroup ? { conversationId: selected._id } : { receiverId: selected._id }),
      };
      if (socket?.connected) socket.emit("send_message", payload);
      else {
        outbox.current.push(payload);
        toast.error("You are offline. The message will send when you reconnect.");
      }
      setReplyTo(null);
    } catch (error) {
      toast.error(apiError(error));
    }
  };

  const toggleBookmark = async (message) => {
    try {
      const path = `/api/messages/${message.messageId}/bookmark`;
      const { data } = message.bookmarked ? await axios.delete(path) : await axios.post(path);
      if (!data.success) return toast.error(data.message || "Could not update the bookmark");
      setMessages((prev) => prev.map((item) => item.messageId === message.messageId ? { ...item, bookmarked: !message.bookmarked } : item));
    } catch (error) {
      toast.error(apiError(error));
    }
  };

  const editMessage = async (messageId, text) => {
    try {
      const { data } = await axios.patch(`/api/messages/${messageId}`, { text });
      if (!data.success) return toast.error(data.message);
      setMessages((prev) => prev.map((item) => item.messageId === messageId ? { ...item, ...data.message } : item));
    } catch (error) {
      toast.error(apiError(error));
    }
  };

  const deleteMessage = async (messageId, scope) => {
    try {
      const { data } = await axios.post(`/api/messages/${messageId}/delete`, { scope });
      if (!data.success) return toast.error(data.message);
      if (scope === "me" || scope === "everyone") {
        setMessages((prev) => prev.filter((item) => item.messageId !== messageId));
        await dbDeleteMessage(messageId);
      }
    } catch (error) {
      toast.error(apiError(error));
    }
  };

  const setRetention = async (hours) => {
    const selected = selectedUserRef.current;
    if (!selected) return;
    const path = selected.isGroup
      ? `/api/conversations/${selected._id}/retention`
      : `/api/conversations/peer/${selected._id}/retention`;
    try {
      const { data } = await axios.put(path, { hours });
      if (data.success) {
        setRetentionHours(data.retentionHours);
        toast.success("Retention updated for new messages");
      } else toast.error(data.message);
    } catch (error) {
      toast.error(apiError(error));
    }
  };

  const createGroup = async (name, memberIds) => {
    try {
      const { data } = await axios.post("/api/conversations/group", { name, memberIds });
      if (data.success) {
        toast.success("Group created");
        await getGroups();
        setSelectedUser({ ...data.conversation, _id: data.conversation._id, fullName: data.conversation.name, isGroup: true });
        return true;
      }
      toast.error(data.message);
      return false;
    } catch (error) {
      toast.error(apiError(error));
      return false;
    }
  };

  useEffect(() => {
    if (!socket) return;
    const upsert = async (confirmed) => {
      const conversationId = confirmed.conversationId;
      await dbSaveMessage({ ...confirmed, conversationId });
      const selected = selectedUserRef.current;
      const currentUser = authUserRef.current;
      const openKey = selected?.isGroup ? String(selected._id) : currentUser && selected ? getConversationKey(currentUser._id, selected._id) : "";
      if (conversationId !== openKey && confirmed.conversationRef !== openKey) return;
      setMessages((prev) => {
        const index = prev.findIndex((item) => item.messageId === confirmed.messageId);
        if (index === -1) return [...prev, { ...confirmed, conversationId }];
        const next = [...prev];
        next[index] = { ...next[index], ...confirmed, conversationId };
        return next;
      });
    };

    const handleNewMessage = async (incoming) => {
      const currentUser = authUserRef.current;
      const selected = selectedUserRef.current;
      const conversationId = incoming.conversationId;
      const existing = await dbGetConversationMessages(conversationId);
      if (existing.some((item) => item.messageId === incoming.messageId)) return;
      const openKey = selected?.isGroup ? String(selected._id) : currentUser && selected ? getConversationKey(currentUser._id, selected._id) : "";
      const isOpen = conversationId === openKey;
      const stored = { ...incoming, conversationId, status: isOpen ? "read" : "delivered" };
      await dbSaveMessage(stored);
      if (isOpen) {
        setMessages((prev) => prev.some((item) => item.messageId === incoming.messageId) ? prev : [...prev, stored]);
        socket.emit("message_read", { messageId: incoming.messageId });
      } else {
        socket.emit("message_delivered", { messageId: incoming.messageId });
        const badgeKey = selected?.isGroup ? conversationId : incoming.senderId;
        setUnseenMessages((prev) => ({ ...prev, [incoming.senderId]: (prev[incoming.senderId] || 0) + 1, [badgeKey]: (prev[badgeKey] || 0) + 1 }));
      }
    };

    const handleNotification = (notice) => {
      const currentUser = authUserRef.current;
      const selected = selectedUserRef.current;
      const openKey = selected?.isGroup ? String(selected._id) : currentUser && selected ? getConversationKey(currentUser._id, selected._id) : "";
      const active = notice.conversationId === openKey && document.visibilityState === "visible";
      if (active) return;
      const prefs = currentUser?.notifications || { sound: true, desktop: false, mentions: true };
      if (notice.mention && prefs.mentions === false) return;
      if (prefs.sound !== false) playTone();
      if (prefs.desktop && Notification.permission === "granted") {
        new Notification(notice.mention ? "You were mentioned" : "New message", { body: notice.preview || "New message" });
      }
    };

    const removeMessages = async (messageIds) => {
      for (const id of messageIds) await dbDeleteMessage(id);
      setMessages((prev) => prev.filter((item) => !messageIds.includes(item.messageId)));
    };

    const handleConnect = () => {
      socket.emit("get_pending_messages");
      for (const payload of outbox.current) socket.emit("send_message", payload);
      outbox.current = [];
    };

    socket.on("message_sent", upsert);
    socket.on("newMessage", handleNewMessage);
    socket.on("message_delivered", async ({ messageId }) => {
      await dbUpdateMessageStatus(messageId, "delivered");
      setMessages((prev) => prev.map((item) => item.messageId === messageId ? { ...item, status: "delivered" } : item));
    });
    socket.on("message_read", async ({ messageIds }) => {
      await dbBatchUpdateStatus(messageIds, "read");
      setMessages((prev) => prev.map((item) => messageIds.includes(item.messageId) ? { ...item, status: "read" } : item));
    });
    socket.on("pending_messages", async (pendingList) => {
      for (const message of pendingList || []) await handleNewMessage(message);
    });
    socket.on("messages_removed", ({ messageIds }) => removeMessages(messageIds || []));
    socket.on("message_deleted", ({ messageId }) => removeMessages([messageId]));
    socket.on("message_edited", (message) => upsert(message));
    socket.on("message_updated", (update) => {
      setMessages((prev) => prev.map((item) => item.messageId === update.messageId ? { ...item, ...update } : item));
    });
    socket.on("notification", handleNotification);
    socket.on("message_error", ({ error }) => toast.error(error || "Message error"));
    socket.on("connect", handleConnect);
    if (socket.connected) handleConnect();

    return () => {
      socket.off("message_sent", upsert);
      socket.off("newMessage", handleNewMessage);
      socket.off("message_delivered");
      socket.off("message_read");
      socket.off("pending_messages");
      socket.off("messages_removed");
      socket.off("message_deleted");
      socket.off("message_edited");
      socket.off("message_updated");
      socket.off("notification", handleNotification);
      socket.off("message_error");
      socket.off("connect", handleConnect);
    };
  }, [socket]);

  const value = {
    messages,
    users,
    groups,
    requests,
    selectedUser,
    getUsers,
    getGroups,
    getRequests,
    sendMessage,
    setSelectedUser,
    unseenMessages,
    setUnseenMessages,
    getMessages,
    loadEarlier,
    searchUsers,
    lookupUsername,
    addContact,
    requestContact,
    acceptRequest,
    rejectRequest,
    messagesLoading,
    retentionHours,
    setRetention,
    replyTo,
    setReplyTo,
    toggleBookmark,
    editMessage,
    deleteMessage,
    createGroup,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
