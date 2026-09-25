require('dotenv').config();
const readline = require('node:readline/promises');
const { stdin: input, stdout: output } = require('node:process');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) { console.error('Configura DATABASE_URL prima di creare l’utente.'); process.exit(1); }
const rl=readline.createInterface({input,output});
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==='disable'?false:(process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:undefined)});
(async()=>{
  try {
    const name=(await rl.question('Nome amministratore: ')).trim();
    const email=(await rl.question('Email: ')).trim().toLowerCase();
    const password=await rl.question('Password (almeno 12 caratteri): ');
    if(!name||!email.includes('@')||password.length<12)throw new Error('Nome, email valida e password di almeno 12 caratteri sono obbligatori.');
    const hash=await bcrypt.hash(password,12);
    const result=await pool.query(`INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'owner') ON CONFLICT (email) DO NOTHING RETURNING id`,[name,email,hash]);
    if(!result.rowCount)throw new Error('Esiste già un utente con questa email.');
    console.log(`Amministratore creato (ID ${result.rows[0].id}).`);
  } catch(e) { console.error(e.message); process.exitCode=1; }
  finally { rl.close(); await pool.end(); }
})();
