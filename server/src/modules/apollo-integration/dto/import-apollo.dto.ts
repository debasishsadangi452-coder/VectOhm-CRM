import { ArrayMinSize, IsArray, IsString } from "class-validator";

// Import only ever takes Apollo identifiers -- the server re-fetches the full,
// revealed record itself (see apollo.service.ts) rather than trusting
// client-supplied contact/company fields, since what the client saw in the
// search results was an obfuscated preview.
export class ImportApolloPeopleDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  apolloIds!: string[];
}

export class ImportApolloOrganizationsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  domains!: string[];
}
