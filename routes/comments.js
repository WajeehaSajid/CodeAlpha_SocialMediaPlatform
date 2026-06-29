const express = require('express');
const Comment = require('../models/Comment');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /api/comments/:postId
router.get('/:postId', async (req, res) => {
  try {
    const comments = await Comment.find({ post: req.params.postId })
      .populate('author', 'name username avatar')
      .sort({ createdAt: 1 });
    res.json({ comments });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/comments/:postId
router.post('/:postId', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'Comment content is required.' });
    if (content.trim().length > 200) return res.status(400).json({ message: 'Comment cannot exceed 200 characters.' });

    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: 'Post not found.' });

    const comment = await Comment.create({ post: req.params.postId, author: req.user._id, content: content.trim() });
    const populated = await Comment.findById(comment._id).populate('author', 'name username avatar');

    // Notify post author
    if (post.author.toString() !== req.user._id.toString()) {
      await Notification.create({ recipient: post.author, sender: req.user._id, type: 'comment', post: post._id });
    }

    const commentCount = await Comment.countDocuments({ post: req.params.postId });
    res.status(201).json({ message: 'Comment added!', comment: populated, commentCount });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: Object.values(err.errors)[0].message });
    }
    res.status(500).json({ message: 'Server error.' });
  }
});

// DELETE /api/comments/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ message: 'Comment not found.' });
    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only delete your own comments.' });
    }

    await Comment.findByIdAndDelete(req.params.id);
    const commentCount = await Comment.countDocuments({ post: comment.post });
    res.json({ message: 'Comment deleted!', commentCount });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
