const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: [true, 'Post reference is required'],
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required'],
    },
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      maxlength: [200, 'Comment cannot exceed 200 characters'],
      trim: true,
    },
  },
  { timestamps: true }
);

// Index for faster comment lookups per post
commentSchema.index({ post: 1, createdAt: 1 });

module.exports = mongoose.model('Comment', commentSchema);
