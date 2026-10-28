import { IsArray, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ApolloPeopleSearchDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  personTitles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  organizationDomains?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  locations?: string[];

  @IsOptional()
  @IsString()
  keywords?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number;
}

export class ApolloOrganizationSearchDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  locations?: string[];

  @IsOptional()
  @IsString()
  keywords?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number;
}
