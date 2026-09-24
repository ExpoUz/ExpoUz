// Single kill-switch that collapses the app to the core booking loop.
// Default ON. Set NEXT_PUBLIC_SIMPLE_MODE=false to restore the full feature set
// (skill levels, leaderboard, formation, player discovery, wallet, …).
// No code or database tables are deleted — hidden surfaces return when the flag is off.
export const SIMPLE_MODE = process.env.NEXT_PUBLIC_SIMPLE_MODE !== "false";
