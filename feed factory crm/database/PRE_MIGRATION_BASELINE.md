# Pre-Migration Baseline
# Generated: 2026-04-28T17:40:04.561Z
# Purpose: Verify data integrity after PostgreSQL migration

## JSON Files Summary
| File | Records | Key Fields | ID Format |
|------|---------|------------|-----------|
| backend/data/users.json | 6 | _id, firstName, lastName, email, phone, role, department, designation, salary, status, joinDate, documents | string (usr_*) |
| backend/data/clients.json | 4 | _id, name, nameEnglish, code, category, contactPerson, phone, email, address, city, region, paymentType, creditPeriod, creditLimit, currentCredit, blockingThreshold, status, tags, createdAt, updatedAt | string (cl_*) |
| backend/data/suppliers.json | 7 | _id, name, nameEnglish, code, category, contactPerson, phone, email, whatsappNumber, address, city, bankDetails, paymentTerms, creditLimit, currency, materialsSupplied, performanceRating, onTimeDeliveryRate, status, notes | string (sup_*) |
| backend/data/rawmaterials.json | 25 | _id, name, nameEnglish, code, category, quantity, unit, unitPrice, minimumStock, reorderLevel, status, averageCost, lastPurchasePrice, totalValue, costHistory, purchasePrices | string (rm_*) |
| backend/data/feedrecipes.json | 16 | _id, name, nameEnglish, feedType, version, status, ingredients, totalQuantityKg, totalCostPerTon, createdAt, isDefault, totalIngredientsCost, ingredientCount | string (rec_*) |
| backend/data/feedtypes.json | 16 | _id, nameArabic, nameEnglish, code, category, protein, description, packageSizes, status | string (ft_*) |
| backend/data/salesorders.json | 1 | _id, company, orderNumber, client, clientName, orderDate, deliveryDate, status, items, subtotal, vatRate, vatAmount, total, currency, paymentType, creditPeriod, dueDate, deliveryAddress, notes, createdAt, updatedAt | string (so_*) |
| backend/data/invoices.json | 1 | _id, company, invoiceNumber, salesOrder, client, clientName, issueDate, dueDate, status, items, subtotal, vatRate, vatAmount, total, paidAmount, balance, currency, notes, createdAt, updatedAt | string (inv_*) |
| backend/data/payments.json | 5 | _id, company, paymentNumber, client, order, amount, method, status, transactionDate | string (pay_*) |
| backend/data/purchaseorders.json | 1 | _id, poNumber, company, supplier, status, orderDate, deliveryDate, items, subtotal, vatRate, vatAmount, total, currency, paymentTerms, deliveryAddress, notes, whatsappSent, createdAt, updatedAt | string (po_*) |
| backend/data/grn.json | 1 | _id, grnNumber, purchaseOrder, supplier, company, receivedDate, status, items, totalAccepted, totalRejected, notes, createdAt, updatedAt | string (grn_*) |
| backend/data/productionorders.json | 3 | _id, company, productionNumber, feedType, feedTypeName, recipe, status, batchNumber, plannedDate, plannedQuantity, packageSize, totalCost, ingredients, notes | string (po_*) |
| backend/data/finishedgoods.json | 3 | _id, company, feedType, feedTypeName, packageSize, quantity, totalWeight, batchNumber, productionDate, expiryDate, productionCost, status, location | string (fg_*) |
| backend/data/stockmovements.json | 0 | none (empty array) | N/A |
| backend/data/payables.json | 7 | _id, payableNumber, type, supplier, purchaseOrder, grn, supplierInvoiceNumber, supplierInvoiceDate, amount, paidAmount, balance, dueDate, daysOutstanding, status, payments, notes | string (payable*) |
| backend/data/expenses.json | 10 | _id, expenseNumber, category, description, amount, date, paymentMethod, receiptNumber, receiptUrl, createdBy, approvedBy, approvedAt, notes | string (expense*) |
| backend/data/payrolls.json | 1 | _id, month, year, status, employeePayrolls, totalBasicSalary, totalAllowances, totalDeductions, totalGrossSalary, totalNetSalary, postedToFinance, notes | string (payroll_*) |
| backend/data/machines.json | 5 | _id, company, name, code, type, brand, model, status, location, totalHours, nextServiceDate, maintenanceSchedule, reminders, maintenanceHistory | string (mc_*) |
| backend/data/vehicles.json | 4 | _id, company, plateNumber, model, type, year, capacityKg, status, driverPhone | string (vh_*) |
| backend/data/deliveryorders.json | 6 | _id, company, deliveryNumber, order, client, deliveryAddress, scheduledDate, vehicle, status, deliveredAt, receivedBy | string (dlv_*) |
| backend/data/accounts.json | 3 | _id, company, name, type, balance, status | string (acc_*) |
| backend/data/companies.json | 1 | _id, name, nameEnglish, logo, address, addressEnglish, phone, phone2, email, website, taxNumber, commercialRegister, settings, businessHours, createdAt | string (comp_*) |

## MongoDB Summary
No MongoDB data found (MongoDB is not configured because `MONGODB_URI` is not set in backend/.env).

## PostgreSQL Current State (Before Migration)
| Table | Current Rows |
|-------|-------------|
| users | ERROR: password authentication failed |
| clients | ERROR: password authentication failed |
| suppliers | ERROR: password authentication failed |
| raw_materials | ERROR: password authentication failed |
| feed_types | ERROR: password authentication failed |
| feed_recipes | ERROR: password authentication failed |
| feed_recipe_items | ERROR: password authentication failed |
| sales_orders | ERROR: password authentication failed |
| sales_order_items | ERROR: password authentication failed |
| invoices | ERROR: password authentication failed |
| invoice_items | ERROR: password authentication failed |
| production_orders | ERROR: password authentication failed |
| production_order_items | ERROR: password authentication failed |
| inventory_transactions | ERROR: password authentication failed |
| reminders | ERROR: password authentication failed |
| client_payment_history | ERROR: password authentication failed |
| purchase_orders | ERROR: password authentication failed |
| purchase_order_items | ERROR: password authentication failed |
| goods_receipt_notes | ERROR: password authentication failed |
| grn_items | ERROR: password authentication failed |
| supplier_payables | ERROR: password authentication failed |
| supplier_payments | ERROR: password authentication failed |
| machines | ERROR: password authentication failed |
| vehicles | ERROR: password authentication failed |
| delivery_assignments | ERROR: password authentication failed |
| finished_goods | ERROR: password authentication failed |
| payroll_records | ERROR: password authentication failed |
| expenses | ERROR: password authentication failed |
| attendance_records | ERROR: password authentication failed |
| leave_requests | ERROR: password authentication failed |
| maintenance_schedules | ERROR: password authentication failed |
| notifications | ERROR: password authentication failed |
| purchase_requisitions | ERROR: password authentication failed |

## Expected Post-Migration Row Counts
| Table | Expected Rows | Source |
|-------|---------------|--------|
| users | 6 | backend/data/users.json |
| clients | 4 | backend/data/clients.json |
| suppliers | 7 | backend/data/suppliers.json |
| raw_materials | 25 | backend/data/rawmaterials.json |
| feed_types | 16 | backend/data/feedtypes.json |
| feed_recipes | 16 | backend/data/feedrecipes.json |
| feed_recipe_items | 196 | backend/data/feedrecipes.json (ingredients arrays) |
| sales_orders | 1 | backend/data/salesorders.json |
| sales_order_items | 2 | backend/data/salesorders.json (items arrays) |
| invoices | 1 | backend/data/invoices.json |
| invoice_items | 2 | backend/data/invoices.json (items arrays) |
| production_orders | 3 | backend/data/productionorders.json |
| production_order_items | 9 | backend/data/productionorders.json (ingredients arrays) |
| purchase_orders | 1 | backend/data/purchaseorders.json |
| purchase_order_items | 3 | backend/data/purchaseorders.json (items arrays) |
| goods_receipt_notes | 1 | backend/data/grn.json |
| grn_items | 3 | backend/data/grn.json (items arrays) |
| supplier_payables | 7 | backend/data/payables.json |
| supplier_payments | 3 | backend/data/payables.json (payments arrays) |
| client_payment_history | 5 | backend/data/payments.json |
| finished_goods | 3 | backend/data/finishedgoods.json |
| delivery_assignments | 6 | backend/data/deliveryorders.json |
| machines | 5 | backend/data/machines.json |
| vehicles | 4 | backend/data/vehicles.json |
| expenses | 10 | backend/data/expenses.json |
| payroll_records | 1 | backend/data/payrolls.json |
| accounts | 3 | backend/data/accounts.json |
| companies | 1 | backend/data/companies.json |

## Critical Records to Verify
- Client record: `مزارع النور للدواجن` / code `CLI-001`
- Supplier record: `مزارع القاهرة للحبوب` / code `SUP-GRAINS-001`
- Raw material: `Yellow Corn` / code `RM-CORN`
- Sales order: `SO-2026-001`
- Production order: `PRD-202603-0001` / batch `B20260320-001`
