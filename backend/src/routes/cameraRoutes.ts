import { Router } from 'express';
import { getCameras, createCamera, updateCamera, deleteCamera } from '../controllers/cameraController';
import { auth } from '../middlewares/auth';

const router = Router();

router.get('/', auth, getCameras);
router.post('/', auth, createCamera);
router.put('/:id', auth, updateCamera);
router.delete('/:id', auth, deleteCamera);

export default router;
