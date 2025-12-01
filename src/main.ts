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

export default Devvit;
