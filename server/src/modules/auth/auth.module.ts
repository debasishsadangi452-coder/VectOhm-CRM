import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AdminBootstrapService } from "./admin-bootstrap.service";
import { JwtStrategy } from "./strategies/jwt.strategy";

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, AdminBootstrapService],
  exports: [AuthService],
})
export class AuthModule {}
