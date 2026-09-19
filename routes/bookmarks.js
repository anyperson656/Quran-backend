const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, surah_number as "surahNumber", surah_name as "surahName", ayah_number as "ayahNumber", created_at as "createdAt"
       FROM bookmarks WHERE user_id = $1 ORDER BY surah_number, ayah_number`,
      [req.user.id]
    );
    res.json({ bookmarks: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't load your bookmarks." });
  }
});

router.post("/", async (req, res) => {
  const { surahNumber, surahName, ayahNumber } = req.body || {};
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
    return res.status(400).json({ error: "Invalid surah number." });
  }
  if (!Number.isInteger(ayahNumber) || ayahNumber < 1) {
    return res.status(400).json({ error: "Invalid ayah number." });
  }
  if (!surahName) return res.status(400).json({ error: "Missing surah name." });

  try {
    const result = await pool.query(
      "INSERT INTO bookmarks (user_id, surah_number, surah_name, ayah_number) VALUES ($1, $2, $3, $4) RETURNING id",
      [req.user.id, surahNumber, String(surahName), ayahNumber]
    );
    res.status(201).json({ bookmark: { id: result.rows[0].id, surahNumber, surahName, ayahNumber } });
  } catch (e) {
    if (e.code === "23505") {
      return res.status(409).json({ error: "This ayah is already bookmarked." });
    }
    console.error(e);
    res.status(500).json({ error: "Couldn't save the bookmark." });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM bookmarks WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Bookmark not found." });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't remove the bookmark." });
  }
});

module.exports = router;