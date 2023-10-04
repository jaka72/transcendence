import { Injectable, Logger } from '@nestjs/common';
//import { Request, Response } from 'express';
import axios from 'axios';
//import * as bcryptjs from 'bcryptjs';
//import { CreateUserDto } from 'src/user/create-user.dto';
//import { JwtService } from '@nestjs/jwt';
//import { UserService } from 'src/user/user.service';
//import { ConfigService } from '@nestjs/config';
//import { TwoFactorAuthService } from './2fa/2fa.service';

@Injectable()
export class DuplicateService {
	constructor(
//		private readonly userService: UserService,
//		private readonly jwtService: JwtService, 
//		private readonly tfaService: TwoFactorAuthService
		) {}
	logger: Logger = new Logger('Duplicate Services');

	async checkDuplicate(user: string, login: string) {
		// this.logger.log('OAuth code received: ' + requestCode);
//		console.log('Jaka: The whole request URL: ', reqUrl);
//		console.log('Jaka:           requestCode: ', requestCode);
		if (user == login) {
			return false;
		}

		//https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams
		const parameters = new URLSearchParams();
		parameters.append('grant_type', 'client_credentials');
		parameters.append('client_id', process.env.CLIENT_ID);
		parameters.append('client_secret', process.env.SECRET);

		try {
			return await this.duplicateService.exchangeCodeForAccessToken(parameters, user);
		} catch (err) {
			this.logger.log('getAuthToken (Robert): ' + err);
		}
	}
	//    STEP 2 - make POST request to exchange the code for an access token 
	//--------------------------------------------------------------------------------
	// This request needs to be performed on the server side, over a secure connection

	async exchangeCodeForAccessToken(clientData: any, user: string) {
		// console.log('Start Exchange Code for token');
		let access_token: string;
		await axios
			.post('https://api.intra.42.fr/oauth/token', clientData)
			.then((response) => {
				access_token = response.data['access_token'];
				this.logger.log('Access Token received (Robert): ' + access_token); //
				
			})
			.catch((error) => {
				// this.logger.error('\x1b[31mAn Error in 42 API: post request: response: \x1b[0m' + JSON.stringify(response));
				// this.logger.error('\x1b[31mAn Error in 42 API: post request: error.response: \x1b[0m' + JSON.stringify(error.response));
//				this.logger.error('\x1b[31mAn Error in 42 API (Robert): post request: error.response.data: \x1b[0m' + JSON.stringify(error.response.data));
//				throw new HttpException('Authorization failed with 42 API (Robert)', HttpStatus.UNAUTHORIZED);
                              logger.log('Duplicate stuff (Robert): ' + error);
			});
		await this.getDuplicate(access_token, user);
	}

	//    STEP 3 - Make API requests with token 
	//--------------------------------------------------------------------------------
	// GET request to the current token owner with the bearer token - get user info in response

	async getDuplicate(access_token: string, user: string) {
		const authorizationHeader: string = 'Bearer ' + access_token;
		let found: boolean;

		const userInfo = await axios
		.get('https://api.intra.42.fr/v2/users?filter[login]=' + user, {
			headers: {
				Authorization: authorizationHeader
			} // fetch the current token owner 
		})
		.then((response) => {
                        if (response) {
				found = true;
			} else {
				found = false;
			}

		})  // save the token owner info 
		.catch(() => {
		this.logger.error('\x1b[31mAn Error in 42 API (Robert): get duplicate\x1b[0m');
//		throw new HttpException('Authorization failed with 42 API', HttpStatus.UNAUTHORIZED);
		});

	return (found);
}
