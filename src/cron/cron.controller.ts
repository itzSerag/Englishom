import { Controller, UseGuards } from '@nestjs/common';
import { AdminJwtGuard } from '../admin-auth/guards';

@UseGuards(AdminJwtGuard)
@Controller('cron')
export class CronController {}

