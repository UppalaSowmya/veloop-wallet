
const request = require("supertest");
const app = require("../app");
const PayoutOption = require("../models/PayoutOption");

jest.mock("../models/PayoutOption", () => ({
  find: jest.fn()
}));

describe("Payout Options API", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/payouts/options", () => {
    test("should reject requests without an authentication token", async () => {
      const response = await request(app).get("/api/payouts/options");

      expect(response.statusCode).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test("should reject requests with an invalid authentication token", async () => {
      const response = await request(app)
        .get("/api/payouts/options")
        .set("Authorization", "Bearer invalid-token");

      expect(response.statusCode).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test("should return active payout options without metadata", async () => {
      const mockOptions = [
        {
          _id: "option123",
          method: "UPI",
          name: "UPI ₹10",
          payoutAmount: 10,
          currency: "INR",
          requiredVEs: 2400,
          active: true
        }
      ];

      PayoutOption.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockOptions)
          })
        })
      });

      const token = require("jsonwebtoken").sign(
        { userId: "6acf1b5925798539c129b365" },
        process.env.JWT_SECRET
      );

      const response = await request(app)
        .get("/api/payouts/options")
        .set("Authorization", `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "Payout options fetched successfully"
      );
      expect(response.body.count).toBe(1);
      expect(response.body.options).toHaveLength(1);
      expect(response.body.options[0].method).toBe("UPI");
      expect(response.body.options[0].requiredVEs).toBe(2400);
      expect(response.body.options[0]).not.toHaveProperty("metadata");
    });
  });
});
