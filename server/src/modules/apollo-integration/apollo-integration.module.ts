import { Module } from "@nestjs/common";
import { ApolloConnectionController } from "./apollo-connection.controller";
import { ApolloConnectionService } from "./apollo-connection.service";
import { ApolloController } from "./apollo.controller";
import { ApolloService } from "./apollo.service";

@Module({
  controllers: [ApolloConnectionController, ApolloController],
  providers: [ApolloConnectionService, ApolloService],
  exports: [ApolloConnectionService, ApolloService],
})
export class ApolloIntegrationModule {}
