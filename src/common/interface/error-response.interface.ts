export interface ErrorResponse {
    success: false;
    statusCode: number;
    message: string;
    errorCode: string;
    details?: unknown;
    path: string;
    timestamp: string;
    requestId?: string;
}