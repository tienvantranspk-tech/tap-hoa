const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const users = await prisma.user.findMany();
  console.log('Users:', users);
  const customers = await prisma.customer.findMany();
  console.log('Customers:', customers);
}
run().catch(console.error);
