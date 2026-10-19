import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/enums/role.enum';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async onModuleInit() {
    await this.seedUsers();
  }

  async seedUsers(): Promise<void> {
    const totalUsers = await this.userRepository.count();

    if (totalUsers > 0) {
      this.logger.log('Base de datos ya cuenta con usuarios registrados. Omitiendo seed.');
      return;
    }

    this.logger.log('Tabla de usuarios vacía. Ejecutando seed de datos iniciales...');

    const adminHashedPassword = await bcrypt.hash('AdminPassword123*', 10);
    const userHashedPassword = await bcrypt.hash('UserPassword123*', 10);

    const adminUser = this.userRepository.create({
      email: 'admin@enterprise.com',
      password: adminHashedPassword,
      roles: [Role.ADMIN],
      isActive: true,
    });

    const operatorUser = this.userRepository.create({
      email: 'operador@enterprise.com',
      password: userHashedPassword,
      roles: [Role.USER],
      isActive: true,
    });

    await this.userRepository.save([adminUser, operatorUser]);

    this.logger.log('Seed completado con éxito: 2 usuarios creados (admin@enterprise.com, operador@enterprise.com).');
  }
}
