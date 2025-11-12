import { Devvit, EventTypes, type FormField } from "@devvit/public-api";

Devvit.configure({
  redditAPI: true,
  http: true
});

Devvit.addSettings([
  {
    type: "string",
    name: "discord-webhook",
    label: "Discord Webhook",
    scope: "installation",
    placeholder: "https://discord.com/api/webhooks/",
    onValidate: async ({ value }) => {
      if (!value?.includes("https://discord.com/api/webhooks/")) {
        return "Please input a correct Discord Webhook link"
      }
    },
  },
  {
    type: "boolean",
    name: "log-bans",
    label: "Log Bans?",
    scope: "installation",
    defaultValue: true
  },
  {
    type: "boolean",
    name: "log-unbans",
    label: "Log Unbans?",
    scope: "installation",
    defaultValue: true
  },
  {
    type: "boolean",
    name: "log-post-removal",
    label: "Log Post Removals?",
    scope: "installation",
    defaultValue: true
  },
  {
    type: "boolean",
    name: "log-comment-removal",
    label: "Log Comment Removals?",
    scope: "installation",
    defaultValue: true
  },
])

Devvit.addTrigger({
  event: "ModAction",
  onEvent: async (event, context) => {
    const subreddit = await context.reddit.getCurrentSubreddit();
    const subredditIcon = subreddit.settings.communityIcon?.split("?")[0]
    const logBans = await context.settings.get("log-bans")
    const logUnBans = await context.settings.get("log-unbans")
    const logPostRemovals = await context.settings.get("log-post-removal")
    const logCommenRemovals = await context.settings.get("log-comment-removal")
    const webhoookLink: string = (await context.settings.get("discord-webhook"))!
    let payload = null
    if (event.action === "removelink" && logPostRemovals) {
      payload = {
        avatar_url: subredditIcon,
        username: subreddit.name,
        "embeds": [
          {
            color: 16729344,
            title: "📋 Post Deleted",
            fields: [
              { name: "Title", value: event.targetPost?.title },
              { name: "Author", value: `u/${event.targetUser?.name}` },
              { name: "Body", value: event.targetPost?.selftext || "Empty Post" },
              { name: "Responsible Moderator", value: event.moderator?.name },
              { name: "Responsible Moderator", value: `u/${event.moderator?.name}` },
              { name: "Subreddit", value: `r/${event.subreddit?.name}` },
            ]
          }
        ]
      }
    }
    if (event.action === "removecomment" && logCommenRemovals) {
      payload = {
        avatar_url: subredditIcon,
        username: subreddit.name,
        "embeds": [
          {
            color: 16729344,
            title: "💬 Comment Deleted",
            fields: [
              { name: "Author", value: `u/${event.targetUser?.name}` },
              { name: "Conent", value: event.targetComment?.body },
              { name: "Responsible Moderator", value: `u/${event.moderator?.name}` },
              { name: "Subreddit", value: `r/${event.subreddit?.name}` },
            ]
          }
        ]
      }
    }
    if (event.action === "banuser" && logBans) {
      const users = context.reddit.getModerationLog({ subredditName: event.subreddit!.name, type: "banuser", "moderatorUsernames": [event.moderator!.name] })
      const user = (await users.get(1))[0]
      payload = {
        avatar_url: subredditIcon,
        username: subreddit.name,
        "embeds": [
          {
            color: 16729344,
            title: "🔨 Member Banned",
            fields: [
              { name: "Member", value: `u/${event.targetUser?.name}`, inline: true },
              { name: "Responsible Moderator", value: `u/${event.moderator?.name}`, inline: true },
              { name: "Reason", value: user.description, inline: false },
              { name: "Duration", value: user.details },
              { name: "Subreddit", value: `r/${event.subreddit?.name}` },
            ]
          }
        ]
      }
    }
    if (event.action === "unbanuser" && logUnBans) {
      payload = {
        avatar_url: subredditIcon,
        username: subreddit.name,
        "embeds": [
          {
            color: 0x00CD70,
            title: "🩹 Member Unbanned",
            fields: [
              { name: "Member", value: `u/${event.targetUser?.name}`, inline: true },
              { name: "Responsible Moderator", value: `u/${event.moderator?.name}`, inline: true },
              { name: "Subreddit", value: `r/${event.subreddit?.name}` },
            ]
          }
        ]
      }

    }
    if (payload && webhoookLink) {
      try {
        await fetch(webhoookLink, {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        })
      }
      catch (e) {
        console.log(e)
      }
    }
  }
})

export default Devvit;
