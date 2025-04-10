import { Injectable, Logger } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRepo } from './repo/repo.user';
import * as bcrypt from 'bcrypt';
@Injectable()
export class UserService {

  constructor(private readonly userRepo: UserRepo) { }
  private logger = new Logger(UserService.name)

  async create(createUserDto: CreateUserDto) {

    const user = await this.userRepo.findOne({ email: createUserDto.email });
    if (user) {
      return null;
    }

    // hash password -- 10 is a constant
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    createUserDto.password = hashedPassword;

    return this.userRepo.create(createUserDto);

  }


}
