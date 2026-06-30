import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import type { Socket } from 'socket.io-client';
import { 
  Video, 
  Shield, 
  AlertTriangle, 
  Activity, 
  Clock, 
  Volume2, 
  VolumeX,
  CameraOff
} from 'lucide-react';
import type { Camera, Detection, SystemSettings } from '../../../shared/types';

interface DashboardProps {
  socket: Socket | null;
  aiConnected: boolean;
  setAiConnected: (status: boolean) => void;
  detections: Detection[];
  setDetections: React.Dispatch<React.SetStateAction<Detection[]>>;
  cameras: Camera[];
  setCameras: React.Dispatch<React.SetStateAction<Camera[]>>;
}

export const Dashboard: React.FC<DashboardProps> = ({
  aiConnected,
  setAiConnected,
  detections,
  setDetections,
  cameras,
  setCameras
}) => {
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [aiStats, setAiStats] = useState({
    fps: 0.0,
    connectedCams: 0,
  });
  
  const processedRef = useRef<string | null>(null);

  // Fetch initial cameras, detections, and settings
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [camsRes, detsRes, settingsRes] = await Promise.all([
          api.get('/cameras'),
          api.get('/detections?limit=10'),
          api.get('/settings')
        ]);
        
        const enabledCams = camsRes.data;
        setCameras(enabledCams);
        setDetections(detsRes.data.detections || []);
        setSystemSettings(settingsRes.data);
        
        // Select first enabled camera
        const activeCams = enabledCams.filter((c: Camera) => c.enabled);
        if (activeCams.length > 0) {
          setSelectedCamera(activeCams[0]);
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      }
    };
    
    fetchData();
  }, []);

  // Monitor AI Engine status
  useEffect(() => {
    const checkAIEngineStatus = async () => {
      try {
        const res = await fetch('http://localhost:8000/status');
        if (res.ok) {
          const data = await res.json();
          setAiConnected(true);
          // Calculate average FPS or sum active streams
          let totalFps = 0.0;
          let activeCount = 0;
          for (const key in data.cameras) {
            totalFps = Math.max(totalFps, data.cameras[key].fps);
            if (data.cameras[key].is_connected) {
              activeCount++;
            }
          }
          setAiStats({
            fps: totalFps,
            connectedCams: activeCount
          });
        } else {
          setAiConnected(false);
        }
      } catch (e) {
        setAiConnected(false);
      }
    };

    checkAIEngineStatus();
    const interval = setInterval(checkAIEngineStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  // Dynamic Web Audio API Beep Generator
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch warning
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.12);
    } catch (e) {
      console.error("AudioContext beep failed", e);
    }
  };

  // Play beep on new real-time detections
  useEffect(() => {
    if (detections.length > 0 && processedRef.current !== detections[0]._id) {
      processedRef.current = detections[0]._id || null;
      
      // Only play beep warning sound if Gemini AI flags it as suspicious
      if (detections[0].isSuspicious !== false) {
        if (detections[0].detectionType !== 'motion' || (systemSettings?.audioAlerts)) {
          playBeep();
        }
      }
    }
  }, [detections, systemSettings]);

  // Compute metrics
  const detectionsCountToday = detections.filter(d => {
    const date = new Date(d.timestamp);
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }).length;

  const lastAlert = detections.find(d => ['fall', 'person', 'fire', 'smoke'].includes(d.detectionType));

  const getDetectionColor = (type: string) => {
    switch (type) {
      case 'fall': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'fire': return 'text-red-500 bg-red-500/10 border-red-500/20 animate-pulse';
      case 'person': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'motion': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  const getStreamUrl = () => {
    if (!selectedCamera) return "";
    return `http://localhost:8000/stream/${selectedCamera._id}?t=${Date.now()}`;
  };

  return (
    <div className="space-y-6">
      {/* Overview Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Camera Status */}
        <div className="glass rounded-2xl p-5 border border-white/5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Connected Cameras</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">{aiStats.connectedCams}</span>
              <span className="text-xs text-gray-500">/ {cameras.filter(c => c.enabled).length} active</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Video className="h-6 w-6" />
          </div>
        </div>

        {/* Stat 2: Today Detections */}
        <div className="glass rounded-2xl p-5 border border-white/5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Today's Detections</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">{detectionsCountToday}</span>
              <span className="text-xs text-gray-500">logged events</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
            <Activity className="h-6 w-6" />
          </div>
        </div>

        {/* Stat 3: AI Engine Info */}
        <div className="glass rounded-2xl p-5 border border-white/5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">AI FPS Status</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">
                {aiConnected ? `${aiStats.fps.toFixed(1)}` : '0.0'}
              </span>
              <span className="text-xs text-gray-500">frames/sec</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400">
            <Activity className="h-6 w-6 text-green-400" />
          </div>
        </div>

        {/* Stat 4: Last Alert */}
        <div className="glass rounded-2xl p-5 border border-white/5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Last Alert</span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-white truncate max-w-[150px]">
                {lastAlert ? `${lastAlert.detectionType.toUpperCase()} DETECTED` : 'None'}
              </p>
              <span className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3" />
                {lastAlert ? new Date(lastAlert.timestamp).toLocaleTimeString() : 'N/A'}
              </span>
            </div>
          </div>
          <div className={`p-3 rounded-xl border ${
            lastAlert ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-gray-500/10 border-gray-500/20 text-gray-400'
          }`}>
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Main Grid: Feed + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Feed Viewer */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass rounded-3xl overflow-hidden border border-white/5 flex flex-col">
            {/* Header controls */}
            <div className="px-6 py-4 bg-dark-800/80 border-b border-white/5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <span className="text-sm font-semibold text-white">Live Monitor</span>
                {selectedCamera && (
                  <span className="text-xs text-gray-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                    {selectedCamera.name} ({selectedCamera.type.toUpperCase()})
                  </span>
                )}
              </div>

              {/* Toolbar */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl border border-white/5 transition-all"
                  title={soundEnabled ? 'Mute Alert Sound' : 'Unmute Alert Sound'}
                >
                  {soundEnabled ? <Volume2 className="h-4 w-4 text-blue-400" /> : <VolumeX className="h-4 w-4" />}
                </button>
                <div className="h-4 w-[1px] bg-white/5 mx-1" />
                <select
                  value={selectedCamera?._id || ""}
                  onChange={(e) => {
                    const cam = cameras.find(c => c._id === e.target.value);
                    if (cam) setSelectedCamera(cam);
                  }}
                  className="bg-dark-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
                >
                  {cameras.filter(c => c.enabled).map((cam) => (
                    <option key={cam._id} value={cam._id}>
                      {cam.name}
                    </option>
                  ))}
                  {cameras.filter(c => c.enabled).length === 0 && (
                    <option value="">No Active Cameras</option>
                  )}
                </select>
              </div>
            </div>

            {/* Video Body */}
            <div className="relative aspect-video bg-dark-950 flex items-center justify-center overflow-hidden">
              {aiConnected && selectedCamera && selectedCamera.enabled ? (
                <img
                  src={getStreamUrl()}
                  alt="Live Camera Feed"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    // Try to fallback / hide
                    (e.target as any).src = "";
                  }}
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-center p-6">
                  <CameraOff className="h-16 w-16 text-gray-600 animate-pulse" />
                  <div>
                    <h3 className="text-gray-300 font-semibold">Feed Unavailable</h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-[280px]">
                      {!aiConnected 
                        ? "AI Engine server at port 8000 is loading or offline. Ensure Python service is running."
                        : !selectedCamera 
                          ? "Please configure and enable a camera stream in Camera Config."
                          : `Camera '${selectedCamera.name}' is currently disabled or connecting.`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Real-Time Alerts */}
        <div className="space-y-4">
          <div className="glass rounded-3xl p-5 border border-white/5 h-full flex flex-col max-h-[500px]">
            <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4">
              <h3 className="font-bold text-white text-sm tracking-wide">Real-time Detections</h3>
              <span className="text-[10px] uppercase font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                Live Feed
              </span>
            </div>

            {/* Alerts list */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {detections.map((det) => (
                <div 
                  key={det._id} 
                  className="bg-dark-800/80 rounded-xl p-3 border border-white/5 flex gap-3 hover:bg-dark-800 transition-colors animate-[fadeIn_0.3s_ease-out]"
                >
                  {/* Thumbnail / Alert indicator */}
                  <div className="w-16 h-16 rounded-lg bg-dark-900 border border-white/5 flex-shrink-0 overflow-hidden relative flex items-center justify-center">
                    {det.imagePath ? (
                      <img 
                        src={`http://localhost:5000${det.imagePath}`} 
                        alt="Detection Snapshot" 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <AlertTriangle className="h-6 w-6 text-gray-600" />
                    )}
                  </div>

                  {/* Text details */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getDetectionColor(det.detectionType)}`}>
                        {det.detectionType}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {new Date(det.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    
                    <p className="text-xs text-gray-300 font-medium truncate">
                      {(det.cameraId as any)?.name || 'Unknown Camera'}
                      {(det.cameraId as any)?.location && (
                        <span className="text-[10px] text-gray-500 font-normal ml-1.5">
                          ({(det.cameraId as any).location})
                        </span>
                      )}
                    </p>
                    
                    {det.geminiAnalysis && (
                      <p className="text-[10px] text-gray-400 italic bg-white/5 p-1.5 rounded-lg border border-white/5 leading-normal">
                        {det.geminiAnalysis}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between text-[9px] text-gray-500 mt-1">
                      <span>Confidence: {Math.round(det.confidence * 100)}%</span>
                      {det.isSuspicious === false ? (
                        <span className="text-[9px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded">
                          Normal
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">
                          Suspicious
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {detections.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
                  <Shield className="h-8 w-8 text-gray-600 mb-2" />
                  <p className="text-xs">No detections recorded today</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Dashboard;
