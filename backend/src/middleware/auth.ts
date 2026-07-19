import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getSessionVersion } from "../lib/sessionVersion";

export interface AuthPayload {
  uid: string;
  sv: number;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token =
    (req.signedCookies as Record<string, string | undefined>)["access_token"] ||
    (req.headers["authorization"]?.replace("Bearer ", "") ?? "");

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const secret = process.env.JWT_ACCESS_SECRET ?? "pfd-access-secret";
    const payload = jwt.verify(token, secret) as AuthPayload;
    if (payload.sv !== getSessionVersion()) {
      res.status(401).json({ error: "Session ended: you were signed in elsewhere" });
      return;
    }
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
