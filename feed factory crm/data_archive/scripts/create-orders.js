// Create Purchase Order and Sales Order with Invoice
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');

function loadData(filename) {
  const file = path.join(DATA_DIR, `${filename}.json`);
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
  } catch (e) {
    console.error(`Error loading ${filename}:`, e.message);
  }
  return [];
}

function saveData(filename, data) {
  const file = path.join(DATA_DIR, `${filename}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Saved ${filename}.json with ${data.length} items`);
}

// ========== 4. CREATE PURCHASE ORDER ==========
const purchaseOrders = [
  {
    _id: "po_001",
    poNumber: "PO-2026-001",
    company: "comp_1774737863573",
    supplier: "sup_grains",
    status: "approved",
    orderDate: "2026-03-15",
    deliveryDate: "2026-03-25",
    items: [
      {
        material: "rm_corn",
        materialName: "ذره",
        quantity: 10000,
        unit: "kg",
        unitPrice: 15.0,
        total: 150000,
        receivedQty: 0,
        notes: "جودة ممتازة - درجة أولى"
      },
      {
        material: "rm_wheat",
        materialName: "سن",
        quantity: 5000,
        unit: "kg",
        unitPrice: 12.0,
        total: 60000,
        receivedQty: 0,
        notes: "للعلف البياض"
      },
      {
        material: "rm_bran",
        materialName: "رده",
        quantity: 3000,
        unit: "kg",
        unitPrice: 10.8,
        total: 32400,
        receivedQty: 0,
        notes: "ردة ناعمة"
      }
    ],
    subtotal: 242400,
    vatRate: 14,
    vatAmount: 33936,
    total: 276336,
    currency: "EGP",
    paymentTerms: "30 يوم",
    deliveryAddress: "المنطقة الصناعية، مدينة العبور، القاهرة",
    notes: "طلبية عاجلة لخط الإنتاج الأول",
    whatsappSent: true,
    createdAt: "2026-03-15",
    updatedAt: "2026-03-15"
  }
];

// ========== 5. CREATE GRN (Goods Receipt Note) ==========
const grnData = [
  {
    _id: "grn_001",
    grnNumber: "GRN-2026-001",
    purchaseOrder: "po_001",
    supplier: "sup_grains",
    company: "comp_1774737863573",
    receivedDate: "2026-03-25",
    status: "approved",
    items: [
      {
        material: "rm_corn",
        materialName: "ذره",
        orderedQty: 10000,
        receivedQty: 10000,
        acceptedQty: 9950,
        rejectedQty: 50,
        rejectionReason: "تلف جزئي - رطوبة في 5 أكياس",
        unitPrice: 15.0,
        batchNumber: "B20260325-CORN",
        expiryDate: "2027-03-25"
      },
      {
        material: "rm_wheat",
        materialName: "سن",
        orderedQty: 5000,
        receivedQty: 5000,
        acceptedQty: 5000,
        rejectedQty: 0,
        rejectionReason: "",
        unitPrice: 12.0,
        batchNumber: "B20260325-WHEAT",
        expiryDate: "2027-03-25"
      },
      {
        material: "rm_bran",
        materialName: "رده",
        orderedQty: 3000,
        receivedQty: 3000,
        acceptedQty: 2980,
        rejectedQty: 20,
        rejectionReason: "شوائب",
        unitPrice: 10.8,
        batchNumber: "B20260325-BRAN",
        expiryDate: "2027-03-25"
      }
    ],
    totalAccepted: 17930,
    totalRejected: 70,
    notes: "استلام جيد بشكل عام. الجودة مقبولة.",
    createdAt: "2026-03-25",
    updatedAt: "2026-03-25"
  }
];

// ========== 6. CREATE CLIENT ==========
const clients = [
  {
    _id: "cl_001",
    name: "مزارع النور للدواجن",
    nameEnglish: "Al Noor Poultry Farms",
    code: "CLI-001",
    category: "farm",
    contactPerson: "محمد النور",
    phone: "+20 10 1234 5678",
    email: "manager@alnoor-farms.com",
    address: "المنطقة الصناعية، مدينة العبور",
    city: "القاهرة",
    region: "القليوبية",
    paymentType: "credit",
    creditPeriod: 30,
    creditLimit: 100000,
    currentCredit: 25000,
    blockingThreshold: 80,
    status: "active",
    tags: ["poultry", "broiler"],
    createdAt: "2026-01-15"
  }
];

// ========== 7. CREATE SALES ORDER ==========
const salesOrders = [
  {
    _id: "so_001",
    company: "comp_1774737863573",
    orderNumber: "SO-2026-001",
    client: "cl_001",
    clientName: "مزارع النور للدواجن",
    orderDate: "2026-03-20",
    deliveryDate: "2026-03-27",
    status: "delivered",
    items: [
      {
        feedType: "ft1",
        feedTypeName: "علف سوبر بادى 23%",
        packageSize: 50,
        quantity: 100,
        unitPrice: 20963.98,
        totalPrice: 2096398,
        productionBatch: "B20260320-001"
      },
      {
        feedType: "ft2",
        feedTypeName: "علف سوبر نامى 21%",
        packageSize: 50,
        quantity: 50,
        unitPrice: 20775.32,
        totalPrice: 1038766,
        productionBatch: "B20260320-002"
      }
    ],
    subtotal: 3135164,
    vatRate: 14,
    vatAmount: 438923,
    total: 3574087,
    currency: "EGP",
    paymentType: "credit",
    creditPeriod: 30,
    dueDate: "2026-04-20",
    deliveryAddress: "مزارع النور، المنطقة الصناعية، العبور",
    notes: "توصيل سريع - أولوية عالية",
    createdAt: "2026-03-20",
    updatedAt: "2026-03-27"
  }
];

// ========== 8. CREATE INVOICE ==========
const invoices = [
  {
    _id: "inv_001",
    company: "comp_1774737863573",
    invoiceNumber: "INV-2026-001",
    salesOrder: "so_001",
    client: "cl_001",
    clientName: "مزارع النور للدواجن",
    issueDate: "2026-03-27",
    dueDate: "2026-04-27",
    status: "partial",
    items: [
      {
        feedType: "ft1",
        feedTypeName: "علف سوبر بادى 23%",
        description: "50 كجم × 100 كيس",
        quantity: 100,
        unitPrice: 20963.98,
        total: 2096398
      },
      {
        feedType: "ft2",
        feedTypeName: "علف سوبر نامى 21%",
        description: "50 كجم × 50 كيس",
        quantity: 50,
        unitPrice: 20775.32,
        total: 1038766
      }
    ],
    subtotal: 3135164,
    vatRate: 14,
    vatAmount: 438923,
    total: 3574087,
    paidAmount: 1000000,
    balance: 2574087,
    currency: "EGP",
    notes: "فاتورة أولى - بقية المبلغ خلال 30 يوم",
    createdAt: "2026-03-27",
    updatedAt: "2026-03-27"
  }
];

// ========== 9. CREATE FINISHED GOODS INVENTORY ==========
const finishedGoods = [
  {
    _id: "fg_001",
    company: "comp_1774737863573",
    feedType: "ft1",
    feedTypeName: "علف سوبر بادى 23%",
    packageSize: 50,
    quantity: 500,
    totalWeight: 25000,
    batchNumber: "B20260320-001",
    productionDate: "2026-03-20",
    expiryDate: "2026-09-20",
    productionCost: 18194.77,
    status: "available",
    location: "مستودع رئيسي - رف A1"
  },
  {
    _id: "fg_002",
    company: "comp_1774737863573",
    feedType: "ft2",
    feedTypeName: "علف سوبر نامى 21%",
    packageSize: 50,
    quantity: 300,
    totalWeight: 15000,
    batchNumber: "B20260320-002",
    productionDate: "2026-03-20",
    expiryDate: "2026-09-20",
    productionCost: 18030.80,
    status: "available",
    location: "مستودع رئيسي - رف A2"
  },
  {
    _id: "fg_003",
    company: "comp_1774737863573",
    feedType: "ft3",
    feedTypeName: "علف سوبر ناهى 19%",
    packageSize: 50,
    quantity: 200,
    totalWeight: 10000,
    batchNumber: "B20260320-003",
    productionDate: "2026-03-20",
    expiryDate: "2026-09-20",
    productionCost: 17683.65,
    status: "available",
    location: "مستودع رئيسي - رف A3"
  }
];

// Save all data
saveData('purchaseorders', purchaseOrders);
saveData('grn', grnData);
saveData('clients', clients);
saveData('salesorders', salesOrders);
saveData('invoices', invoices);
saveData('finishedgoods', finishedGoods);

console.log('\n✅ Steps 4-9 Complete: Orders and transactions created');
console.log(`- ${purchaseOrders.length} purchase order from مزارع القاهرة للحبوب`);
console.log(`- ${grnData.length} GRN with material receipts`);
console.log(`- ${clients.length} client (مزارع النور)`);
console.log(`- ${salesOrders.length} sales order`);
console.log(`- ${invoices.length} invoice`);
console.log(`- ${finishedGoods.length} finished goods in inventory`);
console.log('\n🎉 ALL DATA CREATED SUCCESSFULLY!');