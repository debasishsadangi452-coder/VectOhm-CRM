import { Body, Controller, Param, Post } from "@nestjs/common";
import { ApolloService } from "./apollo.service";
import { ApolloOrganizationSearchDto, ApolloPeopleSearchDto } from "./dto/apollo-search.dto";
import {
  ImportApolloOrganizationsDto,
  ImportApolloPeopleDto,
} from "./dto/import-apollo.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Department } from "../../common/decorators/department.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Department("Sales")
@Controller("apollo")
export class ApolloController {
  constructor(private readonly apolloService: ApolloService) {}

  @Post("search/people")
  searchPeople(@Body() dto: ApolloPeopleSearchDto, @CurrentUser() user: RequestUser) {
    return this.apolloService.searchPeople(dto, user);
  }

  @Post("search/organizations")
  searchOrganizations(@Body() dto: ApolloOrganizationSearchDto, @CurrentUser() user: RequestUser) {
    return this.apolloService.searchOrganizations(dto, user);
  }

  @Post("import/people")
  importPeople(@Body() dto: ImportApolloPeopleDto, @CurrentUser() user: RequestUser) {
    return this.apolloService.importPeople(dto, user);
  }

  @Post("import/organizations")
  importOrganizations(@Body() dto: ImportApolloOrganizationsDto, @CurrentUser() user: RequestUser) {
    return this.apolloService.importOrganizations(dto, user);
  }

  @Post("enrich/:contactId")
  enrich(@Param("contactId") contactId: string, @CurrentUser() user: RequestUser) {
    return this.apolloService.enrichPerson(contactId, user);
  }
}
