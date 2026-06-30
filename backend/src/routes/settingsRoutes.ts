import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController';
import { auth } from '../middlewares/auth';

const router = Router();

router.get('/', auth, getSettings);
router.put('/', auth, updateSettings);

export default router;
