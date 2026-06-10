# Suppliers and Auto-PO System

## Overview

The **Suppliers and Auto-PO System** is a comprehensive purchase order automation solution integrated into the Feed Factory CRM. It automates the entire procurement workflow from stock monitoring to supplier notification.

## Features

### 1. Enhanced Suppliers Module

#### Location
`frontend/src/pages/Suppliers.js`

#### Features:
- **Enhanced Supplier Form**
  - Multi-select "Materials Supplied" with auto-suggest from existing raw materials
  - Removable material tags
  - Materials array stored in supplier record
  
- **Supplier-Material Link**
  - Link suppliers to raw materials they provide
  - Show supplier list on raw material detail view
  - "Order from Supplier" button on materials
  
- **Supplier Performance Metrics**
  - Rating system (1-5 stars)
  - On-time delivery rate tracking
  - Quality rating tracking
  - Performance metrics display in supplier list
  - Total orders and spend tracking

#### Usage:
1. Navigate to **Suppliers** page
2. Click **Add Supplier** to create a new supplier
3. Fill in supplier details including contact, banking info, and materials supplied
4. Set performance ratings (optional)
5. Save the supplier
6. View supplier details to see linked materials and performance history

### 2. Auto-PO System

#### Location
`frontend/src/components/AutoPO.js`

#### Features:

##### A. Low Stock Monitoring
- Real-time monitoring of raw materials against minimum stock levels
- Visual alerts when stock falls below minimum threshold
- Stock level percentage indicators
- Priority classification (high/medium/low)

##### B. Auto-PO Generation
When stock hits low threshold, the system automatically:
- Creates a Purchase Requisition (PR)
- Suggests suppliers based on past purchases and material links
- Calculates recommended quantity based on reorder level
- Estimates total cost
- Shows notification to Inventory Manager

##### C. PO Approval Workflow
- **Pending Review**: Inventory Manager reviews PR
- **Editable**: Can edit quantity and select supplier
- **Approve/Reject**: With reason for rejection
- **Audit Trail**: Tracks who approved and when

##### D. PO Integration
Once approved, the system auto-creates:
- Inventory entry (on order status)
- Payable record for payment tracking
- Supplier notification (email/WhatsApp)
- Links to: Inventory, Payables, Supplier

##### E. Auto-PO Settings
Per-material configuration:
- Enable/disable auto-PO for each material
- Set custom minimum stock thresholds
- Set reorder levels and reorder quantities
- Configure preferred suppliers
- Set approval requirements

#### Usage:

1. **Access Auto-PO**
   - Navigate to **Auto-PO** section from sidebar or dashboard widget

2. **Configure Settings**
   - Click **Auto-PO Settings** tab
   - For each material, click **Configure**
   - Enable/disable auto-PO
   - Set stock thresholds and reorder quantities
   - Select preferred supplier
   - Save settings

3. **Monitor Low Stock**
   - View **Low Stock Alerts** tab for materials below threshold
   - Visual indicators show stock levels
   - Click **Create PR** to manually create a requisition

4. **Approve Requisitions**
   - View **Purchase Requisitions** tab
   - Review auto-generated and manual PRs
   - Click **Review & Approve** on pending PRs
   - Edit quantity and select supplier if needed
   - Approve to create Purchase Order or reject with reason

5. **Track Purchase Orders**
   - View **Purchase Orders** tab
   - See all approved POs
   - Send WhatsApp notification to supplier
   - Print or download PO PDF

### 3. Dashboard Widget

#### Location
`frontend/src/components/AutoPODashboardWidget.js`

#### Features:
- Real-time low stock alerts on dashboard
- Pending PR notifications
- One-click access to Auto-PO system
- Auto-refresh every 5 minutes
- Collapsible view

#### Integration:
Add to your Dashboard component:
```jsx
import AutoPODashboardWidget from '../components/AutoPODashboardWidget';

// In your Dashboard render:
<AutoPODashboardWidget onNavigate={(page, params) => {
  // Handle navigation to Auto-PO page
  navigate(`/auto-po`, { state: params });
}} />
```

## API Integration

### Required Endpoints

#### Inventory
- `GET /api/inventory/raw-materials` - Get all raw materials with stock levels
- `GET /api/inventory/raw-materials/low-stock` - Get materials below minimum stock
- `PUT /api/inventory/raw-materials/:id/settings` - Update material auto-PO settings

#### Suppliers
- `GET /api/suppliers` - Get all suppliers
- `POST /api/suppliers` - Create new supplier
- `PUT /api/suppliers/:id` - Update supplier
- `DELETE /api/suppliers/:id` - Delete supplier
- `PUT /api/suppliers/:id/performance` - Update supplier performance

#### Purchase Requisitions
- `GET /api/purchase-requisitions` - Get all PRs
- `POST /api/purchase-requisitions` - Create PR
- `PUT /api/purchase-requisitions/:id/approve` - Approve PR
- `PUT /api/purchase-requisitions/:id/reject` - Reject PR
- `GET /api/purchase-requisitions/stats` - Get PR statistics

#### Purchase Orders
- `GET /api/purchase-orders` - Get all POs
- `POST /api/purchase-orders` - Create PO
- `PUT /api/purchase-orders/:id/status` - Update PO status
- `POST /api/purchase-orders/:id/send-whatsapp` - Send WhatsApp notification

#### Payables
- `GET /api/payables` - Get all payables
- `POST /api/payables` - Create payable from PO

## Database Schema

### Suppliers Collection
```javascript
{
  _id: ObjectId,
  name: String,
  code: String,
  contactPerson: String,
  phone: String,
  whatsapp: String,
  email: String,
  address: String,
  bankName: String,
  bankAccount: String,
  taxId: String,
  paymentTerms: String,
  leadTime: Number, // days
  materials: [String], // array of material names
  rating: Number, // 1-5
  onTimeDelivery: Number, // percentage
  qualityRating: Number, // 1-5
  totalOrders: Number,
  totalSpend: Number,
  status: String, // active, inactive, blacklisted
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Raw Materials Collection (Additional Fields)
```javascript
{
  // ... existing fields
  autoPOEnabled: Boolean,
  reorderLevel: Number,
  reorderQuantity: Number,
  preferredSupplier: String, // supplier ID or name
}
```

### Purchase Requisitions Collection
```javascript
{
  _id: ObjectId,
  prNumber: String,
  materialId: ObjectId,
  materialName: String,
  materialCode: String,
  currentStock: Number,
  minimumStock: Number,
  unit: String,
  quantity: Number,
  unitCost: Number,
  totalCost: Number,
  supplierId: ObjectId,
  suggestedSuppliers: [String],
  status: String, // pending, approved, rejected
  priority: String, // low, medium, high
  isAutoGenerated: Boolean,
  notes: String,
  rejectionReason: String,
  createdBy: String,
  approvedBy: String,
  approvedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Purchase Orders Collection
```javascript
{
  _id: ObjectId,
  poNumber: String,
  prId: ObjectId,
  prNumber: String,
  supplierId: ObjectId,
  supplier: {
    name: String,
    whatsapp: String,
    email: String
  },
  items: [{
    material: String,
    quantity: Number,
    unit: String,
    unitPrice: Number,
    total: Number
  }],
  subtotal: Number,
  vat: Number,
  total: Number,
  deliveryDate: Date,
  status: String, // draft, pending_approval, approved, ordered, received
  notes: String,
  approvedBy: String,
  approvedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## Workflow

### 1. Automatic Workflow (Auto-PO Enabled)
```
Stock Check → Low Stock Detected → Auto PR Created → Notification Sent → Manager Reviews → Approves → PO Created → Inventory Updated → Payable Created → Supplier Notified
```

### 2. Manual Workflow (Auto-PO Disabled)
```
Manager Notices Low Stock → Creates Manual PR → Reviews → Approves → PO Created → Inventory Updated → Payable Created → Supplier Notified
```

### 3. Approval Workflow
```
PR Created (Pending) → Manager Reviews → Can Edit Quantity/Supplier → Approve (Becomes PO) / Reject (With Reason)
```

## Configuration

### Environment Variables
```bash
# API URL
REACT_APP_API_URL=http://localhost:5000/api

# WhatsApp Integration (optional)
REACT_APP_WHATSAPP_ENABLED=true
```

### Auto-PO Settings Per Material
- **Auto-PO Enabled**: Toggle automatic PR generation
- **Minimum Stock**: Alert threshold
- **Reorder Level**: Trigger threshold for PR creation
- **Reorder Quantity**: Default quantity to order
- **Preferred Supplier**: Primary supplier suggestion

## Notifications

The system generates the following notifications:

1. **Low Stock Alert**: When material stock ≤ minimum stock
2. **New PR Created**: When auto-PR is generated
3. **PR Pending Approval**: Sent to inventory managers
4. **PO Approved**: Confirmation to relevant parties
5. **Supplier Notification**: WhatsApp/email to supplier

## Best Practices

1. **Set Realistic Thresholds**: 
   - Minimum stock: Safety buffer
   - Reorder level: Typically 150% of minimum
   - Reorder quantity: Based on usage patterns

2. **Link Suppliers to Materials**:
   - Keep supplier material lists updated
   - Rate suppliers based on performance
   - Set preferred suppliers for each material

3. **Regular Review**:
   - Review pending PRs daily
   - Check supplier performance monthly
   - Adjust thresholds based on demand changes

4. **Integration**:
   - Enable WhatsApp for quick supplier communication
   - Link payables to finance system
   - Update inventory on GRN receipt

## Troubleshooting

### Common Issues

**1. Auto-PO Not Generating PRs**
- Check if auto-PO is enabled for the material
- Verify reorder level is set correctly
- Ensure material stock is below reorder level
- Check if PR already exists for this material

**2. Suppliers Not Showing**
- Verify suppliers are linked to materials
- Check supplier status is "active"
- Ensure supplier has required contact info

**3. WhatsApp Notifications Not Working**
- Verify WhatsApp number format (include country code)
- Check if WhatsApp is installed on device
- Ensure browser allows popups

**4. PR Approval Not Creating PO**
- Check if supplier is selected
- Verify all required fields are filled
- Check browser console for errors

## Support

For issues or questions:
1. Check browser console for error messages
2. Verify API endpoints are responding
3. Check user permissions
4. Review this documentation

## Future Enhancements

- Email notifications for PRs/POs
- Supplier portal for PO viewing
- Advanced analytics and reporting
- Multi-level approval workflow
- Purchase order templates
- Automated GRN creation on delivery
- Supplier scorecards and ranking
- Bulk PR creation
- Forecasting based on production schedules
