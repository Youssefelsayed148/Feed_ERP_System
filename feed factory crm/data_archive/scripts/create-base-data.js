// Comprehensive data creation script for Al Kheir Feed Factory
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

// ========== 1. RAW MATERIALS ==========
const rawMaterials = [
  { _id: "rm_corn", name: "ذره", nameEnglish: "Yellow Corn", code: "RM-CORN", category: "grain", quantity: 50000, unit: "kg", unitPrice: 15.0, minimumStock: 5000, reorderLevel: 2000, status: "active" },
  { _id: "rm_soy", name: "صويا 46%", nameEnglish: "Soybean 46%", code: "RM-SOY", category: "protein", quantity: 25000, unit: "kg", unitPrice: 19.35, minimumStock: 3000, reorderLevel: 1000, status: "active" },
  { _id: "rm_bran", name: "رده", nameEnglish: "Bran", code: "RM-BRAN", category: "grain", quantity: 12000, unit: "kg", unitPrice: 10.8, minimumStock: 2000, reorderLevel: 800, status: "active" },
  { _id: "rm_gluten", name: "جلوتين", nameEnglish: "Gluten", code: "RM-GLUTEN", category: "protein", quantity: 8000, unit: "kg", unitPrice: 38.5, minimumStock: 1000, reorderLevel: 500, status: "active" },
  { _id: "rm_soyoil", name: "زيت صويا", nameEnglish: "Soybean Oil", code: "RM-SOYOIL", category: "oil", quantity: 300, unit: "kg", unitPrice: 50.0, minimumStock: 50, reorderLevel: 25, status: "active" },
  { _id: "rm_wheat", name: "سن", nameEnglish: "Wheat/Hay", code: "RM-WHEAT", category: "grain", quantity: 15000, unit: "kg", unitPrice: 12.0, minimumStock: 2000, reorderLevel: 800, status: "active" },
  { _id: "rm_meth", name: "ميثونين", nameEnglish: "Methionine", code: "RM-METH", category: "additive", quantity: 500, unit: "kg", unitPrice: 150.0, minimumStock: 100, reorderLevel: 50, status: "active" },
  { _id: "rm_lysi", name: "ليسين", nameEnglish: "Lysine", code: "RM-LYSI", category: "additive", quantity: 400, unit: "kg", unitPrice: 100.0, minimumStock: 100, reorderLevel: 50, status: "active" },
  { _id: "rm_mcal", name: "مونو كالسيوم", nameEnglish: "Mono Calcium", code: "RM-MCAL", category: "mineral", quantity: 3000, unit: "kg", unitPrice: 45.0, minimumStock: 500, reorderLevel: 200, status: "active" },
  { _id: "rm_lime", name: "حجر جيرى", nameEnglish: "Limestone", code: "RM-LIME", category: "mineral", quantity: 8000, unit: "kg", unitPrice: 0.6, minimumStock: 1000, reorderLevel: 500, status: "active" },
  { _id: "rm_prem", name: "بريمكس", nameEnglish: "Premix", code: "RM-PREM", category: "additive", quantity: 800, unit: "kg", unitPrice: 94.0, minimumStock: 200, reorderLevel: 100, status: "active" },
  { _id: "rm_salt", name: "ملح طعام", nameEnglish: "Salt", code: "RM-SALT", category: "mineral", quantity: 2000, unit: "kg", unitPrice: 1.8, minimumStock: 500, reorderLevel: 200, status: "active" },
  { _id: "rm_sod", name: "بيكربونات صوديوم", nameEnglish: "Sodium Bicarbonate", code: "RM-SOD", category: "additive", quantity: 600, unit: "kg", unitPrice: 26.0, minimumStock: 100, reorderLevel: 50, status: "active" },
  { _id: "rm_ads", name: "اندسورب", nameEnglish: "Adsorbent", code: "RM-ADS", category: "additive", quantity: 400, unit: "kg", unitPrice: 20.0, minimumStock: 100, reorderLevel: 50, status: "active" },
  { _id: "rm_myc", name: "مضاد سموم بولجى", nameEnglish: "Mycotoxin Binder", code: "RM-MYC", category: "additive", quantity: 200, unit: "kg", unitPrice: 200.0, minimumStock: 50, reorderLevel: 25, status: "active" },
  { _id: "rm_thre", name: "ثيريونين", nameEnglish: "Threonine", code: "RM-THRE", category: "additive", quantity: 300, unit: "kg", unitPrice: 95.0, minimumStock: 50, reorderLevel: 25, status: "active" },
  { _id: "rm_fat", name: "مستحلب دهون", nameEnglish: "Fat Emulsion", code: "RM-FAT", category: "oil", quantity: 250, unit: "kg", unitPrice: 290.0, minimumStock: 50, reorderLevel: 25, status: "active" },
  { _id: "rm_madu", name: "مديورا مايسين", nameEnglish: "Maduramicin", code: "RM-MADU", category: "additive", quantity: 150, unit: "kg", unitPrice: 80.0, minimumStock: 50, reorderLevel: 25, status: "active" },
  { _id: "rm_trac", name: "تراى اند بوت 3", nameEnglish: "Trace Elements", code: "RM-TRAC", category: "mineral", quantity: 200, unit: "kg", unitPrice: 265.0, minimumStock: 50, reorderLevel: 25, status: "active" },
  { _id: "rm_phyt", name: "انزيم فايتيز", nameEnglish: "Phytase Enzyme", code: "RM-PHYT", category: "enzyme", quantity: 100, unit: "kg", unitPrice: 400.0, minimumStock: 25, reorderLevel: 10, status: "active" },
  { _id: "rm_beta", name: "بيتاين", nameEnglish: "Betaine", code: "RM-BETA", category: "additive", quantity: 200, unit: "kg", unitPrice: 75.0, minimumStock: 50, reorderLevel: 25, status: "active" },
  { _id: "rm_protz", name: "سيبنزا انزيم بروتيز", nameEnglish: "Protease Enzyme", code: "RM-PROTZ", category: "enzyme", quantity: 80, unit: "kg", unitPrice: 450.0, minimumStock: 20, reorderLevel: 10, status: "active" },
  { _id: "rm_enz", name: "انزيم طاقه", nameEnglish: "Energy Enzyme", code: "RM-ENZ", category: "enzyme", quantity: 150, unit: "kg", unitPrice: 200.0, minimumStock: 50, reorderLevel: 25, status: "active" },
  { _id: "rm_biod", name: "بيودى", nameEnglish: "Biocide", code: "RM-BIOD", category: "additive", quantity: 80, unit: "kg", unitPrice: 450.0, minimumStock: 20, reorderLevel: 10, status: "active" },
  { _id: "rm_bags", name: "شكاير", nameEnglish: "Bags", code: "RM-BAGS", category: "packaging", quantity: 5000, unit: "unit", unitPrice: 13.0, minimumStock: 1000, reorderLevel: 500, status: "active" }
];

saveData('rawmaterials', rawMaterials);

// ========== 2. SUPPLIERS WITH MATERIALS ==========
const suppliers = [
  {
    _id: "sup_grains",
    name: "مزارع القاهرة للحبوب",
    nameEnglish: "Cairo Grain Farms",
    code: "SUP-GRAINS-001",
    category: "grain",
    contactPerson: "أحمد حسن",
    phone: "+20 2 2396 2451",
    email: "sales@egyptiangrain.com",
    whatsappNumber: "+20 10 1234 5678",
    address: "المنطقة الصناعية، طريق القاهرة الإسكندرية الزراعي",
    city: "القاهرة",
    bankDetails: { accountName: "مزارع القاهرة للحبوب", accountNumber: "1234567890", iban: "EG32000200012345678901234567890", bankName: "البنك الأهلي المصري", branch: "القاهرة الرئيسي" },
    paymentTerms: "30 يوم",
    creditLimit: 500000,
    currency: "EGP",
    materialsSupplied: ["rm_corn", "rm_wheat", "rm_bran"],
    performanceRating: 4,
    onTimeDeliveryRate: 92,
    status: "active",
    notes: "مورد أساسي للذرة والردة والسن. مورد محلي موثوق به مع ضبط جودة جيد."
  },
  {
    _id: "sup_protein",
    name: "موردي بروتين النيل",
    nameEnglish: "Nile Protein Suppliers",
    code: "SUP-PROTEIN-002",
    category: "protein",
    contactPerson: "محمد السيد",
    phone: "+20 3 4875 1234",
    email: "orders@nileprotein.eg",
    whatsappNumber: "+20 12 3456 7890",
    address: "٤٢ المنطقة الصناعية، برج العرب",
    city: "الإسكندرية",
    bankDetails: { accountName: "موردي بروتين النيل", accountNumber: "9876543210", iban: "EG32000300098765432109876543210", bankName: "بنك مصر", branch: "الإسكندرية الصناعية" },
    paymentTerms: "15 يوم",
    creditLimit: 750000,
    currency: "EGP",
    materialsSupplied: ["rm_soy", "rm_gluten"],
    performanceRating: 5,
    onTimeDeliveryRate: 98,
    status: "active",
    notes: "مورد بروتين متميز. أفضل جودة صويا 46% وجلوتين في مصر."
  },
  {
    _id: "sup_additives",
    name: "إضافات القاهرة المحدودة",
    nameEnglish: "Cairo Additives Ltd",
    code: "SUP-ADD-003",
    category: "additive",
    contactPerson: "فاطمة إبراهيم",
    phone: "+20 2 2274 8910",
    email: "supply@cairoadditives.com",
    whatsappNumber: "+20 11 9876 5432",
    address: "٧٨ شارع التحرير، الدقي",
    city: "الجيزة",
    bankDetails: { accountName: "إضافات القاهرة المحدودة", accountNumber: "5555666677", iban: "EG32000400055556666775555666677", bankName: "البنك التجاري الدولي", branch: "الدقي" },
    paymentTerms: "45 يوم",
    creditLimit: 300000,
    currency: "EGP",
    materialsSupplied: ["rm_meth", "rm_lysi", "rm_prem", "rm_salt", "rm_sod", "rm_ads", "rm_myc", "rm_thre", "rm_madu", "rm_beta", "rm_biod"],
    performanceRating: 4,
    onTimeDeliveryRate: 94,
    status: "active",
    notes: "متخصص في البريمكس والفيتامينات والمعادن والإضافات للعلف الحيواني. استيراد من أوروبا."
  },
  {
    _id: "sup_minerals",
    name: "معادن الدلتا",
    nameEnglish: "Delta Minerals",
    code: "SUP-MIN-004",
    category: "mineral",
    contactPerson: "كريم مصطفى",
    phone: "+20 50 2345 6789",
    email: "info@deltaminerals.eg",
    whatsappNumber: "+20 10 8765 4321",
    address: "١٢٥ شارع النيل، المنصورة",
    city: "الدقهلية",
    bankDetails: { accountName: "معادن الدلتا", accountNumber: "1111222233", iban: "EG32000500011112222331111222233", bankName: "البنك الزراعي المصري", branch: "المنصورة" },
    paymentTerms: "30 يوم",
    creditLimit: 200000,
    currency: "EGP",
    materialsSupplied: ["rm_mcal", "rm_lime", "rm_trac"],
    performanceRating: 3,
    onTimeDeliveryRate: 88,
    status: "active",
    notes: "مورد مونو كالسيوم وحجر جيري ومعادن نادرة."
  },
  {
    _id: "sup_oils",
    name: "زيوت السويس",
    nameEnglish: "Suez Oils",
    code: "SUP-OIL-005",
    category: "oil",
    contactPerson: "سمير محمود",
    phone: "+20 3 4928 7654",
    email: "sales@suezoils.com",
    whatsappNumber: "+20 12 0987 6543",
    address: "٨٠ المنطقة الصناعية، السويس",
    city: "السويس",
    bankDetails: { accountName: "زيوت السويس", accountNumber: "7777888899", iban: "EG32000600077778888997777888899", bankName: "البنك العربي الأفريقي الدولي", branch: "السويس" },
    paymentTerms: "60 يوم",
    creditLimit: 1000000,
    currency: "EGP",
    materialsSupplied: ["rm_soyoil", "rm_fat"],
    performanceRating: 4,
    onTimeDeliveryRate: 90,
    status: "active",
    notes: "مورد زيوت صويا ومستحلبات دهون للعلف. جودة عالية."
  },
  {
    _id: "sup_enzymes",
    name: "إنزيمات مصر",
    nameEnglish: "Egypt Enzymes",
    code: "SUP-ENZ-006",
    category: "enzyme",
    contactPerson: "نور الدين",
    phone: "+20 95 2278 3456",
    email: "export@egyptenzymes.com",
    whatsappNumber: "+20 10 1122 3344",
    address: "٥٥ المنطقة الصناعية، طيبة الجديدة",
    city: "الأقصر",
    bankDetails: { accountName: "إنزيمات مصر", accountNumber: "3333444455", iban: "EG32000700033334444553333444455", bankName: "بنك قطر الوطني مصر", branch: "الأقصر" },
    paymentTerms: "30 يوم",
    creditLimit: 400000,
    currency: "EGP",
    materialsSupplied: ["rm_phyt", "rm_protz", "rm_enz"],
    performanceRating: 3,
    onTimeDeliveryRate: 85,
    status: "active",
    notes: "مورد الإنزيمات بما في ذلك إنزيم فايتيز والإنزيمات البروتينية والطاقة."
  },
  {
    _id: "sup_packaging",
    name: "دلتا للتعبئة والتغليف",
    nameEnglish: "Delta Packaging",
    code: "SUP-PACK-007",
    category: "packaging",
    contactPerson: "يوسف أحمد",
    phone: "+20 50 8765 4321",
    email: "orders@deltapack.eg",
    whatsappNumber: "+20 10 5678 1234",
    address: "٣٠ المنطقة الصناعية الثانية، المنصورة",
    city: "الدقهلية",
    bankDetails: { accountName: "دلتا للتعبئة والتغليف", accountNumber: "9999000011", iban: "EG32000800099990000119999000011", bankName: "البنك المصري لتنمية الصادرات", branch: "المنصورة" },
    paymentTerms: "30 يوم",
    creditLimit: 150000,
    currency: "EGP",
    materialsSupplied: ["rm_bags"],
    performanceRating: 4,
    onTimeDeliveryRate: 95,
    status: "active",
    notes: "مورد شكاير بولي بروبلين للتعبئة. جودة ممتازة وأسعار تنافسية."
  }
];

saveData('suppliers', suppliers);

console.log('\n✅ Step 1 & 2 Complete: Raw materials and suppliers created');
console.log(`- ${rawMaterials.length} raw materials with stock quantities`);
console.log(`- ${suppliers.length} suppliers with material assignments`);