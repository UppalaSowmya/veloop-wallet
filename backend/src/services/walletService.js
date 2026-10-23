
const mongoose = require("mongoose");
const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");

const currencyFields = {
  VES: "ves",
  SVES: "sves",
  GEMS: "gems",
  TOKENS: "tokens",
  SPINS: "spins"
};

const allowedCreditReferences = [
  "REWARD",
  "ADMIN",
  "REFERRAL",
  "REVERSAL",
  "BONUS",
  "DAILY_REWARD",
  "AD_REWARD",
  "GAME_REWARD",
  "EXCHANGE_CREDIT",
  "EXCHANGE",
  "CORRECTION"
];

const allowedDebitReferences = [
  "WITHDRAWAL",
  "ADMIN",
  "ADMIN_DEBIT",
  "EXCHANGE_DEBIT",
  "EXCHANGE"
];

const validateUserId = (userId) => {
  if (!mongoose.isValidObjectId(userId)) {
    throw new Error("Invalid user ID.");
  }
};

const validateAmount = (amount) => {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Amount must be a positive whole number.");
  }
};

const getCurrencyField = (currencyType) => {
  const field = currencyFields[currencyType];

  if (!field) {
    throw new Error("Invalid wallet currency.");
  }

  return field;
};

const validateIdempotencyKey = (key) => {
  if (
    typeof key !== "string" ||
    key.trim().length < 8 ||
    key.trim().length > 128
  ) {
    throw new Error("A valid idempotency key is required.");
  }

  return key.trim();
};

const creditWallet = async ({
  userId,
  currencyType,
  amount,
  referenceType = "REWARD",
  description = "Wallet credit",
  idempotencyKey
}) => {
  validateUserId(userId);
  validateAmount(amount);

  idempotencyKey = validateIdempotencyKey(idempotencyKey);

  const field = getCurrencyField(currencyType);

  if (!allowedCreditReferences.includes(referenceType)) {
    throw new Error("Invalid credit reference type.");
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const existingTransaction = await WalletTransaction.findOne({
        userId,
        idempotencyKey
      }).session(session);

      if (existingTransaction) {
        if (
          existingTransaction.currencyType !== currencyType ||
          existingTransaction.amount !== amount ||
          existingTransaction.referenceType !== referenceType
        ) {
          throw new Error(
            "Idempotency key was already used with different credit details."
          );
        }

        const existingWallet = await Wallet.findById(
          existingTransaction.walletId
        ).session(session);

        result = {
          wallet: existingWallet,
          transaction: existingTransaction,
          duplicate: true
        };

        return;
      }

      const wallet = await Wallet.findOne({ userId }).session(session);

      if (!wallet) {
        throw new Error("Wallet not found.");
      }

      const balanceBefore = wallet[field];
      const balanceAfter = balanceBefore + amount;

      if (!Number.isSafeInteger(balanceAfter)) {
        throw new Error("Wallet balance limit exceeded.");
      }

      const updatedWallet = await Wallet.findOneAndUpdate(
        {
          _id: wallet._id,
          [field]: balanceBefore
        },
        {
          $inc: { [field]: amount }
        },
        {
          new: true,
          session,
          runValidators: true
        }
      );

      if (!updatedWallet) {
        throw new Error("Wallet changed. Please try again.");
      }

      const [transaction] = await WalletTransaction.create(
        [
          {
            userId: wallet.userId,
            walletId: wallet._id,
            currencyType,
            transactionType: "CREDIT",
            amount,
            balanceBefore,
            balanceAfter,
            referenceType,
            description,
            idempotencyKey
          }
        ],
        { session }
      );

      result = {
        wallet: updatedWallet,
        transaction,
        duplicate: false
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
};

const debitWallet = async ({
  userId,
  currencyType = "VES",
  amount,
  referenceType = "WITHDRAWAL",
  description = "Wallet debit",
  referenceId = null
}) => {
  validateUserId(userId);
  validateAmount(amount);

  const field = getCurrencyField(currencyType);

  if (!allowedDebitReferences.includes(referenceType)) {
    throw new Error("Invalid debit reference type.");
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const wallet = await Wallet.findOne({ userId }).session(session);

      if (!wallet) {
        throw new Error("Wallet not found.");
      }

      const balanceBefore = wallet[field];

      if (balanceBefore < amount) {
        throw new Error("Insufficient wallet balance.");
      }

      const balanceAfter = balanceBefore - amount;

      const updatedWallet = await Wallet.findOneAndUpdate(
        {
          _id: wallet._id,
          [field]: { $gte: amount }
        },
        {
          $inc: { [field]: -amount }
        },
        {
          new: true,
          session,
          runValidators: true
        }
      );

      if (!updatedWallet) {
        throw new Error(
          "Insufficient balance or wallet changed. Try again."
        );
      }

      const [transaction] = await WalletTransaction.create(
        [
          {
            userId: wallet.userId,
            walletId: wallet._id,
            currencyType,
            transactionType: "DEBIT",
            amount,
            balanceBefore,
            balanceAfter,
            referenceType,
            referenceId,
            description
          }
        ],
        { session }
      );

      result = {
        wallet: updatedWallet,
        transaction
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  creditWallet,
  debitWallet
};
