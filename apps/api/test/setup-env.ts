import 'reflect-metadata';
import { loadLocalEnvFile } from '../src/config/load-dotenv';

process.env['LOG_LEVEL'] ??= 'warn';
loadLocalEnvFile();
process.env['NODE_ENV'] = 'test';
// Never run tests against the development database.
const testUrl = process.env['TEST_DATABASE_URL'];
if (!testUrl) throw new Error('TEST_DATABASE_URL is not set (see .env.example)');
process.env['DATABASE_URL'] = testUrl;
// Tests opt in to plans explicitly.
process.env['SIGNUP_PLAN_CODE'] = '';
