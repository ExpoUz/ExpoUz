// Single kill-switch that collapses the venue admin panel to the core loop.
// Default ON. Set NEXT_PUBLIC_SIMPLE_MODE=false to restore the full feature set
// (CRM players, insights, broadcasts, revenue analytics, staff/org roles).
// No code or database tables are deleted — hidden surfaces return when the flag is off.
export const SIMPLE_MODE = process.env.NEXT_PUBLIC_SIMPLE_MODE !== "false";
