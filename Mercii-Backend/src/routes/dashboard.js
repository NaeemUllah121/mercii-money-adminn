const express = require('express');
const router = express.Router();

// Serve dashboard page
router.get('/', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

module.exports = router;
