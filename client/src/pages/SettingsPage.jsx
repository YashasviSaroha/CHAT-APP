import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";

const SettingsPage = () => {
  const { authUser, updateNotifications, updateProfile } = useContext(AuthContext);
  const prefs = authUser?.notifications || { sound: true, desktop: false, mentions: true };
  const [discoverable, setDiscoverable] = useState(authUser?.discoverable !== false);
  const navigate = useNavigate();

  const saveNotification = async (key, value) => {
    if (key === "desktop" && value && Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
    }
    await updateNotifications({ ...prefs, [key]: value });
  };

  return (
    <div className="min-h-screen text-white p-6 max-w-xl mx-auto">
      <button type="button" onClick={() => navigate("/")} className="text-sm text-violet-300 mb-4">Back</button>
      <h1 className="text-2xl mb-6">Settings</h1>
      <section className="border border-gray-600 rounded-xl p-4 mb-4">
        <h2 className="mb-3">Notifications</h2>
        {["sound", "desktop", "mentions"].map((key) => (
          <label key={key} className="flex items-center justify-between py-2 text-sm capitalize">
            {key}
            <input type="checkbox" checked={prefs[key] !== false && (key !== "desktop" || prefs.desktop)} onChange={(event) => saveNotification(key, event.target.checked)} />
          </label>
        ))}
        <p className="text-xs text-gray-400 mt-2">A chat you are looking at does not also raise a desktop alert.</p>
      </section>
      <section className="border border-gray-600 rounded-xl p-4">
        <h2 className="mb-3">Discovery</h2>
        <label className="flex items-center justify-between text-sm">
          Allow exact username search
          <input type="checkbox" checked={discoverable} onChange={async (event) => {
            setDiscoverable(event.target.checked);
            await updateProfile({ discoverable: event.target.checked, fullName: authUser.fullName, bio: authUser.bio || "" });
          }} />
        </label>
      </section>
    </div>
  );
};

export default SettingsPage;
