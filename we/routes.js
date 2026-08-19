const express =
  require("express");

const path =
  require("path");

const {
  verifyWebPin,
  normalizePhone
} = require(
  "../database/webAuth"
);

const {
  getUserSettings,
  updateUserSettings
} = require(
  "../database/settings"
);

const {
  createSession,
  deleteSession,
  getAuthSession,
  requireAuth
} = require("./auth");

const router =
  express.Router();

const PUBLIC_DIR =
  path.join(
    __dirname,
    "..",
    "public"
  );

// ======================================================
// LOGIN PAGE
// ======================================================

router.get(
  "/",
  (req, res) => {
    const session =
      getAuthSession(req);

    if (session) {
      return res.redirect(
        "/dashboard"
      );
    }

    res.sendFile(
      path.join(
        PUBLIC_DIR,
        "index.html"
      )
    );
  }
);

// ======================================================
// DASHBOARD PAGE
// ======================================================

router.get(
  "/dashboard",
  (req, res) => {
    const session =
      getAuthSession(req);

    if (!session) {
      return res.redirect(
        "/login"
      );
    }

    res.sendFile(
      path.join(
        PUBLIC_DIR,
        "dashboard.html"
      )
    );
  }
);

// ======================================================
// LOGIN API
// ======================================================

router.post(
  "/api/web/login",
  async (req, res) => {
    try {
      const phone =
        normalizePhone(
          req.body?.phone
        );

      const pin =
        String(
          req.body?.pin || ""
        ).trim();

      if (
        !phone ||
        !/^\d{5}$/.test(pin)
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Enter a valid phone number and 5-digit PIN."
          });
      }

      const result =
        await verifyWebPin(
          phone,
          pin
        );

      if (!result.success) {
        let message =
          "Login failed.";

        if (
          result.reason ===
          "WRONG_PIN"
        ) {
          message =
            "Incorrect Web PIN.";
        }

        if (
          result.reason ===
          "NOT_FOUND"
        ) {
          message =
            "No Web PIN was found for this number.";
        }

        if (
          result.reason ===
          "NO_PIN"
        ) {
          message =
            "No Web PIN is available for this number.";
        }

        if (
          result.reason ===
          "INVALID_INPUT"
        ) {
          message =
            "Enter a valid phone number and 5-digit PIN.";
        }

        return res
          .status(401)
          .json({
            success: false,
            error: message
          });
      }

      const token =
        createSession(
          phone
        );

      res.cookie(
        "osthar_session",
        token,
        {
          httpOnly: true,

          secure:
            process.env.NODE_ENV ===
            "production",

          sameSite:
            "lax",

          maxAge:
            24 *
            60 *
            60 *
            1000
        }
      );

      return res.json({
        success: true
      });

    } catch (error) {
      console.error(
        "WEB LOGIN ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          error:
            "Internal server error."
        });
    }
  }
);

// ======================================================
// LOGOUT
// ======================================================

router.post(
  "/api/web/logout",
  (req, res) => {
    const session =
      getAuthSession(req);

    if (session) {
      deleteSession(
        session.token
      );
    }

    res.clearCookie(
      "osthar_session"
    );

    res.json({
      success: true
    });
  }
);

// ======================================================
// GET SETTINGS
// ======================================================

router.get(
  "/api/web/settings",
  requireAuth,
  async (req, res) => {
    try {
      const phone =
        req.webSession.phone;

      const settings =
        await getUserSettings(
          phone
        );

      res.json({
        success: true,

        phone,

        settings
      });

    } catch (error) {
      console.error(
        "WEB SETTINGS ERROR:",
        error
      );

      res
        .status(500)
        .json({
          success: false,

          error:
            "Unable to load settings."
        });
    }
  }
);

// ======================================================
// UPDATE SETTINGS
// ======================================================

router.post(
  "/api/web/settings",
  requireAuth,
  async (req, res) => {
    try {
      const phone =
        req.webSession.phone;

      const allowed = [
        "botName",
        "prefix",

        "antiDelete",
        "antiDeleteDestination",

        "viewOnceDestination",
        "customDestinationNumber",

        "antiCall",
        "autoStatusSeen",
        "autoReact",
        "autoReply",
        "autoRead",
        "autoTyping",

        "statusReact",
        "statusReactEmoji",
        "statusReply",

        "antiLink",
        "antiSpam",

        "welcome",
        "goodbye",

        "welcomeMessage",
        "goodbyeMessage",
        "autoReplyMessage"
      ];

      const updates = {};

      for (
        const key of allowed
      ) {
        if (
          Object.prototype
            .hasOwnProperty
            .call(
              req.body,
              key
            )
        ) {
          updates[key] =
            req.body[key];
        }
      }

      // ==========================================
      // BOT NAME
      // ==========================================

      if (
        Object.prototype
          .hasOwnProperty
          .call(
            updates,
            "botName"
          )
      ) {
        updates.botName =
          String(
            updates.botName || ""
          )
            .slice(
              0,
              50
            )
            .trim();

        if (!updates.botName) {
          updates.botName =
            "OSTHAR MINI BOT";
        }
      }

      // ==========================================
      // PREFIX
      // ==========================================

      if (
        Object.prototype
          .hasOwnProperty
          .call(
            updates,
            "prefix"
          )
      ) {
        updates.prefix =
          String(
            updates.prefix || ""
          )
            .slice(
              0,
              3
            )
            .trim();

        if (!updates.prefix) {
          updates.prefix =
            ".";
        }
      }

      // ==========================================
      // STATUS REACTION EMOJI
      // ==========================================

      if (
        Object.prototype
          .hasOwnProperty
          .call(
            updates,
            "statusReactEmoji"
          )
      ) {
        const emoji =
          String(
            updates.statusReactEmoji ||
            ""
          )
            .trim()
            .slice(
              0,
              12
            );

        updates.statusReactEmoji =
          emoji ||
          "💚";
      }

      // ==========================================
      // CUSTOM DESTINATION NUMBER
      // ==========================================

      if (
        Object.prototype
          .hasOwnProperty
          .call(
            updates,
            "customDestinationNumber"
          )
      ) {
        updates.customDestinationNumber =
          String(
            updates.customDestinationNumber ||
            ""
          )
            .replace(
              /[^0-9]/g,
              ""
            )
            .slice(
              0,
              15
            );
      }

      // ==========================================
      // DESTINATION OPTIONS
      // ==========================================

      const validDestinations = [
        "owner",
        "same",
        "custom"
      ];

      if (
        updates.antiDeleteDestination &&
        !validDestinations.includes(
          updates.antiDeleteDestination
        )
      ) {
        delete updates
          .antiDeleteDestination;
      }

      if (
        updates.viewOnceDestination &&
        !validDestinations.includes(
          updates.viewOnceDestination
        )
      ) {
        delete updates
          .viewOnceDestination;
      }

      // ==========================================
      // MESSAGE LIMITS
      // ==========================================

      if (
        Object.prototype
          .hasOwnProperty
          .call(
            updates,
            "welcomeMessage"
          )
      ) {
        updates.welcomeMessage =
          String(
            updates.welcomeMessage ||
            ""
          ).slice(
            0,
            1000
          );
      }

      if (
        Object.prototype
          .hasOwnProperty
          .call(
            updates,
            "goodbyeMessage"
          )
      ) {
        updates.goodbyeMessage =
          String(
            updates.goodbyeMessage ||
            ""
          ).slice(
            0,
            1000
          );
      }

      if (
        Object.prototype
          .hasOwnProperty
          .call(
            updates,
            "autoReplyMessage"
          )
      ) {
        updates.autoReplyMessage =
          String(
            updates.autoReplyMessage ||
            ""
          ).slice(
            0,
            1000
          );
      }

      // ==========================================
      // SAVE
      // ==========================================

      const settings =
        await updateUserSettings(
          phone,
          updates
        );

      res.json({
        success: true,

        settings
      });

    } catch (error) {
      console.error(
        "WEB UPDATE ERROR:",
        error
      );

      res
        .status(500)
        .json({
          success: false,

          error:
            "Unable to save settings."
        });
    }
  }
);

module.exports =
  router;