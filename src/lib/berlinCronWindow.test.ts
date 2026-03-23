import { describe, expect, it } from "vitest";
import { isWithinBerlinPlanWatchWindow } from "./berlinCronWindow";

describe("isWithinBerlinPlanWatchWindow", () => {
  it("is true at 06:00 Europe/Berlin in winter (CET)", () => {
    expect(isWithinBerlinPlanWatchWindow(new Date("2025-01-15T05:00:00.000Z"))).toBe(
      true,
    );
  });

  it("is true at 06:00 Europe/Berlin in summer (CEST)", () => {
    expect(isWithinBerlinPlanWatchWindow(new Date("2025-07-15T04:00:00.000Z"))).toBe(
      true,
    );
  });

  it("is false before 06:00 Berlin", () => {
    expect(isWithinBerlinPlanWatchWindow(new Date("2025-01-15T04:59:00.000Z"))).toBe(
      false,
    );
  });

  it("is false from 15:00 Berlin onward", () => {
    expect(isWithinBerlinPlanWatchWindow(new Date("2025-01-15T14:00:00.000Z"))).toBe(
      false,
    );
  });

  it("is true at 14:59 Berlin on a winter day", () => {
    expect(isWithinBerlinPlanWatchWindow(new Date("2025-01-15T13:59:00.000Z"))).toBe(
      true,
    );
  });
});
