import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";

describe("API Router Structure", () => {
  it("should have books router with required methods", () => {
    expect(appRouter._def.procedures).toHaveProperty("books.list");
    expect(appRouter._def.procedures).toHaveProperty("books.create");
    expect(appRouter._def.procedures).toHaveProperty("books.getById");
    expect(appRouter._def.procedures).toHaveProperty("books.update");
    expect(appRouter._def.procedures).toHaveProperty("books.delete");
  });

  it("should have readingMoments router with required methods", () => {
    expect(appRouter._def.procedures).toHaveProperty("readingMoments.listByBook");
    expect(appRouter._def.procedures).toHaveProperty("readingMoments.create");
    expect(appRouter._def.procedures).toHaveProperty("readingMoments.getById");
    expect(appRouter._def.procedures).toHaveProperty("readingMoments.update");
    expect(appRouter._def.procedures).toHaveProperty("readingMoments.delete");
  });

  it("should have system router", () => {
    const procedures = Object.keys(appRouter._def.procedures);
    const hasSystemRouter = procedures.some(key => key.startsWith("system."));
    expect(hasSystemRouter).toBe(true);
  });

  it("should have search router with all method", () => {
    expect(appRouter._def.procedures).toHaveProperty("search.all");
  });
});
