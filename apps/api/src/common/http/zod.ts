import { applyDecorators, HttpStatus, type PipeTransform } from '@nestjs/common';
import { ApiBody, ApiResponse } from '@nestjs/swagger';
import { z } from 'zod';
import { AppError } from './app-error';

/** Validates and transforms a request part with a Zod schema (ADR 0003). */
export class ZodPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_FAILED',
      'Request validation failed',
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
}

function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  // `io: 'input'` documents what clients send; transforms are not representable.
  return z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
}

/** OpenAPI request body documentation from a Zod schema. Pair with `@Body(new ZodPipe(schema))`. */
export function ApiZodBody(schema: z.ZodType): MethodDecorator & ClassDecorator {
  return applyDecorators(ApiBody({ schema: jsonSchema(schema) }));
}

/** OpenAPI response documentation from a Zod schema. */
export function ApiZodResponse(
  status: number,
  schema: z.ZodType,
  description?: string,
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiResponse({ status, schema: jsonSchema(schema), ...(description ? { description } : {}) }),
  );
}
