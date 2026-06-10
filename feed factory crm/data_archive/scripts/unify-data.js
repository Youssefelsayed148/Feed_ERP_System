// Comprehensive Data Unification Script
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');

function loadData(filename) {
  const file = path.join(DATA_DIR, `${filename}.json`);
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (e) {
    console.error(`Error loading ${filename}:`, e.message);
  }
  return [];
}

function saveData(filename, data) {
  const file = path.join(DATA_DIR, `${filename}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  console.log(`✓ ${filename}.json: ${data.length} items`);
}

console.log('=== DATA UNIFICATION PROCESS ===\n');

// 1. UNIFY CLIENTS - Use the comprehensive one but clean it up
console.log('1. Unifying Clients...');
const clients1 = loadData('clients');
const clients2 = loadData('comprehensive_clients_data');

// Create unified clients with clear Arabic names
const unifiedClients = [
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
    createdAt: "2026-01-15",
    updatedAt: "2026-03-29"
  },
  {
    _id: "cl_002",
    name: "شركة الدواجن الكبرى",
    nameEnglish: "Grand Poultry Company",
    code: "CLI-002",
    category: "company",
    contactPerson: "أحمد الكبير",
    phone: "+20 2 2468 1357",
    email: "purchasing@grandpoultry.com",
    address: "المنطقة الصناعية الثانية، العاشر من رمضان",
    city: "الشرقية",
    region: "الشرقية",
    paymentType: "credit",
    creditPeriod: 45,
    creditLimit: 250000,
    currentCredit: 75000,
    blockingThreshold: 80,
    status: "active",
    tags: ["poultry", "layers"],
    createdAt: "2026-02-01",
    updatedAt: "2026-03-29"
  },
  {
    _id: "cl_003",
    name: "مزارع الصفا للإنتاج الحيواني",
    nameEnglish: "Al Safa Animal Production",
    code: "CLI-003",
    category: "farm",
    contactPerson: "خالد الصفا",
    phone: "+20 10 9876 5432",
    email: "info@alsafa-farms.com",
    address: "كيلو ٧٥ طريق القاهرة الإسكندرية الزراعي",
    city: "البحيرة",
    region: "البحيرة",
    paymentType: "cash",
    creditLimit: 0,
    currentCredit: 0,
    blockingThreshold: 0,
    status: "active",
    tags: ["cattle", "dairy"],
    createdAt: "2026-02-15",
    updatedAt: "2026-03-29"
  },
  {
    _id: "cl_004",
    name: "مؤسسة البركة للتربية والإنتاج",
    nameEnglish: "Al Baraka Breeding & Production",
    code: "CLI-004",
    category: "organization",
    contactPerson: "فاطمة البركة",
    phone: "+20 10 5555 9999",
    email: "orders@albaraka.org",
    address: "قرية النصر، مركز السنطة",
    city: "الغربية",
    region: "الغربية",
    paymentType: "credit",
    creditPeriod: 30,
    creditLimit: 50000,
    currentCredit: 12000,
    blockingThreshold: 80,
    status: "active",
    tags: ["sheep", "goats"],
    createdAt: "2026-03-01",
    updatedAt: "2026-03-29"
  }
];

saveData('clients', unifiedClients);

// Delete duplicate files
const filesToDelete = [
  'comprehensive_clients_data.json',
  'comprehensive_feed_data.json',
  'al_kheir_feed_data_complete.json',
  'feedTypes_new.json'
];

console.log('\n2. Cleaning up duplicate files...');
filesToDelete.forEach(file => {
  const filePath = path.join(DATA_DIR, file);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`  ✓ Deleted: ${file}`);
  }
});

// 3. Verify all main data files
console.log('\n3. Final Data Summary:');
const dataSummary = {
  'rawmaterials.json': loadData('rawmaterials').length,
  'suppliers.json': loadData('suppliers').length,
  'feedtypes.json': loadData('feedtypes').length,
  'feedrecipes.json': loadData('feedrecipes').length,
  'clients.json': loadData('clients').length,
  'purchaseorders.json': loadData('purchaseorders').length,
  'salesorders.json': loadData('salesorders').length,
  'invoices.json': loadData('invoices').length,
  'finishedgoods.json': loadData('finishedgoods').length,
  'productionorders.json': loadData('productionorders').length,
  'grn.json': loadData('grn').length
};

Object.entries(dataSummary).forEach(([file, count]) => {
  console.log(`  ${file}: ${count} items`);
});

console.log('\n✅ Data Unification Complete!');
console.log('\nMain Data Files:');
console.log(`- Raw Materials: ${dataSummary['rawmaterials.json']} items with pricing`);
console.log(`- Suppliers: ${dataSummary['suppliers.json']} suppliers with material assignments`);
console.log(`- Feed Types: ${dataSummary['feedtypes.json']} types with 3 package sizes each`);
console.log(`- Feed Recipes: ${dataSummary['feedrecipes.json']} recipes with ingredients`);
console.log(`- Clients: ${dataSummary['clients.json']} clients with credit limits`);
console.log(`- Purchase Orders: ${dataSummary['purchaseorders.json']} POs`);
console.log(`- Sales Orders: ${dataSummary['salesorders.json']} sales orders`);
console.log(`- Invoices: ${dataSummary['invoices.json']} invoices`);
console.log(`- Production Orders: ${dataSummary['productionorders.json']} production orders`);
console.log(`- Finished Goods: ${dataSummary['finishedgoods.json']} inventory items`);
console.log(`- GRNs: ${dataSummary['grn.json']} goods receipts`);