const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('./index');

async function seed() {
  console.log('[SEED] Starting demo database seed...');
  await db.initDb();
  await db.runMigrations();

  const defaultPassword = 'Password@123';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  // 1. Seed Blocks
  console.log('[SEED] Seeding blocks...');
  const blockARes = await db.query(
    `INSERT INTO blocks (name, code, gender, total_floors, description)
     VALUES ('Aryabhatta Boys Block A', 'BBA', 'male', 4, 'Senior & Junior Boys Hostel with LAN & Gym')
     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`
  );
  const blockAId = blockARes.rows[0].id;

  const blockBRes = await db.query(
    `INSERT INTO blocks (name, code, gender, total_floors, description)
     VALUES ('Gargi Girls Block B', 'GBB', 'female', 4, 'Girls Hostel with dedicated reading room and courtyard')
     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`
  );
  const blockBId = blockBRes.rows[0].id;

  // 2. Seed Rooms
  console.log('[SEED] Seeding rooms...');
  const roomsToSeed = [
    { blockId: blockAId, room: '101', floor: 1, capacity: 2, occupied: 2 },
    { blockId: blockAId, room: '102', floor: 1, capacity: 2, occupied: 1 },
    { blockId: blockAId, room: '201', floor: 2, capacity: 3, occupied: 1 },
    { blockId: blockAId, room: '202', floor: 2, capacity: 2, occupied: 0 },
    { blockId: blockBId, room: '101', floor: 1, capacity: 2, occupied: 2 },
    { blockId: blockBId, room: '102', floor: 1, capacity: 2, occupied: 1 },
    { blockId: blockBId, room: '201', floor: 2, capacity: 3, occupied: 1 },
    { blockId: blockBId, room: '202', floor: 2, capacity: 2, occupied: 0 },
  ];

  const roomMap = {};
  for (const r of roomsToSeed) {
    const res = await db.query(
      `INSERT INTO rooms (block_id, room_number, floor, capacity, occupied_count, status)
       VALUES ($1, $2, $3, $4, $5, 'available')
       ON CONFLICT (block_id, room_number) DO UPDATE SET capacity = EXCLUDED.capacity
       RETURNING id, block_id, room_number`,
      [r.blockId, r.room, r.floor, r.capacity, r.occupied]
    );
    roomMap[`${r.blockId}_${r.room}`] = res.rows[0].id;
  }

  // 3. Seed Preloaded Wardens
  console.log('[SEED] Seeding preloaded wardens roster...');
  await db.query(
    `INSERT INTO preloaded_wardens (college_id_number, full_name, email, gender, block_id)
     VALUES 
      ('W-MALE-101', 'Dr. Vikram Malhotra', 'warden.boys@hostelpulse.edu', 'male', $1),
      ('W-FEMA-201', 'Prof. Sunita Rao', 'warden.girls@hostelpulse.edu', 'female', $2),
      ('W-DEPUTY-102', 'Mr. Ramesh Kumar', 'deputy.warden@hostelpulse.edu', 'male', $1)
     ON CONFLICT (college_id_number) DO NOTHING`,
    [blockAId, blockBId]
  );

  // 4. Seed Admin (Chief Warden)
  console.log('[SEED] Seeding chief admin account...');
  const adminUserRes = await db.query(
    `INSERT INTO users (email, phone, password_hash, role, status, email_verified)
     VALUES ('admin@hostelpulse.edu', '+919999900001', $1, 'admin', 'active', TRUE)
     ON CONFLICT (email) DO UPDATE SET role = 'admin', status = 'active'
     RETURNING id`,
    [passwordHash]
  );
  const adminUserId = adminUserRes.rows[0].id;

  await db.query(
    `INSERT INTO staff_profiles (user_id, staff_id_number, full_name, department, designation)
     VALUES ($1, 'ADMIN-001', 'Dr. K. Sharma (Chief Warden)', 'Hostel Administration', 'Chief Warden')
     ON CONFLICT (staff_id_number) DO NOTHING`,
    [adminUserId]
  );

  // 5. Seed Wardens
  console.log('[SEED] Seeding wardens...');
  // Primary Boys Warden
  const wardenBoysUser = await db.query(
    `INSERT INTO users (email, phone, password_hash, role, status, email_verified)
     VALUES ('warden.boys@hostelpulse.edu', '+919888800001', $1, 'warden', 'active', TRUE)
     ON CONFLICT (email) DO UPDATE SET status = 'active'
     RETURNING id`,
    [passwordHash]
  );
  await db.query(
    `INSERT INTO wardens (user_id, college_id_number, full_name, gender, block_id, is_night_deputy, approval_status)
     VALUES ($1, 'W-MALE-101', 'Dr. Vikram Malhotra', 'male', $2, FALSE, 'approved')
     ON CONFLICT (college_id_number) DO UPDATE SET block_id = EXCLUDED.block_id`,
    [wardenBoysUser.rows[0].id, blockAId]
  );

  // Deputy Boys Warden
  const deputyBoysUser = await db.query(
    `INSERT INTO users (email, phone, password_hash, role, status, email_verified)
     VALUES ('deputy.warden@hostelpulse.edu', '+919888800002', $1, 'warden', 'active', TRUE)
     ON CONFLICT (email) DO UPDATE SET status = 'active'
     RETURNING id`,
    [passwordHash]
  );
  await db.query(
    `INSERT INTO wardens (user_id, college_id_number, full_name, gender, block_id, is_night_deputy, approval_status)
     VALUES ($1, 'W-DEPUTY-102', 'Mr. Ramesh Kumar', 'male', $2, TRUE, 'approved')
     ON CONFLICT (college_id_number) DO NOTHING`,
    [deputyBoysUser.rows[0].id, blockAId]
  );

  // Primary Girls Warden
  const wardenGirlsUser = await db.query(
    `INSERT INTO users (email, phone, password_hash, role, status, email_verified)
     VALUES ('warden.girls@hostelpulse.edu', '+919888800003', $1, 'warden', 'active', TRUE)
     ON CONFLICT (email) DO UPDATE SET status = 'active'
     RETURNING id`,
    [passwordHash]
  );
  await db.query(
    `INSERT INTO wardens (user_id, college_id_number, full_name, gender, block_id, is_night_deputy, approval_status)
     VALUES ($1, 'W-FEMA-201', 'Prof. Sunita Rao', 'female', $2, FALSE, 'approved')
     ON CONFLICT (college_id_number) DO UPDATE SET block_id = EXCLUDED.block_id`,
    [wardenGirlsUser.rows[0].id, blockBId]
  );

  // 6. Seed Staff of each role
  console.log('[SEED] Seeding staff accounts for all roles...');
  const staffMembers = [
    {
      email: 'maintenance@hostelpulse.edu',
      phone: '+919777700001',
      role: 'maintenance',
      staffId: 'MAINT-101',
      name: 'Anil Verma',
      dept: 'Facility Maintenance',
      desig: 'Plumbing & Water Specialist',
      specialisations: ['Plumbing & Water Supply', 'Room & Floor Hygiene'],
      isActive: true,
    },
    {
      email: 'electrician@hostelpulse.edu',
      phone: '+919777700008',
      role: 'maintenance',
      staffId: 'MAINT-102',
      name: 'Rajesh Sharma',
      dept: 'Facility Maintenance',
      desig: 'Electrical & Power Specialist',
      specialisations: ['Electrical & Lighting', 'Wi-Fi & LAN Network'],
      isActive: true,
    },
    {
      email: 'health@hostelpulse.edu',
      phone: '+919777700002',
      role: 'health_assistant',
      staffId: 'HLTH-201',
      name: 'Sister Mary Joseph',
      dept: 'Hostel Health Center',
      desig: 'Resident Healthcare Nurse',
      specialisations: ['Health & Medical Support'],
      isActive: true,
    },
    {
      email: 'security@hostelpulse.edu',
      phone: '+919777700003',
      role: 'security',
      staffId: 'SEC-301',
      name: 'Capt. Jagdish Singh',
      dept: 'Campus Security',
      desig: 'Head of Security & Gate Control',
      specialisations: ['Security & Gate Entry'],
      isActive: true,
    },
    {
      email: 'mess@hostelpulse.edu',
      phone: '+919777700004',
      role: 'mess',
      staffId: 'MESS-401',
      name: 'Suresh Naidu',
      dept: 'Hostel Dining & Catering',
      desig: 'Central Mess Operations Manager',
      specialisations: ['Mess & Food Quality'],
      isActive: true,
    },
  ];

  for (const sm of staffMembers) {
    const sUser = await db.query(
      `INSERT INTO users (email, phone, password_hash, role, status, email_verified)
       VALUES ($1, $2, $3, $4, 'active', TRUE)
       ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, status = 'active'
       RETURNING id`,
      [sm.email, sm.phone, passwordHash, sm.role]
    );
    await db.query(
      `INSERT INTO staff_profiles (user_id, staff_id_number, full_name, department, designation, specialisations, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (staff_id_number) 
       DO UPDATE SET department = EXCLUDED.department, designation = EXCLUDED.designation, specialisations = EXCLUDED.specialisations, is_active = EXCLUDED.is_active`,
      [sUser.rows[0].id, sm.staffId, sm.name, sm.dept, sm.desig, JSON.stringify(sm.specialisations || []), sm.isActive ?? true]
    );
  }

  // Ensure sample demo ID card image exists in uploads directory
  const uploadsDir = path.resolve(__dirname, '../../uploads/ids');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const sampleImagePath = path.join(uploadsDir, 'sample-id-card.jpg');
  if (!fs.existsSync(sampleImagePath)) {
    fs.writeFileSync(sampleImagePath, 'HostelPulse Simulated Laminated ID Card Asset');
  }

  // 7. Seed 10 Students (5 Male in Block A, 5 Female in Block B; with 1 pending in each block)
  console.log('[SEED] Seeding 10 demo students...');
  const studentsToSeed = [
    // Boys Block A (4 active, 1 pending)
    {
      email: 'rahul.sharma@hostelpulse.edu',
      phone: '+919111100001',
      roll: '2023CSB101',
      lamId: 'HID-BBA-001',
      name: 'Rahul Sharma',
      gender: 'male',
      blockId: blockAId,
      roomId: roomMap[`${blockAId}_101`],
      className: 'B.Tech CSE',
      year: 3,
      status: 'active',
      parentName: 'Ramesh Sharma',
      parentPhone: '+919111188801',
      emergency: '+919111188801',
      allergies: 'Peanuts',
      dietPreference: 'veg',
    },
    {
      email: 'amit.verma@hostelpulse.edu',
      phone: '+919111100002',
      roll: '2023CSB102',
      lamId: 'HID-BBA-002',
      name: 'Amit Verma',
      gender: 'male',
      blockId: blockAId,
      roomId: roomMap[`${blockAId}_101`],
      className: 'B.Tech ECE',
      year: 3,
      status: 'active',
      parentName: 'Sanjay Verma',
      parentPhone: '+919111188802',
      emergency: '+919111188802',
      allergies: 'None',
      dietPreference: 'non_veg',
    },
    {
      email: 'rohit.patel@hostelpulse.edu',
      phone: '+919111100003',
      roll: '2024CSB103',
      lamId: 'HID-BBA-003',
      name: 'Rohit Patel',
      gender: 'male',
      blockId: blockAId,
      roomId: roomMap[`${blockAId}_102`],
      className: 'B.Tech Mech',
      year: 2,
      status: 'active',
      parentName: 'Kishore Patel',
      parentPhone: '+919111188803',
      emergency: '+919111188803',
      allergies: 'Lactose intolerant',
      dietPreference: 'non_veg',
    },
    {
      email: 'karthik.iyer@hostelpulse.edu',
      phone: '+919111100004',
      roll: '2024CSB104',
      lamId: 'HID-BBA-004',
      name: 'Karthik Iyer',
      gender: 'male',
      blockId: blockAId,
      roomId: roomMap[`${blockAId}_201`],
      className: 'B.Tech Civil',
      year: 2,
      status: 'active',
      parentName: 'Subramanian Iyer',
      parentPhone: '+919111188804',
      emergency: '+919111188804',
      allergies: 'None',
      dietPreference: 'veg',
    },
    {
      // PENDING STUDENT (For Warden Vikram to test approval screen)
      email: 'pranav.nair@hostelpulse.edu',
      phone: '+919111100005',
      roll: '2025CSB105',
      lamId: 'HID-BBA-005',
      name: 'Pranav Nair',
      gender: 'male',
      blockId: blockAId,
      roomId: null,
      className: 'B.Tech AI & Data Science',
      year: 1,
      status: 'pending',
      parentName: 'Gopal Nair',
      parentPhone: '+919111188805',
      emergency: '+919111188805',
      allergies: 'Dust allergy',
      dietPreference: 'non_veg',
    },

    // Girls Block B (4 active, 1 pending)
    {
      email: 'ananya.reddy@hostelpulse.edu',
      phone: '+919222200001',
      roll: '2023CSG201',
      lamId: 'HID-GBB-001',
      name: 'Ananya Reddy',
      gender: 'female',
      blockId: blockBId,
      roomId: roomMap[`${blockBId}_101`],
      className: 'B.Tech CSE',
      year: 3,
      status: 'active',
      parentName: 'Venkat Reddy',
      parentPhone: '+919222288801',
      emergency: '+919222288801',
      allergies: 'None',
      dietPreference: 'veg',
    },
    {
      email: 'priya.singh@hostelpulse.edu',
      phone: '+919222200002',
      roll: '2023CSG202',
      lamId: 'HID-GBB-002',
      name: 'Priya Singh',
      gender: 'female',
      blockId: blockBId,
      roomId: roomMap[`${blockBId}_101`],
      className: 'B.Tech Biotech',
      year: 3,
      status: 'active',
      parentName: 'Rajendra Singh',
      parentPhone: '+919222288802',
      emergency: '+919222288802',
      allergies: 'Gluten sensitivity',
      dietPreference: 'non_veg',
    },
    {
      email: 'sneha.deshmukh@hostelpulse.edu',
      phone: '+919222200003',
      roll: '2024CSG203',
      lamId: 'HID-GBB-003',
      name: 'Sneha Deshmukh',
      gender: 'female',
      blockId: blockBId,
      roomId: roomMap[`${blockBId}_102`],
      className: 'B.Tech IT',
      year: 2,
      status: 'active',
      parentName: 'Arun Deshmukh',
      parentPhone: '+919222288803',
      emergency: '+919222288803',
      allergies: 'None',
      dietPreference: 'veg',
    },
    {
      email: 'diya.sen@hostelpulse.edu',
      phone: '+919222200004',
      roll: '2024CSG204',
      lamId: 'HID-GBB-004',
      name: 'Diya Sen',
      gender: 'female',
      blockId: blockBId,
      roomId: roomMap[`${blockBId}_201`],
      className: 'B.Tech Chemical',
      year: 2,
      status: 'active',
      parentName: 'Debabrata Sen',
      parentPhone: '+919222288804',
      emergency: '+919222288804',
      allergies: 'Penicillin',
      dietPreference: 'non_veg',
    },
    {
      // PENDING STUDENT (For Warden Sunita to test approval screen)
      email: 'meera.krishnan@hostelpulse.edu',
      phone: '+919222200005',
      roll: '2025CSG205',
      lamId: 'HID-GBB-005',
      name: 'Meera Krishnan',
      gender: 'female',
      blockId: blockBId,
      roomId: null,
      className: 'B.Tech Robotics',
      year: 1,
      status: 'pending',
      parentName: 'Krishnan Unni',
      parentPhone: '+919222288805',
      emergency: '+919222288805',
      allergies: 'Asthma inhaler required',
      dietPreference: 'veg',
    },
  ];

  for (const st of studentsToSeed) {
    const sUserRes = await db.query(
      `INSERT INTO users (email, phone, password_hash, role, status, email_verified)
       VALUES ($1, $2, $3, 'student', $4, TRUE)
       ON CONFLICT (email) DO UPDATE SET status = EXCLUDED.status
       RETURNING id`,
      [st.email, st.phone, passwordHash, st.status]
    );
    const userId = sUserRes.rows[0].id;

    // Unique mock hash per student
    const mockImageHash = crypto.createHash('sha256').update(st.lamId).digest('hex');

    await db.query(
      `INSERT INTO students (
        user_id, roll_number, laminated_id_number, id_card_image_url, id_card_image_hash,
        block_id, room_id, full_name, gender, class_name, academic_year,
        parent_name, parent_phone, emergency_contact, allergies, diet_preference
      )
      VALUES ($1, $2, $3, 'sample-id-card.jpg', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (laminated_id_number) 
      DO UPDATE SET block_id = EXCLUDED.block_id, room_id = EXCLUDED.room_id, diet_preference = EXCLUDED.diet_preference`,
      [
        userId,
        st.roll,
        st.lamId,
        mockImageHash,
        st.blockId,
        st.roomId,
        st.name,
        st.gender,
        st.className,
        st.year,
        st.parentName,
        st.parentPhone,
        st.emergency,
        st.allergies,
        st.dietPreference || 'veg',
      ]
    );
  }

  // 8. Seed Complaint Categories (Seed list for complaints teammate)
  console.log('[SEED] Seeding complaint categories...');
  const categories = [
    { name: 'Plumbing & Water Supply', key: 'plumbing', dept: 'maintenance', weight: 75, sla: 12, desc: 'Leaking taps, low pressure, clogged drainage, hot water issues' },
    { name: 'Electrical & Lighting', key: 'electrical', dept: 'maintenance', weight: 80, sla: 12, desc: 'Tube lights, fans, socket faults, MCB trip, geyser malfunction' },
    { name: 'Carpentry & Furniture', key: 'furniture', dept: 'maintenance', weight: 45, sla: 48, desc: 'Broken bed, cupboard lock, study chair, window latches' },
    { name: 'Wi-Fi & LAN Network', key: 'internet', dept: 'maintenance', weight: 65, sla: 18, desc: 'No internet access, slow speed, Ethernet port damage' },
    { name: 'Cleanliness & Hygiene', key: 'cleanliness', dept: 'maintenance', weight: 50, sla: 24, desc: 'Dustbin clearing, washroom cleaning, pest control' },
    { name: 'Mess & Food Quality', key: 'mess', dept: 'mess', weight: 70, sla: 12, desc: 'Food taste, hygiene, utensil cleanliness, delay in meal service' },
    { name: 'Security & Gate Entry', key: 'security', dept: 'security', weight: 90, sla: 6, desc: 'Biometric issues, lost ID cards, gate disputes, unauthorized entry' },
    { name: 'Other Campus Support', key: 'other', dept: 'maintenance', weight: 30, sla: 72, desc: 'General hostel infrastructure inquiries and non-urgent support' },
  ];

  for (const cat of categories) {
    await db.query(
      `INSERT INTO complaint_categories (name, key, department, severity_weight, sla_hours, description, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       ON CONFLICT (name) DO UPDATE SET 
         key = EXCLUDED.key, 
         severity_weight = EXCLUDED.severity_weight, 
         sla_hours = EXCLUDED.sla_hours, 
         description = EXCLUDED.description`,
      [cat.name, cat.key, cat.dept, cat.weight, cat.sla, cat.desc]
    );
  }

  // 9. Seed Weekly Food Menu Templates (Monday=1 to Sunday=7, authentic South Indian rotation)
  console.log('[SEED] Seeding South Indian weekly menu templates (28 meals)...');
  const weeklyTemplates = [
    // 1. MONDAY
    {
      day: 1, dayName: 'Monday', mealType: 'breakfast', mealTime: '07:30 - 09:00',
      veg: 'Steamed Idli (3 pcs) with Medu Vada, Drumstick Sambar & Coconut Chutney',
      nonveg: '', nonvegAvailable: false,
    },
    {
      day: 1, dayName: 'Monday', mealType: 'lunch', mealTime: '12:30 - 14:00',
      veg: 'Steamed Ponni Rice, Madras Drumstick Sambar, Tomato Pepper Rasam, Cabbage & Carrot Poriyal, Curd, Roasted Appalam',
      nonveg: '', nonvegAvailable: false,
    },
    {
      day: 1, dayName: 'Monday', mealType: 'snacks', mealTime: '17:00 - 18:00',
      veg: 'Kala Chana Sundal with grated coconut, Marie Biscuits, Filter Coffee & Cardamom Tea',
      nonveg: '', nonvegAvailable: false,
    },
    {
      day: 1, dayName: 'Monday', mealType: 'dinner', mealTime: '19:30 - 21:00',
      veg: 'Hot Phulka Chapati (3 pcs) with Mixed Veg Kurma, Steamed Rice, Tomato Dal, Curd Rice',
      nonveg: 'Boiled Egg (2 pcs) with Pepper Salt', nonvegAvailable: true,
    },

    // 2. TUESDAY
    {
      day: 2, dayName: 'Tuesday', mealType: 'breakfast', mealTime: '07:30 - 09:00',
      veg: 'Crispy Plain / Ghee Masala Dosa with Drumstick Sambar & Spicy Tomato Chutney',
      nonveg: '', nonvegAvailable: false,
    },
    {
      day: 2, dayName: 'Tuesday', mealType: 'lunch', mealTime: '12:30 - 14:00',
      veg: 'Steamed Rice, Mysore Rasam, Chow-Chow & Chana Dal Kootu, Brinjal Sambar, Fresh Curd, Fryums',
      nonveg: '', nonvegAvailable: false,
    },
    {
      day: 2, dayName: 'Tuesday', mealType: 'snacks', mealTime: '17:00 - 18:00',
      veg: 'Crispy Onion Bajji (3 pcs) with Mint Chutney, Hot Tea & Coffee',
      nonveg: '', nonvegAvailable: false,
    },
    {
      day: 2, dayName: 'Tuesday', mealType: 'dinner', mealTime: '19:30 - 21:00',
      veg: 'Poori (4 pcs) with South Indian Potato Masala, Steamed Rice with Garlic Rasam, Fresh Curd',
      nonveg: '', nonvegAvailable: false,
    },

    // 3. WEDNESDAY (Non-veg Lunch & Dinner)
    {
      day: 3, dayName: 'Wednesday', mealType: 'breakfast', mealTime: '07:30 - 09:00',
      veg: 'Hot Ghee Ven Pongal with Crispy Medu Vada, Coconut Chutney & Brinjal Gothsu',
      nonveg: '', nonvegAvailable: false,
    },
    {
      day: 3, dayName: 'Wednesday', mealType: 'lunch', mealTime: '12:30 - 14:00',
      veg: 'South Indian Veg Meals: Steamed Rice, Sambar, Paruppu Rasam, Beans Carrot Poriyal, Curd, Papad',
      nonveg: 'Chettinad Spicy Chicken Curry with aromatic masala', nonvegAvailable: true,
    },
    {
      day: 3, dayName: 'Wednesday', mealType: 'snacks', mealTime: '17:00 - 18:00',
      veg: 'Sweet Corn Sundal with grated coconut, Filter Coffee & Ginger Tea',
      nonveg: '', nonvegAvailable: false,
    },
    {
      day: 3, dayName: 'Wednesday', mealType: 'dinner', mealTime: '19:30 - 21:00',
      veg: 'Fresh Chapati (3 pcs) with Vegetable Salna, Steamed Rice with Tomato Dal, Curd Rice with lemon pickle',
      nonveg: 'Country Style Egg Curry (2 eggs in rich onion-tomato gravy)', nonvegAvailable: true,
    },

    // 4. THURSDAY
    {
      day: 4, dayName: 'Thursday', mealType: 'breakfast', mealTime: '07:30 - 09:00',
      veg: 'Rava Upma with Vegetable Sambar, Sweet Kesari Bath & Coconut Chutney',
      nonveg: '', nonvegAvailable: false,
    },
    {
      day: 4, dayName: 'Thursday', mealType: 'lunch', mealTime: '12:30 - 14:00',
      veg: 'Steamed Rice, Drumstick & Pumpkin Sambar, Poondu (Garlic) Rasam, Snake Gourd Kootu, Curd, Papad',
      nonveg: '', nonvegAvailable: false,
    },
    {
      day: 4, dayName: 'Thursday', mealType: 'snacks', mealTime: '17:00 - 18:00',
      veg: 'Crunchy Ribbon Pakoda & South Indian Mixture, Masala Chai & Filter Coffee',
      nonveg: '', nonvegAvailable: false,
    },
    {
      day: 4, dayName: 'Thursday', mealType: 'dinner', mealTime: '19:30 - 21:00',
      veg: 'Layered Malabar Parotta / Phulka with Veg Paneer Kurma, Steamed Rice, Dal Tadka',
      nonveg: '', nonvegAvailable: false,
    },

    // 5. FRIDAY (Non-veg Dinner: Double Egg Omelette)
    {
      day: 5, dayName: 'Friday', mealType: 'breakfast', mealTime: '07:30 - 09:00',
      veg: 'Ghee Podi Mini Idli (12 pcs) or Kal Dosa with Sambar & Coriander Chutney',
      nonveg: '', nonvegAvailable: false,
    },
    {
      day: 5, dayName: 'Friday', mealType: 'lunch', mealTime: '12:30 - 14:00',
      veg: 'Steamed Rice, Traditional Mor Kuzhambu (Buttermilk curry), Crispy Potato Roast Fry, Tomato Rasam, Appalam, Curd',
      nonveg: '', nonvegAvailable: false,
    },
    {
      day: 5, dayName: 'Friday', mealType: 'snacks', mealTime: '17:00 - 18:00',
      veg: 'Plantain (Vazhaikkai) / Mirchi Bajji with Groundnut Chutney, Tea & Coffee',
      nonveg: '', nonvegAvailable: false,
    },
    {
      day: 5, dayName: 'Friday', mealType: 'dinner', mealTime: '19:30 - 21:00',
      veg: 'Phulka Chapati (3 pcs) with Punjabi Chana Masala, Steamed Rice, Lemon Rasam, Curd Rice',
      nonveg: 'Masala Omelette (Double Egg with green chillies & onions)', nonvegAvailable: true,
    },

    // 6. SATURDAY
    {
      day: 6, dayName: 'Saturday', mealType: 'breakfast', mealTime: '07:30 - 09:00',
      veg: 'Uttapam (Onion & Tomato) with Medu Vada, Arachuvitta Sambar & Peanut Chutney',
      nonveg: '', nonvegAvailable: false,
    },
    {
      day: 6, dayName: 'Saturday', mealType: 'lunch', mealTime: '12:30 - 14:00',
      veg: 'Variety Rice Festival: Tangy Lemon Rice & Bisibelebath, Curd Rice with Pomegranate, Potato Chips, Papad',
      nonveg: '', nonvegAvailable: false,
    },
    {
      day: 6, dayName: 'Saturday', mealType: 'snacks', mealTime: '17:00 - 18:00',
      veg: 'Hot Medu Pakoda / Mysore Bonda with Coconut Chutney, Cardamom Chai & Coffee',
      nonveg: '', nonvegAvailable: false,
    },
    {
      day: 6, dayName: 'Saturday', mealType: 'dinner', mealTime: '19:30 - 21:00',
      veg: 'Phulka Chapati with Paneer Butter Masala, Fragrant Jeera Rice, Dal Makhani, Mixed Veg Raita',
      nonveg: '', nonvegAvailable: false,
    },

    // 7. SUNDAY (Grand Feast with Chicken Biryani / Fish Fry)
    {
      day: 7, dayName: 'Sunday', mealType: 'breakfast', mealTime: '07:30 - 09:30',
      veg: 'Crispy Mysore Masala Dosa & Hot Poori with Potato Sagu, Coconut Chutney & Sambar',
      nonveg: '', nonvegAvailable: false,
    },
    {
      day: 7, dayName: 'Sunday', mealType: 'lunch', mealTime: '12:30 - 14:30',
      veg: 'Sunday Grand Feast: Steamed Basmati Rice, Sambar, Nattu Kozhi style Veg Gravy, Paneer Tikka, Curd, Papad, Semiya Payasam (Dessert)',
      nonveg: 'Hyderabadi Dum Chicken Biryani with Mirchi ka Salan / Andhra Tawa Fish Fry', nonvegAvailable: true,
    },
    {
      day: 7, dayName: 'Sunday', mealType: 'snacks', mealTime: '17:00 - 18:00',
      veg: 'Osmania Biscuits & Kara Boondi with Irani Chai & Filter Coffee',
      nonveg: '', nonvegAvailable: false,
    },
    {
      day: 7, dayName: 'Sunday', mealType: 'dinner', mealTime: '19:30 - 21:00',
      veg: 'Soft Butter Chapati with Dal Fry, Steamed Rice, Tomato Thokku, Comforting Curd Rice',
      nonveg: 'Egg Bhurji / Boiled Eggs (2 pcs)', nonvegAvailable: true,
    },
  ];

  for (const item of weeklyTemplates) {
    await db.query(
      `INSERT INTO menu_templates (day_of_week, day_name, meal_type, meal_time, veg_items, nonveg_items, nonveg_available, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       ON CONFLICT (day_of_week, meal_type)
       DO UPDATE SET 
         day_name = EXCLUDED.day_name,
         meal_time = EXCLUDED.meal_time,
         veg_items = EXCLUDED.veg_items,
         nonveg_items = EXCLUDED.nonveg_items,
         nonveg_available = EXCLUDED.nonveg_available,
         updated_at = CURRENT_TIMESTAMP`,
      [item.day, item.dayName, item.mealType, item.mealTime, item.veg, item.nonveg, item.nonvegAvailable]
    );
  }

  // 9b. Seed Sample Meal Preferences for Tomorrow (for Demo Display)
  console.log('[SEED] Seeding sample student daily meal preferences for tomorrow...');
  const tomorrow = new Date(Date.now() + 86400000);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Fetch active students
  const activeStudentsRes = await db.query(`SELECT id, diet_preference FROM students LIMIT 4`);
  if (activeStudentsRes.rows.length > 0) {
    const mealTypes = ['breakfast', 'lunch', 'snacks', 'dinner'];
    for (const st of activeStudentsRes.rows) {
      for (const mt of mealTypes) {
        // Choice is veg by default, or non_veg if student prefers it
        const studentChoice = st.diet_preference === 'non_veg' ? 'non_veg' : 'veg';
        await db.query(
          `INSERT INTO meal_preferences (student_id, date, meal_type, choice, updated_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
           ON CONFLICT (student_id, date, meal_type)
           DO UPDATE SET choice = EXCLUDED.choice, updated_at = CURRENT_TIMESTAMP`,
          [st.id, tomorrowStr, mt, studentChoice]
        );
      }
    }
  }

  // 10. Seed System Settings (Cutoff Time)
  console.log('[SEED] Seeding system settings (food cutoff at 21:00)...');
  await db.query(
    `INSERT INTO system_settings (key, value, description)
     VALUES ('food_cutoff_time', '{"hour": 21, "minute": 0}', 'Daily cut-off time for meal preference selection')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
  );

  // 11. Seed a few Notifications
  console.log('[SEED] Seeding welcome notifications...');
  await db.query(
    `INSERT INTO notifications (user_id, title, message, type)
     VALUES 
      ($1, 'Welcome to HostelPulse', 'Your account is verified and ready. You may now submit maintenance complaints or meal preferences.', 'system'),
      ($2, 'Welcome to HostelPulse', 'Your account is verified and ready. You may now submit maintenance complaints or meal preferences.', 'system')`,
    [adminUserId, wardenBoysUser.rows[0].id]
  );

  // 12. Seed 50+ Sample Historical Complaints & Resolution Turnaround Telemetry
  try {
    const { seedComplaints } = require('./seed_complaints');
    await seedComplaints();
  } catch (compSeedErr) {
    console.warn('[SEED-COMPLAINTS-WARN]', compSeedErr.message);
  }

  // 13. Seed Operations & Student Life Modules (Room Services, Outpasses, Health, Room Allocation)
  try {
    const { seedOperations } = require('./seed_operations');
    await seedOperations();
  } catch (opsSeedErr) {
    console.warn('[SEED-OPERATIONS-WARN]', opsSeedErr.message);
  }

  console.log('========================================================================');
  console.log(' DEMO SEED DATA INITIALIZED SUCCESSFULLY!');
  console.log('========================================================================');
  console.log(' Default Login Password for all seeded users: Password@123\n');
  console.log(' 1. Admin (Chief Warden):  admin@hostelpulse.edu');
  console.log(' 2. Boys Block Warden:     warden.boys@hostelpulse.edu (or College ID: W-MALE-101)');
  console.log(' 3. Girls Block Warden:    warden.girls@hostelpulse.edu (or College ID: W-FEMA-201)');
  console.log(' 4. Deputy Boys Warden:    deputy.warden@hostelpulse.edu (College ID: W-DEPUTY-102)');
  console.log(' 5. Maintenance Staff:     maintenance@hostelpulse.edu');
  console.log(' 6. Healthcare Staff:      health@hostelpulse.edu');
  console.log(' 7. Security Staff:        security@hostelpulse.edu');
  console.log(' 8. Mess Staff:            mess@hostelpulse.edu');
  console.log(' 9. Active Boy Student:    HID-BBA-001 (or rahul.sharma@hostelpulse.edu)');
  console.log(' 10. Active Girl Student:  HID-GBB-001 (or ananya.reddy@hostelpulse.edu)');
  console.log(' 11. Pending Boy Student:  HID-BBA-005 (pranav.nair@hostelpulse.edu) -> test approval!');
  console.log(' 12. Pending Girl Student: HID-GBB-005 (meera.krishnan@hostelpulse.edu) -> test approval!');
  console.log('========================================================================\n');
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[SEED-ERROR]', err);
      process.exit(1);
    });
}

module.exports = { seed };
