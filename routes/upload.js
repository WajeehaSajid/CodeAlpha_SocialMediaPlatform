const express = require('express');
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Memory storage — no disk writes
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed.'));
    }
    cb(null, true);
  },
});

// Helper: upload buffer to Cloudinary
function uploadToCloudinary(buffer, folder, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: publicId, resource_type: 'image', transformation: [{ quality: 'auto', fetch_format: 'auto' }] },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

// POST /api/upload/avatar — Upload profile picture
router.post('/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided.' });
    }

    // Delete old avatar if exists
    if (req.user.avatar?.publicId) {
      await cloudinary.uploader.destroy(req.user.avatar.publicId).catch(() => {});
    }

    const publicId = `aether/avatars/${req.user._id}`;
    const result = await uploadToCloudinary(req.file.buffer, 'aether/avatars', `user_${req.user._id}`);

    await User.findByIdAndUpdate(req.user._id, {
      avatar: { url: result.secure_url, publicId: result.public_id },
    });

    res.json({ message: 'Avatar updated!', url: result.secure_url });
  } catch (err) {
    if (err.message === 'Only image files are allowed.') {
      return res.status(400).json({ message: err.message });
    }
    console.error('Avatar upload error:', err.message);
    res.status(500).json({ message: 'Upload failed. Please try again.' });
  }
});

// POST /api/upload/post — Upload post image
router.post('/post', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided.' });
    }

    const result = await uploadToCloudinary(req.file.buffer, 'aether/posts', null);

    res.json({ message: 'Image uploaded!', url: result.secure_url, publicId: result.public_id });
  } catch (err) {
    if (err.message === 'Only image files are allowed.') {
      return res.status(400).json({ message: err.message });
    }
    console.error('Post image upload error:', err.message);
    res.status(500).json({ message: 'Upload failed. Please try again.' });
  }
});

module.exports = router;
