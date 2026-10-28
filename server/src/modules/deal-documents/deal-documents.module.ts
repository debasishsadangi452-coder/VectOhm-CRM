import { Module } from "@nestjs/common";
import { DealDocumentsController } from "./deal-documents.controller";
import { DealDocumentsService } from "./deal-documents.service";
import { DealDocumentStorageService } from "./deal-document-storage.service";

@Module({
  controllers: [DealDocumentsController],
  providers: [DealDocumentsService, DealDocumentStorageService],
})
export class DealDocumentsModule {}
