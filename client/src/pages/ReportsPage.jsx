import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { apiError } from "../lib/apiError";

const ReportsPage = () => {
  const { axios } = useContext(AuthContext);
  const [reports, setReports] = useState([]);
  const [state, setState] = useState("loading");
  const navigate = useNavigate();

  const load = () => {
    axios.get("/api/reports").then(({ data }) => {
      if (data.success) {
        setReports(data.reports || []);
        setState("ready");
      } else setState(data.message);
    }).catch((error) => setState(apiError(error)));
  };

  useEffect(load, []);

  return (
    <div className="min-h-screen text-white p-6 max-w-3xl mx-auto">
      <button type="button" onClick={() => navigate("/")} className="text-sm text-violet-300 mb-4">Back</button>
      <h1 className="text-2xl mb-4">Reports</h1>
      {state === "loading" && <p>Loading reports...</p>}
      {state !== "loading" && state !== "ready" && <p>{state}</p>}
      <div className="flex flex-col gap-3">
        {reports.map((report) => (
          <article key={report.id} className="border border-gray-600 rounded-xl p-4 text-sm">
            <p>{report.reason} · {report.status}</p>
            <p className="text-xs text-gray-400 mt-1">{report.description}</p>
            <select defaultValue={report.status} onChange={async (event) => {
              await axios.patch(`/api/reports/${report.id}`, { status: event.target.value });
              load();
            }} className="mt-2 bg-transparent border border-gray-600 rounded-md p-1">
              <option value="open">open</option>
              <option value="reviewing">reviewing</option>
              <option value="resolved">resolved</option>
              <option value="dismissed">dismissed</option>
            </select>
          </article>
        ))}
      </div>
    </div>
  );
};

export default ReportsPage;
