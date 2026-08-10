const express = require('express');

const {
  listSOSRequests,
  createSOSRequest,
  getSOSRequestById,
  updateSOSRequest,
} = require('../../middleware/sosController');

const { loadUser } = require('../../middleware/loadUserMiddleware');
const { allowHealthProviderOnly } = require('../../middleware/permissionMiddleware');

const router = express.Router();

// Apply loadUser middleware to parse JWT from Authorization header
router.use(loadUser);

router.get('/', listSOSRequests);
router.post('/', createSOSRequest);
router.get('/:id', getSOSRequestById);
// Both doctors and nurses (healthcare providers) can accept/respond to SOS alerts.
router.patch('/:id', allowHealthProviderOnly(), updateSOSRequest);

module.exports = router;
