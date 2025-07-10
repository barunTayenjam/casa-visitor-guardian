import { FileArray } from 'express-fileupload';

declare global {
  namespace Express {
    interface Request {
      files?: FileArray | null;
    }
  }
}