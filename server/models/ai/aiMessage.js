const mongoose = require('mongoose');

const sourceChunkSchema = new mongoose.Schema(
  {
    text: { type: String, default: '' },
    score: { type: Number, default: null },
  },
  { _id: false },
);

const aiMessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AIConversation',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 12000,
    },
    model: {
      type: String,
      default: '',
      trim: true,
    },
    sources: {
      type: [sourceChunkSchema],
      default: [],
    },
  },
  { timestamps: true },
);

aiMessageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model('AIMessage', aiMessageSchema);
