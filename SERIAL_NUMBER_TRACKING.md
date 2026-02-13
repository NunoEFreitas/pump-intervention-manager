# Serial Number Tracking Implementation Guide

## ✅ Completed Changes

### 1. Database Schema Updates (`prisma/schema.prisma`)

**New Fields Added to `WarehouseItem`:**
- `tracksSerialNumbers` (Boolean) - Indicates if this item type uses serial number tracking
- `serialNumbers` relation - Links to individual serial numbers

**New Models Created:**

#### `SerialNumberStock`
Tracks individual serial numbers for items:
- `serialNumber` - The actual serial number (unique per item)
- `location` - Where the SN is (MAIN_WAREHOUSE, TECHNICIAN, USED)
- `technicianId` - Which technician has it (if applicable)
- `status` - AVAILABLE, IN_USE, DAMAGED, LOST

#### `MovementSerialNumber`
Join table linking movements to specific serial numbers moved

**New Enums:**
- `StockLocation` - MAIN_WAREHOUSE, TECHNICIAN, USED
- `SerialStatus` - AVAILABLE, IN_USE, DAMAGED, LOST

### 2. Database Migration
✅ Migration created and applied: `20260213150103_add_serial_number_tracking`

### 3. Translation Keys Added
All three languages (EN, ES, PT) now have:
- `tracksSerialNumbers`, `serialNumberTracking`, `serialNumberRequired`
- `enterSerialNumbers`, `serialNumbersHelp`, `selectSerialNumbers`
- `availableSerialNumbers`, `selectedSerialNumbers`
- `noSerialNumbersAvailable`, `serialNumbersToMove`, `bulkItem`

---

## 🚧 Implementation Required

### Phase 1: Item Creation/Edit (Update warehouse forms)

#### A. Update `warehouse/new/page.tsx`
Add checkbox to enable serial number tracking:
```tsx
<div>
  <label className="flex items-center gap-2">
    <input
      type="checkbox"
      checked={formData.tracksSerialNumbers}
      onChange={(e) => setFormData({...formData, tracksSerialNumbers: e.target.checked})}
    />
    <span>{t('tracksSerialNumbers')}</span>
  </label>
  <p className="text-xs text-gray-500">
    Enable for items where each unit has a unique serial number
  </p>
</div>
```

#### B. Update `warehouse/[id]/page.tsx`
Add display of `tracksSerialNumbers` status and show it's either bulk or serialized

### Phase 2: Adding Stock with Serial Numbers

#### A. Create API: `/api/warehouse/serial-numbers/route.ts`
```typescript
// POST - Add serial numbers when adding stock
export async function POST(request: NextRequest) {
  const { itemId, serialNumbers, createdById } = await request.json()

  // Create SerialNumberStock records
  const created = await prisma.serialNumberStock.createMany({
    data: serialNumbers.map((sn: string) => ({
      itemId,
      serialNumber: sn,
      location: 'MAIN_WAREHOUSE',
      status: 'AVAILABLE'
    }))
  })

  return NextResponse.json(created)
}
```

#### B. Update Stock Modal in `warehouse/[id]/page.tsx`

**For ADD_STOCK operation:**
- If `item.tracksSerialNumbers === true`:
  - Show textarea for entering serial numbers (one per line)
  - Validate uniqueness
  - Create SerialNumberStock records instead of just incrementing count
- If `item.tracksSerialNumbers === false`:
  - Show quantity input (current behavior)

### Phase 3: Transferring/Removing with Serial Numbers

#### A. API: GET available serial numbers
```typescript
// GET /api/warehouse/items/[id]/serial-numbers?location=MAIN_WAREHOUSE
export async function GET(request, { params }) {
  const { searchParams } = new URL(request.url)
  const location = searchParams.get('location')
  const technicianId = searchParams.get('technicianId')

  const serialNumbers = await prisma.serialNumberStock.findMany({
    where: {
      itemId: params.id,
      location,
      technicianId,
      status: 'AVAILABLE'
    }
  })

  return NextResponse.json(serialNumbers)
}
```

#### B. Update Transfer/Remove Modals

**For TRANSFER_TO_TECH:**
1. Fetch available SNs from main warehouse
2. Show multi-select checkbox list
3. User selects which SNs to transfer
4. Update those SN records:
   ```typescript
   await prisma.serialNumberStock.updateMany({
     where: { id: { in: selectedSnIds } },
     data: {
       location: 'TECHNICIAN',
       technicianId: toUserId
     }
   })
   ```

**For TRANSFER_FROM_TECH (Return):**
1. Fetch SNs assigned to that technician
2. Show multi-select list
3. Update selected SNs back to MAIN_WAREHOUSE

**For USE (Interventions):**
1. Fetch technician's available SNs
2. Select which ones were used
3. Update location to 'USED'

### Phase 4: Display Updates

#### A. Warehouse Items List (`warehouse/page.tsx`)
Show badge if item tracks serial numbers:
```tsx
{item.tracksSerialNumbers && (
  <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded">
    SN Tracked
  </span>
)}
```

#### B. Item Detail Page (`warehouse/[id]/page.tsx`)

**For Serialized Items:**
- Don't show simple quantity count
- Show list of serial numbers grouped by location:
  ```
  Main Warehouse: SN001, SN002, SN003
  Technician John: SN004, SN005
  Used: SN006
  ```

**For Non-Serialized Items:**
- Keep current quantity-based display

#### C. Technician Stock View (`warehouse/technicians/[id]/page.tsx`)
- For serialized items, show list of serial numbers instead of quantity
- Group by item, show SNs under each

### Phase 5: Movement History

#### A. Update `ItemMovement` Creation
When creating a movement for serialized items:
```typescript
// Create movement record
const movement = await prisma.itemMovement.create({...})

// Link serial numbers to movement
await prisma.movementSerialNumber.createMany({
  data: serialNumberIds.map(snId => ({
    movementId: movement.id,
    serialNumberId: snId
  }))
})
```

#### B. Update Movement Display
Show serial numbers involved in each movement:
```tsx
{movement.serialNumbers.length > 0 && (
  <div>
    <p className="text-xs text-gray-500">Serial Numbers:</p>
    <p className="text-sm">{movement.serialNumbers.map(sn => sn.serialNumber).join(', ')}</p>
  </div>
)}
```

---

## 📋 Implementation Checklist

### Immediate Next Steps:
- [ ] Update warehouse item create/edit forms with `tracksSerialNumbers` checkbox
- [ ] Create serial numbers API endpoints
- [ ] Update ADD_STOCK modal to handle serial number entry
- [ ] Update TRANSFER modals to show serial number selection
- [ ] Update display logic to show SNs instead of quantities for serialized items

### API Endpoints Needed:
- [ ] `POST /api/warehouse/serial-numbers` - Add serial numbers
- [ ] `GET /api/warehouse/items/[id]/serial-numbers` - Get SNs by location/technician
- [ ] `PATCH /api/warehouse/serial-numbers/[id]` - Update SN location/status
- [ ] Update `POST /api/warehouse/movements` - Handle serial numbers in movements

### UI Components Needed:
- [ ] SerialNumberInput component (textarea with validation)
- [ ] SerialNumberSelector component (multi-select with checkboxes)
- [ ] SerialNumberList component (display grouped SNs)

---

## 🎯 Usage Workflow

### For Items WITH Serial Number Tracking:

**Adding Stock:**
1. Click "Add Stock"
2. Enter quantity: 5
3. Enter 5 serial numbers (one per line):
   ```
   SN001
   SN002
   SN003
   SN004
   SN005
   ```
4. System creates 5 SerialNumberStock records

**Transferring to Technician:**
1. Click "Transfer to Technician"
2. Select technician: John
3. See list of available SNs in main warehouse
4. Select SNs to transfer: ☑ SN001, ☑ SN003
5. System updates those 2 SNs: location=TECHNICIAN, technicianId=John

**Using in Intervention:**
1. Technician has SN001, SN003
2. During intervention, mark SN001 as used
3. System updates SN001: location=USED

### For Items WITHOUT Serial Number Tracking:
- Works exactly as before (quantity-based)

---

## 🔒 Data Integrity Rules

1. **Uniqueness**: Serial number must be unique per item (enforced by DB)
2. **Quantity Sync**: For serialized items, mainWarehouse count should match count of SNs with location=MAIN_WAREHOUSE
3. **Movement Validation**: Can only transfer SNs that are AVAILABLE
4. **Technician Assignment**: SN can only have technicianId when location=TECHNICIAN

---

## 💡 Tips for Development

1. **Start with one operation**: Implement ADD_STOCK with SN input first
2. **Test both modes**: Always test with both serialized and non-serialized items
3. **Validation**: Add proper error messages for duplicate SNs
4. **Performance**: For large quantities, consider batch operations
5. **UX**: Provide clear visual distinction between serialized/non-serialized items

---

## 📝 Database Queries You'll Need

**Get all SNs for an item by location:**
```typescript
const sns = await prisma.serialNumberStock.findMany({
  where: { itemId, location: 'MAIN_WAREHOUSE', status: 'AVAILABLE' }
})
```

**Transfer SNs to technician:**
```typescript
await prisma.serialNumberStock.updateMany({
  where: { id: { in: selectedSnIds } },
  data: { location: 'TECHNICIAN', technicianId }
})
```

**Count by location:**
```typescript
const counts = await prisma.serialNumberStock.groupBy({
  by: ['location'],
  where: { itemId },
  _count: true
})
```

---

## ⚠️ Important Notes

- Existing items default to `tracksSerialNumbers = false` (bulk items)
- Once an item is set to track SNs, you can't easily change it back
- Serial numbers are **per item type**, not globally unique
- System maintains both quantity counts AND serial number records for compatibility

