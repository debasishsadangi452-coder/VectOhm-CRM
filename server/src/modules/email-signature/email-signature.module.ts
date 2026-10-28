import { Module } from "@nestjs/common";
import { EmailSignatureController } from "./email-signature.controller";
import { EmailSignatureService } from "./email-signature.service";

@Module({
  controllers: [EmailSignatureController],
  providers: [EmailSignatureService],
})
export class EmailSignatureModule {}
