import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { NotFoundException } from '../../libs/exceptions/not-found-exception.js';
import { NotAuthorizedException } from '../../libs/exceptions/not-authorized-exception.js';
import { ZodError } from 'zod';

type ApiException = {
  statusCode: number;
  clientCode: string;
  message: string;
  timestamp: string;
  path: string;
  payload: any;
};

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: any, host: ArgumentsHost) {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    let responseBody: ApiException = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      clientCode: 'ERROR',
      message: 'An unexpected error occured',
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
      payload: null,
    };

    if (exception instanceof HttpException) {
      responseBody = {
        ...responseBody,
        message: exception.message,
        statusCode: exception.getStatus(),
        clientCode: 'HTTP_EXCEPTION',
      };
    } else if (exception instanceof NotFoundException) {
      responseBody = {
        ...responseBody,
        statusCode: HttpStatus.NOT_FOUND,
        clientCode: 'NOT_FOUND',
        message: exception.message,
        payload: null,
      };
    } else if (exception instanceof NotAuthorizedException) {
      responseBody = {
        ...responseBody,
        statusCode: HttpStatus.FORBIDDEN,
        clientCode: 'NOT_AUTHORIZED',
        message: exception.message,
        payload: null,
      };
    } else if (exception instanceof ZodError) {
      responseBody = {
        ...responseBody,
        statusCode: HttpStatus.BAD_REQUEST,
        clientCode: 'VALIDATION_ERROR',
        message: 'Validation error',
        payload: {
          errors: exception.errors,
        },
      };
    } else if (exception instanceof Error) {
      responseBody = {
        ...responseBody,
        message: exception.message,
      };
    }

    httpAdapter.reply(ctx.getResponse(), responseBody, responseBody.statusCode);
  }
}
