import { Devvit } from "@devvit/public-api";

Devvit.configure({
  redditAPI: true,
  redis: true,
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
  {
    type: "boolean",
    name: "log-mod-notes",
    label: "Log Mod Notes",
    scope: "installation",
    defaultValue: true
  },
  {
    type: "boolean",
    name: "log-removal-reason",
    label: "Log Removal Reasons",
    scope: "installation",
    defaultValue: true
  },
])

Devvit.addTrigger({
  event: "ModAction",
  onEvent: async (event, context) => {
    const subreddit = await context.reddit.getCurrentSubreddit();
    const subredditIcon = subreddit.settings.communityIcon?.split("?")[0]
    const logModNotes = await context.settings.get("log-mod-notes")
    const logBans = await context.settings.get("log-bans")
    const logUnBans = await context.settings.get("log-unbans")
    const logPostRemovals = await context.settings.get("log-post-removal")
    const logCommenRemovals = await context.settings.get("log-comment-removal")
    const logRemovalReasons = await context.settings.get("log-removal-reason")
    const webhoookLink: string = (await context.settings.get("discord-webhook"))!
    let payload = null

    if (event.action === "addremovalreason" && logRemovalReasons) {
      const comments = context.reddit.getModerationLog({ subredditName: event.subreddit!.name, type: "addremovalreason", "moderatorUsernames": [event.moderator!.name] })
      const comment = (await comments.get(1))[0]
      payload = {
        avatar_url: subredditIcon,
        username: subreddit.name,
        "embeds": [
          {
            color: 0x009EDD,
            title: "✏️ Removal Reason Added",
            fields: [
              { name: "ID", value: `${comment.target?.id}` },
              { name: "Author", value: `u/${event.targetUser?.name}`, inline: true },
              { name: "Responsible Moderator", value: `u/${event.moderator?.name}`, inline: true },
              { name: "Reason", value: `${comment.description}` },
              { name: "Subreddit", value: `r/${event.subreddit?.name}` },
            ]
          }
        ]
      }
    }

    if (event.action === "addnote" && logModNotes) {
      const notes = context.reddit.getModerationLog({ subredditName: event.subreddit!.name, type: "addnote", "moderatorUsernames": [event.moderator!.name] })
      const note = (await notes.get(1))[0]
      payload = {
        avatar_url: subredditIcon,
        username: subreddit.name,
        "embeds": [
          {
            color: 0x009EDD,
            title: "✏️ Mod Note Added",
            fields: [
              { name: "User", value: `u/${event.targetUser?.name}` },
              { name: "Note", value: note.details },
              { name: "Responsible Moderator", value: `u/${event.moderator?.name}` },
              { name: "Subreddit", value: `r/${event.subreddit?.name}` },
            ]
          }
        ]
      }
    }

    if (event.action === "removelink" && logPostRemovals) {
      let post;
      try {
        post = JSON.parse((await context.redis.get(event.targetPost!.id))!)
      } catch (error) {
        post = {
          author: event.targetUser?.name,
          title: event.targetPost?.title,
          body: event.targetPost?.selftext || "Post Body is either empty, or the post only contains attachments",
          permalink: event.targetPost?.permalink,
          subreddit: event.subreddit?.name
        }
      }
      payload = {
        avatar_url: subredditIcon,
        username: subreddit.name,
        "embeds": [
          {
            color: 16729344,
            title: "📋 Post Deleted",
            fields: [
              { name: "Title", value: post.title },
              { name: "Author", value: `u/${post.author}` },
              { name: "Body", value: post.body },
              { name: "Responsible Moderator", value: `u/${event.moderator?.name}` },
              { name: "Permalink", value: `[link](https://reddit.com${post.permalink})` },
              { name: "Subreddit", value: `r/${post.subreddit}` },
            ],
            footer: { text: `postID: ${event.targetPost?.id}` }
          }
        ]
      }
    }

    if (event.action === "removecomment" && logCommenRemovals) {
      let comment;
      try {
        comment = JSON.parse((await context.redis.get(event.targetComment!.id))!)
      } catch (error) {
        comment = {
          author: event.targetUser?.name,
          body: event.targetComment?.body,
          permalink: event.targetComment?.permalink,
          subreddit: event.targetComment?.subredditId
        }
      }
      payload = {
        avatar_url: subredditIcon,
        username: subreddit.name,
        "embeds": [
          {
            color: 16729344,
            title: "💬 Comment Deleted",
            fields: [
              { name: "Author", value: `u/${comment.author}` },
              { name: "Conent", value: comment.body },
              { name: "Responsible Moderator", value: `u/${event.moderator?.name}` },
              { name: "Permalink", value: `[link](https://reddit.com${comment.permalink})` },
              { name: "Subreddit", value: `r/${comment.subreddit}` },
            ],
            footer: { text: `commentID: ${event.targetComment?.id}` }
          }
        ]
      }
    }

    if (event.action === "banuser" && logBans) {
      let users;
      let user;
      try {
        const subreddit = await context.reddit.getCurrentSubreddit()
        users = subreddit.getModerationLog({ type: "banuser", "moderatorUsernames": [event.moderator!.name] })
        user = (await users.get(1))[0]
      }
      catch {

      }
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
              { name: "Reason", value: user ? user.description : "failed to fetch reason", inline: false },
              { name: "Duration", value: user ? user.details : "failed to fetch duration" },
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


Devvit.addTrigger({
  events: ["PostCreate", "PostSubmit"],
  onEvent: async (event, context) => {
    console.log("caching comment")
    await context.redis.set(event.post!.id, JSON.stringify({
      author: event.author?.name,
      title: event.post?.title,
      body: event.post?.selftext || "Post Body is either empty, or the post only contains attachments",
      permalink: event.post?.permalink,
      subreddit: event.subreddit?.name
    }))
    await context.redis.expire(event.post!.id, 60 * 60 * 24 * 30)
  }
})

Devvit.addTrigger({
  events: ["CommentCreate", "CommentSubmit"],
  onEvent: async (event, context) => {
    await context.redis.set(event.comment!.id, JSON.stringify({
      author: event.author?.name,
      body: event.comment?.body || "Comment either empty or only contains media",
      permalink: event.comment?.permalink,
      subreddit: event.subreddit?.name
    }))
    await context.redis.expire(event.post!.id, 60 * 60 * 24 * 30)
  }
})

export default Devvit;
