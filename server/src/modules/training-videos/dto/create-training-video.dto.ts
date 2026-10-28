import { IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Min } from "class-validator";

export class CreateTrainingVideoDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  // A shareable link to the recording -- Google Drive, YouTube, anywhere.
  // require_tld keeps localhost out of production data while still accepting
  // the long query strings Drive share links carry.
  @IsUrl({ require_protocol: true, protocols: ["http", "https"] })
  url!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
