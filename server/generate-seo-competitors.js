const fs = require('fs');
const path = require('path');
const mod = 'seo-competitors';
const basePath = path.join(__dirname, 'src/modules');
const modPath = path.join(basePath, mod);

if (!fs.existsSync(modPath)) {
  fs.mkdirSync(modPath, { recursive: true });
}

const nameUpper = 'SeoCompetitors';
const nameCamel = 'seoCompetitors';
const model = 'seoCompetitor';

fs.writeFileSync(path.join(modPath, mod + '.module.ts'), `import { Module } from '@nestjs/common';
import { ${nameUpper}Service } from './${mod}.service';
import { ${nameUpper}Controller } from './${mod}.controller';

@Module({
  controllers: [${nameUpper}Controller],
  providers: [${nameUpper}Service],
})
export class ${nameUpper}Module {}`);

fs.writeFileSync(path.join(modPath, mod + '.controller.ts'), `import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request } from '@nestjs/common';
import { ${nameUpper}Service } from './${mod}.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('${mod}')
export class ${nameUpper}Controller {
  constructor(private readonly ${nameCamel}Service: ${nameUpper}Service) {}

  @Post()
  create(@Body() createDto: any, @Request() req: any) {
    return this.${nameCamel}Service.create(createDto, req.user);
  }

  @Get()
  findAll(@Query() query: any, @Request() req: any) {
    return this.${nameCamel}Service.findAll(query, req.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.${nameCamel}Service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: any) {
    return this.${nameCamel}Service.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.${nameCamel}Service.remove(id);
  }
}`);

fs.writeFileSync(path.join(modPath, mod + '.service.ts'), `import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ${nameUpper}Service {
  constructor(private prisma: PrismaService) {}

  create(createDto: any, user: any) {
    return this.prisma.${model}.create({ data: createDto });
  }

  findAll(query: any, user: any) {
    const { departmentId } = query;
    const where: any = {};
    if (departmentId) where.departmentId = departmentId;
    return this.prisma.${model}.findMany({ where });
  }

  findOne(id: string) {
    return this.prisma.${model}.findUnique({ where: { id } });
  }

  update(id: string, updateDto: any) {
    return this.prisma.${model}.update({
      where: { id },
      data: updateDto,
    });
  }

  remove(id: string) {
    return this.prisma.${model}.delete({ where: { id } });
  }
}`);
