import { Request, Response, NextFunction } from "express";
import { ZodType } from "zod";

export const validateBody =
  (schema: ZodType) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(result.error);
    }
    next();
  };

export const validateQuery =
  (schema: ZodType) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(result.error);
    }
    next();
  };
