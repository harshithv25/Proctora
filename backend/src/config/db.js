const { PrismaClient } = require('@prisma/client');
const { env } = require('./env');

const prisma = global.__prisma || new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
});

if (env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

module.exports = { prisma };
