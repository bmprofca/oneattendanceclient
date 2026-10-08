import React, { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useNavigate } from "react-router-dom";
import { FaHistory, FaMapMarkerAlt, FaSyncAlt } from "react-icons/fa";
import { toast } from "react-toastify";
import apiCall from "../utils/api";
import { useAuth } from "../context/AuthContext";

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN || "";
const REFRESH_MS = 12000;

function ageLabel(value) {
  if (!value) return "No recent update";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `Updated ${seconds} sec ago`;
  const minutes = Math.floor(seconds / 60);
  return `Updated ${minutes} min ago`;
}

function createMarkerElement(employee, onSelect) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "employee-location-marker";
  element.title = employee.name || "Employee";
  element.setAttribute("aria-label", `Show ${employee.name || "employee"}`);
  Object.assign(element.style, {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "5px 9px 5px 6px",
    border: "1px solid #d5e5dd",
    borderRadius: "18px",
    background: "#fff",
    color: "#173a2e",
    boxShadow: "0 3px 12px rgba(19, 47, 37, .18)",
    font: "600 12px/1.2 sans-serif",
    whiteSpace: "nowrap",
    cursor: "pointer",
  });
  const dot = document.createElement("span");
  Object.assign(dot.style, {
    width: "9px",
    height: "9px",
    borderRadius: "50%",
    background: "#15966a",
    boxShadow: "0 0 0 3px #dff3e9",
  });
  const name = document.createElement("span");
  name.textContent = employee.name || "Employee";
  element.append(dot, name);
  element.addEventListener("click", () => onSelect(employee.employee_id));
  return element;
}

export default function EmployeeLocations() {
  const { company } = useAuth();
  const navigate = useNavigate();
  const companyId = company?.id;
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef(new Map());
  const hasFitLiveBounds = useRef(false);
  const [liveLocations, setLiveLocations] = useState([]);
  const [employeeOptions, setEmployeeOptions] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [historyPoints, setHistoryPoints] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [mode, setMode] = useState("live");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [page, setPage] = useState(1);
  const [historyMeta, setHistoryMeta] = useState(null);

  const refreshLive = useCallback(async () => {
    if (!companyId) return;
    try {
      const response = await apiCall("/location/admin/live", "GET", null, companyId);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Live locations unavailable");
      setLiveLocations(result.data || []);
      setLastRefresh(new Date());
    } catch (error) {
      toast.error(error.message || "Could not refresh live locations");
    }
  }, [companyId]);

  const loadHistory = useCallback(async (employee, requestedPage = 1) => {
    const employeeId = employee?.employee_id ?? employee?.id;
    if (!companyId || !employeeId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(requestedPage), limit: "500" });
      if (fromDate) params.set("from", `${fromDate} 00:00:00`);
      if (toDate) params.set("to", `${toDate} 23:59:59`);
      const response = await apiCall(
        `/location/admin/${employeeId}/history?${params.toString()}`,
        "GET",
        null,
        companyId,
      );
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Location history unavailable");
      setHistoryPoints(result.data?.points || []);
      setHistoryMeta(result.meta || null);
      setPage(requestedPage);
      setMode("history");
    } catch (error) {
      toast.error(error.message || "Could not load location history");
    } finally {
      setLoading(false);
    }
  }, [companyId, fromDate, toDate]);

  useEffect(() => {
    if (!companyId) return undefined;
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ page: "1", limit: "100" });
        if (employeeSearch.trim()) params.set("search", employeeSearch.trim());
        const response = await apiCall(`/employees/list?${params}`, "GET", null, companyId);
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Employee list unavailable");
        setEmployeeOptions((result.data || []).map(employee => ({
          employee_id: employee.id,
          name: employee.name || "Employee",
          designation: employee.designation,
          profile_picture: employee.profile_picture,
        })));
      } catch (error) {
        toast.error(error.message || "Could not load employees");
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [companyId, employeeSearch]);

  useEffect(() => {
    refreshLive();
    const timer = window.setInterval(refreshLive, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refreshLive]);

  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainer.current || map.current) return undefined;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [78.9629, 20.5937],
      zoom: 4,
      attributionControl: true,
    });
    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    return () => {
      markers.current.forEach(marker => marker.remove());
      markers.current.clear();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance) return undefined;

    const drawLocations = () => {
      markers.current.forEach(marker => marker.remove());
      markers.current.clear();
      if (mode === "history") {
      const coordinates = historyPoints.map(point => [Number(point.longitude), Number(point.latitude)]);
      const source = mapInstance.getSource("employee-location-history");
      if (source) {
        source.setData({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates },
        });
      } else {
        mapInstance.addSource("employee-location-history", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates },
          },
        });
        mapInstance.addLayer({
          id: "employee-location-history-line",
          type: "line",
          source: "employee-location-history",
          paint: { "line-color": "#0a805b", "line-width": 4, "line-opacity": 0.85 },
        });
      }
      if (coordinates.length === 1) {
        const marker = new mapboxgl.Marker({ color: "#087f5b" })
          .setLngLat(coordinates[0])
          .addTo(mapInstance);
        markers.current.set("history-point", marker);
        mapInstance.flyTo({ center: coordinates[0], zoom: 15 });
      } else if (coordinates.length > 1) {
        const bounds = coordinates.reduce(
          (result, point) => result.extend(point),
          new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]),
        );
        mapInstance.fitBounds(bounds, { padding: 70, maxZoom: 15 });
      }
        return;
      }

      if (mapInstance.getSource("employee-location-history")) {
        mapInstance.removeLayer("employee-location-history-line");
        mapInstance.removeSource("employee-location-history");
      }
      const live = liveLocations.filter(item => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)));
      live.forEach(employee => {
        const marker = new mapboxgl.Marker({ element: createMarkerElement(employee, setSelectedEmployee) })
          .setLngLat([Number(employee.longitude), Number(employee.latitude)])
          .addTo(mapInstance);
        markers.current.set(employee.employee_id, marker);
      });
      if (live.length && !hasFitLiveBounds.current) {
        hasFitLiveBounds.current = true;
        if (live.length === 1) {
          mapInstance.flyTo({ center: [Number(live[0].longitude), Number(live[0].latitude)], zoom: 13 });
        } else {
          const bounds = live.reduce(
            (result, employee) => result.extend([Number(employee.longitude), Number(employee.latitude)]),
            new mapboxgl.LngLatBounds(
              [Number(live[0].longitude), Number(live[0].latitude)],
              [Number(live[0].longitude), Number(live[0].latitude)],
            ),
          );
          mapInstance.fitBounds(bounds, { padding: 70, maxZoom: 12, duration: 400 });
        }
      }
    };
    if (mapInstance.isStyleLoaded()) drawLocations();
    else mapInstance.once("load", drawLocations);
    return () => mapInstance.off("load", drawLocations);
  }, [historyPoints, liveLocations, mode]);

  const selectedLive = liveLocations.find(item => Number(item.employee_id) === Number(selectedEmployee));
  const selectedHistoryEmployee = selectedLive
    || employeeOptions.find(employee => Number(employee.employee_id) === Number(selectedEmployee))
    || (selectedEmployee ? { employee_id: selectedEmployee, name: "Selected employee" } : null);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Employee locations</h2>
          <p className="mt-1 text-sm text-slate-500">
            {liveLocations.length} live {liveLocations.length === 1 ? "employee" : "employees"}
            {lastRefresh ? ` · refreshed ${ageLabel(lastRefresh)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("live")}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${mode === "live" ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white text-slate-700"}`}>
            <FaMapMarkerAlt size={13} /> Live
          </button>
          <button
            type="button"
            onClick={() => setMode("history")}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${mode === "history" ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white text-slate-700"}`}>
            <FaHistory size={13} /> History
          </button>
          <button
            type="button"
            onClick={refreshLive}
            aria-label="Refresh live locations"
            title="Refresh live locations"
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50">
            <FaSyncAlt size={13} />
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-h-[480px] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
          {MAPBOX_TOKEN ? (
            <div ref={mapContainer} className="h-[480px] w-full" aria-label="Employee location map" />
          ) : (
            <div className="flex h-[480px] flex-col items-center justify-center px-6 text-center">
              <FaMapMarkerAlt className="mb-3 text-emerald-700" size={24} />
              <p className="font-semibold text-slate-800">Mapbox token required</p>
              <p className="mt-2 max-w-sm text-sm text-slate-600">
                Configure <code>REACT_APP_MAPBOX_ACCESS_TOKEN</code> in the admin portal environment to render the live map.
              </p>
            </div>
          )}
        </div>

        <aside className="flex min-h-[480px] flex-col border-t border-slate-200 xl:border-l xl:border-t-0 xl:pl-4">
          {selectedLive ? (
            <div className="mb-3 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-3">
                {selectedLive.profile_picture ? (
                  <img src={selectedLive.profile_picture} alt="" className="h-11 w-11 rounded-full object-cover" />
                ) : (
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-emerald-100 font-bold text-emerald-800">
                    {(selectedLive.name || "E").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{selectedLive.name || "Employee"}</p>
                  <p className="truncate text-xs text-slate-500">{selectedLive.designation || "Employee"}</p>
                </div>
              </div>
              <p className="mt-3 text-sm font-semibold text-emerald-700">● Live</p>
              <p className="mt-1 text-xs text-slate-500">{ageLabel(selectedLive.last_updated_at)}</p>
              <p className="mt-1 text-xs text-slate-500">
                Accuracy: {selectedLive.accuracy == null ? "Unavailable" : `${Math.round(selectedLive.accuracy)} m`}
              </p>
              <button
                type="button"
                onClick={() => loadHistory(selectedLive)}
                className="mt-3 inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <FaHistory size={12} /> View history
              </button>
              <button
                type="button"
                onClick={() => navigate(`/employee-profile/${selectedLive.employee_id}`)}
                className="ml-2 mt-3 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                View profile
              </button>
            </div>
          ) : null}

          {mode === "history" ? (
            <div className="mb-3 space-y-2 border-b border-slate-200 pb-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-800">Location history</p>
                <button type="button" onClick={() => setMode("live")} className="text-xs font-semibold text-emerald-800">Back to live</button>
              </div>
              <label className="block text-[11px] text-slate-500">
                Employee
                <input
                  type="search"
                  value={employeeSearch}
                  onChange={event => setEmployeeSearch(event.target.value)}
                  placeholder="Search employees"
                  className="mt-1 w-full rounded-md border border-slate-300 p-2 text-xs text-slate-800"
                />
                <select
                  value={selectedEmployee || ""}
                  onChange={event => {
                    const employeeId = Number(event.target.value);
                    const employee = employeeOptions.find(item => Number(item.employee_id) === employeeId);
                    setSelectedEmployee(employeeId || null);
                    if (employee) loadHistory(employee, 1);
                  }}
                  className="mt-1 w-full rounded-md border border-slate-300 p-2 text-xs text-slate-800">
                  <option value="">Choose employee</option>
                  {employeeOptions.map(employee => (
                    <option key={employee.employee_id} value={employee.employee_id}>{employee.name}</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-slate-500">From<input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 p-1.5 text-xs text-slate-800" /></label>
                <label className="text-[11px] text-slate-500">To<input type="date" value={toDate} onChange={event => setToDate(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 p-1.5 text-xs text-slate-800" /></label>
              </div>
              <button
                type="button"
                disabled={loading || !selectedHistoryEmployee}
                onClick={() => loadHistory(selectedHistoryEmployee, 1)}
                className="w-full rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                {loading ? "Loading history..." : "Apply date range"}
              </button>
              <p className="text-xs text-slate-500">{historyMeta?.total ?? historyPoints.length} recorded points</p>
              {historyMeta?.total_pages > 1 ? (
                <div className="flex items-center justify-between text-xs">
                  <button disabled={page <= 1 || loading} onClick={() => loadHistory(selectedHistoryEmployee, page - 1)} className="text-emerald-800 disabled:text-slate-300">Previous</button>
                  <span>{page} / {historyMeta.total_pages}</span>
                  <button disabled={!historyMeta.has_next || loading} onClick={() => loadHistory(selectedHistoryEmployee, page + 1)} className="text-emerald-800 disabled:text-slate-300">Next</button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Live employees</h3>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">{liveLocations.length}</span>
            </div>
            {liveLocations.length ? liveLocations.map(employee => (
              <div
                role="button"
                tabIndex={0}
                key={employee.employee_id}
                onClick={() => {
                  setSelectedEmployee(employee.employee_id);
                  setMode("live");
                  if (map.current) map.current.flyTo({ center: [Number(employee.longitude), Number(employee.latitude)], zoom: 14 });
                }}
                onKeyDown={event => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedEmployee(employee.employee_id);
                  }
                }}
                className={`mb-1 flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-slate-50 ${Number(selectedEmployee) === Number(employee.employee_id) ? "bg-emerald-50" : ""}`}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-600" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-800">{employee.name || "Employee"}</span>
                  <span className="block truncate text-xs text-slate-500">{employee.designation || "Employee"} · {ageLabel(employee.last_updated_at)}</span>
                </span>
                <button
                  type="button"
                  onClick={event => { event.stopPropagation(); setSelectedEmployee(employee.employee_id); loadHistory(employee); }}
                  title="View location history"
                  aria-label={`View ${employee.name || "employee"} location history`}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-white hover:text-emerald-800">
                  <FaHistory size={13} />
                </button>
              </div>
            )) : (
              <p className="rounded-md bg-slate-50 px-3 py-5 text-center text-sm text-slate-500">No employees are sharing live location.</p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}