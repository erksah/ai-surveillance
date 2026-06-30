import { Request, Response } from 'express';
import { Camera } from '../models/Camera';
import axios from 'axios';

// Notify the AI Engine of camera changes
const notifyAIEngine = async () => {
  try {
    const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8000';
    await axios.post(`${aiEngineUrl}/update_cameras`);
    console.log('AI Engine notified of camera configuration changes');
  } catch (error) {
    console.error('Failed to notify AI Engine:', (error as Error).message);
  }
};

export const getCameras = async (req: Request, res: Response) => {
  try {
    const cameras = await Camera.find();
    res.json(cameras);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

export const createCamera = async (req: Request, res: Response) => {
  const { name, type, sourceUrl, resolution, fps, enabled } = req.body;
  try {
    const camera = await Camera.create({ name, type, sourceUrl, resolution, fps, enabled });
    
    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('camera-config-changed', { action: 'create', camera });
    }

    // Trigger AI Engine restart/sync
    notifyAIEngine();

    res.status(201).json(camera);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

export const updateCamera = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, type, sourceUrl, resolution, fps, enabled } = req.body;
  try {
    const camera = await Camera.findByIdAndUpdate(
      id,
      { name, type, sourceUrl, resolution, fps, enabled },
      { new: true }
    );

    if (!camera) {
      return res.status(404).json({ message: 'Camera not found' });
    }

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('camera-config-changed', { action: 'update', camera });
    }

    // Trigger AI Engine restart/sync
    notifyAIEngine();

    res.json(camera);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

export const deleteCamera = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const camera = await Camera.findByIdAndDelete(id);
    if (!camera) {
      return res.status(404).json({ message: 'Camera not found' });
    }

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('camera-config-changed', { action: 'delete', id });
    }

    // Trigger AI Engine restart/sync
    notifyAIEngine();

    res.json({ message: 'Camera deleted successfully', id });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};
