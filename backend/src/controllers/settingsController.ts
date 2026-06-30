import { Request, Response } from 'express';
import { Settings } from '../models/Settings';
import axios from 'axios';

// Notify the AI Engine of settings changes
const notifyAIEngineOfSettings = async (settings: any) => {
  try {
    const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8000';
    await axios.post(`${aiEngineUrl}/update_settings`, settings);
    console.log('AI Engine notified of settings configuration changes');
  } catch (error) {
    console.error('Failed to notify AI Engine of settings change:', (error as Error).message);
  }
};

export const getSettings = async (req: Request, res: Response) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      // Seed default settings if none exist
      settings = await Settings.create({});
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  const { confidenceThreshold, motionSensitivity, detectionInterval, emailAlerts, browserNotifications, audioAlerts } = req.body;
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    if (confidenceThreshold !== undefined) settings.confidenceThreshold = confidenceThreshold;
    if (motionSensitivity !== undefined) settings.motionSensitivity = motionSensitivity;
    if (detectionInterval !== undefined) settings.detectionInterval = detectionInterval;
    if (emailAlerts !== undefined) settings.emailAlerts = emailAlerts;
    if (browserNotifications !== undefined) settings.browserNotifications = browserNotifications;
    if (audioAlerts !== undefined) settings.audioAlerts = audioAlerts;

    await settings.save();

    // Trigger AI Engine sync
    notifyAIEngineOfSettings(settings);

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};
