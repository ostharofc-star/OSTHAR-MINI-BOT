// ======================================================
// OSTHAR MINI BOT - COMPLETE NUMBER CATEGORY MENU
// ======================================================

const fs = require("fs");
const path = require("path");

const MENU_IMAGE_PATH =
  path.join(
    __dirname,
    "..",
    "assets",
    "bot-image.jpg"
  );

let MENU_IMAGE_BUFFER = null;

try {
  MENU_IMAGE_BUFFER =
    fs.readFileSync(
      MENU_IMAGE_PATH
    );
} catch (error) {
  console.log(
    "Menu Image Load Error:",
    error?.message || error
  );
}

async function sendMainMenu({
  sock,
  jid,
  msg,
  prefix,
  botName,
  userName
}) {
  const caption =
    buildMainMenu({
      prefix,
      botName,
      userName
    });

  if (MENU_IMAGE_BUFFER) {
    return sock.sendMessage(
      jid,
      {
        image:
          MENU_IMAGE_BUFFER,

        caption
      },
      {
        quoted:
          msg
      }
    );
  }

  // Fallback: menu still works even if image file is missing.
  return sock.sendMessage(
    jid,
    {
      text:
        caption
    },
    {
      quoted:
        msg
    }
  );
}

const MENU_TTL =
  5 * 60 * 1000;

// Each socket gets its own menu sessions
const socketSessions =
  new WeakMap();

const registeredSockets =
  new WeakSet();

// ======================================================
// GET SESSION STORE
// ======================================================

function getSessionStore(sock) {
  let store =
    socketSessions.get(sock);

  if (!store) {
    store = new Map();

    socketSessions.set(
      sock,
      store
    );
  }

  return store;
}

// ======================================================
// GET MESSAGE TEXT
// ======================================================

function getText(msg) {
  const message =
    msg?.message || {};

  return (
    message.conversation ||

    message
      .extendedTextMessage
      ?.text ||

    message
      .imageMessage
      ?.caption ||

    message
      .videoMessage
      ?.caption ||

    ""
  );
}

// ======================================================
// SAVE MENU SESSION
// ======================================================

function saveMenuSession(
  sock,
  jid,
  data
) {
  const store =
    getSessionStore(sock);

  store.set(
    jid,
    {
      ...data,

      expiresAt:
        Date.now() +
        MENU_TTL
    }
  );
}

// ======================================================
// GET MENU SESSION
// ======================================================

function getMenuSession(
  sock,
  jid
) {
  const store =
    getSessionStore(sock);

  const session =
    store.get(jid);

  if (!session) {
    return null;
  }

  if (
    session.expiresAt <
    Date.now()
  ) {
    store.delete(jid);

    return null;
  }

  return session;
}

// ======================================================
// MAIN MENU
// ======================================================

function buildMainMenu({
  prefix,
  botName,
  userName
}) {
  return (
`╭━━━━━━━━━━━━━━━━━━╮
   *${botName}*
╰━━━━━━━━━━━━━━━━━━╯

👋 Hello, *${userName}*

📋 *MAIN MENU*
━━━━━━━━━━━━━━━━━━

1️⃣ GENERAL
2️⃣ DOWNLOADS
3️⃣ MEDIA & CONVERTER
4️⃣ AI & DOCUMENTS
5️⃣ TOOLS
6️⃣ INTERNET & INFO
7️⃣ GROUP ADMIN
8️⃣ GROUP MANAGEMENT
9️⃣ AUTOMATION
🔟 SCHEDULING
1️⃣1️⃣ PERSONAL TOOLS
1️⃣2️⃣ CUSTOMIZATION
1️⃣3️⃣ BOT SYSTEM
1️⃣4️⃣ WHATSAPP TOOLS
1️⃣5️⃣ WEB / GITHUB / MARKET
1️⃣6️⃣ COMMAND & MODE
1️⃣7️⃣ SUPPORT
1️⃣8️⃣ OWNER

━━━━━━━━━━━━━━━━━━

*Reply with a category number.*

Example:

*1* → General Menu
*2* → Downloads Menu
*3* → Media Menu

Type *${prefix}menu* anytime to open this menu again.

━━━━━━━━━━━━━━━━━━
*Mini Bot Created by Pamoda Nethsara*
━━━━━━━━━━━━━━━━━━`
  );
}

// ======================================================
// SUB MENUS
// ======================================================

function getSubMenu(
  number,
  prefix
) {
  const menus = {

    "1":
`╭━━━〔 *GENERAL MENU* 〕━━━╮

${prefix}menu
${prefix}help
${prefix}ping
${prefix}alive
${prefix}owner
${prefix}runtime
${prefix}speed
${prefix}jid
${prefix}me
${prefix}profile
${prefix}findcmd <command>
${prefix}commands
${prefix}cmdinfo <command>

━━━━━━━━━━━━━━━━━━
Reply *0* → Main Menu
╰━━━━━━━━━━━━━━━━━━━━╯`,

    "2":
`╭━━━〔 *DOWNLOAD MENU* 〕━━━╮

${prefix}yts <query>
${prefix}song <name/url>
${prefix}video <name/url>
${prefix}tiktok <url>
${prefix}facebook <url>
${prefix}instagram <url>
${prefix}pinterest <url>
${prefix}twitter <url>
${prefix}snapchat <url>
${prefix}apk <app name>
${prefix}film <movie name>

━━━━━━━━━━━━━━━━━━
Reply *0* → Main Menu
╰━━━━━━━━━━━━━━━━━━━━╯`,

    "3":
`╭━━━〔 *MEDIA & CONVERTER* 〕━━━╮

${prefix}sticker
${prefix}toimg
${prefix}mp3
${prefix}vv
${prefix}tts <text>
${prefix}compress
${prefix}resize <width>x<height>
${prefix}gif
${prefix}voice
${prefix}photo
${prefix}audio

${prefix}qrscan
${prefix}ocr
${prefix}topng
${prefix}tojpg
${prefix}tomp3

━━━━━━━━━━━━━━━━━━
Reply *0* → Main Menu
╰━━━━━━━━━━━━━━━━━━━━╯`,

    "4":
`╭━━━〔 *AI & DOCUMENTS* 〕━━━╮

${prefix}ai <question>
${prefix}define <word>
${prefix}grammar <text>
${prefix}summarize <text>
${prefix}code <question>
${prefix}docsummary
${prefix}pdfsummary

━━━━━━━━━━━━━━━━━━
Reply *0* → Main Menu
╰━━━━━━━━━━━━━━━━━━━━╯`,

    "5":
`╭━━━〔 *TOOLS MENU* 〕━━━╮

${prefix}weather <city>
${prefix}translate <lang> <text>
${prefix}google <query>
${prefix}image <query>
${prefix}wiki <query>
${prefix}calc <expression>
${prefix}shorturl <url>
${prefix}qr <text>
${prefix}ss <url>

${prefix}password <length>
${prefix}uuid
${prefix}base64 encode <text>
${prefix}base64 decode <text>
${prefix}hash <text>
${prefix}random <min> <max>
${prefix}dice
${prefix}coin
${prefix}quote
${prefix}fact
${prefix}joke
${prefix}truth
${prefix}dare

━━━━━━━━━━━━━━━━━━
Reply *0* → Main Menu
╰━━━━━━━━━━━━━━━━━━━━╯`,

    "6":
`╭━━━〔 *INTERNET & INFO* 〕━━━╮

${prefix}ip <ip>
${prefix}whois <domain>
${prefix}dns <domain> [type]
${prefix}time <city>
${prefix}currency <from> <to> <amount>
${prefix}unit <value> <from> <to>

${prefix}urlcheck <url>
${prefix}linkpreview <url>
${prefix}sitecheck <url>

━━━━━━━━━━━━━━━━━━
Reply *0* → Main Menu
╰━━━━━━━━━━━━━━━━━━━━╯`,

    "7":
`╭━━━〔 *GROUP ADMIN MENU* 〕━━━╮

${prefix}groupinfo
${prefix}admins
${prefix}tagall <message>
${prefix}hidetag <message>
${prefix}kick
${prefix}add <number>
${prefix}promote
${prefix}demote
${prefix}mute
${prefix}unmute
${prefix}lock
${prefix}unlock
${prefix}setsubject <name>
${prefix}setdesc <text>
${prefix}invite
${prefix}revoke

━━━━━━━━━━━━━━━━━━
Reply *0* → Main Menu
╰━━━━━━━━━━━━━━━━━━━━╯`,

    "8":
`╭━━━〔 *GROUP MANAGEMENT* 〕━━━╮

${prefix}warn
${prefix}warnings
${prefix}unwarn
${prefix}resetwarn
${prefix}warnlist
${prefix}autowarnkick on/off

${prefix}rules
${prefix}setrules <text>
${prefix}clearrules

${prefix}setwelcome <message>
${prefix}setgoodbye <message>

${prefix}rank
${prefix}level
${prefix}xp
${prefix}leaderboard
${prefix}lb
${prefix}resetxp
${prefix}resetgroupxp

${prefix}groupsetting <setting> <on/off>
${prefix}groupsettings
${prefix}resetgroupsettings

━━━━━━━━━━━━━━━━━━
Reply *0* → Main Menu
╰━━━━━━━━━━━━━━━━━━━━╯`,

    "9":
`╭━━━〔 *AUTOMATION MENU* 〕━━━╮

${prefix}antidelete on/off
${prefix}anticall on/off
${prefix}autostatus on/off
${prefix}autoreact on/off
${prefix}autoreply on/off
${prefix}autoread on/off
${prefix}autotyping on/off
${prefix}statusreact on/off
${prefix}setstatusreact <emoji>
${prefix}statusreply on/off
${prefix}welcome on/off
${prefix}goodbye on/off
${prefix}antilink on/off
${prefix}antispam on/off
${prefix}settings

━━━━━━━━━━━━━━━━━━
Reply *0* → Main Menu
╰━━━━━━━━━━━━━━━━━━━━╯`,

    "10":
`╭━━━〔 *SCHEDULING MENU* 〕━━━╮

${prefix}remind <time> <message>
${prefix}reminders
${prefix}delreminder <number>
${prefix}clearreminders

${prefix}schedule <time> <message>
${prefix}schedules
${prefix}delschedule <number>
${prefix}clearschedules

${prefix}dailymsg <HH:MM> <message>
${prefix}dailymsgs
${prefix}deldailymsg <number>
${prefix}dailymessageoff <number>
${prefix}dailymessageon <number>
${prefix}cleardailymsgs

${prefix}statusschedule <time> <text/caption>
${prefix}statusnow <text/caption>
${prefix}statusschedules
${prefix}delstatusschedule <number>
${prefix}clearstatusschedules
${prefix}statusaudience
${prefix}statusaudience add <number>
${prefix}statusaudience del <number>

━━━━━━━━━━━━━━━━━━
Reply *0* → Main Menu
╰━━━━━━━━━━━━━━━━━━━━╯`,

    "11":
`╭━━━〔 *PERSONAL TOOLS* 〕━━━╮

${prefix}afk <reason>
${prefix}back

${prefix}setnote <name> <text>
${prefix}note <name>
${prefix}notes
${prefix}delnote <name>

${prefix}addfav <command>
${prefix}delfav <command>
${prefix}favorites
${prefix}clearfavorites

━━━━━━━━━━━━━━━━━━
Reply *0* → Main Menu
╰━━━━━━━━━━━━━━━━━━━━╯`,

    "12":
`╭━━━〔 *CUSTOMIZATION MENU* 〕━━━╮

${prefix}setprefix <prefix>
${prefix}setname <name>
${prefix}setwelcome <message>
${prefix}setgoodbye <message>
${prefix}setautoreply <message>
${prefix}setstatusreact <emoji>

${prefix}addcmd <command> <reply>
${prefix}delcmd <command>
${prefix}customcmds

━━━━━━━━━━━━━━━━━━
Reply *0* → Main Menu
╰━━━━━━━━━━━━━━━━━━━━╯`,

    "13":
`╭━━━〔 *BOT SYSTEM* 〕━━━╮

${prefix}botinfo
${prefix}version
${prefix}uptime
${prefix}memory
${prefix}cpu
${prefix}status
${prefix}commands
${prefix}cmdinfo <command>
${prefix}findcmd <command>

${prefix}bot <phone>

━━━━━━━━━━━━━━━━━━
Reply *0* → Main Menu
╰━━━━━━━━━━━━━━━━━━━━╯`,

    "14":
`╭━━━〔 *WHATSAPP TOOLS* 〕━━━╮

${prefix}getpp
${prefix}profile
${prefix}savecontact
${prefix}poll <question | options>
${prefix}readmore <text | hidden>
${prefix}vv

━━━━━━━━━━━━━━━━━━
Reply *0* → Main Menu
╰━━━━━━━━━━━━━━━━━━━━╯`,

    "15":
`╭━━━〔 *WEB / GITHUB / MARKET* 〕━━━╮

${prefix}githubuser <username>
${prefix}githubrepo <owner/repo>

${prefix}crypto <coin>
${prefix}stock <symbol>

${prefix}news
${prefix}news <topic>

${prefix}sitecheck <url>
${prefix}watchsite <url> [name]
${prefix}sitewatches
${prefix}unwatchsite <number>

${prefix}urlcheck <url>
${prefix}linkpreview <url>

━━━━━━━━━━━━━━━━━━
Reply *0* → Main Menu
╰━━━━━━━━━━━━━━━━━━━━╯`,

    "16":
`╭━━━〔 *COMMAND & MODE* 〕━━━╮

${prefix}public
${prefix}private
${prefix}mode

${prefix}disablecmd <command>
${prefix}enablecmd <command>
${prefix}cmdstatus

━━━━━━━━━━━━━━━━━━
Reply *0* → Main Menu
╰━━━━━━━━━━━━━━━━━━━━╯`,

    "17":
`╭━━━〔 *SUPPORT MENU* 〕━━━╮

${prefix}report <problem>
${prefix}feedback <message>

━━━━━━━━━━━━━━━━━━
Reply *0* → Main Menu
╰━━━━━━━━━━━━━━━━━━━━╯`,

    "18":
`╭━━━〔 *OWNER MENU* 〕━━━╮

${prefix}block
${prefix}unblock
${prefix}restart
${prefix}logout

${prefix}broadcast number1,number2 | message

${prefix}backup
${prefix}restorebackup

${prefix}disablecmd <command>
${prefix}enablecmd <command>

━━━━━━━━━━━━━━━━━━
Reply *0* → Main Menu
╰━━━━━━━━━━━━━━━━━━━━╯`
  };

  return (
    menus[number] ||
    null
  );
}

// ======================================================
// REGISTER NUMBER REPLY LISTENER
// ======================================================

function registerMenuListener(sock) {

  if (
    registeredSockets.has(
      sock
    )
  ) {
    return;
  }

  registeredSockets.add(
    sock
  );

  sock.ev.on(
    "messages.upsert",
    async ({
      messages,
      type
    }) => {

      if (
        type !== "notify"
      ) {
        return;
      }

      for (
        const msg of messages
      ) {
        try {

          if (
            !msg?.message
          ) {
            continue;
          }

          const jid =
            msg.key.remoteJid;

          if (!jid) {
            continue;
          }

          const session =
            getMenuSession(
              sock,
              jid
            );

          if (!session) {
            continue;
          }

          const text =
            String(
              getText(msg) || ""
            )
              .trim();

          // Only accept menu numbers 0 - 18
          if (
            !/^(0|[1-9]|1[0-8])$/.test(
              text
            )
          ) {
            continue;
          }

          const prefix =
            session.prefix ||
            ".";

          const botName =
            session.botName ||
            "OSTHAR MINI BOT";

          const userName =
            msg?.pushName ||
            session.userName ||
            "User";

          // ==========================================
          // MAIN MENU
          // ==========================================

          if (
            text === "0"
          ) {
            saveMenuSession(
              sock,
              jid,
              {
                prefix,
                botName,
                userName
              }
            );

            await sendMainMenu({
              sock,
              jid,
              msg,
              prefix,
              botName,
              userName
            });

            continue;
          }

          // ==========================================
          // SUB MENU
          // ==========================================

          const subMenu =
            getSubMenu(
              text,
              prefix
            );

          if (!subMenu) {
            continue;
          }

          saveMenuSession(
            sock,
            jid,
            {
              prefix,
              botName,
              userName
            }
          );

          await sock.sendMessage(
            jid,
            {
              text:
                subMenu
            },
            {
              quoted:
                msg
            }
          );

        } catch (error) {
          console.log(
            "MENU REPLY ERROR:",
            error?.message || error
          );
        }
      }
    }
  );
}

// ======================================================
// COMMAND
// ======================================================

module.exports = {

  name:
    "menu",

  aliases: [
    "help"
  ],

  description:
    "Show categorized command menu.",

  reaction:
    "📋",

  async execute({
    sock,
    msg,
    jid,
    settings
  }) {

    try {

      const prefix =
        settings?.prefix ||
        ".";

      const botName =
        settings?.botName ||
        "OSTHAR MINI BOT";

      const userName =
        msg?.pushName ||
        "User";

      // Register reply listener once
      registerMenuListener(
        sock
      );

      // Start menu session
      saveMenuSession(
        sock,
        jid,
        {
          prefix,
          botName,
          userName
        }
      );

      // Send main menu
      await sendMainMenu({
        sock,
        jid,
        msg,
        prefix,
        botName,
        userName
      });

    } catch (error) {

      console.log(
        "MENU ERROR:",
        error?.message || error
      );

      await sock.sendMessage(
        jid,
        {
          text:
            "❌ Unable to open the menu right now."
        },
        {
          quoted:
            msg
        }
      );
    }
  }
};
