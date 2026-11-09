import { useContext, useEffect, useState } from "react";
import assets from "../assets/assets";
import { ChatContext } from "../../context/ChatContext";
import { AuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";
import { apiError } from "../lib/apiError";

const RightSidebar = () => {
  const { selectedUser, messages } = useContext(ChatContext);
  const { logout, onlineUsers, axios } = useContext(AuthContext);
  const [msgImages, setMsgImages] = useState([]);
  const [relation, setRelation] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [includeEvidence, setIncludeEvidence] = useState(false);

  useEffect(() => {
    setMsgImages(messages.filter((msg) => msg.image).map((msg) => msg.image));
  }, [messages]);

  useEffect(() => {
    if (!selectedUser || selectedUser.isGroup) return;
    axios.get(`/api/auth/relation/${selectedUser._id}`).then(({ data }) => {
      if (data.success) setRelation(data);
    }).catch(() => setRelation(null));
  }, [selectedUser]);

  const block = async () => {
    try {
      const path = relation?.blockedByMe ? `/api/auth/unblock/${selectedUser._id}` : `/api/auth/block/${selectedUser._id}`;
      const { data } = await axios.post(path);
      if (data.success) {
        toast.success(data.message);
        const next = await axios.get(`/api/auth/relation/${selectedUser._id}`);
        setRelation(next.data);
      } else toast.error(data.message);
    } catch (error) {
      toast.error(apiError(error));
    }
  };

  const mute = async () => {
    if (!relation && !selectedUser.isGroup) return;
    const id = selectedUser.isGroup ? selectedUser._id : null;
    if (!id) return toast("Open a group to mute it from here, or use the conversation id.");
    await axios.put(`/api/conversations/${id}/mute`, { muted: !selectedUser.muted });
    toast.success(selectedUser.muted ? "Unmuted" : "Muted");
  };

  const submitReport = async (event) => {
    event.preventDefault();
    try {
      const { data } = await axios.post("/api/reports", {
        reportedUserId: selectedUser.isGroup ? selectedUser.memberIds?.[0] : selectedUser._id,
        reason,
        includeEvidence,
        messageId: includeEvidence ? messages.find((message) => message.senderId !== undefined)?.messageId : undefined,
      });
      if (data.success) {
        toast.success(data.message);
        setReportOpen(false);
      } else toast.error(data.message);
    } catch (error) {
      toast.error(apiError(error));
    }
  };

  if (!selectedUser) return null;

  return (
    <div className={`bg-[#8185b2]/10 text-white w-full relative overflow-y-scroll ${selectedUser ? "max-md:hidden" : ""}`}>
      <div className="pt-16 flex flex-col items-center gap-2 text-xs font-light mx-auto">
        <img src={selectedUser?.profilePic || assets.avatar_icon} alt="" className="w-20 aspect-square rounded-full" />
        <h1 className="px-10 text-xl font-medium mx-auto flex items-center gap-2">
          {!selectedUser.isGroup && onlineUsers.includes(selectedUser._id) && <p className="w-2 h-2 rounded-full bg-green-500" />}
          {selectedUser.fullName || selectedUser.name}
        </h1>
        {selectedUser.username && <p>@{selectedUser.username}</p>}
        <p className="px-10 mx-auto">{selectedUser.bio}</p>
      </div>
      <hr className="border-[#ffffff50] my-4" />
      <div className="px-5 text-xs">
        <p>Media</p>
        <div className="mt-2 max-h-[200px] overflow-y-scroll grid grid-cols-2 gap-4 opacity-80">
          {msgImages.length === 0 && <p className="text-gray-400 col-span-2">No shared photos yet.</p>}
          {msgImages.map((url, index) => (
            <button key={index} type="button" onClick={() => window.open(url)} className="cursor-pointer rounded">
              <img src={url} alt="" className="h-full rounded-md" />
            </button>
          ))}
        </div>
      </div>
      {!selectedUser.isGroup && (
        <div className="px-5 mt-4 flex flex-col gap-2 text-sm">
          {relation?.messagingDisabled && <p className="text-xs text-gray-300">Messaging is unavailable.</p>}
          <button type="button" onClick={block} className="border border-gray-500 rounded-full py-2">{relation?.blockedByMe ? "Unblock" : "Block"}</button>
          <button type="button" onClick={() => setReportOpen((open) => !open)} className="border border-gray-500 rounded-full py-2">Report</button>
        </div>
      )}
      {selectedUser.isGroup && <button type="button" onClick={mute} className="mx-5 mt-4 w-[calc(100%-2.5rem)] border border-gray-500 rounded-full py-2 text-sm">Mute group</button>}
      {reportOpen && (
        <form onSubmit={submitReport} className="px-5 mt-3 text-xs flex flex-col gap-2">
          <select value={reason} onChange={(event) => setReason(event.target.value)} className="bg-transparent border border-gray-600 rounded-md p-2">
            <option value="spam">Spam</option>
            <option value="harassment">Harassment</option>
            <option value="inappropriate">Inappropriate</option>
            <option value="scam">Scam</option>
            <option value="other">Other</option>
          </select>
          <label className="flex gap-2 items-start">
            <input type="checkbox" checked={includeEvidence} onChange={(event) => setIncludeEvidence(event.target.checked)} />
            Include the latest message text as evidence. This keeps that text after the chat expires.
          </label>
          <button className="bg-violet-600 rounded-full py-2">Submit report</button>
        </form>
      )}
      <button onClick={logout} className="absolute bottom-5 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-400 to-violet-600 text-white border-none text-sm font-light py-2 px-20 rounded-full cursor-pointer">Logout</button>
    </div>
  );
};

export default RightSidebar;
