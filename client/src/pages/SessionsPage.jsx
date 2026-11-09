import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";
import { apiError } from "../lib/apiError";
import ConfirmDialog from "../components/ConfirmDialog";

const SessionsPage = () => {
  const { axios, logout } = useContext(AuthContext);
  const [sessions, setSessions] = useState([]);
  const [state, setState] = useState("loading");
  const [pending, setPending] = useState(null);
  const navigate = useNavigate();

  const load = () => {
    axios.get("/api/sessions").then(({ data }) => {
      setSessions(data.sessions || []);
      setState("ready");
    }).catch((error) => setState(apiError(error)));
  };

  useEffect(load, []);

  const revoke = async () => {
    const current = pending?.current;
    try {
      const { data } = await axios.post(`/api/sessions/${pending.id}/revoke`);
      if (!data.success) return toast.error(data.message);
      if (current) logout();
      else load();
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="min-h-screen text-white p-6 max-w-2xl mx-auto">
      <button type="button" onClick={() => navigate("/")} className="text-sm text-violet-300 mb-4">Back</button>
      <h1 className="text-2xl mb-2">Sessions</h1>
      <p className="text-sm text-gray-300 mb-6">These are the devices signed in to your account. Session secrets are not shown.</p>
      {state === "loading" && <p>Loading sessions...</p>}
      {state !== "loading" && state !== "ready" && <p>{state}</p>}
      <div className="flex flex-col gap-3">
        {sessions.filter((session) => !session.revoked).map((session) => (
          <article key={session.id} className="border border-gray-600 rounded-xl p-4 flex justify-between gap-3">
            <div>
              <p>{session.device} {session.current && <span className="text-violet-300 text-xs">This device</span>}</p>
              <p className="text-xs text-gray-400">Last active {new Date(session.lastActiveAt).toLocaleString()}</p>
            </div>
            <button type="button" onClick={() => setPending(session)} className="text-sm text-red-300">Log out</button>
          </article>
        ))}
      </div>
      <ConfirmDialog open={Boolean(pending)} title="End this session?" body="That device will need to log in again." confirmLabel="End session" onClose={() => setPending(null)} onConfirm={revoke} />
    </div>
  );
};

export default SessionsPage;
