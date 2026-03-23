import { describe, expect, it } from "vitest";
import type { LessonPlanRow } from "#/lib/pdfParser";
import type { LessonPlanDayPayload } from "#/lib/lessonPlans";
import {
  canonicalStringForClass,
  fingerprintForClass,
  isValidClassLabel,
  rowMatchesClass,
} from "./planFingerprint";

const row = (over: Partial<LessonPlanRow>): LessonPlanRow => ({
  period: "",
  class: "",
  originalSubject: "",
  originalTeacher: "",
  teacher: "",
  subject: "",
  room: "",
  type: "",
  note: "",
  ...over,
});

describe("planFingerprint", () => {
  it("rowMatchesClass matches exact tokens in comma-separated class cell", () => {
    expect(rowMatchesClass(row({ class: "10a, 10b" }), "10a")).toBe(true);
    expect(rowMatchesClass(row({ class: "10a, 10b" }), "10b")).toBe(true);
    expect(rowMatchesClass(row({ class: "10a, 10b" }), "9a")).toBe(false);
  });

  it("fingerprint is stable for same data and changes when a row changes", () => {
    const plans: LessonPlanDayPayload[] = [
      {
        date: "2025-01-15T00:00:00.000Z",
        sourceUrl: "u",
        isToday: true,
        rows: [
          row({
            period: "1",
            class: "10a",
            teacher: "x",
            subject: "Mathe",
          }),
        ],
      },
    ];
    const fp1 = fingerprintForClass(plans, "10a");
    const fp2 = fingerprintForClass(plans, "10a");
    expect(fp1).toBe(fp2);
    expect(fp1.length).toBe(64);

    const plans2: LessonPlanDayPayload[] = [
      {
        ...plans[0],
        rows: [
          row({
            period: "1",
            class: "10a",
            teacher: "y",
            subject: "Mathe",
          }),
        ],
      },
    ];
    expect(fingerprintForClass(plans2, "10a")).not.toBe(fp1);
  });

  it("canonicalStringForClass is empty when no rows match", () => {
    const plans: LessonPlanDayPayload[] = [
      {
        date: null,
        sourceUrl: "u",
        isToday: false,
        rows: [row({ class: "10b" })],
      },
    ];
    expect(canonicalStringForClass(plans, "10a")).toBe("");
  });

  it("isValidClassLabel rejects empty and overly long labels", () => {
    expect(isValidClassLabel("10a")).toBe(true);
    expect(isValidClassLabel("10/2")).toBe(true);
    expect(isValidClassLabel("")).toBe(false);
    expect(isValidClassLabel("a".repeat(40))).toBe(false);
    expect(isValidClassLabel("10 a")).toBe(false);
  });
});
