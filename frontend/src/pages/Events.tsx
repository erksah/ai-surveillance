import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Filter, 
  Clock, 
  Trash2, 
  Check, 
  Maximize2, 
  X, 
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import type { Camera, Detection } from '../../../shared/types';

interface EventsProps {
  cameras: Camera[];
  detections: Detection[];
  setDetections: React.Dispatch<React.SetStateAction<Detection[]>>;
}

export const Events: React.FC<EventsProps> = ({ cameras, detections, setDetections }) => {
  const [selectedDet, setSelectedDet] = useState<Detection | null>(null);
  
  // Filtering States
  const [filterCamera, setFilterCamera] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      let query = `/detections?page=${page}&limit=12`;
      if (filterCamera) query += `&cameraId=${filterCamera}`;
      if (filterType) query += `&detectionType=${filterType}`;
      if (filterStatus) query += `&status=${filterStatus}`;
      
      const res = await api.get(query);
      setDetections(res.data.detections || []);
      setTotalPages(res.data.pagination.pages || 1);
      setTotalItems(res.data.pagination.total || 0);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [page, filterCamera, filterType, filterStatus]);

  const handleMarkAsRead = async (det: Detection) => {
    try {
      const res = await api.put(`/detections/${det._id}/read`);
      setDetections(detections.map(d => d._id === det._id ? res.data : d));
      if (selectedDet?._id === det._id) {
        setSelectedDet(res.data);
      }
    } catch (err) {
      console.error('Failed to mark event as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put('/detections/read/all');
      setDetections(detections.map(d => ({ ...d, status: 'read' })));
      alert('All notifications marked as read');
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this event log permanently?')) return;
    try {
      await api.delete(`/detections/${id}`);
      setDetections(detections.filter(d => d._id !== id));
      setSelectedDet(null);
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  };

  const getDetectionColor = (type: string) => {
    switch (type) {
      case 'fall': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'fire': return 'text-red-500 bg-red-500/10 border-red-500/20 animate-pulse';
      case 'person': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'motion': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header and top actions */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Detection History</h2>
          <p className="text-xs text-gray-400 mt-1">Review, filter, and inspect screenshots of all recorded security events.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleMarkAllRead}
            className="bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl py-2 px-4 text-xs font-semibold border border-white/5 transition-all flex items-center gap-1.5"
          >
            <Check className="h-4 w-4" /> Mark All as Read
          </button>
          
          <button
            onClick={fetchEvents}
            className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/5 border border-white/5 transition-colors"
            title="Reload Events List"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="glass rounded-2xl p-4 border border-white/5 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold uppercase tracking-wider">
          <Filter className="h-4 w-4 text-blue-500" /> Filter Logs
        </div>

        {/* Camera selection */}
        <select
          value={filterCamera}
          onChange={(e) => { setFilterCamera(e.target.value); setPage(1); }}
          className="bg-dark-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
        >
          <option value="">All Cameras</option>
          {cameras.map(c => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>

        {/* Type selection */}
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
          className="bg-dark-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
        >
          <option value="">All Detections</option>
          <option value="person">Person Detections</option>
          <option value="motion">Motion Detections</option>
          <option value="fall">Fall Alerts</option>
          <option value="fire">Fire/Smoke Detections</option>
          <option value="object">Other Objects</option>
        </select>

        {/* Read status selection */}
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="bg-dark-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="unread">Unread Logs</option>
          <option value="read">Read Logs</option>
        </select>
      </div>

      {/* Grid List of screenshots */}
      {loading ? (
        <div className="h-64 flex justify-center items-center">
          <span className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {detections.map((det) => (
            <div 
              key={det._id} 
              className={`glass rounded-2xl overflow-hidden border transition-all duration-300 flex flex-col justify-between group ${
                det.status === 'unread' ? 'border-blue-500/20 bg-blue-500/5' : 'border-white/5'
              }`}
            >
              {/* Screenshot Frame */}
              <div className="relative aspect-video bg-dark-950 overflow-hidden flex items-center justify-center border-b border-white/5">
                {det.imagePath ? (
                  <img 
                    src={`http://localhost:5000${det.imagePath}`} 
                    alt="Alert Snapshot"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <AlertTriangle className="h-10 w-10 text-gray-700" />
                )}
                
                {/* Maximize hover overlay */}
                <button
                  onClick={() => setSelectedDet(det)}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-200"
                >
                  <Maximize2 className="h-6 w-6" />
                </button>

                {/* Status indicator pill */}
                {det.status === 'unread' && (
                  <span className="absolute top-2 left-2 bg-blue-600 text-[9px] font-bold text-white uppercase tracking-widest px-2 py-0.5 rounded shadow-[0_0_8px_#2563eb]">
                    New
                  </span>
                )}
              </div>

              {/* Card details */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${getDetectionColor(det.detectionType)}`}>
                    {det.detectionType}
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono">
                    {Math.round(det.confidence * 100)}% conf
                  </span>
                </div>
                
                <div>
                  <h4 className="text-xs font-semibold text-white truncate">
                    {(det.cameraId as any)?.name || 'Unknown Camera'}
                  </h4>
                  <span className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" />
                    {new Date(det.timestamp).toLocaleString()}
                  </span>
                </div>

                {/* Small Action items */}
                <div className="flex gap-2 border-t border-white/5 pt-3 mt-2 text-xs">
                  {det.status === 'unread' ? (
                    <button
                      onClick={() => handleMarkAsRead(det)}
                      className="flex-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 py-1.5 rounded-lg border border-blue-500/10 font-medium transition-colors"
                    >
                      Read
                    </button>
                  ) : (
                    <span className="flex-1 text-center py-1.5 text-[10px] text-gray-500 font-medium">Reviewed</span>
                  )}
                  <button
                    onClick={() => handleDelete(det._id!)}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/10"
                    title="Delete record"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {detections.length === 0 && (
            <div className="col-span-full glass rounded-3xl p-12 border border-dashed border-gray-800 text-center flex flex-col items-center justify-center text-gray-500">
              <AlertTriangle className="h-10 w-10 text-gray-700 mb-2 animate-bounce" />
              <h3 className="text-gray-300 font-semibold mb-1">No Detections Found</h3>
              <p className="text-xs max-w-[280px]">Adjust your filter settings or ensure the AI engine is actively streaming.</p>
            </div>
          )}
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-white/5 pt-6 flex-wrap gap-4">
          <span className="text-xs text-gray-500 font-mono">
            Showing Page {page} of {totalPages} ({totalItems} total logs)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="bg-white/5 hover:bg-white/10 disabled:opacity-40 text-gray-300 p-2 rounded-lg border border-white/5 disabled:hover:bg-white/5 transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="bg-white/5 hover:bg-white/10 disabled:opacity-40 text-gray-300 p-2 rounded-lg border border-white/5 disabled:hover:bg-white/5 transition-all"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Snapshot Maximize Viewer Modal */}
      {selectedDet && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-white/10 w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[85vh] animate-[scaleIn_0.2s_ease-out]">
            {/* Left Col: High-Res Image */}
            <div className="flex-1 bg-black flex items-center justify-center overflow-hidden relative">
              {selectedDet.imagePath ? (
                <img 
                  src={`http://localhost:5000${selectedDet.imagePath}`} 
                  alt="High Resolution Alert" 
                  className="w-full h-full object-contain"
                />
              ) : (
                <AlertTriangle className="h-16 w-16 text-gray-700" />
              )}
            </div>

            {/* Right Col: Event Details Panel */}
            <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-white/5 p-6 flex flex-col justify-between bg-dark-800/80">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white text-md">Alert Inspector</h3>
                  <button onClick={() => setSelectedDet(null)} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Camera Node</span>
                    <span className="text-sm font-semibold text-white">
                      {(selectedDet.cameraId as any)?.name || 'Unknown Camera'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Detection Category</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded border uppercase inline-block ${getDetectionColor(selectedDet.detectionType)}`}>
                      {selectedDet.detectionType}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Trigger Confidence</span>
                    <span className="text-sm font-semibold text-white font-mono">
                      {Math.round(selectedDet.confidence * 100)}%
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Timestamp</span>
                    <span className="text-xs text-gray-300 flex items-center gap-1 font-mono">
                      <Clock className="h-3.5 w-3.5 text-gray-500" />
                      {new Date(selectedDet.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center gap-2 border-t border-white/5 pt-4 mt-6">
                {selectedDet.status === 'unread' && (
                  <button
                    onClick={() => handleMarkAsRead(selectedDet)}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-2.5 text-xs font-semibold transition-all"
                  >
                    Mark Reviewed
                  </button>
                )}
                <button
                  onClick={() => handleDelete(selectedDet._id!)}
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl p-2.5 border border-red-500/15 transition-colors"
                  title="Remove Event Log"
                >
                  <Trash2 className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Events;
