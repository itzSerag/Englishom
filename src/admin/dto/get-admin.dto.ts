import { IsMongoId } from 'class-validator';

export class GetAdminDto {
  @IsMongoId({ message: 'No user found with this ID or Invalid ID ' })
  id: string;
}
