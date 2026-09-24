export const PRIORITIES = ["high", "normal", "low"] as const;
export const STATUSES = ["todo", "doing", "done"] as const;
export const SOURCES = ["manual", "voice", "gmail", "chat"] as const;
export const KINDS = ["income", "subscription", "expense"] as const;

export type Priority = (typeof PRIORITIES)[number];
export type Status = (typeof STATUSES)[number];
export type Source = (typeof SOURCES)[number];
export type Kind = (typeof KINDS)[number];

export const CURRENCIES = [
  { code: "EGP", label: "جنيه مصري", short: "ج.م" },
  { code: "SAR", label: "ريال سعودي", short: "ر.س" },
  { code: "AED", label: "درهم", short: "د.إ" },
  { code: "USD", label: "دولار", short: "$" },
] as const;

export const SOURCE_LABEL: Record<Source, string> = {
  manual: "",
  voice: "بالصوت",
  gmail: "من الإيميل",
  chat: "من الشات",
};
