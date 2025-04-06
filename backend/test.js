const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  //change to reference a table in your schema
  const val = await prisma.user.findFirst({});
//   const val = await prisma.<SOME_TABLE_NAME>.findMany({
//     take: 10,
//   });
  console.log(val);
//   const test = await prisma.post.create({})
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
  process.exit(1);
});