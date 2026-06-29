const express = require('express');
const Post = require('../models/Post');
const Follow = require('../models/Follow');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const cloudinary = require('../config/cloudinary');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const PAGE_SIZE = 10;

// Helper: enrich posts with comment count & liked status using aggregation (fixes N+1)
const enrichPosts = async (posts, currentUserId) => {
  if (!posts.length) return [];
  const postIds = posts.map((p) => (p._id ? p._id : p));

  const commentCounts = await Comment.aggregate([
    { $match: { post: { $in: postIds } } },
    { $group: { _id: '$post', count: { $sum: 1 } } },
  ]);
  const countMap = {};
  commentCounts.forEach((c) => { countMap[c._id.toString()] = c.count; });

  return posts.map((post) => {
    const postObj = post.toObject ? post.toObject() : post;
    return {
      ...postObj,
      commentCount: countMap[postObj._id.toString()] || 0,
      isLiked: currentUserId
        ? postObj.likes.some((id) => id.toString() === currentUserId.toString())
        : false,
      likeCount: postObj.likes.length,
    };
  });
};

// GET /api/posts/feed
router.get('/feed', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const skip = (page - 1) * PAGE_SIZE;

    const following = await Follow.find({ follower: req.user._id }).select('following');
    const authorIds = [req.user._id, ...following.map((f) => f.following)];

    const [posts, total] = await Promise.all([
      Post.find({ author: { $in: authorIds } })
        .populate('author', 'name username avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(PAGE_SIZE),
      Post.countDocuments({ author: { $in: authorIds } }),
    ]);

    const enriched = await enrichPosts(posts, req.user._id);
    res.json({ posts: enriched, currentPage: page, totalPages: Math.ceil(total / PAGE_SIZE), hasMore: page * PAGE_SIZE < total });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/posts/liked/:userId
router.get('/liked/:userId', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const skip = (page - 1) * PAGE_SIZE;

    const [posts, total] = await Promise.all([
      Post.find({ likes: req.params.userId })
        .populate('author', 'name username avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(PAGE_SIZE),
      Post.countDocuments({ likes: req.params.userId }),
    ]);

    const enriched = await enrichPosts(posts, req.user._id);
    res.json({ posts: enriched, currentPage: page, totalPages: Math.ceil(total / PAGE_SIZE), hasMore: page * PAGE_SIZE < total });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/posts/bookmarks — current user's bookmarked posts
router.get('/bookmarks', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const skip = (page - 1) * PAGE_SIZE;

    const User = require('../models/User');
    const user = await User.findById(req.user._id).select('bookmarks');
    const bookmarkIds = user.bookmarks || [];

    const total = bookmarkIds.length;
    const slicedIds = bookmarkIds.slice(skip, skip + PAGE_SIZE);

    const posts = await Post.find({ _id: { $in: slicedIds } })
      .populate('author', 'name username avatar')
      .sort({ createdAt: -1 });

    const enriched = await enrichPosts(posts, req.user._id);
    res.json({ posts: enriched, currentPage: page, totalPages: Math.ceil(total / PAGE_SIZE), hasMore: page * PAGE_SIZE < total });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/posts/user/:userId
router.get('/user/:userId', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const skip = (page - 1) * PAGE_SIZE;

    const [posts, total] = await Promise.all([
      Post.find({ author: req.params.userId })
        .populate('author', 'name username avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(PAGE_SIZE),
      Post.countDocuments({ author: req.params.userId }),
    ]);

    const enriched = await enrichPosts(posts, req.user._id);
    res.json({ posts: enriched, currentPage: page, totalPages: Math.ceil(total / PAGE_SIZE), hasMore: page * PAGE_SIZE < total });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/posts — Create post
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { content, imageUrl, imagePublicId } = req.body;

    if (!content?.trim() && !imageUrl) {
      return res.status(400).json({ message: 'Post must have content or an image.' });
    }
    if (content && content.trim().length > 500) {
      return res.status(400).json({ message: 'Post cannot exceed 500 characters.' });
    }

    const postData = { author: req.user._id };
    if (content?.trim()) postData.content = content.trim();
    if (imageUrl) postData.image = { url: imageUrl, publicId: imagePublicId || '' };

    const post = await Post.create(postData);
    const populated = await Post.findById(post._id).populate('author', 'name username avatar');

    res.status(201).json({
      message: 'Post created successfully!',
      post: { ...populated.toObject(), commentCount: 0, isLiked: false, likeCount: 0 },
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: Object.values(err.errors)[0].message });
    }
    res.status(500).json({ message: 'Server error.' });
  }
});

// PUT /api/posts/:id — Edit own post
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found.' });
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only edit your own posts.' });
    }

    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'Post content cannot be empty.' });
    if (content.trim().length > 500) return res.status(400).json({ message: 'Post cannot exceed 500 characters.' });

    post.content = content.trim();
    await post.save();

    const populated = await Post.findById(post._id).populate('author', 'name username avatar');
    res.json({ message: 'Post updated!', post: populated });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// DELETE /api/posts/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found.' });
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only delete your own posts.' });
    }

    if (post.image?.publicId) {
      await cloudinary.uploader.destroy(post.image.publicId).catch(() => {});
    }

    await Post.findByIdAndDelete(req.params.id);
    await Comment.deleteMany({ post: req.params.id });
    await Notification.deleteMany({ post: req.params.id });

    res.json({ message: 'Post deleted successfully!' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/posts/:id/like — Toggle like
router.post('/:id/like', authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found.' });

    const userId = req.user._id;
    const alreadyLiked = post.likes.some((id) => id.toString() === userId.toString());

    if (alreadyLiked) {
      post.likes = post.likes.filter((id) => id.toString() !== userId.toString());
      await Notification.findOneAndDelete({ recipient: post.author, sender: userId, type: 'like', post: post._id });
    } else {
      post.likes.push(userId);
      if (post.author.toString() !== userId.toString()) {
        await Notification.create({ recipient: post.author, sender: userId, type: 'like', post: post._id });
      }
    }

    await post.save();
    res.json({ message: alreadyLiked ? 'Post unliked.' : 'Post liked!', liked: !alreadyLiked, likeCount: post.likes.length });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/posts/:id/bookmark — Toggle bookmark
router.post('/:id/bookmark', authMiddleware, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user._id);
    const postId = req.params.id;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post not found.' });

    const isBookmarked = user.bookmarks.some((id) => id.toString() === postId);

    if (isBookmarked) {
      user.bookmarks = user.bookmarks.filter((id) => id.toString() !== postId);
    } else {
      user.bookmarks.push(postId);
    }
    await user.save();

    res.json({ message: isBookmarked ? 'Bookmark removed.' : 'Post bookmarked!', bookmarked: !isBookmarked });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
