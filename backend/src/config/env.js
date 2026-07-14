
export const config = {
  PORT: process.env.PORT || 4000,
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
  DATABASE_URL: process.env.DATABASE_URL || "",
  REDIS_URL: process.env.REDIS_URL || "",
  JWT_SECRET: process.env.JWT_SECRET || "dev-only-secret-change-me",
};
