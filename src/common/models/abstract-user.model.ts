import { Prop } from '@nestjs/mongoose';
import { AbstractDocument } from '../database/abstract.schema';
import { TimeService } from '../config/time.service';
import { Role } from '../shared';

export abstract class AbstractUser extends AbstractDocument {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true })
  password: string;

  @Prop({
    required: true,
    type: Date,
    default: (timeService: TimeService) => timeService.now(),
  })


  lastActivity: Date;

  @Prop({ default: 'NA' })
  country: string;

  @Prop({ default: 'NA' })
  city: string;

  @Prop({ default: false })
  isVerified: boolean;

  // Method to determine if this is an admin or user
  abstract getUserType(): 'admin' | 'user';
  
  // Method to get the role (will be overridden in child classes)
  abstract getRole(): string;
}
