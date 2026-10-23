const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const app = require("../app");

const User = require("../models/User");
const Wallet = require("../models/Wallet");
const PayoutOption = require("../models/PayoutOption");
const Withdrawal = require("../models/Withdrawal");
const WalletTransaction = require("../models/WalletTransaction");
const AuditLog = require("../models/AuditLog");

jest.mock("../models/User", () => ({
  findById: jest.fn()
}));

jest.mock("../models/Wallet", () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn()
}));

jest.mock("../models/PayoutOption", () => ({
  findOne: jest.fn()
}));

jest.mock("../models/Withdrawal", () => ({
  findOne: jest.fn(),
  create: jest.fn()
}));

jest.mock("../models/WalletTransaction", () => ({
  create: jest.fn()
}));

jest.mock("../models/AuditLog", () => ({
  create: jest.fn()
}));

describe("Withdrawal API", () => {
  const userId = "6acf1b5925798539c129b365";

  const token = jwt.sign(
    { userId },
    process.env.JWT_SECRET
  );

  let session;

  beforeEach(() => {
    session = {
      withTransaction: jest.fn(async (callback) => callback()),
      endSession: jest.fn().mockResolvedValue(undefined)
    };

    jest.spyOn(mongoose, "startSession").mockResolvedValue(session);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });


const mockQuery = (value) => {
  const query = {
    select: jest.fn(() => query),
    session: jest.fn().mockResolvedValue(value),
  };

  return query;
};


  const mockNoDuplicateWithdrawal = () => {
    Withdrawal.findOne.mockReturnValue(mockQuery(null));
  };

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
      expect(mongoose.startSession).not.toHaveBeenCalled();
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
      expect(response.body.message).toBe(
        "Payout details are required."
      );
    });

    test("should reject an inactive or missing payout option", async () => {
      mockNoDuplicateWithdrawal();

      PayoutOption.findOne.mockReturnValue(mockQuery(null));

      const response = await request(app)
        .post("/api/withdrawals")
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", "withdraw-test-003")
        .send({
          payoutOptionId: "6acf2189a40f5f93795064ce",
          payoutDetails: { upiId: "test@upi" }
        });

      expect(response.statusCode).toBe(404);
      expect(response.body.message).toBe(
        "Payout option not found or inactive."
      );
    });

    test("should reject invalid UPI details", async () => {
      mockNoDuplicateWithdrawal();

      PayoutOption.findOne.mockReturnValue(
        mockQuery({
          _id: "6acf2189a40f5f93795064ce",
          method: "UPI",
          payoutAmount: 10,
          currency: "INR",
          requiredVEs: 2400,
          name: "UPI ₹10"
        })
      );

      const response = await request(app)
        .post("/api/withdrawals")
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", "withdraw-test-004")
        .send({
          payoutOptionId: "6acf2189a40f5f93795064ce",
          payoutDetails: { upiId: "invalid-upi" }
        });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe(
        "Payout details are invalid for this method."
      );
    });

    test("should reject a withdrawal when the wallet has insufficient VEs", async () => {
      mockNoDuplicateWithdrawal();

      PayoutOption.findOne.mockReturnValue(
        mockQuery({
          _id: "6acf2189a40f5f93795064ce",
          method: "UPI",
          payoutAmount: 10,
          currency: "INR",
          requiredVEs: 2400,
          name: "UPI ₹10"
        })
      );

      Wallet.findOne.mockReturnValue(
        mockQuery({
          _id: "6acf1b5925798539c129b366",
          userId,
          ves: 100
        })
      );

      const response = await request(app)
        .post("/api/withdrawals")
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", "withdraw-test-005")
        .send({
          payoutOptionId: "6acf2189a40f5f93795064ce",
          payoutDetails: { upiId: "test@upi" }
        });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe(
        "Insufficient VEs for this withdrawal."
      );
      expect(Wallet.findOneAndUpdate).not.toHaveBeenCalled();
      expect(Withdrawal.create).not.toHaveBeenCalled();
    });
  });
});