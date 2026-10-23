
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");

describe("Transaction History API", () => {
  const token = jwt.sign(
    { userId: "6acf1b5925798539c129b365" },
    process.env.JWT_SECRET
  );

  describe("GET /api/transactions", () => {
    test("should reject requests without an authentication token", async () => {
      const response = await request(app).get("/api/transactions");

      expect(response.statusCode).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test("should reject requests with an invalid authentication token", async () => {
      const response = await request(app)
        .get("/api/transactions")
        .set("Authorization", "Bearer invalid-token");

      expect(response.statusCode).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test("should reject page number less than 1", async () => {
      const response = await request(app)
        .get("/api/transactions?page=0")
        .set("Authorization", `Bearer ${token}`);

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe(
        "Page must be positive and limit must be between 1 and 100."
      );
    });

    test("should reject limit greater than 100", async () => {
      const response = await request(app)
        .get("/api/transactions?limit=101")
        .set("Authorization", `Bearer ${token}`);

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe(
        "Page must be positive and limit must be between 1 and 100."
      );
    });
  });
});
