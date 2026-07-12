import { parseCsv, CsvParseError } from "../services/csvParser";

describe("parseCsv", () => {
  it("parses a simple CSV with headers and rows", () => {
    const csv = "name,email\nJane,jane@x.com\nJohn,john@x.com";
    const result = parseCsv(csv);
    expect(result.headers).toEqual(["name", "email"]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ name: "Jane", email: "jane@x.com" });
  });

  it("handles quoted fields containing commas", () => {
    const csv = `name,address\nJane,"123 Main St, Apt 4"`;
    const result = parseCsv(csv);
    expect(result.rows[0].address).toBe("123 Main St, Apt 4");
  });

  it("handles embedded newlines inside quoted fields (single logical row)", () => {
    const csv = `name,notes\n"Jane Doe","Line one\nLine two"\nJohn,Simple`;
    const result = parseCsv(csv);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].notes).toBe("Line one\nLine two");
  });

  it("handles escaped double quotes inside quoted fields", () => {
    const csv = `name,quote\nJane,"She said ""hello"""`;
    const result = parseCsv(csv);
    expect(result.rows[0].quote).toBe('She said "hello"');
  });

  it("handles CRLF line endings", () => {
    const csv = "name,email\r\nJane,jane@x.com\r\nJohn,john@x.com\r\n";
    const result = parseCsv(csv);
    expect(result.rows).toHaveLength(2);
  });

  it("pads ragged rows with missing trailing columns", () => {
    const csv = "name,email,city\nJane,jane@x.com";
    const result = parseCsv(csv);
    expect(result.rows[0]).toEqual({ name: "Jane", email: "jane@x.com", city: "" });
  });

  it("throws CsvParseError on completely empty input", () => {
    expect(() => parseCsv("")).toThrow(CsvParseError);
    expect(() => parseCsv("   \n  ")).toThrow(CsvParseError);
  });

  it("throws CsvParseError when there are headers but no data rows", () => {
    expect(() => parseCsv("name,email\n")).toThrow(CsvParseError);
  });

  it("handles a single-column CSV", () => {
    const csv = "email\njane@x.com\njohn@x.com";
    const result = parseCsv(csv);
    expect(result.headers).toEqual(["email"]);
    expect(result.rows).toHaveLength(2);
  });

  it("handles a file with no trailing newline after the last row", () => {
    const csv = "name,email\nJane,jane@x.com";
    const result = parseCsv(csv);
    expect(result.rows).toHaveLength(1);
  });
});
