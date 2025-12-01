import { SettingsFormField } from "@devvit/public-api"

export interface Settings {
  "discord-webhook": string;
  "log-bans": boolean;
  "log-ubans": boolean;
  "log-post-removal": boolean;
  "log-comment-removal": boolean;
  "log-removal-reason": boolean;
  "log-mod-notes": boolean;
  "log-approvals": boolean;
  "exclude": string;
}

export const settings: SettingsFormField[] = [
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
    type: "string",
    name: "exclude",
    label: "Usernames to exclude when logging separated by a \",\"",
    scope: "installation",
    defaultValue: ""
  },
  {
    type: "group",
    fields: [
      {
        type: "boolean",
        name: "log-bans",
        label: "Bans?",
        scope: "installation",
        defaultValue: true
      },
      {
        type: "boolean",
        name: "log-unbans",
        label: "Unbans?",
        scope: "installation",
        defaultValue: true
      },
      {
        type: "boolean",
        name: "log-post-removal",
        label: "Post Removals?",
        scope: "installation",
        defaultValue: true
      },
      {
        type: "boolean",
        name: "log-comment-removal",
        label: "Comment Removals?",
        scope: "installation",
        defaultValue: true
      },
      {
        type: "boolean",
        name: "log-mod-notes",
        label: "Mod Notes",
        scope: "installation",
        defaultValue: true
      },
      {
        type: "boolean",
        name: "log-removal-reason",
        label: "Removal Reasons",
        scope: "installation",
        defaultValue: true
      },
      {
        type: "boolean",
        name: "log-approvals",
        label: "Approvals",
        scope: "installation",
        defaultValue: false
      },
    ],
    label: "What to log?"
  },
]
