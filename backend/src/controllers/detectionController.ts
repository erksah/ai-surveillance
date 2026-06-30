import { Request, Response } from 'express';
import { Detection } from '../models/Detection';
import { Camera } from '../models/Camera';
import axios from 'axios';
import fs from 'fs';

const analyzeImageWithGemini = async (filePath: string, detectionType: string): Promise<{ description: string; isSuspicious: boolean }> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { description: 'No API key configured for Gemini', isSuspicious: true };
  }
  
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const base64Image = fileBuffer.toString('base64');
    
    const prompt = `Analyze this CCTV camera screenshot from a security camera. This was triggered by a detection of type: "${detectionType}".
Describe briefly (1 short sentence) what is happening in the scene.
Assess if this scene represents a suspicious, unwanted, or dangerous security threat (e.g. an intruder, a person falling/slipping, fire, smoke, vandals, break-ins).
If it is normal/wanted activity (e.g. someone walking normally in daylight, a pet playing, cars passing by on the street, swaying trees, shadow changes, home owners entering), classify it as NOT suspicious (isSuspicious = false).
Your response must be in JSON format matching this schema:
{
  "description": "Brief description of the scene",
  "isSuspicious": true or false
}`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: base64Image
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      },
      { timeout: 15000 }
    );

    const jsonText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (jsonText) {
      const parsed = JSON.parse(jsonText.trim());
      return {
        description: parsed.description || 'Scene analyzed by AI',
        isSuspicious: parsed.isSuspicious === true
      };
    }
  } catch (err) {
    console.error('Gemini API analysis failed:', (err as Error).message);
  }
  return { description: 'Gemini analysis failed or timed out', isSuspicious: true };
};

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
      .populate('cameraId', 'name type location')
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
    let geminiAnalysis = 'No image snapshot available';
    let isSuspicious = true; // default fallback

    if (req.file) {
      imagePath = `/uploads/snapshots/${req.file.filename}`;
      // Trigger Gemini AI validation if API key is set
      if (process.env.GEMINI_API_KEY) {
        console.log(`Analyzing snapshot ${req.file.filename} with Gemini AI...`);
        const analysis = await analyzeImageWithGemini(req.file.path, detectionType);
        geminiAnalysis = analysis.description;
        isSuspicious = analysis.isSuspicious;
        console.log(`Gemini Result: suspicious=${isSuspicious}, description: ${geminiAnalysis}`);
      } else {
        geminiAnalysis = 'Gemini API key not configured. Auto-approving alert.';
        isSuspicious = true;
      }
    } else {
      geminiAnalysis = 'No snapshot image uploaded for AI analysis';
      isSuspicious = true;
    }

    const detection = await Detection.create({
      cameraId,
      detectionType,
      confidence: parseFloat(confidence),
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      imagePath,
      status: 'unread',
      geminiAnalysis,
      isSuspicious,
    });

    const populatedDetection = await Detection.findById(detection._id).populate('cameraId', 'name type location');

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
