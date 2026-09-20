const jwt = require("jsonwebtoken");

const COOKIE_NAME = "quran_session";

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
}

function setSessionCookie(res, token) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

function clearSessionCookie(res) {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
  });
}

// Attaches req.user if a valid session cookie is present. Does not block
// the request if absent — routes decide for themselves whether auth is required.
function readSession(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email, name: payload.name };
  } catch (e) {
    // expired/invalid token - treat as logged out rather than erroring
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Please sign in to continue." });
  next();
}

module.exports = { COOKIE_NAME, signToken, setSessionCookie, clearSessionCookie, readSession, requireAuth };
