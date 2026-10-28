import { IsEmail } from "class-validator";

export class AddSuppressionDto {
  @IsEmail()
  email!: string;
}
