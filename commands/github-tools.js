const axios = require("axios");

const api = axios.create({
  baseURL: "https://api.github.com",
  timeout: 15000,
  headers: {
    "User-Agent": "OSTHAR-MINI-BOT",
    "Accept": "application/vnd.github+json"
  }
});

module.exports = {
  name: "githubuser",
  aliases: ["githubrepo", "ghuser", "ghrepo"],
  description: "Get public GitHub user or repository information.",

  async execute({
    sock,
    msg,
    jid,
    command,
    query
  }) {
    const q = String(query || "").trim();

    try {
      if (["githubuser", "ghuser"].includes(command)) {
        if (!q) {
          return sock.sendMessage(
            jid,
            { text: "🐙 *GITHUB USER*\n\nUsage: .githubuser username" },
            { quoted: msg }
          );
        }

        const { data } = await api.get(`/users/${encodeURIComponent(q)}`);

        return sock.sendMessage(
          jid,
          {
            text:
              "🐙 *GITHUB USER*\n\n" +
              `Name: ${data.name || data.login}\n` +
              `Username: ${data.login}\n` +
              `Public Repos: ${data.public_repos}\n` +
              `Followers: ${data.followers}\n` +
              `Following: ${data.following}\n` +
              `Bio: ${data.bio || "Not available"}\n` +
              `Profile: ${data.html_url}`
          },
          { quoted: msg }
        );
      }

      const parts = q.split("/").filter(Boolean);
      if (parts.length !== 2) {
        return sock.sendMessage(
          jid,
          { text: "🐙 *GITHUB REPO*\n\nUsage: .githubrepo owner/repository" },
          { quoted: msg }
        );
      }

      const { data } =
        await api.get(
          `/repos/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}`
        );

      return sock.sendMessage(
        jid,
        {
          text:
            "🐙 *GITHUB REPOSITORY*\n\n" +
            `Name: ${data.full_name}\n` +
            `Description: ${data.description || "Not available"}\n` +
            `Stars: ${data.stargazers_count}\n` +
            `Forks: ${data.forks_count}\n` +
            `Open Issues: ${data.open_issues_count}\n` +
            `Language: ${data.language || "Unknown"}\n` +
            `Branch: ${data.default_branch}\n` +
            `Repository: ${data.html_url}`
        },
        { quoted: msg }
      );
    } catch (error) {
      const status = error?.response?.status;
      return sock.sendMessage(
        jid,
        {
          text:
            "❌ *GITHUB ERROR*\n\n" +
            (status === 404
              ? "User or repository not found."
              : error?.message || "Unable to contact GitHub.")
        },
        { quoted: msg }
      );
    }
  }
};
