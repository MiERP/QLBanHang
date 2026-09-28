import type { NextFunction, Request, Response } from 'express';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message: string) => new ApiError(400, message);

export function handle(fn: (req: Request, res: Response) => unknown) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = fn(req, res);
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        (result as Promise<unknown>).catch(next);
      }
    } catch (err) {
      next(err);
    }
  };
}

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, ...(err.details !== undefined ? { details: err.details } : {}) });
  }
  const message = err instanceof Error ? err.message : 'Lỗi hệ thống không xác định';
  if (/entity too large/i.test(message)) {
    return res.status(413).json({ error: 'Tệp quá lớn — giới hạn 25MB' });
  }
  if (/UNIQUE constraint failed/i.test(message)) {
    return res.status(409).json({ error: 'Dữ liệu đã tồn tại (trùng mã hoặc khóa duy nhất)' });
  }
  if (/FOREIGN KEY constraint failed/i.test(message)) {
    return res.status(409).json({ error: 'Không thể thao tác: dữ liệu đang được tham chiếu ở nơi khác' });
  }
  return res.status(500).json({ error: message });
}
