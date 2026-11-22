import { type PipeTransform } from '@nestjs/common';
import { z } from 'zod';
import { AppError } from './app-error';

const uuid = z.uuid();

/** Path IDs that are not UUIDs are reported as 404, same as foreign or unknown IDs. */
export class UuidParam implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!uuid.safeParse(value).success) throw AppError.notFound();
    return value;
  }
}
