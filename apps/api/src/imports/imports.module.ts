import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '../queues/queues';
import { TenantsModule } from '../tenants/tenants.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [TenantsModule, BullModule.registerQueue({ name: QUEUES.crmSync })],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
