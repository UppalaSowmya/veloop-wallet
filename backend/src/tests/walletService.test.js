
const mongoose = require("mongoose");
const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");
const { creditWallet, debitWallet } = require("../services/walletService");

jest.mock("../models/Wallet", () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  findOneAndUpdate: jest.fn()
}));

jest.mock("../models/WalletTransaction", () => ({
  findOne: jest.fn(),
  create: jest.fn()
}));

describe("Wallet Service", () => {
  const userId = "6acf1b5925798539c129b365";
  const walletId = "6acf1b5925798539c129b366";

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

  const mockQuery = (value) => ({
    session: jest.fn().mockResolvedValue(value)
  });

  describe("creditWallet", () => {
    test("should reject an invalid user ID", async () => {
      await expect(
        creditWallet({
          userId: "invalid-id",
          currencyType: "VES",
          amount: 100,
          idempotencyKey: "credit-test-001"
        })
      ).rejects.toThrow("Invalid user ID.");
    });

    test("should reject an invalid amount", async () => {
      await expect(
        creditWallet({
          userId,
          currencyType: "VES",
          amount: 0,
          idempotencyKey: "credit-test-002"
        })
      ).rejects.toThrow("Amount must be a positive whole number.");
    });

    test("should reject an invalid currency", async () => {
      await expect(
        creditWallet({
          userId,
          currencyType: "INVALID",
          amount: 100,
          idempotencyKey: "credit-test-003"
        })
      ).rejects.toThrow("Invalid wallet currency.");
    });

    test("should reject a missing idempotency key", async () => {
      await expect(
        creditWallet({
          userId,
          currencyType: "VES",
          amount: 100
        })
      ).rejects.toThrow("A valid idempotency key is required.");
    });

    test("should credit a wallet and create a transaction", async () => {
      const wallet = {
        _id: walletId,
        userId,
        ves: 500
      };

      const updatedWallet = {
        ...wallet,
        ves: 600
      };

      WalletTransaction.findOne.mockReturnValue(mockQuery(null));
      Wallet.findOne.mockReturnValue(mockQuery(wallet));
      Wallet.findOneAndUpdate.mockResolvedValue(updatedWallet);

      const transaction = {
        _id: "transaction-001",
        currencyType: "VES",
        transactionType: "CREDIT",
        amount: 100,
        balanceBefore: 500,
        balanceAfter: 600
      };

      WalletTransaction.create.mockResolvedValue([transaction]);

      const result = await creditWallet({
        userId,
        currencyType: "VES",
        amount: 100,
        referenceType: "REWARD",
        idempotencyKey: "credit-test-004"
      });

      expect(result.wallet).toEqual(updatedWallet);
      expect(result.transaction).toEqual(transaction);
      expect(result.duplicate).toBe(false);

      expect(Wallet.findOneAndUpdate).toHaveBeenCalled();
      expect(WalletTransaction.create).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            currencyType: "VES",
            transactionType: "CREDIT",
            amount: 100,
            balanceBefore: 500,
            balanceAfter: 600,
            idempotencyKey: "credit-test-004"
          })
        ],
        { session }
      );
    });

    test("should return the existing transaction for a duplicate request", async () => {
      const existingTransaction = {
        _id: "transaction-002",
        userId,
        walletId,
        currencyType: "VES",
        amount: 100,
        referenceType: "REWARD"
      };

      const wallet = {
        _id: walletId,
        userId,
        ves: 600
      };

      WalletTransaction.findOne.mockReturnValue(
        mockQuery(existingTransaction)
      );
      Wallet.findById.mockReturnValue(mockQuery(wallet));

      const result = await creditWallet({
        userId,
        currencyType: "VES",
        amount: 100,
        referenceType: "REWARD",
        idempotencyKey: "credit-test-005"
      });

      expect(result.duplicate).toBe(true);
      expect(result.transaction).toEqual(existingTransaction);
      expect(result.wallet).toEqual(wallet);
      expect(Wallet.findOneAndUpdate).not.toHaveBeenCalled();
      expect(WalletTransaction.create).not.toHaveBeenCalled();
    });

    test.each([
      ["VES", "ves"],
      ["SVES", "sves"],
      ["GEMS", "gems"],
      ["TOKENS", "tokens"],
      ["SPINS", "spins"]
    ])(
      "should credit %s and record the correct ledger balances",
      async (currencyType, field) => {
        const wallet = {
          _id: walletId,
          userId,
          [field]: 100
        };

        const updatedWallet = {
          ...wallet,
          [field]: 125
        };

        WalletTransaction.findOne.mockReturnValue(mockQuery(null));
        Wallet.findOne.mockReturnValue(mockQuery(wallet));
        Wallet.findOneAndUpdate.mockResolvedValue(updatedWallet);

        const transaction = {
          currencyType,
          transactionType: "CREDIT",
          amount: 25,
          balanceBefore: 100,
          balanceAfter: 125
        };

        WalletTransaction.create.mockResolvedValue([transaction]);

        const result = await creditWallet({
          userId,
          currencyType,
          amount: 25,
          referenceType: "REWARD",
          idempotencyKey: `credit-${currencyType}-test`
        });

        expect(result.wallet).toEqual(updatedWallet);
        expect(result.transaction).toEqual(transaction);

        expect(Wallet.findOneAndUpdate).toHaveBeenCalledWith(
          {
            _id: walletId,
            [field]: 100
          },
          {
            $inc: { [field]: 25 }
          },
          {
            new: true,
            session,
            runValidators: true
          }
        );

        expect(WalletTransaction.create).toHaveBeenCalledWith(
          [
            expect.objectContaining({
              currencyType,
              transactionType: "CREDIT",
              amount: 25,
              balanceBefore: 100,
              balanceAfter: 125
            })
          ],
          { session }
        );
      }
    );
  });

  describe("debitWallet", () => {
    test("should reject an invalid amount", async () => {
      await expect(
        debitWallet({
          userId,
          currencyType: "VES",
          amount: -10
        })
      ).rejects.toThrow("Amount must be a positive whole number.");
    });

    test("should reject an invalid currency", async () => {
      await expect(
        debitWallet({
          userId,
          currencyType: "INVALID",
          amount: 100
        })
      ).rejects.toThrow("Invalid wallet currency.");
    });

    test("should reject a debit when the wallet has insufficient balance", async () => {
      const wallet = {
        _id: walletId,
        userId,
        ves: 50
      };

      Wallet.findOne.mockReturnValue(mockQuery(wallet));

      await expect(
        debitWallet({
          userId,
          currencyType: "VES",
          amount: 100
        })
      ).rejects.toThrow("Insufficient wallet balance.");

      expect(Wallet.findOneAndUpdate).not.toHaveBeenCalled();
      expect(WalletTransaction.create).not.toHaveBeenCalled();
    });

    test("should debit a wallet and create a transaction", async () => {
      const wallet = {
        _id: walletId,
        userId,
        ves: 500
      };

      const updatedWallet = {
        ...wallet,
        ves: 400
      };

      Wallet.findOne.mockReturnValue(mockQuery(wallet));
      Wallet.findOneAndUpdate.mockResolvedValue(updatedWallet);

      const transaction = {
        _id: "transaction-003",
        currencyType: "VES",
        transactionType: "DEBIT",
        amount: 100,
        balanceBefore: 500,
        balanceAfter: 400
      };

      WalletTransaction.create.mockResolvedValue([transaction]);

      const result = await debitWallet({
        userId,
        currencyType: "VES",
        amount: 100,
        referenceType: "WITHDRAWAL"
      });

      expect(result.wallet).toEqual(updatedWallet);
      expect(result.transaction).toEqual(transaction);

      expect(Wallet.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: walletId,
          ves: { $gte: 100 }
        },
        {
          $inc: { ves: -100 }
        },
        {
          new: true,
          session,
          runValidators: true
        }
      );

      expect(WalletTransaction.create).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            currencyType: "VES",
            transactionType: "DEBIT",
            amount: 100,
            balanceBefore: 500,
            balanceAfter: 400
          })
        ],
        { session }
      );
    });

    test.each([
      ["VES", "ves"],
      ["SVES", "sves"],
      ["GEMS", "gems"],
      ["TOKENS", "tokens"],
      ["SPINS", "spins"]
    ])(
      "should debit %s and record the correct ledger balances",
      async (currencyType, field) => {
        const wallet = {
          _id: walletId,
          userId,
          [field]: 100
        };

        const updatedWallet = {
          ...wallet,
          [field]: 75
        };

        Wallet.findOne.mockReturnValue(mockQuery(wallet));
        Wallet.findOneAndUpdate.mockResolvedValue(updatedWallet);

        const transaction = {
          currencyType,
          transactionType: "DEBIT",
          amount: 25,
          balanceBefore: 100,
          balanceAfter: 75
        };

        WalletTransaction.create.mockResolvedValue([transaction]);

        const result = await debitWallet({
          userId,
          currencyType,
          amount: 25,
          referenceType: "WITHDRAWAL"
        });

        expect(result.wallet).toEqual(updatedWallet);
        expect(result.transaction).toEqual(transaction);

        expect(Wallet.findOneAndUpdate).toHaveBeenCalledWith(
          {
            _id: walletId,
            [field]: { $gte: 25 }
          },
          {
            $inc: { [field]: -25 }
          },
          {
            new: true,
            session,
            runValidators: true
          }
        );

        expect(WalletTransaction.create).toHaveBeenCalledWith(
          [
            expect.objectContaining({
              currencyType,
              transactionType: "DEBIT",
              amount: 25,
              balanceBefore: 100,
              balanceAfter: 75
            })
          ],
          { session }
        );
      }
    );

    test.each([
      ["VES", "ves"],
      ["SVES", "sves"],
      ["GEMS", "gems"],
      ["TOKENS", "tokens"],
      ["SPINS", "spins"]
    ])(
      "should reject an insufficient %s balance",
      async (currencyType, field) => {
        const wallet = {
          _id: walletId,
          userId,
          [field]: 10
        };

        Wallet.findOne.mockReturnValue(mockQuery(wallet));

        await expect(
          debitWallet({
            userId,
            currencyType,
            amount: 25,
            referenceType: "WITHDRAWAL"
          })
        ).rejects.toThrow("Insufficient wallet balance.");

        expect(Wallet.findOneAndUpdate).not.toHaveBeenCalled();
        expect(WalletTransaction.create).not.toHaveBeenCalled();
      }
    );
  });
});
