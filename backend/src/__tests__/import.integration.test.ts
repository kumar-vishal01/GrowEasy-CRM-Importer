import request from "supertest";

// Force the mock provider for these tests, regardless of local .env,
// so the suite never depends on network access or a real API key.
process.env.LLM_PROVIDER = "mock";

// Imported after the env var is set, since providerFactory caches its
// provider choice on first call.
import { createApp } from "../app";

const app = createApp();

describe("POST /api/import", () => {
  it("imports valid rows and returns structured JSON", async () => {
    const res = await request(app)
      .post("/api/import")
      .send({
        fileName: "test.csv",
        headers: ["Full Name", "Email", "Phone"],
        rows: [
          { "Full Name": "Jane Doe", Email: "jane@x.com", Phone: "9876543210" },
          { "Full Name": "No Contact", Email: "", Phone: "" },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.meta.totalRows).toBe(2);
    expect(res.body.meta.totalImported).toBe(1);
    expect(res.body.meta.totalSkipped).toBe(1);
    expect(res.body.imported).toHaveLength(1);
    expect(res.body.imported[0].email).toBe("jane@x.com");
    expect(res.body.skipped[0].reason).toBe("missing_email_and_mobile");
  });

  it("rejects a request with an empty rows array", async () => {
    const res = await request(app)
      .post("/api/import")
      .send({ fileName: "empty.csv", headers: ["a"], rows: [] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe("invalid_csv");
  });

  it("rejects a request with no rows field at all", async () => {
    const res = await request(app)
      .post("/api/import")
      .send({ fileName: "broken.csv", headers: ["a"] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("rejects malformed row entries that aren't flat objects", async () => {
    const res = await request(app)
      .post("/api/import")
      .send({
        fileName: "broken.csv",
        headers: ["a"],
        rows: [["not", "an", "object"]],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_csv");
  });

  it("rejects a payload exceeding the configured row limit", async () => {
    const manyRows = Array.from({ length: 10 }, (_, i) => ({ email: `${i}@x.com` }));
    const originalMax = process.env.MAX_ROWS;
    process.env.MAX_ROWS = "5";

    const res = await request(app)
      .post("/api/import")
      .send({ fileName: "big.csv", headers: ["email"], rows: manyRows });

    expect(res.status).toBe(413);
    expect(res.body.error).toBe("file_too_large");

    process.env.MAX_ROWS = originalMax;
  });

  it("returns 404 for unknown routes", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/health", () => {
  it("reports ok status and the active provider", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.provider).toBe("mock");
  });
});
