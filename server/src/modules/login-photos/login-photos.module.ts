import { Module } from "@nestjs/common";
import { LoginPhotosController } from "./login-photos.controller";
import { LoginPhotosService } from "./login-photos.service";
import { LoginPhotoStorageService } from "./login-photo-storage.service";

@Module({
  controllers: [LoginPhotosController],
  providers: [LoginPhotosService, LoginPhotoStorageService],
})
export class LoginPhotosModule {}
