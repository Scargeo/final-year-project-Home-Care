const express = require('express');

const {
  listSOSRequests,
  createSOSRequest,
  getSOSRequestById,
  updateSOSRequest,
} = require('../../middleware/sosController');

const router = express.Router();

router.get('/', listSOSRequests);
router.post('/', createSOSRequest);
router.get('/:id', getSOSRequestById);
router.patch('/:id', updateSOSRequest);

module.exports = router;
