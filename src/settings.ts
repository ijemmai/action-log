import { Devvit, SettingsFormField } from "@devvit/public-api"

export interface Settings {
  "discord-webhook": string;
  "log-bans": boolean;
  "log-unbans": boolean;
  "log-post-removal": boolean;
  "log-comment-removal": boolean;
  "log-removal-reason": boolean;
  "log-mod-notes": boolean;
  "log-approvals": boolean;
  "exclude": string;
  "webhook-bans": string;
  "webhook-unbans": string;
  "webhook-post-removal": string;
  "webhook-comment-removal": string;
  "webhook-removal-reason": string;
  "webhook-mod-notes": string;
  "webhook-approvals": string;
}

export const settings: SettingsFormField[] = [
  {
    type: "string",
    name: "discord-webhook",
    label: "Webhook URL",
    scope: "installation",
    placeholder: "https://discord.com/api/webhooks/",
    onValidate: async ({ value }) => {
      if (!(value?.includes("https://discord.com/api/webhooks/") || value?.includes("https://hooks.slack.com/services"))) {
        return "Please input a correct Discord or Slack Webhook link"
      }
    },
  },
  {
    type: "paragraph",
    disabled: true,
    name: "exclude",
    label: "Username exclusions no longer supported through here, instead find the select menu on the subreddit page under 'Action Log exclude list'",
    scope: "installation",
    defaultValue: "No longer supported through here, instead find the select menu on the subreddit page under 'Action Log exclude list'",
    placeholder: "No longer supported through here, instead find the select menu on the subreddit page under 'Action Log exclude list'",
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
  {
    type: "group",
    fields: [
      {
        type: "string",
        name: "webhook-bans",
        label: "Bans?",
        scope: "installation",
      },
      {
        type: "string",
        name: "webhook-unbans",
        label: "Unbans?",
        scope: "installation",
      },
      {
        type: "string",
        name: "webhook-post-removal",
        label: "Post Removals?",
        scope: "installation",
      },
      {
        type: "string",
        name: "webhook-comment-removal",
        label: "Comment Removals?",
        scope: "installation",
      },
      {
        type: "string",
        name: "webhook-mod-notes",
        label: "Mod Notes",
        scope: "installation",
      },
      {
        type: "string",
        name: "webhook-removal-reason",
        label: "Removal Reasons",
        scope: "installation",
      },
      {
        type: "string",
        name: "webhook-approvals",
        label: "Approvals",
        scope: "installation",
      },
    ],
    label: "Optional: Fine grained webhook links",
    helpText: "Will be used if given, otherwise will default to the general webhook link"
  },
  {
    type: "group",
    label: "Backup and Exports (currently only available to discord)",
    helpText: "to start automatic exports, please press the button on the subreddit page",
    fields: [
      {
        type: "string",
        name: "export-path",
        label: "Export Webhook",
        scope: "installation",
        placeholder: "https://discord.com/api/webhooks/...",
        onValidate: async ({ value }) => {
          if (!(value?.includes("https://discord.com/api/webhooks/") || value?.includes("https://hooks.slack.com/services"))) {
            return "Please input a correct Discord or Slack Webhook link"
          }
        },
      },
      {
        type: "select",
        name: "export-frequency",
        label: "Export Frequency",
        scope: "installation",
        options: [
          {
            label: "Daily",
            value: "daily",
          },
          {
            label: "Weekly",
            value: "weekly",
          },
          {
            label: "Monthly",
            value: "monthly",
          },
          {
            label: "Never (Only Manual)",
            value: "never",
          },
        ],
      },
    ],
  }
]
