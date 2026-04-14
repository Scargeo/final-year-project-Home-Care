const mongoose = require('mongoose');

const aiConversationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      default: 'New conversation',
      trim: true,
      maxlength: 120,
    },
    status: {
      type: String,
      enum: ['active', 'archived', 'deleted'],
      default: 'active',
      index: true,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    messageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

aiConversationSchema.index({ userId: 1, lastMessageAt: -1 });

module.exports = mongoose.model('AIConversation', aiConversationSchema);
