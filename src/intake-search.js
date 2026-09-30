module.exports = function attachIntakeSearch(app,pool,needAuth){
  app.get('/intake/search/customers',needAuth,async(req,res,next)=>{
    try{
      const q=String(req.query.q||'').trim().slice(0,100);
      if(q.length<2)return res.json({results:[]});
      const normalized=q.toUpperCase().replace(/[^A-Z0-9]/g,'');
      const found=await pool.query("SELECT id,kind,name,tax_code,vat_number,email,phone,address FROM customers WHERE name ILIKE $1 OR tax_code ILIKE $1 OR upper(regexp_replace(tax_code,'[^A-Z0-9]','','g'))=$2 OR phone ILIKE $1 OR email ILIKE $1 OR id IN (SELECT id FROM customers ORDER BY created_at DESC LIMIT 5000) ORDER BY CASE WHEN upper(regexp_replace(tax_code,'[^A-Z0-9]','','g'))=$2 THEN 0 ELSE 1 END,created_at DESC LIMIT 5000",['%'+q+'%',normalized]);
      const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
      const distance=(a,b)=>{const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;}}return row[b.length];};
      const target=normalize(q),tokens=target.split(' ').filter(Boolean);
      const results=found.rows.map(customer=>{
        const name=normalize(customer.name),nameTokens=name.split(' ').filter(Boolean);
        const tokenScore=tokens.length?tokens.filter(token=>nameTokens.some(part=>part.startsWith(token)||token.startsWith(part)||distance(token,part)<=1)).length/tokens.length:0;
        const reversed=target.split(' ').reverse().join(' '),editScore=1-Math.min(distance(target,name),distance(reversed,name))/Math.max(target.length,name.length,1);
        const taxQuery=String(q).toUpperCase().replace(/[^A-Z0-9]/g,''),taxScore=taxQuery&&taxQuery===String(customer.tax_code||'').toUpperCase().replace(/[^A-Z0-9]/g,'')?1:0;
        return {...customer,_score:Math.max(tokenScore,editScore,taxScore)};
      }).filter(customer=>customer._score>=0.42).sort((a,b)=>b._score-a._score||a.name.localeCompare(b.name,'it')).slice(0,15).map(({_score,...customer})=>customer);
      res.json({results});
    }catch(error){next(error);}
  });
  app.get('/intake/search/vehicles',needAuth,async(req,res,next)=>{
    try{
      const q=String(req.query.q||'').trim().slice(0,100),customerId=Number(req.query.customer_id)||null;
      if(q.length<2&&!customerId)return res.json({results:[]});
      const sql=[
        "SELECT v.id,v.customer_id,v.plate,v.vin,v.make,v.model,v.year,v.fuel,v.mileage,c.name AS customer_name,",
        "count(DISTINCT w.id)::int AS repair_count,max(w.created_at) AS last_visit,",
        "coalesce(json_agg(json_build_object('work_order_id',w.id,'customer_name',wc.name,'created_at',w.created_at,'complaint',w.complaint) ORDER BY w.created_at DESC) FILTER(WHERE w.id IS NOT NULL),'[]'::json) AS history,",
        "d.origin_work_order_id,d.last_delivered_at,s.warranty_days",
        "FROM vehicles v JOIN customers c ON c.id=v.customer_id",
        "LEFT JOIN work_orders w ON w.vehicle_id IN (SELECT prior_vehicle.id FROM vehicles prior_vehicle WHERE upper(regexp_replace(prior_vehicle.plate,'[^A-Z0-9]','','g'))=upper(regexp_replace(v.plate,'[^A-Z0-9]','','g')))",
        "LEFT JOIN customers wc ON wc.id=w.customer_id",
        "LEFT JOIN LATERAL (SELECT prior.id AS origin_work_order_id,vd.delivered_at AS last_delivered_at FROM work_orders prior JOIN vehicle_deliveries vd ON vd.work_order_id=prior.id WHERE prior.vehicle_id=v.id ORDER BY vd.delivered_at DESC LIMIT 1) d ON true",
        "CROSS JOIN workshop_settings s",
        "WHERE (($1='' AND $3::bigint IS NOT NULL AND (v.customer_id=$3 OR EXISTS(SELECT 1 FROM work_orders mine WHERE mine.vehicle_id=v.id AND mine.customer_id=$3)))",
        "OR ($1<>'' AND (v.plate ILIKE $2 OR v.vin ILIKE $2 OR v.make ILIKE $2 OR v.model ILIKE $2 OR c.name ILIKE $2)))",
        "GROUP BY v.id,c.name,d.origin_work_order_id,d.last_delivered_at,s.warranty_days",
        "ORDER BY CASE WHEN $3::bigint IS NOT NULL AND (v.customer_id=$3 OR EXISTS(SELECT 1 FROM work_orders mine WHERE mine.vehicle_id=v.id AND mine.customer_id=$3)) THEN 0 ELSE 1 END,",
        "CASE WHEN upper(v.plate)=upper($4) THEN 0 WHEN upper(v.vin)=upper($4) THEN 1 ELSE 2 END,v.created_at DESC LIMIT 30"
      ].join(' ');
      const found=await pool.query(sql,[q,'%'+q+'%',customerId,q]);
      res.json({results:found.rows});
    }catch(error){next(error);}
  });
};
