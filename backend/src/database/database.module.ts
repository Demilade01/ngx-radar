import { Global, Module } from '@nestjs/common';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

export const DB = 'DATABASE_CONNECTION';

const dbProvider = {
  provide: DB,
  useFactory: () => {
    const sql = neon(process.env.DATABASE_URL!);
    return drizzle(sql, { schema });
  },
};

@Global()
@Module({
  providers: [dbProvider],
  exports: [dbProvider],
})
export class DatabaseModule {}
