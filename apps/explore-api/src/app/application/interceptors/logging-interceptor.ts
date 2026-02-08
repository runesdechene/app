import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { catchError, Observable, tap, throwError } from 'rxjs';
import { I_LOGGER, ILogger } from '../ports/services/logger.interface.js';
import { FastifyReply } from 'fastify';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(@Inject(I_LOGGER) private readonly logger: ILogger) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const response = httpContext.getResponse<FastifyReply>();
    const newsletterIdHeader = request.headers['x-newsletter-id'];

    this.logger.info(`${request.method.toUpperCase()} - ${request.url}`);

    return next.handle().pipe(
      tap((res) => {
        const data = {
          path: request.url,
          method: request.method,
          status: response.statusCode,
        };

        this.logger.info(` ${request.url} - Response ${response.statusCode}`);
      }),
      catchError((error) => {
        const data = {
          status: response.statusCode,
          time: Math.round(response.elapsedTime),
          error,
        };

        this.logger.error('Error', error);
        return throwError(error);
      }),
    );
  }
}
