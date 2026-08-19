const crypto = require("crypto");

const sessions = new Map();

const SESSION_TTL =
  24 * 60 * 60 * 1000;

function createSession(phone) {
  const token =
    crypto
      .randomBytes(32)
      .toString("hex");

  sessions.set(token, {
    phone,
    expiresAt:
      Date.now() + SESSION_TTL
  });

  return token;
}

function getSession(token) {
  if (!token) return null;

  const session =
    sessions.get(token);

  if (!session) {
    return null;
  }

  if (
    session.expiresAt <
    Date.now()
  ) {
    sessions.delete(token);
    return null;
  }

  return session;
}

function deleteSession(token) {
  if (!token) return;

  sessions.delete(token);
}

function parseCookies(req) {
  const raw =
    req.headers.cookie || "";

  const result = {};

  raw.split(";")
    .map(item => item.trim())
    .filter(Boolean)
    .forEach(item => {
      const index =
        item.indexOf("=");

      if (index === -1) {
        return;
      }

      const key =
        item.slice(0, index);

      const value =
        item.slice(index + 1);

      result[key] =
        decodeURIComponent(value);
    });

  return result;
}

function getAuthSession(req) {
  const cookies =
    parseCookies(req);

  const token =
    cookies.osthar_session;

  const session =
    getSession(token);

  if (!session) {
    return null;
  }

  return {
    token,
    ...session
  };
}

function requireAuth(
  req,
  res,
  next
) {
  const session =
    getAuthSession(req);

  if (!session) {
    return res.status(401).json({
      success: false,
      error:
        "Authentication required."
    });
  }

  req.webSession = session;

  next();
}

module.exports = {
  createSession,
  getSession,
  deleteSession,
  getAuthSession,
  requireAuth
};