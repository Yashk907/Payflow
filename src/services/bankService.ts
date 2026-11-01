import type { BankPayment } from "../types/bank.js";


const baseUrl = process.env.BANK_URL ?? "http://localhost:4000";
const timeoutMs = Number(process.env.BANK_TIMEOUT_MS ?? 5000);

export const createPaymentAtBank = async (
  reference: string,
  amount: number | string,
) => {
  try {
    const res = await fetch(`${baseUrl}/bank/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference, amount: Number(amount) }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    // 201 = approved, 402 = declined: both are definite answers from the bank
    if (res.status === 201 || res.status === 402) {
      return (await res.json()) as BankPayment;
    }
    // any other response is unexpected, so the outcome is unknown
    return null;
  } catch {
    // timeout / network failure: outcome unknown, caller should mark payment `unknown`
    return null;
  }
};

export const fetchPaymentStatus = async (reference: string) => {
  try {
    const res = await fetch(`${baseUrl}/bank/payments/${reference}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    // 201 = approved, 402 = declined: both are definite answers from the bank
    if (res.status === 200 || res.status === 402) {
      return (await res.json()) as BankPayment;
    }
    // any other response is unexpected, so the outcome is unknown
    return null;
  } catch {
    return null;
  }
};
