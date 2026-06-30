import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { io, type Socket } from 'socket.io-client';
import api from './services/api';

// Pages & Components
import Auth from './pages/Auth';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Cameras from './pages/Cameras';
import Events from './pages/Events';
import Settings from './pages/Settings';
import type { Camera, Detection } from '../../shared/types';
import { Bell, X, ShieldAlert, Check } from 'lucide-react';

const MainApp: React.FC = () => {
  const { token, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [aiConnected, setAiConnected] = useState(false);
  
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
  
  const socketRef = useRef<Socket | null>(null);

  // Load cameras and initial notifications
  useEffect(() => {
    if (!token) return;
    
    const loadInitialData = async () => {
      try {
        const camsRes = await api.get('/cameras');
        setCameras(camsRes.data);
        
        const detsRes = await api.get('/detections?limit=25');
        setDetections(detsRes.data.detections || []);
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    };
    loadInitialData();
  }, [token]);

  // Establish Socket.IO real-time channel
  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
      return;
    }

    const socketUrl = 'http://localhost:5000';
    console.log(`Connecting Socket.IO to ${socketUrl}...`);
    
    const socketIo = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socketRef.current = socketIo;
    setSocket(socketIo);

    socketIo.on('connect', () => {
      console.log('Socket.IO channel established');
      setSocketConnected(true);
    });

    socketIo.on('disconnect', () => {
      console.log('Socket.IO channel disconnected');
      setSocketConnected(false);
    });

    // Real-time detection event trigger
    socketIo.on('new-detection', (detection: Detection) => {
      console.log('Real-time detection received:', detection);
      setDetections((prev) => [detection, ...prev.slice(0, 29)]); // keep max 30 recent

      // If browser supports notifications and allowed, show HTML5 notification
      // Only send notification if Gemini AI flagged it as suspicious/unwanted
      if (Notification.permission === 'granted' && detection.isSuspicious !== false) {
        const camName = (detection.cameraId as any)?.name || 'Camera';
        const locationTag = (detection.cameraId as any)?.location ? ` (${(detection.cameraId as any).location})` : '';
        const bodyText = detection.geminiAnalysis 
          ? `AI: ${detection.geminiAnalysis}` 
          : `${detection.detectionType.toUpperCase()} detected on ${camName}${locationTag}`;
          
        new Notification(`🚨 SECURE ALERT: ${detection.detectionType.toUpperCase()}`, {
          body: bodyText,
          icon: '/favicon.ico'
        });
      }
    });

    // Real-time camera config updates
    socketIo.on('camera-config-changed', async () => {
      console.log('Camera configuration change broadcast received');
      try {
        const res = await api.get('/cameras');
        setCameras(res.data);
      } catch (e) {
        console.error(e);
      }
    });

    // Request HTML5 notification permissions
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      socketIo.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex justify-center items-center">
        <span className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!token) {
    return <Auth />;
  }

  const unreadCount = detections.filter(d => d.status === 'unread').length;

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await api.put(`/detections/${id}/read`);
      setDetections(detections.map(d => d._id === id ? res.data : d));
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put('/detections/read/all');
      setDetections(detections.map(d => ({ ...d, status: 'read' })));
    } catch (e) {
      console.error(e);
    }
  };

  const getDetectionColor = (type: string) => {
    switch (type) {
      case 'fall': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'fire': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'person': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'motion': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard 
            socket={socket}
            aiConnected={aiConnected}
            setAiConnected={setAiConnected}
            detections={detections}
            setDetections={setDetections}
            cameras={cameras}
            setCameras={setCameras}
          />
        );
      case 'cameras':
        return <Cameras cameras={cameras} setCameras={setCameras} />;
      case 'events':
        return <Events cameras={cameras} detections={detections} setDetections={setDetections} />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard socket={socket} aiConnected={aiConnected} setAiConnected={setAiConnected} detections={detections} setDetections={setDetections} cameras={cameras} setCameras={setCameras} />;
    }
  };

  return (
    <Layout
      currentPage={currentPage}
      setCurrentPage={setCurrentPage}
      socketConnected={socketConnected}
      aiEngineStatus={aiConnected}
      unreadCount={unreadCount}
      onOpenNotifications={() => setNotifDrawerOpen(true)}
    >
      {renderPage()}

      {/* Notifications slide-out drawer panel */}
      {notifDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop overlay */}
          <div 
            onClick={() => setNotifDrawerOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300" 
          />
          
          <div className="absolute inset-y-0 right-0 max-w-full flex">
            <div className="w-screen max-w-md bg-dark-800 border-l border-white/5 shadow-2xl flex flex-col justify-between animate-[slideIn_0.3s_ease-out]">
              
              {/* Drawer Header */}
              <div className="px-6 py-5 border-b border-white/5 bg-dark-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Bell className="h-5 w-5 text-blue-500" />
                  <h3 className="font-bold text-white text-md">Security Notifications</h3>
                </div>
                <button 
                  onClick={() => setNotifDrawerOpen(false)}
                  className="text-gray-400 hover:text-white p-1 hover:bg-white/5 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer Content - list of unread */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-gray-400">Showing recent unread events</span>
                  {unreadCount > 0 && (
                    <button 
                      onClick={handleMarkAllRead}
                      className="text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <Check className="h-3.5 w-3.5" /> Mark all read
                    </button>
                  )}
                </div>

                {detections.filter(d => d.status === 'unread').map((det) => (
                  <div 
                    key={det._id} 
                    className="bg-dark-900 border border-blue-500/20 rounded-xl p-3 flex gap-3 hover:bg-dark-900/60 transition-all"
                  >
                    <div className="w-12 h-12 bg-dark-950 border border-white/5 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {det.imagePath ? (
                        <img 
                          src={`http://localhost:5000${det.imagePath}`} 
                          alt="Thumbnail" 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <ShieldAlert className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${getDetectionColor(det.detectionType)}`}>
                          {det.detectionType}
                        </span>
                        <button 
                          onClick={() => handleMarkAsRead(det._id!)}
                          className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold"
                        >
                          Mark read
                        </button>
                      </div>
                      <p className="text-xs text-gray-200 font-medium truncate">
                        {(det.cameraId as any)?.name || 'CCTV Camera'}
                      </p>
                      <span className="text-[10px] text-gray-500 font-mono block">
                        {new Date(det.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}

                {detections.filter(d => d.status === 'unread').length === 0 && (
                  <div className="text-center py-10 text-gray-500 flex flex-col items-center justify-center gap-2">
                    <Check className="h-8 w-8 text-green-500 bg-green-500/10 p-1.5 rounded-full" />
                    <p className="text-xs">All clear! No unread notifications.</p>
                  </div>
                )}
              </div>

              {/* Drawer Footer */}
              <div className="p-6 border-t border-white/5 bg-dark-900/40 text-center">
                <button
                  onClick={() => { setCurrentPage('events'); setNotifDrawerOpen(false); }}
                  className="w-full bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-xl py-3 text-xs font-semibold border border-blue-500/10 transition-all"
                >
                  View Full Event Log History
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
};
export default App;
