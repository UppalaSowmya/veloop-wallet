
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const User = require("../models/User");
const walletService = require("../services/walletService");

jest.mock("../models/User", () => ({
  findById: jest.fn()
}));

jest.mock("../services/walletService", () => ({
  creditWallet: jest.fn()
}));

describe("Admin Wallet Credit API", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const token = () =>
    jwt.sign(
      { userId: "6acf1b5925798539c129b365" },
      process.env.JWT_SECRET
    );

  const adminUser = () => {
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        role: "ADMIN",
        status: "ACTIVE"
      })
    });
  };

  describe("POST /api/wallet/credits", () => {
    test("should reject requests without an authentication token", async () => {
      const response = await request(app)
        .post("/api/wallet/credits")
        .send({});

      expect(response.statusCode).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test("should reject requests with an invalid authentication token", async () => {
      const response = await request(app)
        .post("/api/wallet/credits")
        .set("Authorization", "Bearer invalid-token")
        .send({});

      expect(response.statusCode).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test("should reject a user who is not an admin", async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          role: "USER",
          status: "ACTIVE"
        })
      });

      const response = await request(app)
        .post("/api/wallet/credits")
        .set("Authorization", `Bearer ${token()}`)
        .send({});

      expect(response.statusCode).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Admin access required.");
    });

    test("should reject an invalid user ID", async () => {
      adminUser();
      walletService.creditWallet.mockRejectedValue(
        new Error("Invalid user ID.")
      );

      const response = await request(app)
        .post("/api/wallet/credits")
        .set("Authorization", `Bearer ${token()}`)
        .send({
          userId: "invalid-id",
          currencyType: "VES",
          amount: 100,
          idempotencyKey: "credit-test-001"
        });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("Invalid user ID.");
    });

    test("should reject a non-positive whole-number amount", async () => {
      adminUser();
      walletService.creditWallet.mockRejectedValue(
        new Error("Amount must be a positive whole number.")
      );

      const response = await request(app)
        .post("/api/wallet/credits")
        .set("Authorization", `Bearer ${token()}`)
        .send({
          userId: "6acf1b5925798539c129b365",
          currencyType: "VES",
          amount: 0,
          idempotencyKey: "credit-test-002"
        });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe(
        "Amount must be a positive whole number."
      );
    });

    test("should reject an invalid wallet currency", async () => {
      adminUser();
      walletService.creditWallet.mockRejectedValue(
        new Error("Invalid wallet currency.")
      );

      const response = await request(app)
        .post("/api/wallet/credits")
        .set("Authorization", `Bearer ${token()}`)
        .send({
          userId: "6acf1b5925798539c129b365",
          currencyType: "INVALID",
          amount: 100,
          idempotencyKey: "credit-test-003"
        });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("Invalid wallet currency.");
    });

    test("should reject a missing idempotency key", async () => {
      adminUser();
      walletService.creditWallet.mockRejectedValue(
        new Error("A valid idempotency key is required.")
      );

      const response = await request(app)
        .post("/api/wallet/credits")
        .set("Authorization", `Bearer ${token()}`)
        .send({
          userId: "6acf1b5925798539c129b365",
          currencyType: "VES",
          amount: 100
        });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe(
        "A valid idempotency key is required."
      );
    });
  });
});
