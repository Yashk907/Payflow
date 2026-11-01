export type PaymentStatus =
  | "created"
  | "authorized"
  | "unknown"
  | "failed"
  | "captured"
  | "refunded";

// columns returned to the API
export type Payment = {
  id: string;
  status: string;
  amount: number;
};

// full DB row
export type PaymentRow = {
  id: string;
  order_id: string;
  amount: number;
  status: PaymentStatus;
  bank_ref: string | null;
  failure_reason: string | null;
  version: number;
};

export type PaymentRequest = {
  orderId: string;
  cardToken: number;
  paymentMethod?: string;
};

// httpStatus: 201 = captured, 202 = outcome still unknown
export type CreatePaymentResult = { httpStatus: 201 | 202; payment: Payment };
