const fs = require('fs');
const path = require('path');

const modules = ['seo-keywords', 'seo-audits', 'seo-backlinks', 'seo-content-briefs'];
const basePath = path.join(__dirname, 'src/modules');

modules.forEach(mod => {
  const modPath = path.join(basePath, mod);
  if (!fs.existsSync(modPath)) {
    fs.mkdirSync(modPath, { recursive: true });
    fs.mkdirSync(path.join(modPath, 'dto'), { recursive: true });
  }

  const nameUpper = mod.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  const nameCamel = mod.split('-').map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join('');

  // Module file
  fs.writeFileSync(path.join(modPath, `${mod}.module.ts`), `import { Module } from '@nestjs/common';
import { ${nameUpper}Service } from './${mod}.service';
import { ${nameUpper}Controller } from './${mod}.controller';

@Module({
  controllers: [${nameUpper}Controller],
  providers: [${nameUpper}Service],
})
export class ${nameUpper}Module {}`);

  // Controller file
  fs.writeFileSync(path.join(modPath, `${mod}.controller.ts`), `import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request } from '@nestjs/common';
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

  // Service file
  fs.writeFileSync(path.join(modPath, `${mod}.service.ts`), `import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ${nameUpper}Service {
  constructor(private prisma: PrismaService) {}

  create(createDto: any, user: any) {
    return this.prisma.${nameCamel}.create({ data: createDto });
  }

  findAll(query: any, user: any) {
    const { departmentId } = query;
    const where: any = {};
    if (departmentId) where.departmentId = departmentId;
    return this.prisma.${nameCamel}.findMany({ where });
  }

  findOne(id: string) {
    return this.prisma.${nameCamel}.findUnique({ where: { id } });
  }

  update(id: string, updateDto: any) {
    return this.prisma.${nameCamel}.update({
      where: { id },
      data: updateDto,
    });
  }

  remove(id: string) {
    return this.prisma.${nameCamel}.delete({ where: { id } });
  }
}`);
});
