const admin = require("firebase-admin");

const SUPPORTED_APPS = new Set(["music", "cover", "atmo"]);
let installed = false;

function clean(value) {
  return String(value || "").trim();
}

function stripLegacyEmoji(title) {
  return clean(title)
    .replace(/[🎵🎶🖼️🎬]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function iconUrlFor(app) {
  return `https://aivo.tr/api/push/icons/module.png?app=${encodeURIComponent(app)}`;
}

function decorateMessage(message) {
  const app = clean(message?.data?.app).toLowerCase();
  if (!SUPPORTED_APPS.has(app)) return message;

  const imageUrl = iconUrlFor(app);
  const next = { ...(message || {}) };

  next.notification = {
    ...(message?.notification || {}),
    title: stripLegacyEmoji(message?.notification?.title),
    imageUrl,
  };

  next.apns = {
    ...(message?.apns || {}),
    payload: {
      ...(message?.apns?.payload || {}),
      aps: {
        ...(message?.apns?.payload?.aps || {}),
        "mutable-content": 1,
      },
    },
    fcmOptions: {
      ...(message?.apns?.fcmOptions || {}),
      imageUrl,
    },
  };

  next.data = {
    ...(message?.data || {}),
    module_icon_url: imageUrl,
    imageUrl,
    image: imageUrl,
  };

  return next;
}

function installPushModuleRichIcons() {
  if (installed) return;
  installed = true;

  const originalMessaging = admin.messaging.bind(admin);

  admin.messaging = function patchedMessaging(...args) {
    const client = originalMessaging(...args);

    if (!client.__AIVO_MODULE_ICON_PATCHED__) {
      const originalSend = client.send.bind(client);

      client.send = function patchedSend(message, ...rest) {
        return originalSend(decorateMessage(message), ...rest);
      };

      Object.defineProperty(client, "__AIVO_MODULE_ICON_PATCHED__", {
        value: true,
        enumerable: false,
        configurable: false,
        writable: false,
      });
    }

    return client;
  };
}

module.exports = {
  installPushModuleRichIcons,
  decorateMessage,
};
