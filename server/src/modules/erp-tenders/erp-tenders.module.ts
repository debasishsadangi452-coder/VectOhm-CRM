import { Module } from "@nestjs/common";
import { ErpTendersController } from "./erp-tenders.controller";
import { ErpTendersService } from "./erp-tenders.service";

@Module({
  controllers: [ErpTendersController],
  providers: [ErpTendersService],
})
export class ErpTendersModule {}
