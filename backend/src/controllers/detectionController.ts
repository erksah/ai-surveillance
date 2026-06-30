import { Request, Response } from 'express';
import { Detection } from '../models/Detection';
import { Camera } from '../models/Camera';

export const getDetections = async (req: Request, res: Response) => {
  const { cameraId, detectionType, status, startDate, endDate, page = 1, limit = 20 } = req.query;
  const filter: any = {};

  if (cameraId) filter.cameraId = cameraId;
  if (detectionType) filter.detectionType = detectionType;
  if (status) filter.status = status;
  
  if (startDate || endDate) {
    filter.timestamp = {};
    if (startDate) filter.timestamp.$gte = new Date(startDate as string);
    if (endDate) filter.timestamp.$lte = new Date(endDate as string);
  }

  try {
    const skip = (Number(page) - 1) * Number(limit);
    const detections = await Detection.find(filter)
      .populate('cameraId', 'name type')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Detection.countDocuments(filter);

    res.json({
      detections,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

export const createDetection = async (req: Request, res: Response) => {
  const { cameraId, detectionType, confidence, timestamp } = req.body;
  
  try {
    // Check if camera exists
    const camera = await Camera.findById(cameraId);
    if (!camera) {
      return res.status(404).json({ message: 'Camera not found' });
    }

    // Save image path if file uploaded
    let imagePath = '';
    if (req.file) {
      imagePath = `/uploads/snapshots/${req.file.filename}`;
    }

    const detection = await Detection.create({
      cameraId,
      detectionType,
      confidence: parseFloat(confidence),
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      imagePath,
      status: 'unread',
    });

    const populatedDetection = await Detection.findById(detection._id).populate('cameraId', 'name type');

    // Socket.IO real-time emission
    const io = req.app.get('io');
    if (io) {
      io.emit('new-detection', populatedDetection);
    }

    res.status(201).json(populatedDetection);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const detection = await Detection.findByIdAndUpdate(
      id,
      { status: 'read' },
      { new: true }
    ).populate('cameraId', 'name type');

    if (!detection) {
      return res.status(404).json({ message: 'Detection not found' });
    }

    res.json(detection);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    await Detection.updateMany({ status: 'unread' }, { status: 'read' });
    res.json({ message: 'All detections marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

export const deleteDetection = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const detection = await Detection.findByIdAndDelete(id);
    if (!detection) {
      return res.status(404).json({ message: 'Detection not found' });
    }
    res.json({ message: 'Detection deleted successfully', id });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};
