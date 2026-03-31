import { Devvit } from "@devvit/public-api";
import { Settings, settings } from "./settings.js";
import { cacheComments, cachePosts, handleModActions } from "./handlers.js";

Devvit.configure({
  redditAPI: true,
  redis: true,
  http: true
});

Devvit.addSettings(settings)

Devvit.addTrigger({
  event: "ModAction",
  onEvent: async (event, context) => handleModActions(event, context)
})


Devvit.addTrigger({
  events: ["PostCreate", "PostSubmit"],
  onEvent: async (event, context) => cachePosts(event, context)
})

Devvit.addTrigger({
  events: ["CommentCreate", "CommentSubmit"],
  onEvent: async (event, context) => cacheComments(event, context)
})

const form = Devvit.createForm((data) => {
  return ({
    fields: [
      {
        type: 'select',
        name: 'mods',
        label: 'Moderators',
        multiSelect: true,
        defaultValue: data.baseValue,
        options: data.moderators || []
      },
    ],
    title: "Moderators Exclude List"
  })
},
  async (event, context) => {
    try {
      const values = event.values.mods
      if (values) {
        await context.redis.set("excludeList", event.values.mods.join(","))
      }
      else {
        await context.redis.set("excludeList", "")
      }
      context.ui.showToast("Updated the exclude list successfully")
      console.log(await context.redis.get("excludeList"))
    }
    catch (e) {
      console.log(e)
      context.ui.showToast("Something went wrong when updating the exclude list")
    }
  }
)


Devvit.addMenuItem({
  label: "Action Log Exclude List",
  location: "subreddit",
  forUserType: "moderator",
  onPress: async (event, context) => {
    const subreddit = await context.reddit.getCurrentSubredditName();
    const mods = await (context.reddit.getModerators({ subredditName: subreddit })).all()
    let baseValue = (await context.redis.get("excludeList"))?.split(",") || []
    const data = {
      moderators: mods.map(mod => mod.username).concat(["reddit", "[ Redacted ]", "AutoModerator"]).map(mod => ({ label: mod, value: mod })),
      baseValue: baseValue
    };
    context.ui.showForm(form, data)
  }
})

export default Devvit;
