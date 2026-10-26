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

const fetchModActionList = async (context: any, cutoffdays: number) =>{
    const subreddit = await context.reddit.getCurrentSubredditName();
    const settings: Settings = await context.settings.getAll();
    const modlog: any= {
      bans: [],
      unbans: [],
      postRemovals: [],
      modReasons: [],
      commentRemovals: [],
      approvals: []
    }
    if (settings["log-bans"]) {
      modlog.bans = await context.reddit.getModerationLog({ subredditName: subreddit, type: "banuser" }).all()
    }
    if (settings["log-unbans"]) {
      modlog.unbans = await context.reddit.getModerationLog({ subredditName: subreddit, type: "unbanuser" }).all()
    }
    if (settings["log-post-removal"]) {
      modlog.postRemovals = await context.reddit.getModerationLog({ subredditName: subreddit, type: "removelink" }).all()
    }
    if (settings["log-removal-reason"]) {
      modlog.modReasons = await context.reddit.getModerationLog({ subredditName: subreddit, type: "addremovalreason" }).all()
    }
    if (settings["log-comment-removal"]) {
      modlog.commentRemovals = await context.reddit.getModerationLog({ subredditName: subreddit, type: "removecomment" }).all()
    }
    if (settings["log-approvals"]) {
      modlog.approvals = await context.reddit.getModerationLog({ subredditName: subreddit, type: "approvelink" }).all()
      modlog.approvals.push(...await context.reddit.getModerationLog({ subredditName: subreddit, type: "approvecomment" }).all())
    }
    //Combine all properties of the modlog object into one array
    const actionList = Object.values(modlog).flat() as ModAction[]
    //Drop the removal when a removal reason exists for the same target, so only the reason is kept
    const reasonTargets = new Set(
      actionList
        .filter(action => action.type === "addremovalreason" && action.target?.id)
        .map(action => action.target!.id)
    )
    const filteredList = actionList.filter(
      action => (action.type !== "removelink" && action.type !== "removecomment") || !reasonTargets.has(action.target?.id ?? "")
    )
    const cutoffDate = new Date(Date.now() - cutoffdays * 24 * 60 * 60 * 1000)
    const finalList = filteredList.filter(
      action => action.createdAt >= cutoffDate
    )
    return finalList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

function compileCSV(actionList:ModAction[]){
    let csvContent = "id,type,createdAt,body,title,author,moderator\n";
    actionList.forEach(action => {
      csvContent += `${action.id},${action.type},${action.createdAt},${action.target?.body},${action.target?.title},${action.target?.author},${action.moderatorName}\n`
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
