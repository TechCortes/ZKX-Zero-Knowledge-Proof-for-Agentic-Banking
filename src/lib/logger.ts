type Level = "info" | "warn" | "error";

function log(level: Level, route: string, event: string, data?: Record<string, unknown>) {
  const entry = { ts: new Date().toISOString(), level, route, event, ...data };
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  info: (route: string, event: string, data?: Record<string, unknown>) =>
    log("info", route, event, data),
  warn: (route: string, event: string, data?: Record<string, unknown>) =>
    log("warn", route, event, data),
  error: (route: string, event: string, data?: Record<string, unknown>) =>
    log("error", route, event, data),
};
