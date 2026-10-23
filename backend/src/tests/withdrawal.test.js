
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");

describe("Withdrawal API", () => {
  const token = jwt.sign(
    { userId: "6acf1b5925798539c129b365" },
    process.env.JWT_SECRET
  );

  describe("POST /api/withdrawals", () => {
    test("should reject requests without an authentication token", async () => {
      const response = await request(app)
        .post("/api/withdrawals")
        .send({});

      expect(response.statusCode).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test("should reject requests with an invalid authentication token", async () => {
      const response = await request(app)
        .post("/api/withdrawals")
        .set("Authorization", "Bearer invalid-token")
        .send({});

      expect(response.statusCode).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test("should reject an invalid payout option ID", async () => {
      const response = await request(app)
        .post("/api/withdrawals")
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", "withdraw-test-001")
        .send({
          payoutOptionId: "invalid-id",
          payoutDetails: { upiId: "test@upi" }
        });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe(
        "A valid payout option ID is required."
      );
    });

    test("should reject a missing idempotency key", async () => {
      const response = await request(app)
        .post("/api/withdrawals")
        .set("Authorization", `Bearer ${token}`)
        .send({
          payoutOptionId: "6acf2189a40f5f93795064ce",
          payoutDetails: { upiId: "test@upi" }
        });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe(
        "Provide an Idempotency-Key header between 8 and 128 characters."
      );
    });

    test("should reject missing payout details", async () => {
      const response = await request(app)
        .post("/api/withdrawals")
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", "withdraw-test-002")
        .send({
          payoutOptionId: "6acf2189a40f5f93795064ce"
        });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("Payout details are required.");
    });
  });
});
