export type UploadErrorCode =
  | "FILE_REQUIRED"
  | "FILE_TOO_LARGE"
  | "VIDEO_TOO_LONG"
  | "UNSUPPORTED_TYPE"
  | "FORBIDDEN";

interface UploadErrorPayload {
  code: UploadErrorCode;
  message: string;
  details?: Record<string, any>;
}

export function uploadError(
  code: UploadErrorCode,
  message: string,
  details?: Record<string, any>
): UploadErrorPayload {
  return { code, message, details };
}