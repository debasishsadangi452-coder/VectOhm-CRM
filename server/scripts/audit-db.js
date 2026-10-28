const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const tables = await p.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' 
    AND table_name IN ('JobPosting', 'JobSubmission', 'JobTask', 'JobNote', 'JobDocument', 'JobActivity', 'JobEmailMerge', 'Vendor', 'Lead', 'Candidate', 'Interview', 'Offer')
    ORDER BY table_name;
  `);
  console.log('TABLES FOUND:', tables.map(t => t.table_name));

  const entities = ['JobSubmission', 'JobTask', 'JobNote', 'JobDocument', 'JobActivity', 'JobEmailMerge'];
  for (const ent of entities) {
    const cols = await p.$queryRawUnsafe(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = '${ent}'
      ORDER BY ordinal_position;
    `);
    console.log(`\n=== COLUMNS FOR ${ent} ===`);
    console.log(cols);

    const fks = await p.$queryRawUnsafe(`
      SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = '${ent}';
    `);
    console.log(`FOREIGN KEYS FOR ${ent}:`, fks);
  }

  const jpCols = await p.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable FROM information_schema.columns 
    WHERE table_name = 'JobPosting' AND column_name IN ('industry', 'clearance', 'tags', 'boardStatus', 'status', 'client', 'clientJobId', 'businessUnit', 'states', 'clientBillRate', 'sources')
    ORDER BY column_name;
  `);
  console.log('\n=== JOB POSTING PERSISTENCE COLS ===', jpCols);

  const vendorCols = await p.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable FROM information_schema.columns 
    WHERE table_name = 'Vendor' AND column_name = 'contactPerson';
  `);
  console.log('\n=== VENDOR contactPerson COL ===', vendorCols);

  const leadCols = await p.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable FROM information_schema.columns 
    WHERE table_name = 'Lead' AND column_name = 'company';
  `);
  console.log('\n=== LEAD company COL ===', leadCols);
}

main().catch(console.error).finally(() => p.$disconnect());
