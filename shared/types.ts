export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt?: string;
}

export type CameraType = 'webcam' | 'ip' | 'rtsp' | 'mjpeg';

export interface Camera {
  _id?: string;
  id?: string;
  name: string;
  type: CameraType;
  sourceUrl: string;
  resolution: string;
  fps: number;
  enabled: boolean;
  createdAt?: string;
}

export type DetectionType = 'person' | 'motion' | 'fall' | 'object' | 'fire' | 'smoke' | 'camera_disconnected' | 'ai_stopped';

export interface Detection {
  _id?: string;
  id?: string;
  cameraId: string;
  timestamp: string | Date;
  detectionType: DetectionType;
  confidence: number;
  imagePath?: string;
  clipPath?: string;
  status: 'read' | 'unread';
}

export interface SystemSettings {
  confidenceThreshold: number; // e.g. 0.5
  motionSensitivity: number; // e.g. 500 (contour area)
  detectionInterval: number; // in seconds or frames, e.g. 2
  emailAlerts: boolean;
  browserNotifications: boolean;
  audioAlerts: boolean;
}
