import { Devvit, ModAction } from "@devvit/public-api";
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

const fetchModActionList = async (context: any, cutoffdays: number) => {
    const subreddit = await context.reddit.getCurrentSubredditName();
    const settings: Settings = await context.settings.getAll();
    const cutoffDate = new Date(Date.now() - cutoffdays * 24 * 60 * 60 * 1000);

    // Build fetch promises for enabled log types - RUN IN PARALLEL
    const fetchPromises: Promise<ModAction[]>[] = [];

    if (settings["log-bans"]) {
      fetchPromises.push(
        context.reddit.getModerationLog({ subredditName: subreddit, type: "banuser" }).all()
      );
    }
    if (settings["log-unbans"]) {
      fetchPromises.push(
        context.reddit.getModerationLog({ subredditName: subreddit, type: "unbanuser" }).all()
      );
    }
    if (settings["log-post-removal"]) {
      fetchPromises.push(
        context.reddit.getModerationLog({ subredditName: subreddit, type: "removelink" }).all()
      );
    }
    if (settings["log-removal-reason"]) {
      fetchPromises.push(
        context.reddit.getModerationLog({ subredditName: subreddit, type: "addremovalreason" }).all()
      );
    }
    if (settings["log-comment-removal"]) {
      fetchPromises.push(
        context.reddit.getModerationLog({ subredditName: subreddit, type: "removecomment" }).all()
      );
    }
    if (settings["log-approvals"]) {
      fetchPromises.push(
        context.reddit.getModerationLog({ subredditName: subreddit, type: "approvelink" }).all()
      );
      fetchPromises.push(
        context.reddit.getModerationLog({ subredditName: subreddit, type: "approvecomment" }).all()
      );
    }

    // Execute all fetches in parallel
    const results = await Promise.all(fetchPromises);

    // Combine all results
    const actionList = results.flat() as ModAction[];

    // Pass 1: Build Set of all removal reason targets (order-independent)
    const reasonTargets = new Set<string>();
    for (const action of actionList) {
      if (action.type === "addremovalreason" && action.target?.id) {
        reasonTargets.add(action.target.id);
      }
    }

    // Pass 2: Filter by date and removal reasons, collect final list
    const finalList: ModAction[] = [];
    for (const action of actionList) {
      // Early date filter - skip if outside cutoff
      if (action.createdAt < cutoffDate) continue;

      // Skip removals that have a corresponding reason
      if ((action.type === "removelink" || action.type === "removecomment") &&
          action.target?.id &&
          reasonTargets.has(action.target.id)) {
        continue;
      }

      finalList.push(action);
    }

    // Sort by createdAt descending (newest first)
    return finalList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

function compileCSV(actionList:ModAction[]){
    let csvContent = "id,type,createdAt,body,title,author,moderator\n";
    actionList.forEach(action => {
      csvContent += `${action.id},${action.type},${action.createdAt},\"${action.target?.body}\",\"${action.target?.title}\",${action.target?.author},${action.moderatorName}\n`
    })
    return csvContent;
}

Devvit.addSchedulerJob({
  name: 'AutoExport',
  onRun: async (event, context) => {
    let frequency = await context.settings.get("export-frequency")
    frequency = frequency[0]
    if(frequency == "never") return
    let cutoffdays = 90;
    if(frequency == "weekly") cutoffdays = 7;
    if(frequency == "daily") cutoffdays = 1;
    if(frequency == "weekly") cutoffdays = 30;
    const actionList = await fetchModActionList(context,cutoffdays);
    const csvContent = compileCSV(actionList)
    const data = new FormData()
    const link: string = (await context.settings.get("export-path"))!
    data.append("files[0]",new Blob([csvContent],{type: "text/csv"}),`export_${new Date().toDateString()}.csv`)
    try {
    await fetch(link, {
      method: "POST",
      body: data
    })
    } catch (error) {
      console.log(error)
    }
  }
});

Devvit.addMenuItem({
  label: "Export Action Log",
  description: "Export the last 90 days logs",
  location: "subreddit",
  forUserType: "moderator",
  onPress: async (event, context) => {
    const startAutomaticExports = await context.settings.get("export-frequency")
    const actionList = await fetchModActionList(context,90);
    const csvContent = compileCSV(actionList)
    const data = new FormData()
    const link: string = (await context.settings.get("export-path"))!
    data.append("files[0]",new Blob([csvContent],{type: "text/csv"}),`export_${new Date().toDateString()}.csv`)
    try {
    await fetch(link, {
      method: "POST",
      body: data
    })
    await context.ui.showToast("Exported Successfully")
    } catch (error) {
      console.log(error)
    }
  }
})

Devvit.addMenuItem({
  label: "Toggle Automatic Exports",
  location: "subreddit",
  forUserType: "moderator",
  onPress: async (event, context) => {
    let startAutomaticExports = (await context.settings.get("export-frequency"))!
    startAutomaticExports = startAutomaticExports[0]
    if(startAutomaticExports == "never") return;
    let cronstring = ""
    switch (startAutomaticExports) {
      case "daily":
        cronstring = "0 0 * * *"
        break;
      case "weekly":
        cronstring = "0 0 * * *"
        break;
      case "monthly":
        cronstring = "0 0 1 * *"
        break;
    }
    const currentJobs = await context.scheduler.listJobs()
    for(let job of currentJobs){
      if(job.name == 'AutoExport'){
        await context.scheduler.cancelJob(job.id);
        await context.ui.showToast("Stopped Auto Export")
        return
      }
    }
    await context.scheduler.runJob({
      name: "AutoExport",
      cron: cronstring
    })
    await context.ui.showToast("Started Auto Export")
  }
})

export default Devvit;
