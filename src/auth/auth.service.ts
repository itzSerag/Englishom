import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IPayload } from 'src/common/shared/interfaces/payload.interface';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { UserModel } from 'src/user/models/user.schema';
import { UserRepo } from 'src/user/repo/repo.user';
import { UserService } from 'src/user/user.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt'
import { UserDto } from 'src/common/shared/dto/user-dto';
@Injectable()
export class AuthService {

  constructor(private readonly userRepo: UserRepo,
    private readonly userService: UserService,
    private readonly jwtService: JwtService
  ) { }


  async register(createUserDto: CreateUserDto) {
    return await this.userService.create(createUserDto)
  }


  async login(loginDto: LoginDto) {
    const user = await this.userRepo.findOne({ email: loginDto.email });

    const isValid = user && await bcrypt.compare(loginDto.password, user.password);

    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const access_token = await this.generateToken(user)

    return {
      access_token,
      user: new UserDto(user)
    };
  }





  async generateToken(user: UserModel) {

    const payload: IPayload = { sub: user._id.toString(), email: user.email }

    try {
      return this.jwtService.sign(payload)
    } catch (err) {
      throw new InternalServerErrorException('Something Went Wrong, ' + err)
    }
  }



}
