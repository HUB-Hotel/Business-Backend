const express = require("express");
const router = express.Router();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { presignPut } = require('../src/s3.js');
const { authenticateToken } = require('../middlewares/auth');
const { requireBusiness } = require('../middlewares/roles');

router.get('/ping', (req, res) => res.json({ ok: true }));

router.post('/presign', authenticateToken, requireBusiness, async (req, res) => {
  try {
    const { filename, contentType } = req.body;

    if (!filename || !contentType) {
      return res.status(400).json({ message: 'filename/contentType은 필수입니다.' });
    }

    const key = `hotels/${Date.now()}-${uuidv4()}${path.extname(filename)}`;

    const url = await presignPut(key, contentType);

    res.json({ url, key });
  } catch (error) {
    console.error('presign 실패', error);
    res.status(500).json({ message: "presign 생성 실패" });
  }
});

module.exports = router;

