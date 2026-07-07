const { query } = require('../config/database');

/**
 * Query low-stock materials with resolved suppliers and suggested quantities.
 * Pure read — does not create any requisition.
 * Includes requisition-deduplication (excludes materials already in draft/sent requisitions)
 * and respects restock_quantity, preferred_supplier_id, and is_active.
 * @param {number[]|null} materialIds - Specific raw_material_ids to check, or null/empty to check all
 * @returns {Promise<Array<{
 *   raw_material_id: number,
 *   material_name: string,
 *   material_code: string,
 *   current_stock: number,
 *   reorder_level: number,
 *   restock_quantity: number|null,
 *   min_order_qty: number,
 *   suggested_quantity: number,
 *   unit_price: number,
 *   total_cost: number,
 *   unit: string,
 *   supplier_id: number|null,
 *   supplier_name: string|null,
 *   supplier_contact: string|null,
 *   supplier_email: string|null,
 *   supplier_phone: string|null
 * }>>}
 */
async function getLowStockMaterialsWithSuggestions(materialIds = null) {
  let materialFilter = '';
  const params = [];
  if (materialIds && materialIds.length > 0) {
    const placeholders = materialIds.map((_, i) => `$${i + 1}`).join(',');
    materialFilter = `AND rm.id IN (${placeholders})`;
    params.push(...materialIds);
  }

  const lowStockCheck = await query(`
    SELECT rm.id, rm.code, rm.name_arabic, rm.name_english,
           rm.current_stock, rm.reorder_level, rm.min_stock_level,
           rm.unit, rm.unit_price,
           rm.restock_quantity, rm.preferred_supplier_id,
           s.id as supplier_id, s.name as supplier_name,
           s.contact_person, s.email, s.phone
    FROM raw_materials rm
    LEFT JOIN supplier_materials sm
      ON sm.raw_material_id = rm.id AND sm.is_preferred = true
    LEFT JOIN suppliers s
      ON COALESCE(rm.preferred_supplier_id, sm.supplier_id) = s.id
    WHERE rm.current_stock <= rm.reorder_level
      AND rm.is_active = true
      ${materialFilter}
      AND rm.id NOT IN (
        SELECT DISTINCT ri.raw_material_id
        FROM requisition_items ri
        JOIN requisitions r ON r.id = ri.requisition_id
        WHERE r.status IN ('draft', 'sent')
          AND ri.raw_material_id IS NOT NULL
      )
  `, params);

  return lowStockCheck.rows.map(mat => {
    let suggestedQty;
    if (mat.restock_quantity != null && parseFloat(mat.restock_quantity) > 0) {
      suggestedQty = parseFloat(mat.restock_quantity);
    } else {
      const shortage = Math.max(0, parseFloat(mat.reorder_level) - parseFloat(mat.current_stock));
      suggestedQty = Math.max(shortage, parseFloat(mat.min_order_qty || 0), 1);
    }
    const unitPrice = parseFloat(mat.unit_price || 0);
    const itemTotal = suggestedQty * unitPrice;

    return {
      raw_material_id: mat.id,
      material_name: mat.name_arabic || mat.name_english || '',
      material_code: mat.code,
      current_stock: parseFloat(mat.current_stock || 0),
      reorder_level: parseFloat(mat.reorder_level || 0),
      restock_quantity: mat.restock_quantity != null ? parseFloat(mat.restock_quantity) : null,
      min_order_qty: parseFloat(mat.min_order_qty || 0),
      suggested_quantity: suggestedQty,
      unit_price: unitPrice,
      total_cost: itemTotal,
      unit: mat.unit || 'kg',
      supplier_id: mat.supplier_id,
      supplier_name: mat.supplier_name,
      supplier_contact: mat.contact_person,
      supplier_email: mat.email,
      supplier_phone: mat.phone
    };
  });
}

/**
 * Check low-stock materials and auto-create requisition drafts.
 * @param {number[]|null} materialIds - Specific raw_material_ids to check, or null/empty to check all
 * @param {number} createdByUserId - User id to record as creator
 * @param {string} contextNote - Optional note prefix for the requisition notes
 * @returns {Promise<{requisition:object|null, created:boolean, message:string}>}
 */
async function checkAndCreateRequisition(materialIds, createdByUserId, contextNote = '') {
  try {
    const items = await getLowStockMaterialsWithSuggestions(materialIds);

    if (items.length === 0) {
      return { requisition: null, created: false, message: 'No materials below reorder level' };
    }

    const numRes = await query(
      "SELECT COALESCE(MAX(CAST(SUBSTRING(requisition_number FROM 5) AS INTEGER)), 0) + 1 as next_num FROM requisitions WHERE requisition_number LIKE 'REQ-%'"
    );
    const reqNumber = `REQ-${String(numRes.rows[0].next_num).padStart(5, '0')}`;

    let totalCost = 0;
    const reqResult = await query(
      `INSERT INTO requisitions (requisition_number, status, total_items, total_cost, notes, created_by)
       VALUES ($1, 'draft', $2, 0, $3, $4) RETURNING id`,
      [
        reqNumber,
        items.length,
        contextNote || 'تم الإنشاء تلقائياً بسبب انخفاض المخزون',
        createdByUserId
      ]
    );
    const reqId = reqResult.rows[0].id;

    for (const mat of items) {
      totalCost += mat.total_cost;

      await query(
        `INSERT INTO requisition_items (requisition_id, raw_material_id, suggested_quantity, unit_price, total_cost, supplier_id, supplier_name, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          reqId, mat.raw_material_id, mat.suggested_quantity, mat.unit_price, mat.total_cost,
          mat.supplier_id || null, mat.supplier_name || null,
          `المخزون الحالي: ${mat.current_stock} ${mat.unit || 'kg'} — حد إعادة الطلب: ${mat.reorder_level} ${mat.unit || 'kg'}`
        ]
      );
    }

    await query('UPDATE requisitions SET total_cost = $1 WHERE id = $2', [totalCost, reqId]);

    // Notify all owners and admins
    await query(
      `INSERT INTO notifications (user_id, type, title, message, module, created_at)
       SELECT u.id, 'warning',
         'تنبيه: مخزون منخفض — طلب احتياج تلقائي',
         $1 || ' مادة تحتاج إعادة طلب — تم إنشاء ' || $2 || ' تلقائياً',
         'inventory', NOW()
       FROM users u WHERE u.role IN ('owner', 'admin')`,
      [items.length, reqNumber]
    );

    return {
      requisition: { id: reqId, requisition_number: reqNumber, total_cost: totalCost },
      created: true,
      message: `Created ${reqNumber} with ${items.length} items`
    };
  } catch (error) {
    console.error('[AUTO-REORDER] Check failed:', error.message);
    return { requisition: null, created: false, message: error.message };
  }
}

module.exports = { getLowStockMaterialsWithSuggestions, checkAndCreateRequisition };
