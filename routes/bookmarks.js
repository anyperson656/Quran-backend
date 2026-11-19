const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

const EXTRA_TYPES = new Set([
  "normal_parah",
  "translation_surah",
  "translation_parah",
  "word_by_word",
]);

router.get("/", async (req, res) => {
  try {
    const [existingResult, extraResult] = await Promise.all([
      pool.query(
        `SELECT id, surah_number as "surahNumber", surah_name as "surahName",
                ayah_number as "ayahNumber", mode, source, created_at as "createdAt"
         FROM bookmarks
         WHERE user_id = $1
         ORDER BY surah_number, ayah_number`,
        [req.user.id]
      ),
      pool.query(
        `SELECT id, bookmark_type as "bookmarkType", surah_number as "surahNumber",
                surah_name as "surahName", parah_number as "parahNumber",
                ayah_number as "ayahNumber", created_at as "createdAt",
                updated_at as "updatedAt"
         FROM extra_bookmarks
         WHERE user_id = $1
         ORDER BY created_at DESC, id DESC`,
        [req.user.id]
      ),
    ]);

    res.json({
      bookmarks: existingResult.rows,
      extraBookmarks: extraResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't load your bookmarks." });
  }
});

router.post("/", async (req, res) => {
  const {
    bookmarkType = "normal_surah",
    surahNumber,
    surahName,
    parahNumber,
    ayahNumber,
    mode = "surah",
    source = "plain",
  } = req.body || {};

  try {
    // Handle the 4 new bookmark types in `extra_bookmarks`
    if (EXTRA_TYPES.has(bookmarkType)) {
      const parsedSurah =
        surahNumber === undefined || surahNumber === null || surahNumber === ""
          ? null
          : Number(surahNumber);
      const parsedParah =
        parahNumber === undefined || parahNumber === null || parahNumber === ""
          ? null
          : Number(parahNumber);
      const parsedAyah =
        ayahNumber === undefined || ayahNumber === null || ayahNumber === ""
          ? null
          : Number(ayahNumber);

      if (
        parsedSurah !== null &&
        (!Number.isInteger(parsedSurah) || parsedSurah < 1 || parsedSurah > 114)
      ) {
        return res.status(400).json({ error: "Invalid surah number." });
      }
      if (
        parsedParah !== null &&
        (!Number.isInteger(parsedParah) || parsedParah < 1 || parsedParah > 30)
      ) {
        return res.status(400).json({ error: "Invalid parah number." });
      }
      if (parsedAyah !== null && (!Number.isInteger(parsedAyah) || parsedAyah < 1)) {
        return res.status(400).json({ error: "Invalid ayah number." });
      }

      // Word-by-word: enforces single ayah per user per surah
      if (bookmarkType === "word_by_word") {
        if (!parsedSurah) {
          return res
            .status(400)
            .json({ error: "Surah number is required for word-by-word bookmark." });
        }

        const wbwResult = await pool.query(
          `INSERT INTO extra_bookmarks
             (user_id, bookmark_type, surah_number, surah_name, parah_number, ayah_number, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT (user_id, surah_number)
           WHERE bookmark_type = 'word_by_word' AND surah_number IS NOT NULL
           DO UPDATE SET
             surah_name = EXCLUDED.surah_name,
             parah_number = EXCLUDED.parah_number,
             ayah_number = EXCLUDED.ayah_number,
             updated_at = NOW()
           RETURNING id, bookmark_type as "bookmarkType", surah_number as "surahNumber",
                     surah_name as "surahName", parah_number as "parahNumber",
                     ayah_number as "ayahNumber", created_at as "createdAt",
                     updated_at as "updatedAt"`,
          [
            req.user.id,
            bookmarkType,
            parsedSurah,
            surahName ? String(surahName) : null,
            parsedParah,
            parsedAyah,
          ]
        );

        return res.status(201).json({
          bookmark: wbwResult.rows[0],
          storage: "extra_bookmarks",
        });
      }

      // Normal Parah, Translation Surah, and Translation Parah
      const extraInsert = await pool.query(
        `INSERT INTO extra_bookmarks
           (user_id, bookmark_type, surah_number, surah_name, parah_number, ayah_number)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, bookmark_type as "bookmarkType", surah_number as "surahNumber",
                   surah_name as "surahName", parah_number as "parahNumber",
                   ayah_number as "ayahNumber", created_at as "createdAt",
                   updated_at as "updatedAt"`,
        [
          req.user.id,
          bookmarkType,
          parsedSurah,
          surahName ? String(surahName) : null,
          parsedParah,
          parsedAyah,
        ]
      );

      return res.status(201).json({
        bookmark: extraInsert.rows[0],
        storage: "extra_bookmarks",
      });
    }

    // Existing Normal Quran Surah flow (`bookmarks` table)
    if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
      return res.status(400).json({ error: "Invalid surah number." });
    }
    if (!Number.isInteger(ayahNumber) || ayahNumber < 1) {
      return res.status(400).json({ error: "Invalid ayah number." });
    }
    if (!surahName) return res.status(400).json({ error: "Missing surah name." });

    const result = await pool.query(
      `INSERT INTO bookmarks (user_id, surah_number, surah_name, ayah_number, mode, source)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, surah_number, ayah_number) DO UPDATE
       SET mode = EXCLUDED.mode, source = EXCLUDED.source
       RETURNING id, surah_number as "surahNumber", surah_name as "surahName",
                 ayah_number as "ayahNumber", mode, source, created_at as "createdAt"`,
      [req.user.id, surahNumber, String(surahName), ayahNumber, mode, source]
    );

    res.status(201).json({ bookmark: result.rows[0], storage: "bookmarks" });
  } catch (e) {
    if (e.code === "23505") {
      return res.status(409).json({ error: "This ayah is already bookmarked." });
    }
    console.error(e);
    res.status(500).json({ error: "Couldn't save the bookmark." });
  }
});

router.delete("/:id", async (req, res) => {
  const tableName = req.query.table === "extra" ? "extra_bookmarks" : "bookmarks";

  try {
    const result = await pool.query(
      `DELETE FROM ${tableName} WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Bookmark not found." });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't remove the bookmark." });
  }
});

module.exports = router;