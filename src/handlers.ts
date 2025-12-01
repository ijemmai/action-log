import { TriggerContext } from "@devvit/public-api";
import { CommentCreate, CommentSubmit, ModAction, PostCreate, PostSubmit } from "@devvit/protos";
import { Settings } from "./settings.js";

const CACHE_DURATION = 60 * 60 * 24 * 30;

export async function handleModActions(event: { type: "ModAction" } & ModAction, context: TriggerContext) {
  const settings: Settings = await context.settings.getAll();
  const subreddit = await context.reddit.getCurrentSubreddit();
  const subredditIcon = subreddit.settings.communityIcon?.split("?")[0]

  const ignoreList = settings.exclude.toLowerCase().split(",")
  if (ignoreList.includes(event.moderator!.name.toLowerCase())) return;

  const embeds: Object[] = [];
  const payload = {
    avatar_url: subredditIcon,
    username: subreddit.name,
    embeds: embeds
  }
  switch (true) {
    case event.action === "addremovalreason" && settings["log-removal-reason"]:
      const reasons = context.reddit.getModerationLog({ subredditName: event.subreddit!.name, type: "addremovalreason", "moderatorUsernames": [event.moderator!.name] })
      const reason = (await reasons.get(1))[0]
      embeds.push(
        {
          color: 0x009EDD,
          title: "✏️ Removal Reason Added",
          fields: [
            { name: "ID", value: `${reason.target?.id}` },
            { name: "Author", value: `u/${event.targetUser?.name}`, inline: true },
            { name: "Responsible Moderator", value: `u/${event.moderator?.name}`, inline: true },
            { name: "Reason", value: `${reason.description}` },
            { name: "Subreddit", value: `r/${event.subreddit?.name}` },
          ]
        }
      )
      break;
    case event.action === "addnote" && settings["log-mod-notes"]:
      const notes = context.reddit.getModerationLog({ subredditName: event.subreddit!.name, type: "addnote", "moderatorUsernames": [event.moderator!.name] })
      const note = (await notes.get(1))[0]
      embeds.push(
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
      )
      break;
    case event.action === "removelink" && settings["log-post-removal"]:
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
      embeds.push(
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
      )
      break;
    case event.action === "removecomment" && settings["log-comment-removal"]:
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
      embeds.push(
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
      )
      break;
    case event.action === "banuser" && settings["log-bans"]:
      let users;
      let user;
      try {
        const subreddit = await context.reddit.getCurrentSubreddit()
        users = subreddit.getModerationLog({ type: "banuser", "moderatorUsernames": [event.moderator!.name] })
        user = (await users.get(1))[0]
      }
      catch {

      }
      embeds.push(
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
      )
      break;
    case event.action === "unbanuser" && settings["log-ubans"]:
      embeds.push(
        {
          color: 0x00CD70,
          title: "🩹 Member Unbanned",
          fields: [
            { name: "Member", value: `u/${event.targetUser?.name}`, inline: true },
            { name: "Responsible Moderator", value: `u/${event.moderator?.name}`, inline: true },
            { name: "Subreddit", value: `r/${event.subreddit?.name}` },
          ]
        }
      )
      break;
  }
  if (embeds && settings["discord-webhook"]) {
    try {
      await fetch(settings["discord-webhook"], {
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


export async function cachePosts(event: PostCreate | PostSubmit, context: TriggerContext) {
  await context.redis.set(event.post!.id, JSON.stringify({
    author: event.author?.name,
    title: event.post?.title,
    body: event.post?.selftext || "Post Body is either empty, or the post only contains attachments",
    permalink: event.post?.permalink,
    subreddit: event.subreddit?.name
  }))
  await context.redis.expire(event.post!.id, CACHE_DURATION)
}

export async function cacheComments(event: CommentCreate | CommentSubmit, context: TriggerContext) {
  await context.redis.set(event.comment!.id, JSON.stringify({
    author: event.author?.name,
    body: event.comment?.body || "Comment either empty or only contains media",
    permalink: event.comment?.permalink,
    subreddit: event.subreddit?.name
  }))
  await context.redis.expire(event.post!.id, CACHE_DURATION)
}
