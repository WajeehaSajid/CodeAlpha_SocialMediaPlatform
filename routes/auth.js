const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const generateToken = (userId) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign({ id: userId }, secret, { expiresIn: '30d' });
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    if (!name?.trim() || !username?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const existingEmail = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingEmail) return res.status(400).json({ message: 'An account with this email already exists.' });

    const existingUsername = await User.findOne({ username: username.toLowerCase().trim() });
    if (existingUsername) return res.status(400).json({ message: 'This username is already taken.' });

    const user = await User.create({ name: name.trim(), username: username.trim(), email: email.trim(), password });
    const token = generateToken(user._id);

    res.status(201).json({
      message: 'Account created successfully!',
      token,
      user: { _id: user._id, name: user.name, username: user.username, email: user.email, bio: user.bio, avatar: user.avatar, createdAt: user.createdAt },
    });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(400).json({ message: `This ${field} is already in use.` });
    }
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: messages[0] });
    }
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email?.trim() || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ message: 'Invalid email or password.' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password.' });

    const token = generateToken(user._id);
    res.json({
      message: 'Login successful!',
      token,
      user: { _id: user._id, name: user.name, username: user.username, email: user.email, bio: user.bio, avatar: user.avatar, createdAt: user.createdAt },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// PUT /api/auth/change-password
router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Both current and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return res.status(401).json({ message: 'Current password is incorrect.' });

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully!' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// DELETE /api/auth/account — Delete account
router.delete('/account', authMiddleware, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ message: 'Password is required to delete account.' });

    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Incorrect password.' });

    // Delete avatar from cloudinary
    if (user.avatar?.publicId) {
      await cloudinary.uploader.destroy(user.avatar.publicId).catch(() => {});
    }

    const Post = require('../models/Post');
    const Comment = require('../models/Comment');
    const Follow = require('../models/Follow');
    const Notification = require('../models/Notification');

    // Delete all user's posts and their images
    const userPosts = await Post.find({ author: user._id });
    for (const post of userPosts) {
      if (post.image?.publicId) {
        await cloudinary.uploader.destroy(post.image.publicId).catch(() => {});
      }
    }

    await Post.deleteMany({ author: user._id });
    await Comment.deleteMany({ author: user._id });
    await Follow.deleteMany({ $or: [{ follower: user._id }, { following: user._id }] });
    await Notification.deleteMany({ $or: [{ recipient: user._id }, { sender: user._id }] });
    await User.findByIdAndDelete(user._id);

    res.json({ message: 'Account deleted successfully.' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
