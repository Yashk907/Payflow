declare global {
  namespace Express {
    interface Request {
      merchant?: { id: string; name: string; email: string };
      apiKey? :string;
    }
  }
}

export {};