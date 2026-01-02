import { Router } from 'express';
import multer from 'multer';
import { UploadController } from '../controllers/upload.controller';
import { requireDeviceKey } from '../middleware/deviceKey.middleware';

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

router.post('/shift-xml', requireDeviceKey, upload.single('file'), UploadController.uploadShiftXML);

export default router;
