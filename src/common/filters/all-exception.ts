import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        // Generate request ID if not exists
        const requestId = request.headers['x-request-id'] || uuidv4();
        response.setHeader('x-request-id', requestId);

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        let errorResponse: any = {
            statusCode: status,
            message,
            timestamp: new Date().toISOString(),
            path: request.url,
            requestId,
        };

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const res = exception.getResponse();
            if (typeof res === 'string') {
                message = res;
            } else if (typeof res === 'object') {
                errorResponse = {
                    ...errorResponse,
                    ...(res as object),
                };
                message = (res as any).message || message;
            }
        } else if (exception instanceof Error) {
            message = exception.message;
            // Add error name for better error identification
            errorResponse.error = exception.name;
        }

        // Update errorResponse with final status and message
        errorResponse.statusCode = status;
        errorResponse.message = message;

        // Enhanced logging with request details
        this.logger.error(
            `[${requestId}] [${request.method}] ${request.url} - ${status} - ${message}`,
            {
                requestId,
                method: request.method,
                url: request.url,
                status,
                message,
                stack: exception instanceof Error ? exception.stack : undefined,
                headers: request.headers,
                body: request.body,
            }
        );

        response.status(status).json(errorResponse);
    }
}
