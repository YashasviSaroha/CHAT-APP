import { useContext, useEffect, useRef, useState } from "react";
import assets from "../assets/assets";
import { formatMessageTime } from "../lib/utils";
import { ChatContext } from "../../context/ChatContext";
import { AuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";
import { apiError } from "../lib/apiError";
import ConfirmDialog from "./ConfirmDialog";

const retentionLabel = { 12: "12 hours", 24: "24 hours", 168: "7 days" };

const ChatContainer = () => {
  const {
    messages, selectedUser, setSelectedUser, sendMessage, getMessages, messagesLoading,
    retentionHours, setRetention, replyTo, setReplyTo, toggleBookmark, editMessage, deleteMessage, loadEarlier,
  } = useContext(ChatContext);
  const { authUser, onlineUsers, axios } = useContext(AuthContext);
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryRange, setSummaryRange] = useState("day");
  const [summaryFrom, setSummaryFrom] = useState("");
  const [summaryTo, setSummaryTo] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [summaryText, setSummaryText] = useState("");
  const [summaryState, setSummaryState] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchHits, setSearchHits] = useState([]);
  const [recording, setRecording] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const scrollEnd = useRef();
  const recorder = useRef(null);
  const chunks = useRef([]);

  const handleSendMessage = async (event) => {
    event?.preventDefault?.();
    if (input.trim() === "") return;
    await sendMessage({ text: input.trim() });
    setInput("");
  };

  const handleSendImage = async (event) => {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith("image/")) return toast.error("Select an image file");
    const reader = new FileReader();
    reader.onloadend = async () => sendMessage({ image: reader.result });
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const toggleRecording = async () => {
    if (recording && recorder.current) {
      recorder.current.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      chunks.current = [];
      mediaRecorder.ondataavailable = (event) => chunks.current.push(event.data);
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks.current, { type: mediaRecorder.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = async () => sendMessage({ audio: reader.result });
        reader.readAsDataURL(blob);
      };
      recorder.current = mediaRecorder;
      mediaRecorder.start();
      setRecording(true);
    } catch {
      toast.error("Microphone permission is required for voice messages.");
    }
  };

  const runSummary = async (kind) => {
    setSummaryState("loading");
    setSummaryText("");
    try {
      const body = selectedUser.isGroup
        ? { conversationId: selectedUser._id, range: summaryRange, from: summaryFrom, to: summaryTo, messageIds: selectedIds }
        : { peerId: selectedUser._id, range: summaryRange, from: summaryFrom, to: summaryTo, messageIds: selectedIds };
      const path = kind === "catchup" ? "/api/ai/catch-up" : "/api/ai/summarize";
      const { data } = await axios.post(path, body);
      setSummaryText(data.text || "Nothing to summarize.");
      setSummaryState(data.empty ? "empty" : "ready");
    } catch (error) {
      setSummaryState("error");
      setSummaryText(apiError(error));
    }
  };

  const searchMessages = async (event) => {
    event.preventDefault();
    if (!searchText.trim()) return;
    const params = new URLSearchParams({ q: searchText.trim() });
    if (selectedUser.isGroup) params.set("conversationId", selectedUser._id);
    else params.set("peerId", selectedUser._id);
    const { data } = await axios.get(`/api/messages/find?${params.toString()}`);
    setSearchHits(data.messages || []);
  };

  useEffect(() => {
    if (selectedUser) getMessages(selectedUser._id);
  }, [selectedUser]);

  useEffect(() => {
    if (scrollEnd.current && messages) scrollEnd.current.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!selectedUser) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 text-gray-500 bg-white/10 max-md:hidden">
        <img src={assets.logo_icon} className="max-w-16" alt="" />
        <p className="text-lg font-medium text-white">Chat Anytime, Anywhere</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-scroll relative backdrop-blur-lg">
      <div className="flex items-center gap-3 py-3 mx-4 border-b border-stone-500">
        <img src={selectedUser.profilePic || assets.avatar_icon} alt="" className="w-8 rounded-full" />
        <div className="flex-1 min-w-0">
          <p className="text-lg text-white flex items-center gap-2 truncate">
            {selectedUser.fullName || selectedUser.name}
            {!selectedUser.isGroup && onlineUsers.includes(selectedUser._id) && <span className="w-2 h-2 rounded-full bg-green-500" />}
          </p>
          <p className="text-[11px] text-gray-400">Messages disappear after {retentionLabel[retentionHours] || "24 hours"}</p>
        </div>
        <select value={retentionHours} onChange={(event) => setRetention(Number(event.target.value))} aria-label="Message retention" className="bg-transparent text-xs text-gray-300 border border-gray-600 rounded-md px-1 py-1 max-md:hidden">
          <option value={12}>12 hours</option>
          <option value={24}>24 hours</option>
          <option value={168}>7 days</option>
        </select>
        <button type="button" onClick={() => setSearchOpen((open) => !open)} className="text-xs text-gray-300">Search</button>
        <button type="button" onClick={() => setSummaryOpen((open) => !open)} className="text-xs text-violet-300">Summarize</button>
        <img onClick={() => setSelectedUser(null)} src={assets.arrow_icon} alt="Back" className="md:hidden max-w-7 cursor-pointer" />
      </div>

      {searchOpen && (
        <form onSubmit={searchMessages} className="mx-4 mt-3 flex gap-2">
          <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search this chat" className="flex-1 bg-transparent border border-gray-600 rounded-full px-3 py-2 text-sm text-white outline-none" />
          <button className="text-xs px-3 rounded-full bg-violet-600">Find</button>
        </form>
      )}
      {searchHits.length > 0 && (
        <div className="mx-4 mt-2 max-h-28 overflow-y-auto text-xs text-gray-300">
          {searchHits.map((hit) => <button key={hit.messageId} type="button" className="block w-full text-left py-1 truncate" onClick={() => document.getElementById(hit.messageId)?.scrollIntoView({ behavior: "smooth" })}>{hit.text || hit.transcript || "Attachment"}</button>)}
        </div>
      )}

      {summaryOpen && (
        <div className="mx-4 mt-3 rounded-xl border border-gray-600 p-3 text-sm text-gray-200">
          <p className="text-xs text-gray-400 mb-2">Summaries send only this conversation’s selected messages to Google Gemini. They are not saved unless you choose Save.</p>
          <div className="flex flex-wrap gap-2 mb-2">
            <select value={summaryRange} onChange={(event) => setSummaryRange(event.target.value)} className="bg-transparent border border-gray-600 rounded-md px-2 py-1 text-xs">
              <option value="hour">Last hour</option>
              <option value="day">Last 24 hours</option>
              <option value="selected">Selected messages</option>
              <option value="custom">Custom range</option>
            </select>
            {summaryRange === "custom" && (
              <>
                <input type="datetime-local" value={summaryFrom} onChange={(event) => setSummaryFrom(event.target.value)} className="bg-transparent border border-gray-600 rounded-md px-2 py-1 text-xs" />
                <input type="datetime-local" value={summaryTo} onChange={(event) => setSummaryTo(event.target.value)} className="bg-transparent border border-gray-600 rounded-md px-2 py-1 text-xs" />
              </>
            )}
            <button type="button" onClick={() => runSummary("summary")} className="text-xs px-3 py-1 rounded-full bg-violet-600">Summarize</button>
            <button type="button" onClick={() => runSummary("catchup")} className="text-xs px-3 py-1 rounded-full border border-gray-500">Catch me up</button>
          </div>
          {summaryState === "loading" && <p>Preparing the summary...</p>}
          {summaryText && <p className="whitespace-pre-wrap text-xs leading-5">{summaryText}</p>}
          {summaryState === "ready" && (
            <div className="mt-2 flex gap-2">
              <button type="button" className="text-xs underline" onClick={() => navigator.clipboard.writeText(summaryText)}>Copy</button>
              <button type="button" className="text-xs underline" onClick={async () => {
                await axios.post("/api/ai/summaries", { text: summaryText, conversationId: selectedUser.isGroup ? selectedUser._id : undefined, kind: "summary" });
                toast.success("Summary saved");
              }}>Save</button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col h-[calc(100%-120px)] overflow-y-scroll p-3 pb-6">
        <button type="button" onClick={loadEarlier} className="text-xs text-gray-400 mb-3">Load earlier</button>
        {messagesLoading && <p className="text-sm text-gray-400">Loading messages...</p>}
        {!messagesLoading && messages.length === 0 && <p className="text-sm text-gray-400 text-center mt-8">No messages yet. New messages disappear automatically.</p>}
        {messages.map((msg) => {
          const mine = msg.senderId === String(authUser._id);
          const fresh = Date.now() - new Date(msg.createdAt).getTime() < 15 * 60 * 1000;
          return (
            <div id={msg.messageId} key={msg.messageId} className={`flex items-end gap-2 justify-end ${!mine && "flex-row-reverse"}`}>
              <div className={`relative max-w-[230px] mb-8 ${mine ? "" : ""}`}>
                <button type="button" aria-label={msg.bookmarked ? "Remove bookmark" : "Bookmark message"} onClick={() => toggleBookmark(msg)} className="absolute -top-1 -right-1 text-[11px] text-gray-300">{msg.bookmarked ? "★" : "☆"}</button>
                {summaryRange === "selected" && (
                  <label className="text-[10px] text-gray-400 flex items-center gap-1 mb-1">
                    <input type="checkbox" checked={selectedIds.includes(msg.messageId)} onChange={(event) => {
                      setSelectedIds((prev) => event.target.checked ? [...prev, msg.messageId] : prev.filter((id) => id !== msg.messageId));
                    }} />
                    Include in summary
                  </label>
                )}
                {msg.replyPreview && <p className="text-[10px] text-violet-200 mb-1 truncate">Replying to {msg.replyPreview}</p>}
                {msg.audio ? (
                  <div className="bg-violet-500/30 rounded-lg p-2">
                    <audio controls src={msg.audio} className="max-w-[210px]" />
                    <p className="text-[10px] text-gray-300 mt-1">Transcript is created by Gemini.</p>
                    {msg.transcriptStatus === "processing" && <p className="text-[10px]">Transcribing...</p>}
                    {msg.transcriptStatus === "failed" && <p className="text-[10px]">Transcript failed.</p>}
                    {msg.transcriptStatus === "unavailable" && <p className="text-[10px]">Transcription is not configured.</p>}
                    {msg.transcript && <p className="text-xs mt-1 whitespace-pre-wrap">{msg.transcript} <button type="button" className="underline" onClick={() => navigator.clipboard.writeText(msg.transcript)}>Copy</button></p>}
                    {mine && msg.transcript && (
                      <button type="button" className="text-[10px] underline" onClick={async () => {
                        await axios.put(`/api/messages/${msg.messageId}/transcript`, { enabled: !msg.transcriptSearchable });
                        getMessages(selectedUser._id);
                      }}>
                        {msg.transcriptSearchable ? "Transcript is searchable" : "Allow transcript search"}
                      </button>
                    )}
                  </div>
                ) : msg.image ? (
                  <img src={msg.image} alt="" className="max-w-[230px] border border-gray-700 rounded-lg" />
                ) : (
                  <p className={`p-2 text-sm font-light rounded-lg break-all bg-violet-500/30 text-white ${mine ? "rounded-br-none" : "rounded-bl-none"}`}>{msg.text}</p>
                )}
                {msg.editedAt && <p className="text-[10px] text-gray-400">Edited</p>}
                <div className="flex gap-2 text-[10px] text-gray-400 mt-1">
                  <button type="button" onClick={() => setReplyTo(msg)}>Reply</button>
                  {mine && fresh && msg.text && <button type="button" onClick={() => setEditing(msg)}>Edit</button>}
                  <button type="button" onClick={() => setConfirm({ id: msg.messageId, scope: "me" })}>Delete for me</button>
                  {mine && fresh && <button type="button" onClick={() => setConfirm({ id: msg.messageId, scope: "everyone" })}>Delete for everyone</button>}
                </div>
              </div>
              <div className="text-center text-xs">
                <img src={mine ? authUser?.profilePic || assets.avatar_icon : selectedUser?.profilePic || assets.avatar_icon} alt="" className="w-7 rounded-full" />
                <p className="text-gray-500">{formatMessageTime(msg.createdAt)}</p>
                {mine && (
                  <span className="text-[10px] block">
                    {msg.status === "read" ? <span className="text-sky-400">✓✓</span> : msg.status === "delivered" ? <span>✓✓</span> : <span>✓</span>}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={scrollEnd} />
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-3">
        {replyTo && (
          <div className="mb-2 text-xs text-gray-300 flex justify-between bg-black/20 rounded-lg px-3 py-2">
            <span className="truncate">Replying to {replyTo.text || "attachment"}</span>
            <button type="button" onClick={() => setReplyTo(null)}>Close</button>
          </div>
        )}
        {editing && (
          <form className="mb-2 flex gap-2" onSubmit={async (event) => {
            event.preventDefault();
            await editMessage(editing.messageId, editing.text);
            setEditing(null);
          }}>
            <input value={editing.text} onChange={(event) => setEditing({ ...editing, text: event.target.value })} className="flex-1 bg-transparent border border-gray-600 rounded-full px-3 text-sm text-white outline-none" />
            <button className="text-xs px-3 rounded-full bg-violet-600">Save</button>
          </form>
        )}
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center bg-gray-100/12 px-3 rounded-full">
            <input onChange={(event) => setInput(event.target.value)} value={input} onKeyDown={(event) => event.key === "Enter" ? handleSendMessage(event) : null} type="text" placeholder="Send a Message" className="flex-1 text-sm p-3 border-none rounded-lg outline-none text-white placeholder-gray-400" />
            <input onChange={handleSendImage} type="file" id="image" accept="image/png,image/jpeg,image/webp" hidden />
            <label htmlFor="image"><img src={assets.gallery_icon} alt="Upload image" className="w-5 mr-2 cursor-pointer" /></label>
            <button type="button" aria-label={recording ? "Stop recording" : "Record voice message"} onClick={toggleRecording} className={`mr-2 text-xs ${recording ? "text-red-400" : "text-gray-300"}`}>{recording ? "Stop" : "Mic"}</button>
          </div>
          <img onClick={handleSendMessage} src={assets.send_button} alt="Send" className="w-7 cursor-pointer" />
        </div>
      </div>
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.scope === "everyone" ? "Delete for everyone?" : "Delete for you?"}
        body={confirm?.scope === "everyone" ? "This removes the message, saved copies, and the uploaded file for everyone in the chat." : "This hides the message on your devices. A bookmark you already saved stays in Saved Messages."}
        confirmLabel="Delete"
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          await deleteMessage(confirm.id, confirm.scope);
          setConfirm(null);
        }}
      />
    </div>
  );
};

export default ChatContainer;
