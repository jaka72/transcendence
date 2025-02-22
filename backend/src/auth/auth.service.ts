import { Injectable, Logger, HttpException, HttpStatus, UnauthorizedException} from '@nestjs/common';
import { Request, Response } from 'express';
import axios from 'axios';
import * as bcryptjs from 'bcryptjs';
import { CreateUserDto } from 'src/user/create-user.dto';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/user/user.service';
import { TwoFactorAuthService } from './2fa/2fa.service';

interface JwtPayload {
	sub: number;
	username: string;
	exp: number;
	iat: number;
  }  

@Injectable()
export class AuthService {
	constructor(
		private readonly userService: UserService,
		public readonly jwtService: JwtService,
		private readonly tfaService: TwoFactorAuthService
		) {}
	logger: Logger = new Logger('Auth Services');

	//    STEP 3 - make POST request to exchange the code for an access token 
	//--------------------------------------------------------------------------------
	// This request needs to be performed on the server side, over a secure connection

	async exchangeCodeForAccessToken(clientData: any, res: Response) {
		let access_token: string;
		this.logger.log('exchangeCodeForAccessToken');
		await axios
			.post('https://api.intra.42.fr/oauth/token', clientData)
			.then((response) => {
				access_token = response.data['access_token'];
				this.logger.log('Access Token received: ' + access_token);
			})
			.catch((error) => {
				this.logger.error('\x1b[31mAn Error in 42 API: post request: error.response.data: \x1b[0m' + JSON.stringify(error.response.data));
				throw new HttpException('Authorization failed with 42 API', HttpStatus.UNAUTHORIZED);
			});
		await this.getTokenOwnerData(access_token, process.env.JWT_SECRET, res);
	}

	//    STEP 4 - Make API requests with token 
	//--------------------------------------------------------------------------------
	// GET request to the current token owner with the bearer token - get user info in response

	async getTokenOwnerData(access_token: string, secret: string, res: Response) {
		const authorizationHeader: string = 'Bearer ' + access_token;
		let login: string;
		let id: string;
		let avatar: string;
		let email: string;

		const userInfo = await axios
		.get('https://api.intra.42.fr/v2/me', {
			headers: {
				Authorization: authorizationHeader
			} // fetch the current token owner 
		})
		.then((response) => {
			login = response['data'].login;
			id = response['data'].id;
			avatar = response['data'].image.link;
			email = response['data'].email;
			this.logger.log('Token owner data received: login:' + login + ' id: ' + response['data'].id);
			this.logger.log('Token owner data received: image: ' + avatar);
			this.logger.log('E-mail: ' + email);

		})  // save the token owner info 
		.catch(() => {
			this.logger.error('\x1b[31mAn Error in 42 API: get token owner data\x1b[0m');
			throw new HttpException('Authorization failed with 42 API', HttpStatus.UNAUTHORIZED);
		});

		const hash = await this.hashSecret(secret, id);  // CORINA - TO DO - is this actually necesary? 

		const dto: CreateUserDto = {
			loginName: login,
			profileName: login,
			intraId: +id,
			email: email,
			onlineStatus: false,		// at logout change to 'false'
			hashedSecret: hash,         // might not be necessary and might need to be removed 
			refreshToken: 'default',
			tfaEnabled: true,
			tfaCode: 'default',
			tfaVerified: false,
			profileImage: avatar,
		};

		this.logger.log('dto:  intraLogin: ' + dto.loginName + ' intraId: ' + dto.intraId + ' refreshToken: '+ dto.refreshToken); // testing purpose - TO BE REMOVED!
		return await this.getOrCreateUser(dto, res);
	}

	// generate hash 
	//Hashing alone is not sufficient to mitigate more involved attacks such as rainbow tables. 
	//A better way to store passwords is to add a salt to the hashing process: adding additional random data 
	//to the input of a hashing function that makes each password hash unique. 
	//The ideal authentication platform would integrate these two processes, hashing and salting, seamlessly.
	//At Auth0, the integrity and security of our data are one of our highest priorities. 
	//We use the industry-grade and battle-tested bcrypt algorithm to securely hash and salt passwords. 

	async hashSecret(secret: string, id: string) {
		const saltOrRounds = 10; 
		this.logger.log('Salt : ' + saltOrRounds + ' Secret: ' +  secret); // testing purpose - TO BE REMOVED!
		try {
			return await bcryptjs.hash(secret, saltOrRounds);
		}
		catch (err) {
			this.logger.error('\x1b[31mHash secret error: \x1b[0m' + err);
		}
	}

	async getOrCreateUser(data: CreateUserDto, response: Response) {
    	let token: string; 
		let player = await this.userService.getUserByLoginName(data.loginName);

		if (!player) {
			try {
				player = await this.userService.createUser(data);
				this.logger.log('made new player: ' + player.loginName);

				// ADDED JAKA: 							//	SAVE ORIG USER IMAGE TO THE ./uploads/ FOLDER
				const imageUrl = data.profileImage;		// 	AND STORE THE PATH TO THE DATABASE

				// todo: replace ./uploads/ with .env var everywhere
            	const imagePath = `./${process.env.UPLOADS}/${player.loginName}.jpg`;

				try {
					await this.userService.downloadAndSaveImage(imageUrl, imagePath);
					await this.userService.updateProfileImage(player.loginName,	process.env.UPLOADS + "/" + player.loginName + ".jpg");

					this.logger.log("Create new player: User image saved.");
				} catch(err) {
					this.logger.error('Error updating profile image for player: ' + err);					
				}
			}
			catch (err) {
				this.logger.error('\x1b[31mError creating new player: \x1b[0m' + err);
				return ;
			}
		}
		
		this.logger.log('getOrCreateUser: Current User:');
		this.logger.log('                          player.intraLogin:' + player.loginName);
		this.logger.log('                          player.profileName:' + player.profileName);
		this.logger.log('                          player.profileName:' + player.profileImage);
		this.logger.log('                          player.intrId:' + player.intraId);
		this.logger.log('                          player.email:' + player.email);
		this.logger.log('                          player.2fa:' + player.tfaEnabled);
		this.logger.log('                          player.tfaCode:' + player.tfaCode);
		this.logger.log('                          player.tfaCode:' + player.tfaCode);
		this.logger.log('                          player.tfaVerified:' + player.tfaVerified);
		this.logger.log('                          player.refreshToken:' + player.refreshToken);


		token = await this.signToken(player);
		if (!token) {
			throw new HttpException('Signing token failed.', HttpStatus.SERVICE_UNAVAILABLE);
		}
		let refreshToken = await this.signRefreshToken(player);
		if (!refreshToken) {
			throw new HttpException('Signing refresh token failed.', HttpStatus.SERVICE_UNAVAILABLE);
		}
		this.userService.updateRefreshToken(player.loginName, refreshToken);

		this.logger.log('Set-Cookie token: ' + token);
		const cookieAttributes = {
			httpOnly: true,
			//	secure: true,
			path: '/',
			//	sameSite: 'none',
		};

		// Variant B)
		// added jaka: appending the Attributes to the cookie
		let cookieToken = `token=${token};`;
		for (let attribute in cookieAttributes) {
			if (cookieAttributes[attribute] === true) {
				cookieToken += ` ${attribute};`;
			} else
				cookieToken += ` ${attribute}=${cookieAttributes[attribute]};`;
		}
		response.append('Set-Cookie', cookieToken);
		this.logger.log('print token inside response: ' + response.getHeader("set-cookie"));  // test

		// Set status Online true
		await this.userService.setOnlineStatus(player.loginName, true);

		let path: string;
		if (player.tfaEnabled === true)
		{
			this.logger.log('Two factor authentication enabled! Sending verification mail.');
			this.tfaService.sendVerificationMail(player);
			path = `${process.env.FRONTEND}/Login_2fa`;
		}
		else{
			path = `${process.env.FRONTEND}/main_page/profile`;
			this.logger.log("Redirecting to: ", path);
		}
		return response.redirect(path);
	}

	// JWT Token
	// In its compact form, JSON Web Tokens consist of three parts separated by dots (.), which are: Header, Payload, Signature

	// The header typically consists of two parts: the type of the token, which is JWT, and the signing algorithm being used, such as HMAC SHA256 or RSA.

	// The second part of the token is the payload, which contains the claims. 
	// Claims are statements about an entity (typically, the user) and additional data. 
	// There are three types of claims: registered, public, and private claims.

	// To create the signature part you have to take the encoded header, the encoded payload, a secret, the algorithm specified in the header, and sign that.
	// The signature is used to verify the message wasn't changed along the way, and, 
	// in the case of tokens signed with a private key, it can also verify that the sender of the JWT is who it says it is.

  	async signToken(player: CreateUserDto) {
		let token: string;

		let expiryDate = new Date();
		expiryDate.setMinutes(expiryDate.getMinutes() + 5);
		this.logger.log("expiry date auth token: " + expiryDate);

		let time = expiryDate.valueOf();
		this.logger.log("time: " + time);

		const payload = { sub: player.intraId, username:player.loginName, exp: time };  // https://docs.nestjs.com/security/authentication
		try {
			token = await this.jwtService.signAsync(payload, {
				secret: process.env.JWT_SECRET
			});
		}
		catch (err) {
			throw new HttpException('Signing JWT token failed.', HttpStatus.SERVICE_UNAVAILABLE);
		}
		return token;
	}

	async signRefreshToken(player: CreateUserDto) {
		let refreshToken: string;
		let expiryDate = new Date();

		expiryDate.setDate(expiryDate.getDate() + 30);
		//this.logger.log("expiry date refresh token: " + expiryDate);

		let time = expiryDate.valueOf();
		//this.logger.log("time: " + time);

		const payload = { sub: player.intraId, username:player.loginName, exp: time };  // https://docs.nestjs.com/security/authentication
		try {
			refreshToken = await this.jwtService.signAsync(payload, {
				secret: process.env.JWT_SECRET
			});
		}
		catch (err) {
			throw new HttpException('Signing JWT token failed.', HttpStatus.SERVICE_UNAVAILABLE);
		}
		return refreshToken;
	}

  	async replaceToken(request: Request, response: Response, newToken: any): Promise<any> {
		try {
			this.logger.log("start replaceToken");
			let cookies = request.get('Cookie'); // not needed
			this.logger.log("     verify cookie: " + cookies); // not needed
			let existingToken = this.extractTokenFromHeader(request); // not needed
			this.logger.log("     existingToken: " + existingToken); // not needed

			let replaceToken = newToken;
			const cookieAttributes = {
				httpOnly: true,
				path: '/',
				sameSite: 'none',
			};
			let cookieToken = `token=${replaceToken};`;
			for (let attribute in cookieAttributes) {
				if (cookieAttributes[attribute] === true) {
					cookieToken += ` ${attribute};`;
				} else
					cookieToken += ` ${attribute}=${cookieAttributes[attribute]};`;
			}
			// request.cookies('Set-Cookie', cookieToken)
			response.append('Set-Cookie', cookieToken) // jaka, was it always request here??
			this.logger.log('Replaced token in header');
			return true;

		} catch (err) {
			this.logger.error('\x1b[31mError unable to replace header : \x1b[0m' + err);
			throw new HttpException('Failed to replace header', HttpStatus.SERVICE_UNAVAILABLE); // check if other status is better suited 
		}
  	}

	// ADDED JAKA:
    // THE FUNCTION extractUserFromToken() DOES NOT WORK IN OTHER FILES OUTSIDE auth.guards
    // BECAUSE 'CONTEXT' IS NOT AVAILABLE THERE.
    // SO THIS FUNCION NEEDS TO BE MODIFIED
    async extractUserdataFromToken(request: Request): Promise<JwtPayload> { 
        //DISABLE LOGGER
		    //this.logger.log('extract data from token()');
        const token = this.extractTokenFromHeader(request);
        if (!token) {
			      //this.logger.log('     Token not found');
            throw new UnauthorizedException('Token not found');
        }
        try {
            const payload = await this.jwtService.verifyAsync(token, { secret: process.env.JWT_SECRET });
            return payload;
        } catch (error) {
            // throw new UnauthorizedException('Invalid token');
			// if (error instanceof TokenExpiredError) // this would need installing the package 'jsonwebtoken'
			if (error.message === "jwt expired")
				throw new UnauthorizedException('Token expired');
			else {
				this.logger.error(`Invalid token: ${error.message}`, error.stack);
				throw new UnauthorizedException('Invalid token');
			}
		}
    }

    extractTokenFromHeader(request: Request): string | undefined {
        let cookie: string;
        let token: string;
        //DISABLE LOGGER
		    //this.logger.log('extract token from header()');

        cookie = request.get('Cookie');
        if (!cookie)
            return undefined;
        var arrays = cookie.split(';');
        for (let i = 0; arrays[i]; i++) {
            if (arrays[i].includes("token=")) {
                token = arrays[i].split('token=')[1];
                break ;
            }
        }
        return token;
    }
}
