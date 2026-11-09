import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { apiError } from "../lib/apiError";

const SavedPage = () => {
  const { axios } = useContext(AuthContext);
  const [messages, setMessages] = useState([]);
  const [state, setState] = useState("loading");
  const navigate = useNavigate();

  useEffect(() => {
    axios.get("/api/messages/saved").then(({ data }) => {
      setMessages(data.messages || []);
      setState("ready");
    }).catch((error) => {
      setState(apiError(error));
    });
  }, []);

  return (
    <div className="min-h-screen text-white p-6 max-w-2xl mx-auto">
      <button type="button" onClick={() => navigate("/")} className="text-sm text-violet-300 mb-4">Back</button>
      <h1 className="text-2xl mb-2">Saved Messages</h1>
      <p className="text-sm text-gray-300 mb-6">A bookmark stays after the conversation expires. It is visible only to you.</p>
      {state === "loading" && <p>Loading saved messages...</p>}
      {state !== "loading" && state !== "ready" && <p>{state}</p>}
      {state === "ready" && messages.length === 0 && <p className="text-gray-400">You have not bookmarked any messages.</p>}
      <div className="flex flex-col gap-3">
        {messages.map((message) => (
          <article key={message._id} className="border border-gray-600 rounded-xl p-4 bg-white/5">
            <p className="text-xs text-gray-400">{message.senderName} · {new Date(message.originalCreatedAt || message.createdAt).toLocaleString()}</p>
            {message.text && <p className="mt-2">{message.text}</p>}
            {message.image && <img src={message.image} alt="" className="mt-2 max-h-40 rounded-md" />}
            {message.audio && <audio controls src={message.audio} className="mt-2" />}
            {message.transcript && <p className="text-sm text-gray-300 mt-2">{message.transcript}</p>}
          </article>
        ))}
      </div>
    </div>
  );
};

export default SavedPage;
