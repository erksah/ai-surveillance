import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Video, 
  AlertTriangle, 
  Laptop, 
  Smartphone, 
  Eye, 
  EyeOff 
} from 'lucide-react';
import type { Camera, CameraType } from '../../../shared/types';

interface CamerasProps {
  cameras: Camera[];
  setCameras: React.Dispatch<React.SetStateAction<Camera[]>>;
}

export const Cameras: React.FC<CamerasProps> = ({ cameras, setCameras }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  
  // Form fields
  const [name, setName] = useState('');
  const [type, setType] = useState<CameraType>('webcam');
  const [sourceUrl, setSourceUrl] = useState('0');
  const [resolution, setResolution] = useState('1280x720');
  const [fps, setFps] = useState(15);
  const [enabled, setEnabled] = useState(true);
  const [location, setLocation] = useState('Default Location');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch cameras on page mount
  const fetchCameras = async () => {
    try {
      const res = await api.get('/cameras');
      setCameras(res.data);
    } catch (err) {
      console.error('Failed to load cameras:', err);
    }
  };

  useEffect(() => {
    fetchCameras();
  }, []);

  const openAddModal = () => {
    setEditingCamera(null);
    setName('');
    setType('webcam');
    setSourceUrl('0');
    setResolution('1280x720');
    setFps(15);
    setEnabled(true);
    setLocation('Default Location');
    setError('');
    setModalOpen(true);
  };

  const openEditModal = (cam: Camera) => {
    setEditingCamera(cam);
    setName(cam.name);
    setType(cam.type);
    setSourceUrl(cam.sourceUrl);
    setResolution(cam.resolution);
    setFps(cam.fps);
    setEnabled(cam.enabled);
    setLocation(cam.location || 'Default Location');
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const payload = { name, type, sourceUrl, resolution, fps, enabled, location };

    try {
      if (editingCamera?._id) {
        const res = await api.put(`/cameras/${editingCamera._id}`, payload);
        setCameras(cameras.map(c => c._id === editingCamera._id ? res.data : c));
      } else {
        const res = await api.post('/cameras', payload);
        setCameras([...cameras, res.data]);
      }
      setModalOpen(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save camera configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this camera configuration?')) return;
    try {
      await api.delete(`/cameras/${id}`);
      setCameras(cameras.filter(c => c._id !== id));
    } catch (err) {
      console.error('Failed to delete camera:', err);
      alert('Failed to delete camera');
    }
  };

  const toggleCameraEnabled = async (cam: Camera) => {
    try {
      const res = await api.put(`/cameras/${cam._id}`, { ...cam, enabled: !cam.enabled });
      setCameras(cameras.map(c => c._id === cam._id ? res.data : c));
    } catch (err) {
      console.error('Failed to toggle camera status:', err);
    }
  };

  // Quick setup helper buttons
  const quickSetupLaptopWebcam = () => {
    setName('Laptop Integrated Webcam');
    setType('webcam');
    setSourceUrl('0');
    setResolution('1280x720');
    setFps(15);
    setEnabled(true);
    setLocation('Home');
  };

  const quickSetupMobileCamera = () => {
    setName('Android Mobile Stream');
    setType('mjpeg');
    setSourceUrl('http://192.168.1.100:8080/video');
    setResolution('1280x720');
    setFps(15);
    setEnabled(true);
    setLocation('Business Office');
  };

  return (
    <div className="space-y-6">
      {/* Header and Add button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Video Sources</h2>
          <p className="text-xs text-gray-400 mt-1">Configure USB, local laptop webcams, RTSP streams, or mobile camera feeds.</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm rounded-xl px-4 py-2.5 flex items-center gap-2 transition-colors shadow-lg shadow-blue-600/10"
        >
          <Plus className="h-4.5 w-4.5" /> Add Video Source
        </button>
      </div>

      {/* Grid of cameras */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cameras.map((cam) => (
          <div 
            key={cam._id} 
            className={`glass rounded-2xl p-5 border flex flex-col justify-between transition-all duration-300 ${
              cam.enabled ? 'border-white/5' : 'border-dashed border-gray-800 opacity-60'
            }`}
          >
            <div className="space-y-4">
              {/* Card Title & Type */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border ${
                    cam.enabled ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-gray-800 border-gray-700 text-gray-400'
                  }`}>
                    <Video className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white truncate max-w-[150px]">{cam.name}</h3>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-dark-900 px-2 py-0.5 rounded border border-white/5">
                      {cam.type}
                    </span>
                  </div>
                </div>
                
                {/* Enabled status toggle */}
                <button
                  onClick={() => toggleCameraEnabled(cam)}
                  className={`p-1.5 rounded-lg border transition-colors ${
                    cam.enabled 
                      ? 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20' 
                      : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                  }`}
                  title={cam.enabled ? "Disable Camera" : "Enable Camera"}
                >
                  {cam.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              </div>

              {/* Source properties */}
              <div className="bg-dark-900/60 rounded-xl p-3 border border-white/5 text-xs space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-500">Source:</span>
                  <span className="text-gray-300 truncate max-w-[170px]" title={cam.sourceUrl}>
                    {cam.sourceUrl}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Resolution:</span>
                  <span className="text-gray-300">{cam.resolution}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Location:</span>
                  <span className="text-gray-300 font-semibold">{cam.location || 'Default Location'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Target FPS:</span>
                  <span className="text-gray-300">{cam.fps}</span>
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="flex items-center gap-2 border-t border-white/5 pt-4 mt-6">
              <button
                onClick={() => openEditModal(cam)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl py-2 text-xs font-semibold border border-white/5 transition-all flex items-center justify-center gap-1.5"
              >
                <Edit3 className="h-3.5 w-3.5" /> Modify
              </button>
              <button
                onClick={() => handleDelete(cam._id!)}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl p-2 border border-red-500/10 transition-colors"
                title="Remove Camera"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        {cameras.length === 0 && (
          <div className="col-span-full glass rounded-3xl p-10 border border-dashed border-gray-800 text-center flex flex-col items-center justify-center text-gray-500">
            <Video className="h-10 w-10 text-gray-700 mb-3 animate-pulse" />
            <h3 className="text-gray-300 font-semibold mb-1">No Video Sources Found</h3>
            <p className="text-xs max-w-[280px] mb-4">You need to register at least one video source like your laptop webcam to begin.</p>
            <button 
              onClick={openAddModal}
              className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-xl px-4 py-2"
            >
              Add Camera
            </button>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-white/10 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-[fadeIn_0.2s_ease-out]">
            <div className="px-6 py-4 border-b border-white/5 bg-dark-800/50 flex items-center justify-between">
              <h3 className="font-bold text-white text-md">
                {editingCamera ? 'Modify Camera Config' : 'Register New Video Source'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mx-6 mt-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Quick Setup helpers if creating new */}
              {!editingCamera && (
                <div className="bg-dark-900 rounded-xl p-3 border border-white/5 space-y-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Quick Presets</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={quickSetupLaptopWebcam}
                      className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 border border-white/5 transition-all"
                    >
                      <Laptop className="h-3.5 w-3.5" /> Integrated Webcam
                    </button>
                    <button
                      type="button"
                      onClick={quickSetupMobileCamera}
                      className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 border border-white/5 transition-all"
                    >
                      <Smartphone className="h-3.5 w-3.5" /> Mobile Wi-Fi Camera
                    </button>
                  </div>
                </div>
              )}

              {/* Form Input fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Camera Display Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Front Gate Camera"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-dark-900 border border-white/10 rounded-xl py-2.5 px-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Source Type</label>
                  <select
                    value={type}
                    onChange={(e) => {
                      const newType = e.target.value as CameraType;
                      setType(newType);
                      // Default webcam source to "0"
                      if (newType === 'webcam') setSourceUrl('0');
                    }}
                    className="w-full bg-dark-900 border border-white/10 rounded-xl py-2.5 px-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="webcam">Integrated Webcam</option>
                    <option value="mjpeg">HTTP / MJPEG Stream (Mobile)</option>
                    <option value="rtsp">RTSP CCTV Stream</option>
                    <option value="ip">IP Camera Stream</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Location / Group</label>
                  <input
                    type="text"
                    placeholder="e.g. Home, Business, Warehouse"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-dark-900 border border-white/10 rounded-xl py-2.5 px-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Target Frame Rate (FPS)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    required
                    value={fps}
                    onChange={(e) => setFps(parseInt(e.target.value) || 15)}
                    className="w-full bg-dark-900 border border-white/10 rounded-xl py-2.5 px-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Source Connection URL / Index
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={type === 'webcam' ? 'e.g. 0, 1 (Device Index)' : 'e.g. http://192.168.1.100:8080/video or rtsp://admin:pass@ip'}
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    className="w-full bg-dark-900 border border-white/10 rounded-xl py-2.5 px-3 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Streaming Resolution</label>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="w-full bg-dark-900 border border-white/10 rounded-xl py-2.5 px-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="640x480">640 x 480 (SD)</option>
                    <option value="1280x720">1280 x 720 (HD - Default)</option>
                    <option value="1920x1080">1920 x 1080 (FHD)</option>
                  </select>
                </div>

                <div className="flex items-center pt-6 pl-4">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none text-sm text-gray-300 font-medium">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => setEnabled(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-700 bg-dark-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-dark-900"
                    />
                    Enable Immediately
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 border-t border-white/5 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl py-3 text-sm font-semibold border border-white/5 transition-all"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-3 text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/15"
                >
                  {loading ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="h-4 w-4" /> Save Camera
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default Cameras;
