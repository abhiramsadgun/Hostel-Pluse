# HostelPulse - Foundation Layer Contracts & Architecture

This document specifies the exact shared contracts, middleware, services, data types, and API conventions for the Hostel Complaint Management System foundation layer. Modules built on top (Complaints/AI, Outpass/Room Allocation, Health) must consume these standards.

---

## 1. Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    BLOCKS ||--o{ ROOMS : contains
    BLOCKS ||--o{ STUDENTS : houses
    BLOCKS ||--o{ WARDENS : manages
    BLOCKS ||--o{ AUDIT_LOGS : scoped_to
    
    USERS ||--|| STUDENTS : identity_profile
    USERS ||--|| WARDENS : identity_profile
    USERS ||--|| STAFF_PROFILES : identity_profile
    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ AUDIT_LOGS : performs
    USERS ||--o{ PASSWORD_RESETS : requests
    
    ROOMS ||--o{ STUDENTS : allocated_to
    
    STUDENTS ||--o{ MEAL_PREFERENCES : submits
    FOOD_MENUS ||--o{ MEAL_PREFERENCES : options_for

    BLOCKS {
        int id PK
        string name
        string code UK
        string gender "male | female"
        int total_floors
        text description
        timestamp created_at
    }

    ROOMS {
        int id PK
        int block_id FK
        string room_number
        int floor
        int capacity
        int occupied_count
        string status "available | full | maintenance"
        timestamp created_at
    }

    USERS {
        int id PK
        string email UK
        string phone UK
        string password_hash
        string role "student | warden | admin | maintenance | health_assistant | security | mess"
        string status "pending | active | rejected | suspended"
        boolean email_verified
        timestamp created_at
        timestamp updated_at
    }

    STUDENTS {
        int id PK
        int user_id FK,UK
        string roll_number UK
        string laminated_id_number UK
        string id_card_image_url
        string id_card_image_hash
        int block_id FK
        int room_id FK "nullable"
        string full_name
        string gender "male | female"
        string class_name
        int academic_year
        string parent_name
        string parent_phone
        string emergency_contact
        text allergies
        text rejection_reason
        int approved_by_warden_id
        timestamp approved_at
        timestamp created_at
    }

    WARDENS {
        int id PK
        int user_id FK,UK
        string college_id_number UK
        string full_name
        string gender "male | female"
        int block_id FK
        boolean is_night_deputy
        string photo_url
        string approval_status "pending | approved | rejected"
        timestamp created_at
    }

    PRELOADED_WARDENS {
        int id PK
        string college_id_number UK
        string full_name
        string email UK
        string gender "male | female"
        int block_id FK
        timestamp created_at
    }

    STAFF_PROFILES {
        int id PK
        int user_id FK,UK
        string staff_id_number UK
        string full_name
        string department
        string designation
        jsonb specialisations "category names handled"
        boolean is_active "active flag for auto-assignment"
        timestamp created_at
    }

    NOTIFICATIONS {
        int id PK
        int user_id FK
        string title
        text message
        string type "info | approval | food | alert | complaint | system"
        boolean is_read
        jsonb metadata
        timestamp created_at
    }

    AUDIT_LOGS {
        int id PK
        int user_id FK "nullable"
        string action
        string entity_type
        string entity_id
        int block_id FK "nullable"
        jsonb details
        string ip_address
        timestamp created_at
    }

    FOOD_MENUS {
        int id PK
        int day_of_week "0=Sun, 6=Sat"
        string meal_type "breakfast | lunch | snacks | dinner"
        string start_time
        string end_time
        string title
        text description
        jsonb options "array of options"
        boolean is_active
        timestamp created_at
    }

    MEAL_PREFERENCES {
        int id PK
        int student_id FK
        date meal_date
        string meal_type "breakfast | lunch | snacks | dinner"
        string selected_option_id
        boolean is_locked
        timestamp created_at
        timestamp updated_at
    }

    SYSTEM_SETTINGS {
        string key PK
        jsonb value
        text description
        timestamp updated_at
    }

    COMPLAINT_CATEGORIES {
        int id PK
        string name UK
        string department
        text description
        boolean is_active
        timestamp created_at
    }
```

---

## 2. API Response Envelope

Every endpoint in HostelPulse conforms to this uniform format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

### Error Response
```json
{
  "success": false,
  "data": null,
  "error": {
    "message": "Human-readable error explanation",
    "code": "ERROR_CODE_STRING",
    "details": [ ... ]
  }
}
```

All foundation routes are prefixed with `/api/v1`.

---

## 3. Shared Middleware Contracts (`/server/src/middleware`)

### 3.1 `authenticate`
Extracts and validates the JWT from `Authorization: Bearer <token>` or cookies.
Attaches the authenticated user payload to `req.user`.

**Export**:
```javascript
const { authenticate } = require('../middleware/auth');
```

**Populated `req.user` Shape**:
```javascript
{
  id: 1,                          // users.id
  email: "student@hostelpulse.edu",
  role: "student",               // student | warden | admin | maintenance | health_assistant | security | mess
  status: "active",
  studentId: 10,                 // Present if role === 'student'
  wardenId: null,                // Present if role === 'warden'
  blockId: 1,                    // Assigned block ID (for student and warden)
  gender: "male",                // Block gender scope
  full_name: "Rahul Sharma"
}
```

### 3.2 `requireRole(...roles)`
Guards endpoints to ensure the caller possesses one of the authorized roles.

**Export**:
```javascript
const { requireRole } = require('../middleware/auth');

// Usage:
router.post('/resolve', authenticate, requireRole('warden', 'admin'), handler);
```

### 3.3 `scopeToBlock`
Enforces hostel block and gender tenancy. Wardens can strictly access data originating from their own block. Admin has bypass privileges across all blocks.

**Export**:
```javascript
const { scopeToBlock } = require('../middleware/scopeToBlock');

// Usage:
router.get('/students', authenticate, scopeToBlock, (req, res) => {
  // req.blockScope is automatically populated:
  // - For warden: req.blockScope = { blockId: req.user.blockId, gender: req.user.gender }
  // - For admin:  req.blockScope = null (unrestricted access)
});
```

---

## 4. Shared Services Contracts (`/server/src/services`)

### 4.1 Notification Service (`notify.js`)
Dispatches cross-channel notifications:
1. Writes record to `notifications` table (immediate in-app delivery).
2. Sends email via Nodemailer (asynchronous, non-blocking).
3. Emits SMS stub to console logs (ready for SMS provider gateway hook).

**Export**:
```javascript
const { notify } = require('../services/notify');

// Usage:
await notify({
  userId: studentUserId,
  title: "Complaint Status Updated",
  message: "Your plumbing complaint #104 has been marked In Progress.",
  type: "complaint", // 'info' | 'approval' | 'food' | 'alert' | 'complaint' | 'system'
  metadata: { complaintId: 104, priority: "high" },
  email: studentEmail,       // Optional: overrides user email lookup
  phone: studentPhone        // Optional: for SMS stub
});
```

### 4.2 Audit Service (`audit.js`)
Records immutable compliance and security audit trails.

**Export**:
```javascript
const { audit } = require('../services/audit');

// Usage:
await audit({
  userId: req.user.id,
  action: "STUDENT_REGISTRATION_APPROVED",
  entityType: "student",
  entityId: studentId,
  blockId: studentBlockId,
  details: { approvedBy: req.user.full_name, timestamp: new Date() },
  ipAddress: req.ip
});
```

---

## 5. Outpass & Mess Contract Export (`/server/src/modules/food`)

To allow the Outpass/Room Allocation module teammate to seamlessly exclude students who have an approved outpass from mess meal calculations, the food service exports:

```javascript
/**
 * Contract Hook for Outpass Module Teammate:
 * Implement or hook your Outpass query in `server/src/services/outpassContract.js`
 * or pass an array of studentIds into `calculateMealReport(date, mealType, options)`.
 */
const { getApprovedOutpassStudentIds } = require('../services/outpassContract');

// Signature:
async function getApprovedOutpassStudentIds(date, mealType) {
  // Returns: Array of student IDs [1, 4, 12] currently on approved outpass
}
```

---

## 6. Secure Uploads Contract

- Student laminated ID photos and sensitive docs are saved outside the public static root in `/server/uploads/ids/`.
- File hashes (SHA-256) are calculated before saving. Re-uploading an identical image causes an immediate rejection to prevent duplicate or fraudulent identities.
- Images are retrieved through authenticated, role-scoped route:
  `GET /api/v1/auth/files/:filename` (Wardens can view photos of students in their block; Admins can view all; Students can view their own).

---

## 7. Maintenance Assignee Auto-Suggestion Contract (`/server/src/services/maintenanceContract.js`)

**FOR TEAMMATE (Complaints & AI Dispatch Module):**
To auto-suggest the optimal maintenance technician based on category (e.g., plumbing vs electrical), use either the Node.js service function or the HTTP endpoint.

### 7.1 Node.js Service Import
```javascript
const { getSuggestedMaintenanceAssignees } = require('../services/maintenanceContract');

// Usage:
// Pass complaint category name, e.g. "Plumbing & Water Supply"
const assignees = await getSuggestedMaintenanceAssignees("Plumbing & Water Supply");
// Returns: Array of active maintenance personnel, sorted with `isBestMatch: true` at top!
```

### 7.2 REST API Endpoint
`GET /api/v1/admin/maintenance/assignees?category=Plumbing+%26+Water+Supply`
**Headers**: `Authorization: Bearer <token>` (Admin role)

**Response Shape**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "staffIdNumber": "MAINT-101",
      "fullName": "Anil Verma",
      "department": "Facility Maintenance",
      "designation": "Plumbing & Water Specialist",
      "specialisations": ["Plumbing & Water Supply", "Room & Floor Hygiene"],
      "isActive": true,
      "email": "maintenance@hostelpulse.edu",
      "phone": "+919777700001",
      "isBestMatch": true
    }
  ],
  "error": null
}
```

---

## 8. Frontend Complaints Analytics Mount Point Contract

**FOR TEAMMATE (Complaints Analytics / Dashboard Widgets):**
The Admin portal includes a dedicated tab: **"Complaints & AI Analytics"**.
The component is located at:
`client/src/portals/staff/ComplaintsAnalyticsMountPoint.jsx`

Simply drop your widgets, charts, and AI triage summaries into the exported component or replace the shell with your dashboard!

