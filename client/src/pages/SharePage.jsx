import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { ChatContext } from "../../context/ChatContext";
import toast from "react-hot-toast";
import { apiError } from "../lib/apiError";

const SharePage = () => {
  const { axios } = useContext(AuthContext);
  const { getUsers, setSelectedUser } = useContext(ChatContext);
  const [qr, setQr] = useState(null);
  const [remaining, setRemaining] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!qr?.expiresAt) return undefined;
    const timer = setInterval(() => {
      const delta = new Date(qr.expiresAt).getTime() - Date.now();
      if (delta <= 0) {
        setRemaining("Expired");
        return;
      }
      const minutes = Math.floor(delta / 60000);
      const seconds = Math.floor((delta % 60000) / 1000);
      setRemaining(`${minutes}:${String(seconds).padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(timer);
  }, [qr]);

  const createCode = async () => {
    setBusy(true);
    try {
      const { data } = await axios.post("/api/qr");
      if (data.success) setQr(data);
      else toast.error(data.message);
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!qr?.id) return;
    await axios.post(`/api/qr/${qr.id}/revoke`);
    setQr(null);
    setRemaining("");
    toast.success("QR code revoked");
  };

  const redeem = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const { data } = await axios.post("/api/qr/redeem", { token: token.trim() });
      if (data.success) {
        toast.success(`Connected with ${data.user.fullName}`);
        await getUsers();
        setSelectedUser(data.user);
        navigate("/");
      } else toast.error(data.message);
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setBusy(false);
    }
  };

  const scan = async () => {
    if (!("BarcodeDetector" in window)) return toast.error("This browser cannot scan QR codes. Paste the code instead.");
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    const video = document.createElement("video");
    video.srcObject = stream;
    await video.play();
    const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    const started = Date.now();
    const tick = async () => {
      if (Date.now() - started > 20000) {
        stream.getTracks().forEach((track) => track.stop());
        toast.error("No QR code found.");
        return;
      }
      const codes = await detector.detect(video);
      if (codes[0]?.rawValue) {
        stream.getTracks().forEach((track) => track.stop());
        setToken(codes[0].rawValue);
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  };

  return (
    <div className="min-h-screen text-white p-6 max-w-xl mx-auto">
      <button type="button" onClick={() => navigate("/")} className="text-sm text-violet-300 mb-4">Back</button>
      <h1 className="text-2xl mb-2">Share profile</h1>
      <p className="text-sm text-gray-300 mb-6">The QR code holds a random token for 10 minutes. It does not contain your password, id, or login token. Each code works once.</p>
      <button type="button" onClick={createCode} disabled={busy} className="bg-violet-600 rounded-full px-4 py-2 text-sm">{busy ? "Working..." : "Create QR code"}</button>
      {qr && (
        <div className="mt-4 bg-white rounded-xl p-4 w-fit">
          <img src={qr.image} alt="Profile QR code" className="w-56 h-56" />
          <p className="text-black text-sm mt-2">Expires in {remaining || "10:00"}</p>
          <button type="button" onClick={revoke} className="text-sm text-violet-700 mt-2">Revoke now</button>
        </div>
      )}
      <form onSubmit={redeem} className="mt-8 flex flex-col gap-3">
        <h2 className="text-lg">Redeem a code</h2>
        <textarea value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste the QR token" className="bg-transparent border border-gray-600 rounded-xl p-3 text-sm outline-none" rows={3} />
        <div className="flex gap-2">
          <button className="bg-violet-600 rounded-full px-4 py-2 text-sm" disabled={busy}>Connect</button>
          <button type="button" onClick={scan} className="border border-gray-500 rounded-full px-4 py-2 text-sm">Scan</button>
        </div>
      </form>
    </div>
  );
};

export default SharePage;
