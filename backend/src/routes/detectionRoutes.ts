import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getDetections, createDetection, markAsRead, markAllAsRead, deleteDetection } from '../controllers/detectionController';
import { auth } from '../middlewares/auth';

const router = Router();

// Set up file upload destination and naming
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../../uploads/snapshots');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'snapshot-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

router.get('/', auth, getDetections);
// AI Engine posts detection with image file. We don't enforce JWT on this webhook for easier local setup.
router.post('/', upload.single('image'), createDetection);
router.put('/read/all', auth, markAllAsRead);
router.put('/:id/read', auth, markAsRead);
router.delete('/:id', auth, deleteDetection);

export default router;
