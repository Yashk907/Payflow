export type BankPayment = {
  ref: string;
  amount: number;
  status: "approved" | "declined";
  reason?: string;
};
