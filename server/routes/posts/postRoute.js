const express = require('express')
const router = express.Router()
const Post = require('../../models/posts/post')
const Doctor = require('../../models/privateHealthWorker/doctor/doctorRegistration')
const Nurse = require('../../models/privateHealthWorker/nurse/privateNurseRegistration')
const { loadUser } = require('../../middleware/loadUserMiddleware')
const { getJson, setJson, delMatching } = require('../../lib/redisClient')

const POSTS_CACHE_TTL = 60 // seconds
const POSTS_CACHE_PREFIX = 'posts:feed' // used with delMatching('posts:feed:*')

function postsCacheKey(limit, skip) {
  return `${POSTS_CACHE_PREFIX}:${limit}:${skip}`
}

// Best-effort cache invalidation for the public feed. Runs in the background
// so a Redis hiccup never blocks a write operation.
function invalidatePostsCache() {
  delMatching(`${POSTS_CACHE_PREFIX}:*`).catch((error) => {
    console.warn('[redis] failed to invalidate posts cache:', error?.message || error)
  })
}

function getUserIdentity(user = {}) {
  const record = user.record || {}
  return {
    id: user.id || user.userId || user.patientId || user.doctorId || user.nurseId || record.patientId || record.doctorId || record.uid || 'anonymous',
    name:
      record.patientFirstName ||
      record.doctorFirstName ||
      record.nurseFirstName ||
      record.adminName ||
      user?.patientFirstName ||
      user?.doctorFirstName ||
      user?.nurseFirstName ||
      user?.adminName ||
      user?.name ||
      record.name ||
      'Unknown',
    role: user?.role || record.role || 'doctor',
    isVerified: Boolean(user?.isVerified ?? record?.isVerified),
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

    invalidatePostsCache()

    return res.status(201).json({ message: 'Post created', post })
  } catch (error) {
    console.error('Failed to create post:', error)
    return res.status(500).json({ message: 'Failed to create post', error: error.message })
  }
})

// Get public posts (paginated optional, cached in Redis)
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit || '20', 10))
    const skip = Math.max(0, parseInt(req.query.skip || '0', 10))

    const cacheKey = postsCacheKey(limit, skip)
    const cached = await getJson(cacheKey)
    if (cached && Array.isArray(cached.posts)) {
      return res.status(200).json(cached)
    }

    const posts = await Post.find({ visibility: 'public' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    const doctorAuthorIds = [...new Set(
      posts
        .filter((post) => String(post?.author?.role || '').toLowerCase() === 'doctor')
        .map((post) => String(post?.author?.id || ''))
        .filter(Boolean),
    )]

    const nurseAuthorIds = [...new Set(
      posts
        .filter((post) => String(post?.author?.role || '').toLowerCase() === 'nurse')
        .map((post) => String(post?.author?.id || ''))
        .filter(Boolean),
    )]

    const doctorVerificationMap = new Map()
    if (doctorAuthorIds.length > 0) {
      const doctors = await Doctor.find({ doctorId: { $in: doctorAuthorIds } })
        .select('doctorId isVerified')
        .lean()

      for (const doctor of doctors) {
        doctorVerificationMap.set(String(doctor.doctorId), Boolean(doctor.isVerified))
      }
    }

    const nurseVerificationMap = new Map()
    if (nurseAuthorIds.length > 0) {
      const nurses = await Nurse.find({ uid: { $in: nurseAuthorIds } })
        .select('uid isVerified')
        .lean()

      for (const nurse of nurses) {
        nurseVerificationMap.set(String(nurse.uid), Boolean(nurse.isVerified))
      }
    }

    const normalizedPosts = posts.map((post) => {
      if (!post?.author) return post

      const authorId = String(post.author.id || '')
      const authorRole = String(post.author.role || '').toLowerCase()
      const fallbackVerified = authorRole === 'doctor'
        ? Boolean(doctorVerificationMap.get(authorId))
        : authorRole === 'nurse'
          ? Boolean(nurseVerificationMap.get(authorId))
          : false

      return {
        ...post,
        author: {
          ...post.author,
          isVerified: Boolean(post.author.isVerified ?? fallbackVerified),
        },
      }
    })

    const payload = { posts: normalizedPosts }
    await setJson(cacheKey, payload, POSTS_CACHE_TTL)
    return res.status(200).json(payload)
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
    invalidatePostsCache()
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
    invalidatePostsCache()
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
    invalidatePostsCache()
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
    invalidatePostsCache()
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
