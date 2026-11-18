import { defineApp } from "convex/server";
import { v } from "convex/values";

// FAMBA_SERVER_SECRET is shared only with the Famba Next.js server. Every Famba
// function requires it, so the browser can't read or change payments directly.
const app = defineApp({
  env: {
    FAMBA_SERVER_SECRET: v.optional(v.string()),
  },
});

export default app;
