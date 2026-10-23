const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");

jest.mock("../models/User", () => ({
  findById: jest.fn()
}));

jest.mock("../models/Withdrawal", () => ({
  findById: jest.fn()
}));

jest.mock("../models/Wallet", () => ({
  findOne: jest.fn()
}));

jest.mock("../models/WalletTransaction", () => ({
  create: jest.fn()
}));

jest.mock("../models/AuditLog", () => ({
  create: jest.fn()
}));

describe("Admin Withdrawal Status API", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const token = jwt.sign(
    { userId: "6acf1b5925798539c129b365" },
    process.env.JWT_SECRET
  );

  const mockAdmin = () => {
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        role: "ADMIN",
        status: "ACTIVE"
      })
    });
  };

  const mockSession = () => {
    const session = {
      withTransaction: jest.fn(async (callback) => callback()),
      endSession: jest.fn().mockResolvedValue(undefined)
    };

    jest.spyOn(mongoose, "startSession").mockResolvedValue(session);

    return session;
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("PATCH /api/admin/withdrawals/:id/status", () => {
    test("should reject requests without an authentication token", async () => {
      const response = await request(app)
        .patch("/api/admin/withdrawals/invalid-id/status")
        .send({ status: "APPROVED" });

      expect(response.statusCode).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test("should reject requests with an invalid authentication token", async () => {
      const response = await request(app)
        .patch("/api/admin/withdrawals/invalid-id/status")
        .set("Authorization", "Bearer invalid-token")
        .send({ status: "APPROVED" });

      expect(response.statusCode).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test("should reject an invalid withdrawal ID", async () => {
      mockAdmin();
      mockSession();

      const response = await request(app)
        .patch("/api/admin/withdrawals/invalid-id/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "APPROVED" });

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "A valid withdrawal ID is required."
      );
    });

    test("should reject an unsupported status", async () => {
      mockAdmin();
      mockSession();

      const response = await request(app)
        .patch("/api/admin/withdrawals/6acf27cdd093943706650eec/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "INVALID" });

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "Invalid withdrawal status."
      );
    });

    test("should reject REJECTED status without a rejection reason", async () => {
      mockAdmin();
      mockSession();

      const response = await request(app)
        .patch("/api/admin/withdrawals/6acf27cdd093943706650eec/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "REJECTED" });

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "A rejection reason is required."
      );
    });
  });
});