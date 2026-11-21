import 'reflect-metadata';
import { loadLocalEnvFile } from '../src/config/load-dotenv';

process.env['LOG_LEVEL'] ??= 'warn';
loadLocalEnvFile();
process.env['NODE_ENV'] = 'test';
