import { TriggerContext } from "@devvit/public-api";
import { CommentCreate, CommentSubmit, ModAction, PostCreate, PostSubmit } from "@devvit/protos";
import { Settings } from "./settings.js";

const CACHE_DURATION = 60 * 60 * 24 * 30;

interface Field {
  name: string;
  value: string;
  inline?: boolean;
}
interface Embed {
  color: number;
  title: string;
  fields: Field[];
  footer?: { text: string };
}

export async function handleModActions(event: { type: "ModAction" } & ModAction, context: TriggerContext) {
  const settings: Settings = await context.settings.getAll();
  const subreddit = await context.reddit.getCurrentSubreddit();
  const subredditIcon = subreddit.settings.communityIcon?.split("?")[0]
  const slack = settings["discord-webhook"].includes("https://hooks.slack.com/services");

  const ignoreList = (await context.redis.get("excludeList"))?.split(",") || []
  if (ignoreList.includes(event.moderator!.name)) return;

  const embeds: Embed[] = [];
  let payload: any = {
    avatar_url: subredditIcon,
    username: subreddit.name,
    embeds: embeds
  }
  const slackEmbeds: any[] = []
  if (slack) {
    payload = {
      blocks: slackEmbeds
    }
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
      if (slack) {
        slackEmbeds.push(
          {
            "type": "header",
            "text": {
              "type": "plain_text",
              "text": "✏️ Removal Reason Added",
              "emoji": true
            }
          },
          {
            "type": "divider"
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*ID*\n" + reason.target?.id
            }
          },
          {
            "type": "section",
            "fields": [
              {
                "type": "mrkdwn",
                "text": "*Author*\n" + event.targetUser?.name
              },
              {
                "type": "mrkdwn",
                "text": "*Responsible Moderator*\n" + event.moderator?.name
              }
            ]
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Reason*\n" + reason.description
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Subreddit*\n" + `r/${event.subreddit?.name}`
            }
          }
        )
      }
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
            { name: "Note", value: note.details! },
            { name: "Responsible Moderator", value: `u/${event.moderator?.name}` },
            { name: "Subreddit", value: `r/${event.subreddit?.name}` },
          ]
        }
      )
      if (slack) {
        slackEmbeds.push(
          {
            "type": "header",
            "text": {
              "type": "plain_text",
              "text": "✏️ Mod Note Added",
              "emoji": true
            }
          },
          {
            "type": "divider"
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*User*\n" + `u/${event.targetUser?.name}`
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Note*\n" + `${note.details!}`
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Responsible Moderator*\n" + `u/${event.moderator?.name}`
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Subreddit*\n" + `r/${event.subreddit?.name}`
            }
          },
        )
      }
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
      if (slack) {
        slackEmbeds.push(
          {
            "type": "header",
            "text": {
              "type": "plain_text",
              "text": "📋 Post Deleted",
              "emoji": true
            }
          },
          {
            "type": "divider"
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Title*\n" + post.title
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Author*\n" + `u/${post.author}`
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Body*\n" + `${post.body}`
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Responsible Moderator*\n" + `u/${event.moderator?.name}`
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*permalink*\n" + `<https://reddit.com${post.permalink}|link>`
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Subreddit*\n" + `r/${post.subreddit}`
            }
          },
          {
            "type": "context",
            "elements": [
              {
                "type": "plain_text",
                "text": `postID: ${event.targetPost?.id}`,
                "emoji": true
              }
            ]
          }
        )
      }

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
      if (slack) {
        slackEmbeds.push(
          {
            "type": "header",
            "text": {
              "type": "plain_text",
              "text": "💬 Comment Deleted",
              "emoji": true
            }
          },
          {
            "type": "divider"
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Author*\n" + `u/${comment.author}`
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Body*\n" + `${comment.body}`
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Responsible Moderator*\n" + `u/${event.moderator?.name}`
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*permalink*\n" + `<https://reddit.com${comment.permalink}|link>`
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Subreddit*\n" + `r/${comment.subreddit}`
            }
          },
          {
            "type": "context",
            "elements": [
              {
                "type": "plain_text",
                "text": `commentID: ${event.targetComment?.id}`,
                "emoji": true
              }
            ]
          }
        )
      }
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
            { name: "Reason", value: user ? user.description! : "failed to fetch reason", inline: false },
            { name: "Duration", value: user ? user.details! : "failed to fetch duration" },
            { name: "Subreddit", value: `r/${event.subreddit?.name}` },
          ]
        }
      )
      if (slack) {
        slackEmbeds.push(
          {
            "type": "header",
            "text": {
              "type": "plain_text",
              "text": "🔨 Member Banned",
              "emoji": true
            }
          },
          {
            "type": "divider"
          },
          {
            "type": "section",
            "fields": [
              {
                "type": "mrkdwn",
                "text": "*Member*\n" + `u/${event.targetUser?.name}`
              },
              {
                "type": "mrkdwn",
                "text": "*Responsible Moderator*\n" + `u/${event.moderator?.name}`
              }
            ]
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Reason*\n" + (user ? user.description! : "failed to fetch reason")
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Duration*\n" + (user ? user.details! : "failed to fetch duration")
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Subreddit*\n" + `r/${event.subreddit?.name}`
            }
          }
        )
      }
      break;
    case event.action === "unbanuser" && settings["log-unbans"]:
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
      if (slack) {
        slackEmbeds.push(
          {
            "type": "header",
            "text": {
              "type": "plain_text",
              "text": "🩹 Member Unbanned",
              "emoji": true
            }
          },
          {
            "type": "divider"
          },
          {
            "type": "section",
            "fields": [
              {
                "type": "mrkdwn",
                "text": "*Member*\n" + `u/${event.targetUser?.name}`
              },
              {
                "type": "mrkdwn",
                "text": "*Responsible Moderator*\n" + `u/${event.moderator?.name}`
              }
            ]
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Subreddit*\n" + `r/${event.subreddit?.name}`
            }
          }
        )
      }
      break;
    case event.action === "approvelink" && settings["log-approvals"]:
      let approvedPost;
      try {
        approvedPost = JSON.parse((await context.redis.get(event.targetPost!.id))!)
      } catch (error) {
        approvedPost = {
          author: event.targetUser?.name,
          title: event.targetPost?.title,
          body: event.targetPost?.selftext || "Post Body is either empty, or the post only contains attachments",
          permalink: event.targetPost?.permalink,
          subreddit: event.subreddit?.name
        }
      }
      embeds.push(
        {
          color: 0x00CD70,
          title: "✅ Post approved",
          fields: [
            { name: "Title", value: approvedPost.title },
            { name: "Author", value: `u/${approvedPost.author}` },
            { name: "Body", value: approvedPost.body },
            { name: "Responsible Moderator", value: `u/${event.moderator?.name}` },
            { name: "Permalink", value: `[link](https://reddit.com${approvedPost.permalink})` },
            { name: "Subreddit", value: `r/${approvedPost.subreddit}` },
          ]
        }
      )
      if (slack) {
        slackEmbeds.push(
          {
            "type": "header",
            "text": {
              "type": "plain_text",
              "text": "✅ Post approved",
              "emoji": true
            }
          },
          {
            "type": "divider"
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Title*\n" + approvedPost.title
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Author*\n" + `u/${approvedPost.author}`
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Body*\n" + `${approvedPost.body}`
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Responsible Moderator*\n" + `u/${event.moderator?.name}`
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*permalink*\n" + `<https://reddit.com${approvedPost.permalink}|link>`
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Subreddit*\n" + `r/${approvedPost.subreddit}`
            }
          },
          {
            "type": "context",
            "elements": [
              {
                "type": "plain_text",
                "text": `postID: ${event.targetPost?.id}`,
                "emoji": true
              }
            ]
          }
        )
      }
      break;
    case event.action === "approvecomment" && settings["log-approvals"]:
      let approvedComment;
      try {
        approvedComment = JSON.parse((await context.redis.get(event.targetComment!.id))!)
      } catch (error) {
        approvedComment = {
          author: event.targetUser?.name,
          body: event.targetComment?.body,
          permalink: event.targetComment?.permalink,
          subreddit: event.targetComment?.subredditId
        }
      }
      embeds.push(
        {
          color: 0x00CD70,
          title: "✅ Comment approved",
          fields: [
            { name: "Author", value: `u/${approvedComment.author}` },
            { name: "Conent", value: approvedComment.body },
            { name: "Responsible Moderator", value: `u/${event.moderator?.name}` },
            { name: "Permalink", value: `[link](https://reddit.com${approvedComment.permalink})` },
            { name: "Subreddit", value: `r/${approvedComment.subreddit}` },
          ]
        }
      )
      if (slack) {
        slackEmbeds.push(
          {
            "type": "header",
            "text": {
              "type": "plain_text",
              "text": "✅ Comment approved",
              "emoji": true
            }
          },
          {
            "type": "divider"
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Author*\n" + `u/${approvedComment.author}`
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Body*\n" + `${approvedComment.body}`
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Responsible Moderator*\n" + `u/${event.moderator?.name}`
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*permalink*\n" + `<https://reddit.com${approvedComment.permalink}|link>`
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Subreddit*\n" + `r/${approvedComment.subreddit}`
            }
          },
          {
            "type": "context",
            "elements": [
              {
                "type": "plain_text",
                "text": `commentID: ${event.targetComment?.id}`,
                "emoji": true
              }
            ]
          }
        )
      }
      break;
  }
  if (embeds.length > 0 && settings["discord-webhook"]) {
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
