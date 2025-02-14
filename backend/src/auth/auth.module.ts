import {Logger, Module} from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
// import { AuthGuard } from './guards/auth.guard';
import { APP_GUARD } from '@nestjs/core';
import { UserService } from 'src/user/user.service';
import { TwoFactorAuthService } from './2fa/2fa.service';
import { UserModule } from 'src/user/user.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'src/user/user.entity';

@Module({
  imports: [
  JwtModule.register({
    global: true,
    secret: process.env.secret // added jaka, to enable extracting the jwt token
  }), 
  UserModule, 
  TypeOrmModule.forFeature([UserEntity])],

  controllers: [AuthController],
  
  providers: [
  AuthService,
  // {
  //   provide: APP_GUARD,
  //   useClass: AuthGuard, 
  // }, 
  UserService, 
  TwoFactorAuthService,
  ],

  exports: [AuthService]  // added jaka, to be able to use it in the Blockship controller
})

export class AuthModule {
  private readonly logger = new Logger(AuthModule.name);
  constructor() {
    this.logger.log('constructor');
  }
}
