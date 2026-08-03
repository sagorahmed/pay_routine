import pino from "pino";

// Log keys like "error"/"bridgeError" carry raw Error objects; without an explicit
// serializer, pino/JSON.stringify only sees Error's non-enumerable props and logs "{}".
const errSerializer = pino.stdSerializers.err;

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  serializers: {
    err: errSerializer,
    error: errSerializer,
    bridgeError: errSerializer,
  },
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
          },
        },
});
