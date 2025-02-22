import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { PonggameService } from "./ponggame.service";
import { GameState } from "./dto/game-state.dto";

import { AuthService } from "src/auth/auth.service";
import { UserService } from "src/user/user.service";
import { UserEntity } from "src/user/user.entity";
import { MatchService } from "src/matches/match.service";
import { MatchDto } from "src/matches/match.dto";

//for testing
import { MatchEntity } from "src/matches/match.entity";
import {Logger, UnauthorizedException} from "@nestjs/common";

@WebSocketGateway({
  cors: {
    //    origin: '*', //!DEV allowing any origin
    origin: process.env.FRONTEND,
    credentials: true,
    // origin: "http://localhost:3000", // allow the origin http://localhost:5173
    // credentials: true,
  },
})
export class PonggameGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(PonggameGateway.name);

  @WebSocketServer()
  private server: Server;

  //variables for sending the gamestate to the clients
  private _gameInterval: NodeJS.Timeout;
  private _processingGamestates: boolean = false;
  private _socketIdUserId: Map<string, string> = new Map(); //maps socketId to userId
  private _userIdSocketId: Map<string, string> = new Map(); //maps the userId to a socketId

  constructor(
    private readonly ponggameService: PonggameService,
    public readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly matchService: MatchService
  ) {
    this._gameInterval = setInterval(() => {
      if (this._processingGamestates == false) {
        this._processingGamestates = true;
        ponggameService.updateCurrentMatches();
        const currentGames = ponggameService.getCurrentMatches();
        currentGames.forEach((gamestate: GameState) => {
          this.server.to(gamestate.roomName).emit('stateUpdate', gamestate);
          if (gamestate.currentState == "End"){
console.log("match is being processed");
              this.processMatch(gamestate); //send the match data to the database
              this.server.socketsLeave(gamestate.roomName);
              this.ponggameService.removeUserIdMatch(gamestate.player1info);
              this.ponggameService.removeUserIdMatch(gamestate.player2info);
          }
          else if( gamestate.currentState == "Disconnection"){
              this.server.socketsLeave(gamestate.roomName);
              this.ponggameService.removeUserIdMatch(gamestate.player1info);
              this.ponggameService.removeUserIdMatch(gamestate.player2info);
          }
        });
        ponggameService.cleanUpMatches();
        this._processingGamestates = false;
      }
    }, 13);
  }

  async handleConnection(client: Socket) {
    try {
      this.logger.log(`[handleConnection] pong game client id ${client.id} connected`);

      if (client.handshake.headers.cookie) {
        const token_key_value = client.handshake.headers.cookie;
        // this.logger.log('[handleConnection] token found in the header: ' + token_key_value);
        if (token_key_value.includes("token")) {
          const token_index_start= token_key_value.indexOf("token");
          const token_index_end_global = token_key_value.length;
          const from_token_to_end = token_key_value.substring(token_index_start, token_index_end_global);
          let token_index_end_local = from_token_to_end.indexOf(";");
          if (token_index_end_local == -1) {
            token_index_end_local = from_token_to_end.length;
          }
          const token_key_value_2 = from_token_to_end.substring(0, token_index_end_local);
          const token = token_key_value_2.split('=')[1];
          // this.logger.log('[handleConnection] token: ' + token);

          try {
            const payload = await this.authService.jwtService.verifyAsync(token, {secret: process.env.JWT_SECRET});
            this.logger.log('[handleConnection] payload.username: ' + payload.username);
            client.data.user = payload.username;

            const userId = payload.username;

            this._socketIdUserId.set(client.id, userId);
            this._userIdSocketId.set(userId, client.id);

            // added Jaka:
            this.emitOnlineStatuses();

            const matchId = this.ponggameService.getMatchId(userId);
            // this.logger.log(`UserId found : ${userId}`);
            if (matchId) {
              this.logger.log(`Match Id ${matchId}`);
            }
            if (matchId == "") {
              //if not get the selection screen
              client.emit(
                  "stateUpdate",
                  this.ponggameService.getInitMatch("Default")
              );
            } else {
              // if part of a game then join the match
              client.join(matchId);
            }

          } catch {
            throw new UnauthorizedException('Invalid token');
          }
        } else {
          throw new UnauthorizedException('Token does not exist (yet?), disconnecting');
        }
      } else {
        throw new UnauthorizedException('No cookie found in the header, disconnecting');
      }
    } catch (error) {
      // this.logger.error("something went wrong verifying the token");
      // this.logger.error("Disconnecting the client socket");
      this.logger.error('[handleConnection] error: ' + error);
      client.emit("exceptionHandleConnection", new UnauthorizedException(error));
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[handleDisconnect] pong game client id ${client.id} disconnected`);
    this.ponggameService.playerDisconnected(
      this._socketIdUserId.get(client.id),
    );
    this._userIdSocketId.delete(this._socketIdUserId.get(client.id));
    this._socketIdUserId.delete(client.id);

    // Added Jaka:
    this.emitOnlineStatuses();
  }

@SubscribeMessage('joinGame')
  joinGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() type: string
  ) {
    const userId = this._socketIdUserId.get(client.id);
    const matchId= this.ponggameService.joinGame(userId, type);
    client.join(matchId);
  }

  @SubscribeMessage('playerinput')
  procesInput(@MessageBody() input: number, @ConnectedSocket() client: Socket) {
    const userId = this._socketIdUserId.get(client.id);
    const matchId = this.ponggameService.getMatchId(userId);
    if (matchId != '') {
      this.ponggameService.updateUserInput(matchId, userId, input);
    }
  }
  @SubscribeMessage('requestUserStatus')
  requestUserStatus(@MessageBody() userId: string): string {
    if (!this._userIdSocketId.has(userId))
        return 'offline';
    const match = this.ponggameService.getMatchId(userId);
    if (match != "")
        return "ingame"
    return "online";
  }

@SubscribeMessage('requestPlayerPartOfGame')
  requestPlayerPartOfGame(@MessageBody() userId: string, @ConnectedSocket() client: Socket){
    let partOfMatch : boolean = false;
    if (this.ponggameService.getMatchId(userId) != ""){
        partOfMatch = true;
    }
    client.emit('responsePlayerPartOfGame',partOfMatch);
  }

  @SubscribeMessage('createPrivateMatch')
  createPrivateMatch(@MessageBody() data: {player1: string, player2: string, matchType: string}, @ConnectedSocket() client: Socket) : boolean{
    this.ponggameService.createPrivateMatch(data.player1, data.player2, data.matchType);
    return true;
  }

  @SubscribeMessage('invitePlayerToGame')
  invitePlayer(@MessageBody() userId: string, @ConnectedSocket() client: Socket): boolean{
    console.log(`invite for ${userId} received`);
    const invitedSocketId = this._userIdSocketId.get(userId);
    const inviteeName = this._socketIdUserId.get(client.id);
    this.server.to(invitedSocketId).emit("inviteMessage",inviteeName);
    return true;
  }

  @SubscribeMessage('declineInvite')
  declineInvite(@ConnectedSocket() client: Socket){
    const userId = this._socketIdUserId.get(client.id);
    this.ponggameService.declineInvite(userId);
  }


//test function
@SubscribeMessage('testMatchDb')
  async testingMatchCreation(){
    const player1: UserEntity = await this.userService.getUserByLoginName("hman");
    this.logger.log("playerid is " + player1.id + " |");
    const player2: UserEntity = await this.userService.getUserByLoginName("dummy2");
    this.logger.log("dummy playerid is " + player2.id + "|");
    const match: MatchDto = new MatchDto();
    match.player1Id = player1.id;
    match.player2Id = player2.id;
    match.player1Score= 3;
    match.player2Score= 1;
    match.winnerId = player1.id;
    match.timeStamp = new Date();
    try{
      await this.matchService.createMatch(match);
    } catch (e){
      this.logger.log("Error: something went wrong with entering match into the database");
    }
  }

  //save the match data to the database
  async processMatch(gamestate : GameState){
    const player1 : UserEntity = await this.userService.getUserByLoginName(gamestate.player1info);
    const player2 : UserEntity = await this.userService.getUserByLoginName(gamestate.player2info);
    const match : MatchDto = new MatchDto();
    match.player1Id = player1.id;
    match.player2Id = player2.id;
    match.player1Score = gamestate.player1score;
    match.player2Score = gamestate.player2score;
    if(gamestate.winner == 1)
        match.winnerId = player1.id;
    else if (gamestate.winner == 2)
        match.winnerId = player2.id;

    match.timeStamp = new Date();
    this.logger.log("player ids :" + player1.id + " " + player2.id);
    try {
        await this.matchService.createMatch(match);
    } catch(e){
        this.logger.log("Error: something went wrong with entering match in to the database");
    }
  }

  //test function
  print_out_socketId() {
    this.logger.log('\ncurrent log');
    this._socketIdUserId.forEach((value, key) => {
      this.logger.log(`Socket id ${key} userID ${value}`);
    });
    this.logger.log('\n');

    this._userIdSocketId.forEach((value, key) => {
      this.logger.log(`user id ${key} client id ${value}`);
    });
    this.logger.log('\n');
  }
  
  //test function
  async print_out_matches(userId: number){
    const matchHistory: MatchEntity[] = await this.matchService.getMatchHistoryByUserId(userId);
    matchHistory.forEach((match) =>{
        this.logger.log(` match id ${match.id}\n player 1 ${match.player1} and player 2 ${match.player2} \n Score ${match.player1Score} - ${match.player2Score} \n WinnerId ${match.winnerId}\n`);
    });
  }
  
  
  // ADDED JAKA /////////////////////////////////////
  //  If possible, here I would like to check all currently played matches and check if this
  //  username/userId is in any of current matches 
  @SubscribeMessage('requestPlayingStatus')
  handleRequestPlayingStatus(
    @MessageBody() loginName: string,
    @ConnectedSocket() client: Socket) {
      const matchId = this.ponggameService.getMatchId(loginName);
      const isPlaying = matchId ? true : false;
      console.log("Status of playing: ", isPlaying);
      client.emit('responsePlayingStatus', { isPlaying })
    }


  // ADDED JAKA: single user's status
  @SubscribeMessage('requestOnlineStatus')
  handleRequestOnlineStatus(
    @MessageBody() loginName: string,
    @ConnectedSocket() client: Socket) {
      const isOnline = this._userIdSocketId.has(loginName);
      client.emit('responseOnlineStatus', { isOnline });
  }

  // Added Jaka:
  // This is called inside handleConnection() and handleDisconnect(),
  // after each change of any user login status
  private emitOnlineStatuses() {
    const onlineUsersIds = Array.from(this._userIdSocketId.keys());
    this.server.emit('onlineStatusUpdates', onlineUsersIds);
  }

}
