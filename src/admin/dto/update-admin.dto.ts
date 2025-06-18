import { PartialType } from '@nestjs/mapped-types';
import { CreateAdminDto } from './create-admin.dto';
import { IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { AdminRole } from '../../common/shared';

export class UpdateAdminDto extends PartialType(CreateAdminDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(AdminRole)
  adminRole?: AdminRole;
}
