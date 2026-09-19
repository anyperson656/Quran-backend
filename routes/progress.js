const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT surah_number as "surahNumber", ayah_number as "ayahNumber", updated_at as "updatedAt"
       FROM progress WHERE user_id = $1`,
      [req.user.id]
    );
    res.json({ progress: result.rows[0] || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't load your reading progress." });
  }
});

router.put("/", async (req, res) => {
  const { surahNumber, ayahNumber } = req.body || {};
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
    return res.status(400).json({ error: "Invalid surah number." });
  }
  if (!Number.isInteger(ayahNumber) || ayahNumber < 1) {
    return res.status(400).json({ error: "Invalid ayah number." });
  }
  try {
    await pool.query(
      `INSERT INTO progress (user_id, surah_number, ayah_number, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) DO UPDATE SET surah_number = $2, ayah_number = $3, updated_at = NOW()`,
      [req.user.id, surahNumber, ayahNumber]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't save your progress." });
  }
});

module.exports = router;