import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.NODE_ENV === "development" ? "/" : "/diablo-match/",
});
