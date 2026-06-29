const express = require('express');
const User = require('../models/User');
const Follow = require('../models/Follow');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /api/users/suggestions
router.get('/suggestions', authMiddleware, async (req, res) => {
  try {
    const following = await Follow.find({ follower: req.user._id }).select('following');
    const excludeIds = [req.user._id, ...following.map((f) => f.following)];

    const suggestions = await User.aggregate([
      { $match: { _id: { $nin: excludeIds } } },
      { $sample: { size: 5 } },
      { $project: { password: 0 } },
    ]);

    const suggestionsWithCounts = await Promise.all(
      suggestions.map(async (user) => {
        const followerCount = await Follow.countDocuments({ following: user._id });
        return { ...user, followerCount };
      })
    );

    res.json({ suggestions: suggestionsWithCounts });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/users/me/bookmarks-status/:postId
router.get('/me/bookmark-status/:postId', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('bookmarks');
    const isBookmarked = user.bookmarks.some((id) => id.toString() === req.params.postId);
    res.json({ isBookmarked });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/users/:username — by username (must be before /:id routes)
router.get('/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username.toLowerCase() }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const [followerCount, followingCount, postCount] = await Promise.all([
      Follow.countDocuments({ following: user._id }),
      Follow.countDocuments({ follower: user._id }),
      Post.countDocuments({ author: user._id }),
    ]);

    res.json({ user: { ...user.toJSON(), followerCount, followingCount, postCount } });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// PUT /api/users/me — Update name/bio
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const { name, bio } = req.body;
    const updates = {};
    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ message: 'Name cannot be empty.' });
      updates.name = name.trim();
    }
    if (bio !== undefined) updates.bio = bio.trim();

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true }).select('-password');
    res.json({ message: 'Profile updated successfully!', user });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: Object.values(err.errors)[0].message });
    }
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/users/:id/follow
router.post('/:id/follow', authMiddleware, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user._id;

    if (targetUserId === currentUserId.toString()) {
      return res.status(400).json({ message: 'You cannot follow yourself.' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) return res.status(404).json({ message: 'User not found.' });

    const existingFollow = await Follow.findOne({ follower: currentUserId, following: targetUserId });
    if (existingFollow) return res.status(400).json({ message: 'You are already following this user.' });

    await Follow.create({ follower: currentUserId, following: targetUserId });

    // Notification
    await Notification.create({ recipient: targetUserId, sender: currentUserId, type: 'follow' });

    const followerCount = await Follow.countDocuments({ following: targetUserId });
    res.json({ message: 'Followed successfully!', followerCount });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// DELETE /api/users/:id/follow
router.delete('/:id/follow', authMiddleware, async (req, res) => {
  try {
    const result = await Follow.findOneAndDelete({ follower: req.user._id, following: req.params.id });
    if (!result) return res.status(400).json({ message: 'You are not following this user.' });

    const followerCount = await Follow.countDocuments({ following: req.params.id });
    res.json({ message: 'Unfollowed successfully!', followerCount });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/users/:id/followers
router.get('/:id/followers', async (req, res) => {
  try {
    const follows = await Follow.find({ following: req.params.id })
      .populate('follower', 'name username avatar bio')
      .sort({ createdAt: -1 });
    res.json({ followers: follows.map((f) => f.follower) });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/users/:id/following
router.get('/:id/following', async (req, res) => {
  try {
    const follows = await Follow.find({ follower: req.params.id })
      .populate('following', 'name username avatar bio')
      .sort({ createdAt: -1 });
    res.json({ following: follows.map((f) => f.following) });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
