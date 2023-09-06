/*
  This is the main file, together with app.module.ts. It is the entry point of the application,
  it attaches the 'AppModule' and creates an instance of 'NestApplication'
*/

import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppModule } from './app/app.module';
import { AuthGuard } from './auth/guards/auth.guard';
import cookieParser from 'cookie-parser';

// const { Server } = require("socket.io"); JOYCE ?? socket.io tutorial
// const io = new Server(server); JOYCE ?? socket.io tutorial

async function main() {
  console.log('[BACKEND LOG] Backend main');

  const app = await NestFactory.create(AppModule);

  // Enable CORS for all routes (this app will turn on port 3001, but the frontend and database will
  // run on a different port, so its good to add all other origin ports running (i.e.: that will
  // try to access/send requests to the backend) as a Cors option).


  app.enableCors({
    origin: ['http://localhost:3000','http://localhost:3001', 'http://localhost:5432']// TODO: change 3000 for a macro or from .env
    // 3000 -> ReactJS (frontend)
    // 5432 -> PostgreQSL (database)
  });
  

  // app.enableCors({
  //   // origin: true,
  //   origin: ['http://localhost:3000/','http://localhost:3001/', 'http://localhost:5432']// TODO: change 3000 for a macro or from .env
	// 	// origin: [`${process.env.FRONTEND}/`, `${process.env.BACKEND}/`, `${process.env.DATABASE}/`],
  //   // methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  //   // credentials: true,
  // });
  
  // this allows the AuthGuard to be used globally so that we don't have to add the decorator to every single controller
  // app.useGlobalGuards(new AuthGuard(new JwtService, new Reflector));  
	app.use(cookieParser());

  // app.use((req, res, next) => {
  //   res.header('Access-Control-Allow-Origin', ['http://localhost:3000/','http://localhost:3001/', 'http://localhost:5432'] );
  //   res.header('Access-Control-Allow-Credentials', 'true');
  //   res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  //   next();
  // });

  await app.listen(3001);

  // I think this down below may work for socket.io
  // const http = app.require('http');
  // const port = 3001;// socket.io also listens on port 3001???
  // http.listen(port, () => {
  //   console.log(`Socket.IO server running at http://localhost:${port}/`);
  // });
}
main();
