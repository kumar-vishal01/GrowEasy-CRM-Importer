import { validateAndSanitizeRecord } from "../services/validator";
import { CrmRecord } from "../types/schema";

function blankPartial(overrides: Partial<CrmRecord> = {}): Partial<CrmRecord> {
  return {
    created_at: "",
    name: "",
    email: "",
    country_code: "",
    mobile_without_country_code: "",
    company: "",
    city: "",
    state: "",
    country: "",
    lead_owner: "",
    crm_status: "",
    crm_note: "",
    data_source: "",
    possession_time: "",
    description: "",
    ...overrides,
  };
}

describe("validateAndSanitizeRecord", () => {
  it("passes through a valid enum crm_status", () => {
    const { record } = validateAndSanitizeRecord(
      blankPartial({ email: "a@b.com", crm_status: "SALE_DONE" }),
      {}
    );
    expect(record?.crm_status).toBe("SALE_DONE");
  });

  it("coerces an invalid crm_status to blank rather than trusting the LLM", () => {
    const { record } = validateAndSanitizeRecord(
      blankPartial({ email: "a@b.com", crm_status: "MAYBE_INTERESTED" as any }),
      {}
    );
    expect(record?.crm_status).toBe("");
  });

  it("passes through a valid enum data_source", () => {
    const { record } = validateAndSanitizeRecord(
      blankPartial({ email: "a@b.com", data_source: "eden_park" }),
      {}
    );
    expect(record?.data_source).toBe("eden_park");
  });

  it("coerces an invalid data_source to blank", () => {
    const { record } = validateAndSanitizeRecord(
      blankPartial({ email: "a@b.com", data_source: "some_other_project" as any }),
      {}
    );
    expect(record?.data_source).toBe("");
  });

  it("normalizes a valid date string to ISO format", () => {
    const { record } = validateAndSanitizeRecord(
      blankPartial({ email: "a@b.com", created_at: "2024-01-15" }),
      {}
    );
    expect(record?.created_at).toBe(new Date("2024-01-15").toISOString());
  });

  it("falls back to current time for an unparseable date rather than failing the row", () => {
    const before = Date.now();
    const { record } = validateAndSanitizeRecord(
      blankPartial({ email: "a@b.com", created_at: "not a date" }),
      {}
    );
    const parsed = new Date(record!.created_at).getTime();
    expect(parsed).toBeGreaterThanOrEqual(before);
  });

  it("keeps the first email and moves additional emails to crm_note", () => {
    const { record } = validateAndSanitizeRecord(
      blankPartial({ email: "first@x.com, second@x.com" }),
      {}
    );
    expect(record?.email).toBe("first@x.com");
    expect(record?.crm_note).toContain("second@x.com");
  });

  it("keeps the first phone and moves additional phones to crm_note", () => {
    const { record } = validateAndSanitizeRecord(
      blankPartial({
        email: "a@b.com",
        mobile_without_country_code: "9876543210;9123456780",
      }),
      {}
    );
    expect(record?.mobile_without_country_code).toBe("9876543210");
    expect(record?.crm_note).toContain("9123456780");
  });

  it("skips a record with neither email nor mobile, and reports the reason", () => {
    const { record, skipReason } = validateAndSanitizeRecord(blankPartial(), {});
    expect(record).toBeNull();
    expect(skipReason).toBe("missing_email_and_mobile");
  });

  it("does NOT skip a record with only a mobile number and no email", () => {
    const { record } = validateAndSanitizeRecord(
      blankPartial({ mobile_without_country_code: "9876543210" }),
      {}
    );
    expect(record).not.toBeNull();
  });

  it("does NOT skip a record with only an email and no mobile", () => {
    const { record } = validateAndSanitizeRecord(blankPartial({ email: "a@b.com" }), {});
    expect(record).not.toBeNull();
  });

  it("fills all 15 fields even if the LLM omitted some", () => {
    const { record } = validateAndSanitizeRecord({ email: "a@b.com" }, {});
    expect(Object.keys(record!)).toHaveLength(15);
    expect(record?.company).toBe("");
  });

  it("neutralizes a leading '=' in free-text fields to prevent CSV/formula injection", () => {
    const { record } = validateAndSanitizeRecord(
      blankPartial({ email: "a@b.com", name: "=SUM(A1:A10)" }),
      {}
    );
    expect(record?.name.startsWith("'")).toBe(true);
  });

  it("neutralizes a leading '@' in crm_note", () => {
    const { record } = validateAndSanitizeRecord(
      blankPartial({ email: "a@b.com", crm_note: "@cmd|'/c calc'!A1" }),
      {}
    );
    expect(record?.crm_note.startsWith("'")).toBe(true);
  });

  it("does not alter ordinary text that happens to not start with a formula prefix", () => {
    const { record } = validateAndSanitizeRecord(
      blankPartial({ email: "a@b.com", name: "Jane Doe" }),
      {}
    );
    expect(record?.name).toBe("Jane Doe");
  });
});
