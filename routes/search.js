const express = require('express');
const User = require('../models/User');
const Post = require('../models/Post');
const Follow = require('../models/Follow');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /api/search?q=query&type=users|posts|all
router.get('/', authMiddleware, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const type = req.query.type || 'users';

    if (!q || q.length < 1) {
      return res.json({ users: [], posts: [] });
    }

    // Sanitize: only allow safe search characters
    const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(safeQ, 'i');

    if (type === 'users' || type === 'all') {
      const users = await User.find({
        $or: [{ name: regex }, { username: regex }],
      })
        .select('name username bio avatar')
        .limit(10);

      // Add follower counts and isFollowing status
      const enriched = await Promise.all(
        users.map(async (u) => {
          const [followerCount, isFollowingDoc] = await Promise.all([
            Follow.countDocuments({ following: u._id }),
            Follow.findOne({ follower: req.user._id, following: u._id }),
          ]);
          return { ...u.toObject(), followerCount, isFollowing: !!isFollowingDoc };
        })
      );

      if (type === 'users') return res.json({ users: enriched, posts: [] });
      return res.json({ users: enriched, posts: [] }); // extend later for all
    }

    res.json({ users: [], posts: [] });
  } catch (err) {
    res.status(500).json({ message: 'Search error.' });
  }
});

module.exports = router;
