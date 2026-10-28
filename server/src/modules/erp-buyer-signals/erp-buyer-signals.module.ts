import { Module } from "@nestjs/common";
import { ErpBuyerSignalsController } from "./erp-buyer-signals.controller";
import { ErpBuyerSignalsService } from "./erp-buyer-signals.service";

@Module({
  controllers: [ErpBuyerSignalsController],
  providers: [ErpBuyerSignalsService],
})
export class ErpBuyerSignalsModule {}
