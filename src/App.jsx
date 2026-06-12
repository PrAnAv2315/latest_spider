import React, { useState } from 'react';
import { 
  Shield, Settings, Server, MapPin, Trash2, CheckCircle, 
  Upload, Network, Clock, FileOutput, Save, BellDot, 
  LayoutDashboard, Map, Sliders, Play, Square, Terminal, Activity, CheckSquare, Download
} from 'lucide-react';

// ==========================================
// GEOGRAPHIC MATH ENGINE (Replaces Python's geopy)
// ==========================================
const getDestinationCoords = (lat, lng, distanceMeters, bearingDeg) => {
  const R = 6371000; // Earth radius in meters
  const brng = bearingDeg * (Math.PI / 180);
  const lat1 = lat * (Math.PI / 180);
  const lon1 = lng * (Math.PI / 180);

  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distanceMeters / R) +
               Math.cos(lat1) * Math.sin(distanceMeters / R) * Math.cos(brng));
  const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(distanceMeters / R) * Math.cos(lat1),
                      Math.cos(distanceMeters / R) - Math.sin(lat1) * Math.sin(lat2));

  return {
    lat: lat2 * (180 / Math.PI),
    lng: lon2 * (180 / Math.PI)
  };
};


// ==========================================
// MODULE 1: DEVICE CONFIGURATION
// ==========================================
const DeviceConfigView = ({ devices, setDevices }) => {
  const [status, setStatus] = useState({ message: 'System Ready', type: 'info' });
  const [formData, setFormData] = useState({
    id: '', type: 'Radar', lat: '', lng: '', innerRange: 0, outerRange: 250, azimuth: 0, fov: 360
  });

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const extension = file.name.split('.').pop().toLowerCase();

      try {
        let parsedDevices = [];
        if (extension === 'json') {
          const data = JSON.parse(text);
          parsedDevices = data.map(d => ({
            id: d.SensorId, type: d.SensorType,
            innerRange: d.InnerRange, outerRange: d.OuterRange,
            azimuth: d.Azimuth, fov: d.FOV,
            lat: d.geometry?.coordinates?.[1] || d.lat || 0,
            lng: d.geometry?.coordinates?.[0] || d.lng || 0
          }));
        } else if (extension === 'kml') {
          const parser = new DOMParser();
          const xml = parser.parseFromString(text, "text/xml");
          const placemarks = xml.querySelectorAll("Placemark");

          placemarks.forEach(pm => {
            const coordNode = pm.querySelector("coordinates");
            const descNode = pm.querySelector("description");
            if (coordNode && descNode) {
              const coords = coordNode.textContent.trim().split(",");
              const desc = descNode.textContent;
              const extract = (key) => {
                const match = desc.match(new RegExp(`<B>${key}</B>\\s*=\\s*([^<]+)`, 'i'));
                return match ? match[1].trim() : null;
              };
              parsedDevices.push({
                id: extract("SensorId") || `UNK_${Math.floor(Math.random()*1000)}`,
                type: extract("SensorType") || "Unknown",
                innerRange: parseFloat(extract("InnerRange") || 0),
                outerRange: parseFloat(extract("OuterRange") || 100),
                azimuth: parseFloat(extract("Azimuth") || 0),
                fov: parseFloat(extract("FOV") || 360),
                lat: parseFloat(coords[1]),
                lng: parseFloat(coords[0])
              });
            }
          });
        }
        setDevices(prev => [...prev, ...parsedDevices]);
        setStatus({ message: `Imported ${parsedDevices.length} devices from ${file.name}`, type: 'success' });
        event.target.value = '';
      } catch (err) {
        setStatus({ message: `Import Error: ${err.message}`, type: 'error' });
      }
    };
    reader.readAsText(file);
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    setDevices(prev => [...prev, { ...formData, lat: parseFloat(formData.lat), lng: parseFloat(formData.lng) }]);
    setStatus({ message: `Manually added ${formData.id}`, type: 'success' });
    setFormData({ id: '', type: 'Radar', lat: '', lng: '', innerRange: 0, outerRange: 250, azimuth: 0, fov: 360 });
  };

  const removeDevice = (id) => setDevices(devices.filter(d => d.id !== id));

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-emerald-400 flex items-center space-x-2">
            <Settings className="w-6 h-6" /> <span>Device Configuration</span>
          </h2>
          <p className="text-slate-400 text-sm mt-1">Import via KML/JSON/CSV or manually configure simulation hardware.</p>
        </div>
        <div className={`px-4 py-2 rounded font-mono text-xs font-bold border ${status.type === 'error' ? 'bg-rose-950/50 border-rose-800 text-rose-400' : 'bg-emerald-950/50 border-emerald-800 text-emerald-400'}`}>
          {status.message}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center"><Upload className="w-4 h-4 mr-2 text-cyan-400"/> Universal Import</h3>
            <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center hover:bg-slate-800/50 transition-colors relative">
              <input type="file" accept=".json,.kml,.csv" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <MapPin className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-300">Drag & Drop or Click to Upload</p>
              <p className="text-xs text-slate-500 mt-1">Supports .KML, .JSON, and .CSV</p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center"><Settings className="w-4 h-4 mr-2 text-amber-400"/> Manual Entry</h3>
            <form onSubmit={handleManualSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="block text-xs text-slate-500 mb-1">Sensor ID</label><input required value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white" /></div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">Type</label>
                  <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white">
                    <option>Radar</option><option>Camera</option><option>PIDS</option>
                  </select>
                </div>
                <div><label className="block text-xs text-slate-500 mb-1">Latitude</label><input type="number" step="any" required value={formData.lat} onChange={e => setFormData({...formData, lat: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white" /></div>
                <div><label className="block text-xs text-slate-500 mb-1">Longitude</label><input type="number" step="any" required value={formData.lng} onChange={e => setFormData({...formData, lng: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white" /></div>
                <div><label className="block text-xs text-slate-500 mb-1">Inner Range (m)</label><input type="number" required value={formData.innerRange} onChange={e => setFormData({...formData, innerRange: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-cyan-400" /></div>
                <div><label className="block text-xs text-slate-500 mb-1">Outer Range (m)</label><input type="number" required value={formData.outerRange} onChange={e => setFormData({...formData, outerRange: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-cyan-400" /></div>
                <div><label className="block text-xs text-slate-500 mb-1">Azimuth (°)</label><input type="number" required value={formData.azimuth} onChange={e => setFormData({...formData, azimuth: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-amber-400" /></div>
                <div><label className="block text-xs text-slate-500 mb-1">FOV (°)</label><input type="number" required value={formData.fov} onChange={e => setFormData({...formData, fov: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-amber-400" /></div>
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold py-2 rounded transition-colors text-white">Add Hardware</button>
            </form>
          </div>
        </div>

        <div className="xl:col-span-2">
          <div className="bg-slate-900 border border-slate-800 rounded-lg h-full flex flex-col overflow-hidden">
            <div className="bg-slate-850 border-b border-slate-800 px-5 py-4 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center"><Server className="w-4 h-4 mr-2 text-indigo-400"/> Deployed Fleet Array ({devices.length})</h3>
            </div>
            <div className="flex-1 overflow-auto p-0">
              {devices.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 font-mono text-sm py-20">
                  <Server className="w-12 h-12 mb-4 opacity-20" />
                  No devices configured. Upload a file or add manually.
                </div>
              ) : (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-950/50 text-slate-400 font-mono text-xs sticky top-0">
                    <tr>
                      <th className="p-3">ID / Type</th>
                      <th className="p-3">Location</th>
                      <th className="p-3">Range</th>
                      <th className="p-3">Angles</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {devices.map((dev, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="p-3"><div className="font-bold text-slate-200">{dev.id}</div><div className="text-xs text-slate-500 uppercase">{dev.type}</div></td>
                        <td className="p-3 font-mono text-xs text-slate-400">{dev.lat.toFixed(4)}, {dev.lng.toFixed(4)}</td>
                        <td className="p-3 font-mono text-cyan-400">{dev.innerRange}m - {dev.outerRange}m</td>
                        <td className="p-3 font-mono text-amber-400">{dev.azimuth}° / {dev.fov}°</td>
                        <td className="p-3 text-right"><button onClick={() => removeDevice(dev.id)} className="text-slate-500 hover:text-rose-400"><Trash2 className="w-4 h-4 inline" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// MODULE 2: SCENARIO BUILDER
// ==========================================
const ScenarioBuilderView = ({ scenario, setScenario, devices }) => {
  const [status, setStatus] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setScenario(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const toggleDevice = (id) => {
    setScenario(prev => {
      const isActive = prev.activeDevices.includes(id);
      return {
        ...prev,
        activeDevices: isActive ? prev.activeDevices.filter(d => d !== id) : [...prev.activeDevices, id]
      };
    });
  };

  const handleSave = (e) => {
    e.preventDefault();
    if(scenario.activeDevices.length === 0) return alert("You must select at least one device for the scenario!");
    setStatus('Scenario successfully compiled and saved to memory.');
    setTimeout(() => setStatus(''), 4000);
  };

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-indigo-400 flex items-center space-x-2">
            <Sliders className="w-6 h-6" /> <span>Scenario Builder</span>
          </h2>
          <p className="text-slate-400 text-sm mt-1">Bind hardware to your mission and configure output networks.</p>
        </div>
        <span className="text-emerald-400 text-sm font-mono font-bold">{status && <><CheckCircle className="w-4 h-4 inline mr-2" />{status}</>}</span>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 shadow-sm md:col-span-2">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-500 mb-1 uppercase tracking-wider">Mission Designation (Scenario Name)</label>
              <input type="text" name="name" required value={scenario.name} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded px-4 py-3 text-white text-lg font-bold focus:border-indigo-500 focus:outline-none" />
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center border-b border-slate-800 pb-2"><CheckSquare className="w-4 h-4 mr-2 text-amber-400"/> Hardware Binding</h3>
          <p className="text-[11px] text-slate-500 mb-3">Select the specific units from your fleet that will generate alerts during this scenario.</p>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
            {devices.length === 0 ? (
              <div className="text-xs font-mono text-rose-400 p-3 bg-rose-950/20 border border-rose-900/50 rounded">No hardware configured. Go to Device Config.</div>
            ) : (
              devices.map(dev => (
                <div key={dev.id} onClick={() => toggleDevice(dev.id)} className={`flex items-center justify-between p-3 rounded cursor-pointer border transition-colors ${scenario.activeDevices.includes(dev.id) ? 'bg-indigo-950/40 border-indigo-500/50' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}>
                  <div>
                    <span className={`text-sm font-bold ${scenario.activeDevices.includes(dev.id) ? 'text-indigo-400' : 'text-slate-300'}`}>{dev.id}</span>
                    <span className="text-xs text-slate-500 ml-2 uppercase">({dev.type})</span>
                  </div>
                  <input type="checkbox" checked={scenario.activeDevices.includes(dev.id)} readOnly className="w-4 h-4 accent-indigo-500" />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center border-b border-slate-800 pb-2"><Network className="w-4 h-4 mr-2 text-cyan-400"/> Target Routing</h3>
          <div className="grid grid-cols-1 gap-4">
            <div><label className="block text-xs font-mono text-slate-500 mb-1">Target UDP IP Address</label><input type="text" name="udpIp" value={scenario.udpIp} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-cyan-400 font-mono" /></div>
            <div><label className="block text-xs font-mono text-slate-500 mb-1">Target UDP Port</label><input type="number" name="udpPort" value={scenario.udpPort} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-cyan-400 font-mono" /></div>
          </div>
        </div>

        <div className="md:col-span-2 flex justify-end">
          <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-3 rounded text-sm shadow-lg"><Save className="w-4 h-4 inline mr-2" />SAVE SCENARIO ARCHITECTURE</button>
        </div>
      </form>
    </div>
  );
};

// ==========================================
// MODULE 3: ALERT GENERATOR
// ==========================================
const AlertGeneratorView = ({ devices, scenario, alertConfig, setAlertConfig, setCompletedRuns }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState(0);

  const activeFleet = devices.filter(d => scenario.activeDevices.includes(d.id));

  const handleChange = (e) => {
    const { name, value } = e.target;
    setAlertConfig(prev => ({ ...prev, [name]: parseFloat(value) }));
  };

  const handleStartSimulation = () => {
    if (activeFleet.length === 0) return alert("MISSION ABORT: No hardware bound to scenario.");
    if (alertConfig.totalAlerts <= 0) return alert("Please specify a valid number of alerts.");
    
    setIsRunning(true);
    setLogs([{ time: new Date().toLocaleTimeString(), msg: `SYSTEM: Engaging '${scenario.name}'. Connecting to UDP Engine at 127.0.0.1:8000...`, type: 'info' }]);
    setProgress(0);

    let currentAlert = 0;
    let generatedAlertsMemory = []; 
    
    // THE ASYNC LOOP (Restored!)
    const runTick = async () => {
      if (currentAlert >= alertConfig.totalAlerts) {
        setIsRunning(false);
        setLogs(prev => [{ time: new Date().toLocaleTimeString(), msg: `SYSTEM: Transmission Complete. ${alertConfig.totalAlerts} packets sent.`, type: 'info' }, ...prev]);
        setCompletedRuns(prev => [...prev, {
          id: Date.now(), scenarioName: scenario.name, alertsGenerated: alertConfig.totalAlerts,
          timestamp: new Date().toLocaleString(), devices: activeFleet, alerts: generatedAlertsMemory
        }]);
        return;
      }

      currentAlert++;
      const dev = activeFleet[Math.floor(Math.random() * activeFleet.length)];
      
      try {
        // Ping Python to do the Geopy Math AND send the UDP!
        const response = await fetch('http://127.0.0.1:8000/api/transmit', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetIp: scenario.udpIp, targetPort: scenario.udpPort,
            trackId: currentAlert, device: dev
          })
        });
        
        const result = await response.json();

        if (result.status === "success") {
            // Save the exact math Python generated to memory for the KML later
            generatedAlertsMemory.push(result.alert_data);
            setLogs(prev => [{ time: new Date().toLocaleTimeString(), msg: `[${dev.id}] SPIDER -> ${result.packet}`, type: 'success' }, ...prev]);
        } else {
            setLogs(prev => [{ time: new Date().toLocaleTimeString(), msg: `[ERROR] Python Error: ${result.message}`, type: 'error' }, ...prev]);
        }

      } catch (error) { 
        setLogs(prev => [{ time: new Date().toLocaleTimeString(), msg: `[ERROR] Connection refused. Is Uvicorn running?`, type: 'error' }, ...prev]);
      }

      setProgress(Math.floor((currentAlert / alertConfig.totalAlerts) * 100));

      // Trigger the next packet after a random delay
      const delay = Math.random() * (alertConfig.maxDelaySec - alertConfig.minDelaySec) + alertConfig.minDelaySec;
      window.simTimeout = setTimeout(runTick, delay * 1000);
    };

    runTick(); // Start the loop
  };

  const handleStopSimulation = () => {
    clearTimeout(window.simTimeout);
    setIsRunning(false);
    setLogs(prev => [{ time: new Date().toLocaleTimeString(), msg: 'SYSTEM: Transmission Manually Aborted.', type: 'error' }, ...prev]);
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-rose-400 flex items-center space-x-2">
            <BellDot className="w-6 h-6" /> <span>Alert Generator</span>
          </h2>
          <p className="text-slate-400 text-sm mt-1">Generate dynamic UDP telemetry using parameters from '{scenario.name}'.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-5 flex items-center border-b border-slate-800 pb-2">
              <Sliders className="w-4 h-4 mr-2 text-cyan-400"/> Transmission Parameters
            </h3>
            <div className="space-y-4 mb-6">
              <div><label className="block text-xs font-mono text-slate-500 mb-1">Total Packets to Generate</label><input type="number" name="totalAlerts" value={alertConfig.totalAlerts} onChange={handleChange} disabled={isRunning} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-rose-400 font-bold disabled:opacity-50" /></div>
              
              <div>
                <label className="block text-xs font-mono text-slate-500 mb-1 flex items-center"><Clock className="w-3 h-3 mr-1 text-amber-400"/> Timing Physics (Seconds)</label>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" step="0.1" name="minDelaySec" value={alertConfig.minDelaySec} onChange={handleChange} disabled={isRunning} placeholder="Min Delay" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-amber-400 font-mono disabled:opacity-50" />
                  <input type="number" step="0.1" name="maxDelaySec" value={alertConfig.maxDelaySec} onChange={handleChange} disabled={isRunning} placeholder="Max Delay" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-amber-400 font-mono disabled:opacity-50" />
                </div>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex justify-between text-xs font-mono mb-1 text-slate-400"><span>Simulation Progress</span><span>{progress}%</span></div>
              <div className="w-full bg-slate-950 rounded-full h-2 border border-slate-800"><div className="bg-rose-500 h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div></div>
            </div>

            {!isRunning ? (
              <button onClick={handleStartSimulation} className="w-full flex justify-center items-center space-x-2 bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded text-sm shadow-lg">
                <Play className="w-4 h-4 fill-current" /> <span>ENGAGE TRANSMITTER</span>
              </button>
            ) : (
              <button onClick={handleStopSimulation} className="w-full flex justify-center items-center space-x-2 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded text-sm shadow-lg animate-pulse">
                <Square className="w-4 h-4 fill-current" /> <span>ABORT</span>
              </button>
            )}
          </div>
        </div>

        <div className="xl:col-span-2">
          <div className="bg-[#0A0A0A] border border-slate-800 rounded-lg h-full flex flex-col overflow-hidden shadow-2xl relative">
            <div className="bg-slate-900 border-b border-slate-800 px-5 py-3 flex justify-between items-center z-10">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center font-mono"><Terminal className="w-4 h-4 mr-2 text-slate-500"/> Live UDP Telemetry</h3>
              {isRunning && <span className="flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>}
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed space-y-1">
              {logs.length === 0 ? <div className="text-slate-600 mt-2">Waiting for simulation to begin...</div> : logs.map((log, idx) => (
                <div key={idx} className={`flex space-x-3 ${log.type === 'error' ? 'text-rose-400' : log.type === 'info' ? 'text-cyan-400' : 'text-emerald-400'}`}>
                  <span className="opacity-50 shrink-0">[{log.time}]</span><span className="break-all">{log.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// MODULE 4: REPORTS / EXPORT
// ==========================================
const ExportView = ({ completedRuns }) => {

const handleDownload = async (run) => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioName: run.scenarioName, devices: run.devices, alerts: run.alerts })
      });
      const data = await response.json();

      // Download KML
      const kmlBlob = new Blob([data.kml_content], { type: 'application/vnd.google-earth.kml+xml' });
      const kmlUrl = URL.createObjectURL(kmlBlob);
      const link1 = document.createElement('a');
      link1.href = kmlUrl; link1.download = `${run.scenarioName.replace(/\s+/g, '_')}_Output.kml`;
      link1.click();

      // Download CSV
      const csvBlob = new Blob([data.csv_content], { type: 'text/csv' });
      const csvUrl = URL.createObjectURL(csvBlob);
      const link2 = document.createElement('a');
      link2.href = csvUrl; link2.download = `${run.scenarioName.replace(/\s+/g, '_')}_Output.csv`;
      link2.click();

    } catch (err) {
      alert("Failed to generate export files from backend.");
    }
  };

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-emerald-400 flex items-center space-x-2">
            <FileOutput className="w-6 h-6" /> <span>Reports & Export</span>
          </h2>
          <p className="text-slate-400 text-sm mt-1">Download dynamic KML files containing accurate plotting of hardware and alerts.</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
        <div className="bg-slate-850 border-b border-slate-800 px-5 py-4">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-cyan-400"/> Completed Simulation Runs ({completedRuns.length})</h3>
        </div>
        
        <div className="p-0 max-h-[500px] overflow-y-auto">
          {completedRuns.length === 0 ? (
            <div className="p-10 text-center text-slate-500 font-mono text-sm">
              No simulations have been completed yet.<br/>Go to the Alert Generator to run a scenario.
            </div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-950/50 text-slate-400 font-mono text-xs sticky top-0">
                <tr>
                  <th className="p-4">Simulation Timestamp</th>
                  <th className="p-4">Mission Designation</th>
                  <th className="p-4">Alerts Transmitted</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {completedRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-800/30">
                    <td className="p-4 text-slate-300 font-mono text-xs">{run.timestamp}</td>
                    <td className="p-4 font-bold text-emerald-400">{run.scenarioName}</td>
                    <td className="p-4 text-slate-300 font-mono">{run.alertsGenerated} Packets</td>
                    <td className="p-4 text-right">
                      <button onClick={() => handleDownload(run)} className="bg-slate-800 hover:bg-slate-700 text-white font-medium px-4 py-2 rounded transition-colors text-xs flex items-center ml-auto">
                        <Download className="w-3 h-3 mr-2" /> DOWNLOAD KML
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// MASTER APP (COMMAND CENTER)
// ==========================================
export default function App() {
  const [currentView, setCurrentView] = useState('Device Configuration');
  
  // THE GLOBAL STATE
  const [devices, setDevices] = useState([]);
  const [scenario, setScenario] = useState({
    name: 'Operation Alpha', activeDevices: [], udpIp: '172.20.148.254', udpPort: 5005
  });
  const [alertConfig, setAlertConfig] = useState({
    totalAlerts: 10, minDelaySec: 0.1, maxDelaySec: 0.5
  });
  
  const [completedRuns, setCompletedRuns] = useState([]);

  const menuItems = [
    { name: 'Device Configuration', icon: Settings },
    { name: 'Scenario Builder', icon: Sliders },
    { name: 'Alert Generator', icon: BellDot },
    { name: 'Reports / Export', icon: FileOutput },
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-900 overflow-hidden">
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 z-10 shadow-2xl">
        <div className="h-16 border-b border-slate-800 flex items-center px-6">
          <Shield className="w-6 h-6 text-emerald-400 mr-3" />
          <span className="font-bold tracking-wider text-lg">SIMCORE <span className="text-xs text-slate-500">v2.5</span></span>
        </div>
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.name;
              return (
                <li key={item.name}>
                  <button onClick={() => setCurrentView(item.name)} className={`w-full flex items-center px-6 py-3 text-sm font-medium transition-colors ${isActive ? 'bg-cyan-950/30 text-cyan-400 border-r-2 border-cyan-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                    <Icon className={`w-4 h-4 mr-3 ${isActive ? 'text-cyan-400' : 'opacity-70'}`} /> {item.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden bg-slate-950">
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 flex items-center justify-between shrink-0">
          <h1 className="text-sm font-bold text-slate-300 uppercase tracking-widest">{currentView}</h1>
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-slate-950 border border-slate-800 font-mono text-xs">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span><span className="text-slate-300">ENGINE: IDLE</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {currentView === 'Device Configuration' && <DeviceConfigView devices={devices} setDevices={setDevices} />}
          {currentView === 'Scenario Builder' && <ScenarioBuilderView devices={devices} scenario={scenario} setScenario={setScenario} />}
          {currentView === 'Alert Generator' && <AlertGeneratorView devices={devices} scenario={scenario} alertConfig={alertConfig} setAlertConfig={setAlertConfig} setCompletedRuns={setCompletedRuns} />}
          {currentView === 'Reports / Export' && <ExportView completedRuns={completedRuns} />}
        </div>
      </main>
    </div>
  );
}