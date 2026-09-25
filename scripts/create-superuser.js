require('dotenv').config();
const readline=require('node:readline/promises');
const {stdin:input,stdout:output}=require('node:process');
const bcrypt=require('bcryptjs');
const {Pool}=require('pg');

if(!process.env.DATABASE_URL){console.error('Configura DATABASE_URL prima di creare il superuser.');process.exit(1);}
const rl=readline.createInterface({input,output});
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==='disable'?false:(process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:undefined)});
let client;
(async()=>{
  try{
    client=await pool.connect();
    await client.query("SELECT set_config('app.platform_admin','true',false)");
    const existing=await client.query('SELECT count(*)::int AS n FROM platform_admins');
    if(existing.rows[0].n)throw new Error('Esiste già un superuser. Usa la console per reimpostare le credenziali.');
    const username=(await rl.question('Nome superuser [wincklers]: ')).trim()||'wincklers';
    const password=await rl.question('Password superuser (almeno 12 caratteri): ');
    const confirmation=await rl.question('Ripeti la password: ');
    if(password.length<12||password!==confirmation)throw new Error('Le password devono coincidere e avere almeno 12 caratteri.');
    const hash=await bcrypt.hash(password,12);
    const result=await client.query('INSERT INTO platform_admins(username,password_hash) VALUES($1,$2) RETURNING id',[username,hash]);
    console.log(`Superuser ${username} creato (ID ${result.rows[0].id}).`);
  }catch(error){console.error(error.message);process.exitCode=1;}
  finally{rl.close();client?.release();await pool.end();}
})();
