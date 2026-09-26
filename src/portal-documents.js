const shareableDocument = `
  d.mime_type='application/pdf'
  AND (
    (d.document_type='estimate_pdf' AND e.status='approved' AND e.work_order_id=w.id)
    OR
    (d.document_type='invoice_pdf' AND i.status IN ('open','partial','paid') AND i.work_order_id=w.id)
  )`;

const fromAndJoins = `
    FROM documents d
    JOIN work_orders w ON w.id=d.work_order_id
    JOIN vehicles v ON v.id=w.vehicle_id
    LEFT JOIN estimates e ON e.id=d.estimate_id
    LEFT JOIN invoices i ON i.id=d.invoice_id`;

const listPortalDocuments = `
  SELECT d.id,d.file_name,d.created_at,d.document_type,w.id AS work_order_id,
         v.plate,v.make,v.model,e.version,i.invoice_number,
         CASE WHEN d.document_type='estimate_pdf' THEN 'Preventivo approvato'
              ELSE 'Documento gestionale' END AS label
    ${fromAndJoins}
   WHERE w.customer_id=$1 AND ${shareableDocument}
   ORDER BY d.created_at DESC,d.id DESC LIMIT 100`;

const getPortalDocument = `
  SELECT d.id,d.file_name,d.file_data,d.created_at,d.document_type,w.id AS work_order_id,
         v.plate,v.make,v.model,e.version,i.invoice_number
    ${fromAndJoins}
   WHERE w.customer_id=$1 AND d.id=$2 AND ${shareableDocument}
   LIMIT 1`;

module.exports = { listPortalDocuments, getPortalDocument };
