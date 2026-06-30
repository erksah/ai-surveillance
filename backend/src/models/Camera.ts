import { Schema, model } from 'mongoose';

const cameraSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['webcam', 'ip', 'rtsp', 'mjpeg'], required: true },
    sourceUrl: { type: String, required: true },
    resolution: { type: String, default: '1280x720' },
    fps: { type: Number, default: 15 },
    enabled: { type: Boolean, default: true },
    location: { type: String, default: 'Default Location' },
  },
  { timestamps: true }
);

export const Camera = model('Camera', cameraSchema);
export default Camera;
