const mongoose = require('mongoose')
const { nanoid } = require('nanoid')

const postSchema = new mongoose.Schema(
  {
    postId: {
      type: String,
      required: true,
      unique: true,
      default: () => `POST-${nanoid(8)}`,
    },
    author: {
      id: { type: String, required: true },
      name: { type: String, required: true },
      role: { type: String, default: 'doctor' },
      isVerified: { type: Boolean, default: false },
      profileImage: {
        url: String,
        publicId: String,
      },
    },
    body: { type: String, trim: true },
    images: [
      {
        url: String,
        publicId: String,
        mimeType: String,
      },
    ],
    visibility: { type: String, enum: ['public', 'private'], default: 'public' },
    likes: {
      count: { type: Number, default: 0 },
      userIds: [String],
    },
    comments: {
      count: { type: Number, default: 0 },
      list: [
        {
          commentId: { type: String, default: () => `COMMENT-${nanoid(8)}` },
          author: {
            id: String,
            name: String,
            role: { type: String, default: 'doctor' },
            isVerified: { type: Boolean, default: false },
            profileImage: {
              url: String,
              publicId: String,
            },
          },
          text: String,
          createdAt: { type: Date, default: Date.now },
        },
      ],
    },
    shares: {
      count: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
)

const Post = mongoose.model('Post', postSchema)

module.exports = Post
