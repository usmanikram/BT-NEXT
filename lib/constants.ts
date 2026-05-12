export const APP_NAME = "Pocket";
export const APP_TAGLINE = "Friendly budgeting in your pocket.";
export const CURRENCY_SYMBOL = "Rs ";
export const COOKIE_CURRENT_MONTH = "bt_current_month";

/**
 * Display nouns — kept separate from URL paths so we can rebrand without renaming routes.
 */
export const NOUN = {
  categories: { singular: "pocket", plural: "pockets", title: "Pockets" },
  expenses: { singular: "spend", plural: "spends", title: "Spends" },
} as const;

/** Warm Mochi-friendly category swatches. */
export const CATEGORY_COLORS = [
  "#FF6B5C", // coral
  "#FFD86B", // yellow
  "#7BCFA9", // sage green
  "#8B5CF6", // soft violet
  "#0EA5E9", // sky
  "#EC4899", // pink
  "#F59E0B", // amber
  "#A98AD6", // lilac
  "#5B5FEF", // indigo
  "#10B981", // emerald
  "#FB923C", // orange
  "#1F1A14", // ink
] as const;

export const CHART_COLORS = [
  "#FF6B5C",
  "#FFD86B",
  "#7BCFA9",
  "#8B5CF6",
  "#0EA5E9",
  "#EC4899",
  "#F59E0B",
  "#A98AD6",
  "#5B5FEF",
  "#10B981",
] as const;
