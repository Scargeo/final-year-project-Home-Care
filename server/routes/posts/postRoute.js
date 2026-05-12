const express = require('express')
const router = express.Router()
const Post = require('../../models/posts/post')
const { loadUser } = require('../../middleware/loadUserMiddleware')

function getUserIdentity(user = {}) {
  const record = user.record || {}
  return {
    id: user.id || user.userId || user.patientId || user.doctorId || record.patientId || record.doctorId || 'anonymous',
    name:
      record.patientFirstName ||
      record.doctorFirstName ||
      record.adminName ||
      user?.patientFirstName ||
      user?.doctorFirstName ||
      user?.adminName ||
      user?.name ||
      record.name ||
      'Unknown',
    role: user?.role || record.role || 'doctor',
    profileImage: user?.profileImage || record.profileImage || null,
  }
}

// Allow loadUser to attach user info if Authorization header provided
router.use(loadUser)

// Create a post
router.post('/', async (req, res) => {
  try {
    const user = req.user || {}
    const { body, images, visibility = 'public' } = req.body

    if (!body && (!images || images.length === 0)) {
      return res.status(400).json({ message: 'Post must include text or images.' })
    }

    const author = getUserIdentity(user)

    const post = new Post({ author, body, images: Array.isArray(images) ? images : [], visibility })
    await post.save()

    return res.status(201).json({ message: 'Post created', post })
  } catch (error) {
    console.error('Failed to create post:', error)
    return res.status(500).json({ message: 'Failed to create post', error: error.message })
  }
})

// Get public posts (paginated optional)
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit || '20', 10))
    const skip = Math.max(0, parseInt(req.query.skip || '0', 10))

    const posts = await Post.find({ visibility: 'public' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    return res.status(200).json({ posts })
  } catch (error) {
    console.error('Failed to fetch posts:', error)
    return res.status(500).json({ message: 'Failed to fetch posts', error: error.message })
  }
})

// Like/unlike a post
router.patch('/:postId/like', async (req, res) => {
  try {
    const { postId } = req.params
    const user = req.user || {}
    const userId = getUserIdentity(user).id

    if (!postId) {
      return res.status(400).json({ message: 'Post ID is required' })
    }

    const post = await Post.findOne({ postId })
    if (!post) {
      return res.status(404).json({ message: 'Post not found' })
    }

    // Check if user already liked
    const alreadyLiked = post.likes?.userIds?.includes(userId)
    
    if (alreadyLiked) {
      // Unlike
      post.likes.userIds = post.likes.userIds.filter((id) => id !== userId)
      post.likes.count = Math.max(0, post.likes.count - 1)
    } else {
      // Like
      if (!post.likes) post.likes = { count: 0, userIds: [] }
      if (!post.likes.userIds) post.likes.userIds = []
      post.likes.userIds.push(userId)
      post.likes.count = (post.likes.count || 0) + 1
    }

    await post.save()
    return res.status(200).json({ message: alreadyLiked ? 'Post unliked' : 'Post liked', post })
  } catch (error) {
    console.error('Failed to like post:', error)
    return res.status(500).json({ message: 'Failed to like post', error: error.message })
  }
})

// Add comment to a post
router.post('/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params
    const { text } = req.body
    const user = req.user || {}

    if (!postId) {
      return res.status(400).json({ message: 'Post ID is required' })
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Comment text is required' })
    }

    const post = await Post.findOne({ postId })
    if (!post) {
      return res.status(404).json({ message: 'Post not found' })
    }

    // Initialize comments if not exist
    if (!post.comments) {
      post.comments = { count: 0, list: [] }
    }
    if (!post.comments.list) {
      post.comments.list = []
    }

    // Create new comment
    const newComment = {
      text: text.trim(),
      author: getUserIdentity(user),
    }

    // Add comment
    post.comments.list.push(newComment)
    post.comments.count = (post.comments.count || 0) + 1

    await post.save()
    return res.status(200).json({ message: 'Comment added', post })
  } catch (error) {
    console.error('Failed to add comment:', error)
    return res.status(500).json({ message: 'Failed to add comment', error: error.message })
  }
})

// Delete a comment from a post
router.delete('/:postId/comments/:commentId', async (req, res) => {
  try {
    const { postId, commentId } = req.params
    const user = req.user || {}
    const userIdentity = getUserIdentity(user)

    if (!postId || !commentId) {
      return res.status(400).json({ message: 'Post ID and comment ID are required' })
    }

    const post = await Post.findOne({ postId })
    if (!post) {
      return res.status(404).json({ message: 'Post not found' })
    }

    const comment = post.comments?.list?.find((item) => item.commentId === commentId)
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' })
    }

    if (userIdentity.role !== 'admin' && comment.author?.id !== userIdentity.id) {
      return res.status(403).json({ message: 'You can only delete your own comments' })
    }

    post.comments.list = post.comments.list.filter((item) => item.commentId !== commentId)
    post.comments.count = Math.max(0, (post.comments.count || 0) - 1)

    await post.save()
    return res.status(200).json({ message: 'Comment deleted', post })
  } catch (error) {
    console.error('Failed to delete comment:', error)
    return res.status(500).json({ message: 'Failed to delete comment', error: error.message })
  }
})

// Delete a post
router.delete('/:postId', async (req, res) => {
  try {
    const { postId } = req.params
    const user = req.user || {}
    const userIdentity = getUserIdentity(user)

    if (!postId) {
      return res.status(400).json({ message: 'Post ID is required' })
    }

    const post = await Post.findOne({ postId })
    if (!post) {
      return res.status(404).json({ message: 'Post not found' })
    }

    if (userIdentity.role !== 'admin' && post.author?.id !== userIdentity.id) {
      return res.status(403).json({ message: 'Only the post owner can delete this post' })
    }

    await Post.deleteOne({ postId })
    return res.status(200).json({ message: 'Post deleted', postId })
  } catch (error) {
    console.error('Failed to delete post:', error)
    return res.status(500).json({ message: 'Failed to delete post', error: error.message })
  }
})

// Get comments for a post
router.get('/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params

    if (!postId) {
      return res.status(400).json({ message: 'Post ID is required' })
    }

    const post = await Post.findOne({ postId })
    if (!post) {
      return res.status(404).json({ message: 'Post not found' })
    }

    const comments = post.comments?.list || []
    return res.status(200).json({ comments, count: post.comments?.count || 0 })
  } catch (error) {
    console.error('Failed to fetch comments:', error)
    return res.status(500).json({ message: 'Failed to fetch comments', error: error.message })
  }
})

module.exports = router
