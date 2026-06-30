import { Schema, model } from 'mongoose';

const detectionSchema = new Schema(
  {
    cameraId: { type: Schema.Types.ObjectId, ref: 'Camera', required: true },
    timestamp: { type: Date, default: Date.now },
    detectionType: { 
      type: String, 
      enum: ['person', 'motion', 'fall', 'object', 'fire', 'smoke', 'camera_disconnected', 'ai_stopped'], 
      required: true 
    },
    confidence: { type: Number, required: true },
    imagePath: { type: String },
    clipPath: { type: String },
    status: { type: String, enum: ['read', 'unread'], default: 'unread' },
    geminiAnalysis: { type: String },
    isSuspicious: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Detection = model('Detection', detectionSchema);
export default Detection;
