import { Schema, model } from 'mongoose';

const settingsSchema = new Schema(
  {
    confidenceThreshold: { type: Number, default: 0.5 },
    motionSensitivity: { type: Number, default: 500 }, // min area in pixels
    detectionInterval: { type: Number, default: 2 }, // checking interval in seconds
    emailAlerts: { type: Boolean, default: false },
    browserNotifications: { type: Boolean, default: true },
    audioAlerts: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Settings = model('Settings', settingsSchema);
export default Settings;
