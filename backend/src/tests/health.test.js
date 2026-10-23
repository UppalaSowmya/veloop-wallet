const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");

describe("VELoop Wallet API health check", () => {
  test("should return 503 when database is disconnected", async () => {
    const originalReadyState = mongoose.connection.readyState;

    try {
      Object.defineProperty(mongoose.connection, "readyState", {
        configurable: true,
        value: 0
      });

      const response = await request(app).get("/api/health");

      expect(response.statusCode).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.database).toBe("disconnected");
    } finally {
      Object.defineProperty(mongoose.connection, "readyState", {
        configurable: true,
        value: originalReadyState
      });
    }
  });

  test("should return a successful root API response", async () => {
    const response = await request(app).get("/");

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("VELoop Wallet API is running");
  });
});