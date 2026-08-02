export const logger = {
  info(message, meta = {}) {
    console.log(
      JSON.stringify({
        level: "INFO",
        timestamp: new Date().toISOString(),
        message,
        ...meta,
      })
    );
  },
  error(message, error, meta = {}) {
    console.error(
      JSON.stringify({
        level: "ERROR",
        timestamp: new Date().toISOString(),
        message,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        ...meta,
      })
    );
  },
  security(message, meta = {}) {
    console.warn(
      JSON.stringify({
        level: "SECURITY",
        timestamp: new Date().toISOString(),
        message,
        ...meta,
      })
    );
  },
};

export default logger;
