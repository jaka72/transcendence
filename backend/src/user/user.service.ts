/*
	Defining the 'UserService' class and implementing the necessary methods for handling user-related operations.
	The UserService class is defined as an 'injectable provider' ???, using the @Injectable() decorator.
	The class has a constructor that injects the User repository, which is obtained using the
	@InjectRepository(User) decorator.

  The functions that access data are better located in the file user.repository
*/

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateUserDto } from './create-user.dto';
import { MyUser } from './user.entity';
import { UserRepository } from './user.repository';
import { Repository, FindOneOptions } from 'typeorm';

@Injectable()
export class UserService {
  constructor(
      // @InjectRepository(Repository)
      @InjectRepository(MyUser)
      public readonly userRepository: UserRepository,
      // public readonly justRepository: Repository<MyUser>
  ) {
      console.log('[BACKEND LOG] UserService constructor');
  }

  async createUser(createUserDto: CreateUserDto): Promise<MyUser> {
    console.log('[BACKEND LOG] UserService.createUser');
    const user = this.userRepository.create(createUserDto);
    return this.userRepository.save(user);
  }

  async deleteAllUsers(): Promise<void> {
    console.log('[BACKEND LOG] UserService.deleteAllUsers');
    try {
      await this.userRepository.clear();
      console.log('[BACKEND LOG] from nest user.service: All users deleted.');
    } catch (error) {
      console.error('[BACKEND LOG] from nest user.service: Error deleting all users.', error);
      // throw new InternalServerErrorException('Unable to delete all users');
    }
  }

  async getAllUsers(): Promise<MyUser[]> {
    console.log('[BACKEND LOG] UserService.getAllUsers');
    return this.userRepository.find();
    // return this.userRepository.getAllUsers();
  }


  async getUserByLoginName(loginName: string): Promise<MyUser> {
    const options: FindOneOptions<MyUser> = { where: { loginName } };
	  return this.userRepository.findOne( options );
  }

  async getUserByProfileName(profileName: string): Promise<MyUser> {
    const options: FindOneOptions<MyUser> = { where: { profileName } };
	  return this.userRepository.findOne( options );
  }

  async saveUser(user: MyUser): Promise<MyUser> {
    return this.userRepository.save(user);
  }

  async updateProfileImage(loginName: string, profileImage: string) {
    await this.userRepository.update({ loginName} , { profileImage });
  }

  async updateStoredTFACode(loginName: string, tfaCode: string) {
    await this.userRepository.update({ loginName} , { tfaCode });
  }

  async enableTFA(loginName: string, tfaEnabled: boolean) {
    await this.userRepository.update({ loginName} , { tfaEnabled });
  }

  // async findById(id: number): Promise<MyUser | undefined> {
  //   console.log('[BACKEND LOG] UserService.getUserById');
  //   return this.userRepository.findById(id);
  // }



  // async getUserById(id: number): Promise<MyUser> {
  //   return this.userRepository.findOne({ where: { id} });
  // }

  // async updateUser(id: number, updateUserDto: CreateUserDto): Promise<MyUser> {
  //   await this.userRepository.update(id, updateUserDto);
  //   return this.userRepository.findOne({ where: { id } });
  // }

  // async deleteUser(id: number): Promise<void> {
  //   await this.userRepository.delete(id);
  // }
}