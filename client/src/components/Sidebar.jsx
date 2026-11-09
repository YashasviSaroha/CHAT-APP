import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import assets from "../assets/assets";
import { AuthContext } from "../../context/AuthContext";
import { ChatContext } from "../../context/ChatContext";

const Sidebar = () => {
  const {
    getUsers, getGroups, getRequests, users, groups, requests, selectedUser, setSelectedUser,
    unseenMessages, setUnseenMessages, lookupUsername, requestContact, acceptRequest, rejectRequest, createGroup,
  } = useContext(ChatContext);
  const { logout, onlineUsers, authUser } = useContext(AuthContext);
  const [input, setInput] = useState("");
  const [foundUser, setFoundUser] = useState(null);
  const [searched, setSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const username = input.trim().replace(/^@/, "");
    if (username.length < 3) {
      setFoundUser(null);
      setSearched(false);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timeout = setTimeout(async () => {
      const user = await lookupUsername(username);
      setFoundUser(user);
      setSearched(true);
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [input]);

  useEffect(() => {
    getUsers();
    getGroups();
    getRequests();
  }, [onlineUsers]);

  const isContact = (userId) => users.some((user) => user._id === userId);

  const openChat = (user) => {
    setSelectedUser(user);
    setUnseenMessages((prev) => ({ ...prev, [user._id]: 0 }));
  };

  const submitGroup = async (event) => {
    event.preventDefault();
    const created = await createGroup(groupName, groupMembers);
    if (created) {
      setGroupOpen(false);
      setGroupName("");
      setGroupMembers([]);
    }
  };

  return (
    <div className={`bg-[#8185B2]/10 h-full p-5 rounded-r-xl overflow-y-scroll text-white ${selectedUser ? "max-md:hidden" : ""}`}>
      <div className="pb-5">
        <div className="flex justify-between items-center">
          <img src={assets.logo} alt="logo" className="max-w-40" />
          <div className="relative py-2 group">
            <img src={assets.menu_icon} alt="" className="max-w-5 cursor-pointer" />
            <div className="absolute top-full right-0 z-20 w-40 p-4 rounded-md bg-[#282142] border border-gray-600 text-gray-100 hidden group-hover:block">
              <button onClick={() => navigate("/profile")} className="block w-full text-left text-sm cursor-pointer">Edit Profile</button>
              <button onClick={() => navigate("/saved")} className="block w-full text-left text-sm mt-2 cursor-pointer">Saved Messages</button>
              <button onClick={() => navigate("/share")} className="block w-full text-left text-sm mt-2 cursor-pointer">Share Profile</button>
              <button onClick={() => navigate("/sessions")} className="block w-full text-left text-sm mt-2 cursor-pointer">Sessions</button>
              <button onClick={() => navigate("/settings")} className="block w-full text-left text-sm mt-2 cursor-pointer">Settings</button>
              {authUser?.isAdmin && <button onClick={() => navigate("/reports")} className="block w-full text-left text-sm mt-2 cursor-pointer">Reports</button>}
              <hr className="my-2 border-gray-500" />
              <button onClick={() => setGroupOpen(true)} className="block w-full text-left text-sm cursor-pointer">New group</button>
              <button onClick={logout} className="block w-full text-left text-sm mt-2 cursor-pointer">Logout</button>
            </div>
          </div>
        </div>
        {!authUser?.username && (
          <button onClick={() => navigate("/profile")} className="mt-4 w-full text-left text-xs bg-[#282142] border border-gray-600 rounded-xl px-3 py-2">
            Choose a username so people can find you.
          </button>
        )}
        <div className="bg-[#282142] rounded-full flex items-center gap-2 py-3 px-4 mt-5">
          <img src={assets.search_icon} alt="" className="w-3" />
          <input value={input} onChange={(event) => setInput(event.target.value)} className="bg-transparent border-none outline-none text-white text-xs placeholder-[#c8c8c8] flex-1" placeholder="Exact username" />
        </div>
      </div>

      {groupOpen && (
        <form onSubmit={submitGroup} className="mb-4 rounded-xl border border-gray-600 p-3 text-sm">
          <p className="mb-2">New group</p>
          <input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Group name" className="w-full mb-2 bg-transparent border border-gray-500 rounded-md p-2 outline-none" />
          <div className="max-h-28 overflow-y-auto">
            {users.map((user) => (
              <label key={user._id} className="flex items-center gap-2 py-1">
                <input type="checkbox" checked={groupMembers.includes(user._id)} onChange={(event) => {
                  setGroupMembers((prev) => event.target.checked ? [...prev, user._id] : prev.filter((id) => id !== user._id));
                }} />
                <span>{user.fullName}</span>
              </label>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <button type="submit" className="px-3 py-1 rounded-full bg-violet-600 text-xs">Create</button>
            <button type="button" onClick={() => setGroupOpen(false)} className="px-3 py-1 rounded-full border border-gray-500 text-xs">Cancel</button>
          </div>
        </form>
      )}

      {requests.length > 0 && !input && (
        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-2">Requests</p>
          {requests.map((request) => (
            <div key={request._id} className="flex items-center justify-between gap-2 py-2">
              <p className="text-sm truncate">{request.from?.fullName}</p>
              <div className="flex gap-1">
                <button onClick={() => acceptRequest(request._id)} className="text-xs px-2 py-1 rounded-full bg-violet-600">Accept</button>
                <button onClick={() => rejectRequest(request._id)} className="text-xs px-2 py-1 rounded-full border border-gray-500">Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col">
        {input.trim().replace(/^@/, "").length >= 3 ? (
          <div>
            <p className="text-xs text-gray-400 mb-2 px-2">{isSearching ? "Searching..." : "Username"}</p>
            {!foundUser && searched && !isSearching && <p className="text-xs text-gray-400 p-4 text-center">No user found.</p>}
            {foundUser && (
              <div className="flex items-center justify-between p-2 pl-4 rounded">
                <div className="flex items-center gap-2">
                  <img src={foundUser.profilePic || assets.avatar_icon} alt="" className="w-[35px] aspect-square rounded-full" />
                  <div>
                    <p className="text-sm">{foundUser.fullName}</p>
                    <p className="text-xs text-gray-400">@{foundUser.username}</p>
                  </div>
                </div>
                {isContact(foundUser._id) ? (
                  <button onClick={() => openChat(foundUser)} className="text-xs border border-gray-500 px-3 py-1 rounded-full">Chat</button>
                ) : (
                  <button onClick={() => requestContact(foundUser._id)} className="text-xs bg-violet-600 px-3 py-1 rounded-full">Request</button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div>
            {groups.map((group) => (
              <button key={group._id} onClick={() => openChat(group)} className={`w-full text-left relative flex items-center gap-2 p-2 pl-4 rounded ${selectedUser?._id === group._id ? "bg-[#282142]/50" : ""}`}>
                <div className="w-[35px] aspect-square rounded-full bg-violet-700 flex items-center justify-center text-xs">G</div>
                <div>
                  <p>{group.fullName}</p>
                  <span className="text-neutral-400 text-xs">Group</span>
                </div>
                {unseenMessages[group._id] > 0 && <span className="absolute top-4 right-4 text-xs h-5 w-5 flex justify-center items-center rounded-full bg-violet-500/50">{unseenMessages[group._id]}</span>}
              </button>
            ))}
            {users.length === 0 && groups.length === 0 ? (
              <div className="text-center py-10 px-4 text-gray-400 text-xs">
                <p className="text-gray-300 mb-1">No contacts yet</p>
                <p>Search an exact username to send a request.</p>
              </div>
            ) : users.map((user) => (
              <button key={user._id} onClick={() => openChat(user)} className={`w-full text-left relative flex items-center gap-2 p-2 pl-4 rounded ${selectedUser?._id === user._id ? "bg-[#282142]/50" : ""}`}>
                <img src={user.profilePic || assets.avatar_icon} alt="" className="w-[35px] aspect-square rounded-full" />
                <div className="flex flex-col leading-5">
                  <p>{user.fullName}</p>
                  {onlineUsers.includes(user._id) ? <span className="text-green-400 text-xs">Online</span> : <span className="text-neutral-400 text-xs">Offline</span>}
                </div>
                {unseenMessages[user._id] > 0 && <span className="absolute top-4 right-4 text-xs h-5 w-5 flex justify-center items-center rounded-full bg-violet-500/50">{unseenMessages[user._id]}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
