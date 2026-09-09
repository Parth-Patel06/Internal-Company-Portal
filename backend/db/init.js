const pool = require("./pool");
const { PERMISSIONS, roleDefault } = require("./permission-definitions");


async function seedPermissionCatalog() {
  for (const [key, name, module, description, sensitive] of PERMISSIONS) {
    await pool.query(`
      INSERT INTO permissions(permission_key, permission_name, module, description, is_sensitive)
      VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(permission_key) DO UPDATE SET
        permission_name=EXCLUDED.permission_name,
        module=EXCLUDED.module,
        description=EXCLUDED.description,
        is_sensitive=EXCLUDED.is_sensitive
    `, [key, name, module, description, sensitive]);
  }
  for (const role of ['CEO','ADMIN','HR','EMPLOYEE','INTERN']) {
    for (const [key] of PERMISSIONS) {
      const { rows } = await pool.query('SELECT id FROM permissions WHERE permission_key=$1', [key]);
      await pool.query(`
        INSERT INTO role_permissions(role, permission_id, access)
        VALUES($1,$2,$3)
        ON CONFLICT(role, permission_id) DO UPDATE SET access=EXCLUDED.access, updated_at=NOW()
      `, [role, rows[0].id, roleDefault(role, key)]);
    }
  }
}

(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        employee_id VARCHAR(30) UNIQUE NOT NULL,
        full_name VARCHAR(120) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,

        role VARCHAR(20) NOT NULL
          CHECK (
            UPPER(TRIM(role)) IN (
              'CEO',
              'ADMIN',
              'HR',
              'EMPLOYEE',
              'INTERN'
            )
          ),

        employment_type VARCHAR(30) DEFAULT 'permanent',
        department VARCHAR(100),
        designation VARCHAR(100),
        employee_level VARCHAR(30) DEFAULT 'L1',

        salary_basic NUMERIC(12,2) DEFAULT 0,
        salary_hra NUMERIC(12,2) DEFAULT 0,
        salary_allowances NUMERIC(12,2) DEFAULT 0,
        salary_deductions NUMERIC(12,2) DEFAULT 0,
        overtime_rate NUMERIC(10,2) DEFAULT 0,

        company_id VARCHAR(30),

        mobile VARCHAR(30),
        address TEXT,

        joining_date DATE,
        end_date DATE,

        permanent BOOLEAN DEFAULT TRUE,

        assigned_mentor VARCHAR(120),
        photo_url TEXT,

        must_change_password BOOLEAN DEFAULT FALSE,

        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        description TEXT,

        lead_id INT REFERENCES users(id),
        created_by INT REFERENCES users(id),

        start_date DATE,
        deadline DATE,

        status VARCHAR(30) DEFAULT 'Planning',
        priority VARCHAR(20) DEFAULT 'Medium',
        progress INT DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(150) NOT NULL,
        description TEXT,

        project_id INT REFERENCES projects(id),
        assignee_id INT REFERENCES users(id),
        created_by INT REFERENCES users(id),

        start_date DATE,
        deadline DATE,

        status VARCHAR(30) DEFAULT 'Pending',
        priority VARCHAR(20) DEFAULT 'Medium',

        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS task_assignments (
        id SERIAL PRIMARY KEY,

        task_id INT NOT NULL
          REFERENCES tasks(id)
          ON DELETE CASCADE,

        user_id INT NOT NULL
          REFERENCES users(id)
          ON DELETE CASCADE,

        status VARCHAR(30) DEFAULT 'Pending',

        progress INT DEFAULT 0
          CHECK (progress >= 0 AND progress <= 100),

        assigned_at TIMESTAMP DEFAULT NOW(),

        started_at TIMESTAMP,
        completed_at TIMESTAMP,

        UNIQUE(task_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS project_members (
        id SERIAL PRIMARY KEY,

        project_id INT NOT NULL
          REFERENCES projects(id)
          ON DELETE CASCADE,

        user_id INT NOT NULL
          REFERENCES users(id)
          ON DELETE CASCADE,

        joined_at TIMESTAMP DEFAULT NOW(),

        UNIQUE(project_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,

        user_id INT REFERENCES users(id),
        work_date DATE NOT NULL,

        check_in TIME,
        check_out TIME,

        status VARCHAR(20) DEFAULT 'Present',

        UNIQUE(user_id, work_date)
      );

      CREATE TABLE IF NOT EXISTS leave_requests (
        id SERIAL PRIMARY KEY,

        user_id INT REFERENCES users(id),

        leave_type VARCHAR(50) DEFAULT 'Leave',

        from_date DATE NOT NULL,
        to_date DATE NOT NULL,

        reason TEXT,

        status VARCHAR(20) DEFAULT 'Pending',

        reviewed_by INT REFERENCES users(id),

        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS daily_work_logs (
        id SERIAL PRIMARY KEY,

        user_id INT REFERENCES users(id),

        work_date DATE DEFAULT CURRENT_DATE,

        content TEXT,

        progress INT DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,

        title VARCHAR(150),

        content TEXT,

        created_at TIMESTAMP DEFAULT NOW(),

        created_by INT REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS salary_records (
        id SERIAL PRIMARY KEY,

        user_id INT REFERENCES users(id)
          ON DELETE CASCADE,

        month VARCHAR(30) NOT NULL,

        amount NUMERIC(12,2) DEFAULT 0,

        basic_salary NUMERIC(12,2) DEFAULT 0,
        hra NUMERIC(12,2) DEFAULT 0,
        allowances NUMERIC(12,2) DEFAULT 0,
        overtime_pay NUMERIC(12,2) DEFAULT 0,

        gross_salary NUMERIC(12,2) DEFAULT 0,

        deductions NUMERIC(12,2) DEFAULT 0,

        net_salary NUMERIC(12,2) DEFAULT 0,

        status VARCHAR(30) DEFAULT 'Pending Review',

        reviewed_by INT REFERENCES users(id),
        reviewed_at TIMESTAMP,

        approved_by INT REFERENCES users(id),
        approved_at TIMESTAMP,

        processed_by INT REFERENCES users(id),
        processed_at TIMESTAMP,

        created_at TIMESTAMP DEFAULT NOW(),

        UNIQUE(user_id, month)
      );

      CREATE TABLE IF NOT EXISTS overtime (
        id SERIAL PRIMARY KEY,

        user_id INT REFERENCES users(id),

        work_date DATE,

        hours NUMERIC(5,2),

        reason TEXT,

        status VARCHAR(20) DEFAULT 'Approved'
      );

      CREATE TABLE IF NOT EXISTS login_logs (
        id SERIAL PRIMARY KEY,

        user_id INT REFERENCES users(id),

        login_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

        logout_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS repositories (
        id SERIAL PRIMARY KEY,

        name VARCHAR(150),

        project_id INT REFERENCES projects(id),

        owner_id INT REFERENCES users(id),

        branch VARCHAR(50) DEFAULT 'main',

        updated_at TIMESTAMP DEFAULT NOW()
      );


      /* Code Management */
      CREATE TABLE IF NOT EXISTS repository_versions (
        id SERIAL PRIMARY KEY,
        repository_id INT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        version_no INT NOT NULL,
        message TEXT NOT NULL,
        created_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(repository_id, version_no)
      );

      CREATE TABLE IF NOT EXISTS repository_files (
        id SERIAL PRIMARY KEY,
        repository_id INT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        version_id INT REFERENCES repository_versions(id) ON DELETE SET NULL,
        path TEXT NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        storage_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(150),
        size BIGINT DEFAULT 0,
        uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(repository_id, path)
      );

      CREATE TABLE IF NOT EXISTS repository_activity (
        id SERIAL PRIMARY KEY,
        repository_id INT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        action VARCHAR(60) NOT NULL,
        target_type VARCHAR(40),
        target_id INT,
        target_name TEXT,
        details JSONB,
        created_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_repository_activity_repo
        ON repository_activity(repository_id, created_at DESC, id DESC);

      CREATE TABLE IF NOT EXISTS repository_merge_requests (
        id SERIAL PRIMARY KEY,
        repository_id INT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        source_branch VARCHAR(100) NOT NULL,
        target_branch VARCHAR(100) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
        created_by INT REFERENCES users(id) ON DELETE SET NULL,
        reviewed_by INT REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_repository_versions_repo
        ON repository_versions(repository_id, version_no DESC);

      CREATE INDEX IF NOT EXISTS idx_repository_files_repo
        ON repository_files(repository_id, path);

      CREATE INDEX IF NOT EXISTS idx_repository_mr_repo
        ON repository_merge_requests(repository_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        sender_id INT REFERENCES users(id),
        receiver_id INT REFERENCES users(id),
        body TEXT,
        message_type VARCHAR(20) DEFAULT 'text',
        created_at TIMESTAMP DEFAULT NOW()
      );

      /* Chat Phase 2: direct + group conversations. */
      CREATE TABLE IF NOT EXISTS chat_conversations (
        id SERIAL PRIMARY KEY,
        conversation_type VARCHAR(20) NOT NULL DEFAULT 'direct',
        user_one_id INT REFERENCES users(id) ON DELETE CASCADE,
        user_two_id INT REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100),
        created_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        CHECK (
          (conversation_type = 'direct' AND user_one_id IS NOT NULL AND user_two_id IS NOT NULL AND user_one_id <> user_two_id)
          OR
          (conversation_type = 'group' AND name IS NOT NULL AND created_by IS NOT NULL)
        )
      );

      CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_direct_pair
        ON chat_conversations(conversation_type, user_one_id, user_two_id)
        WHERE conversation_type = 'direct';

      ALTER TABLE chat_conversations
        ADD COLUMN IF NOT EXISTS name VARCHAR(100),
        ADD COLUMN IF NOT EXISTS created_by INT REFERENCES users(id) ON DELETE SET NULL;

      ALTER TABLE chat_conversations
        ALTER COLUMN user_one_id DROP NOT NULL,
        ALTER COLUMN user_two_id DROP NOT NULL;

      ALTER TABLE chat_messages
        ADD COLUMN IF NOT EXISTS conversation_id INT REFERENCES chat_conversations(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS read_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS deleted_by INT REFERENCES users(id),
        ADD COLUMN IF NOT EXISTS attachment_url TEXT,
        ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS attachment_mime VARCHAR(150),
        ADD COLUMN IF NOT EXISTS attachment_size BIGINT;

      CREATE TABLE IF NOT EXISTS chat_members (
        id SERIAL PRIMARY KEY,
        conversation_id INT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_admin BOOLEAN DEFAULT FALSE,
        joined_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(conversation_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS chat_group_message_reads (
        message_id INT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        read_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY(message_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS chat_message_deletions (
        id SERIAL PRIMARY KEY,
        message_id INT NOT NULL,
        conversation_id INT REFERENCES chat_conversations(id) ON DELETE SET NULL,
        message_sender_id INT REFERENCES users(id) ON DELETE SET NULL,
        message_body TEXT,
        deleted_by INT NOT NULL REFERENCES users(id),
        deleted_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_one
        ON chat_conversations(user_one_id);
      CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_two
        ON chat_conversations(user_two_id);
      CREATE INDEX IF NOT EXISTS idx_chat_members_conversation
        ON chat_members(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_chat_members_user
        ON chat_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created
        ON chat_messages(conversation_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_type
        ON chat_messages(message_type);

      CREATE INDEX IF NOT EXISTS idx_chat_messages_unread
        ON chat_messages(receiver_id, read_at)
        WHERE read_at IS NULL AND deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_chat_message_deletions_message
        ON chat_message_deletions(message_id);

      /* Attach legacy direct messages to the direct conversation model. */
      INSERT INTO chat_conversations (conversation_type, user_one_id, user_two_id, created_by)
      SELECT DISTINCT
        'direct',
        LEAST(sender_id, receiver_id),
        GREATEST(sender_id, receiver_id),
        LEAST(sender_id, receiver_id)
      FROM chat_messages
      WHERE conversation_id IS NULL
        AND sender_id IS NOT NULL
        AND receiver_id IS NOT NULL
        AND sender_id <> receiver_id
      ON CONFLICT DO NOTHING;

      UPDATE chat_messages m
      SET conversation_id = c.id
      FROM chat_conversations c
      WHERE m.conversation_id IS NULL
        AND c.conversation_type = 'direct'
        AND c.user_one_id = LEAST(m.sender_id, m.receiver_id)
        AND c.user_two_id = GREATEST(m.sender_id, m.receiver_id);

      /* Ensure every participant of an existing direct chat is also a member. */
      INSERT INTO chat_members (conversation_id, user_id, is_admin)
      SELECT c.id, x.user_id, FALSE
      FROM chat_conversations c
      CROSS JOIN LATERAL (
        VALUES (c.user_one_id), (c.user_two_id)
      ) AS x(user_id)
      WHERE c.conversation_type = 'direct'
        AND x.user_id IS NOT NULL
      ON CONFLICT (conversation_id, user_id) DO NOTHING;

      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,

        user_id INT REFERENCES users(id),

        title VARCHAR(150),

        body TEXT,

        read BOOLEAN DEFAULT FALSE,

        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS password_reset_requests (
        id SERIAL PRIMARY KEY,

        user_id INT NOT NULL
          REFERENCES users(id)
          ON DELETE CASCADE,

        requested_for_role VARCHAR(20) NOT NULL,

        status VARCHAR(20) NOT NULL
          DEFAULT 'PENDING',

        requested_at TIMESTAMP DEFAULT NOW(),

        handled_by INT
          REFERENCES users(id),

        handled_at TIMESTAMP
      );

      /*
       * ============================================================
       * OFFBOARDING TABLES
       * ============================================================
       */

      CREATE TABLE IF NOT EXISTS offboarding_records (
        id SERIAL PRIMARY KEY,

        user_id INT NOT NULL
          REFERENCES users(id),

        initiated_by INT NOT NULL
          REFERENCES users(id),

        last_working_day DATE NOT NULL,

        reason TEXT NOT NULL,

        retention_days INT NOT NULL
          CHECK (retention_days IN (30, 60, 90)),

        status VARCHAR(20) NOT NULL
          DEFAULT 'OFFBOARDING',

        email_forward_to VARCHAR(150) NOT NULL
          DEFAULT 'hr@triobyte.demo',

        auto_reply_enabled BOOLEAN NOT NULL
          DEFAULT TRUE,

        work_preserved BOOLEAN NOT NULL
          DEFAULT TRUE,

        created_at TIMESTAMP DEFAULT NOW(),

        completed_at TIMESTAMP,

        cancelled_at TIMESTAMP,

        cancelled_by INT
          REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS offboarding_audit_log (
        id SERIAL PRIMARY KEY,

        offboarding_id INT
          REFERENCES offboarding_records(id),

        user_id INT NOT NULL
          REFERENCES users(id),

        actor_id INT NOT NULL
          REFERENCES users(id),

        action VARCHAR(40) NOT NULL,

        details JSONB,

        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS offboarding_work_archive (
        id SERIAL PRIMARY KEY,

        offboarding_id INT NOT NULL
          REFERENCES offboarding_records(id),

        user_id INT NOT NULL
          REFERENCES users(id),

        entity_type VARCHAR(40) NOT NULL,

        entity_id INT NOT NULL,

        snapshot JSONB,

        created_at TIMESTAMP DEFAULT NOW(),

        UNIQUE(offboarding_id, entity_type, entity_id)
      );
    `);

    await pool.query(`
  ALTER TABLE offboarding_records
    ADD COLUMN IF NOT EXISTS initiated_by INT REFERENCES users(id);

  ALTER TABLE offboarding_records
    ADD COLUMN IF NOT EXISTS reason TEXT;

  ALTER TABLE offboarding_records
    ADD COLUMN IF NOT EXISTS retention_days INT;

  ALTER TABLE offboarding_records
    ADD COLUMN IF NOT EXISTS email_forward_to VARCHAR(150)
      DEFAULT 'hr@triobyte.demo';

  ALTER TABLE offboarding_records
    ADD COLUMN IF NOT EXISTS work_preserved BOOLEAN
      DEFAULT TRUE;

  ALTER TABLE offboarding_records
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;

  ALTER TABLE offboarding_records
    ADD COLUMN IF NOT EXISTS cancelled_by INT REFERENCES users(id);

  ALTER TABLE offboarding_records
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
`);

    /*
     * ============================================================
     * USER MIGRATIONS
     * ============================================================
     */

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS employment_type VARCHAR(30)
      DEFAULT 'permanent';

      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS employee_level VARCHAR(30)
      DEFAULT 'L1';

      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS company_id VARCHAR(30);

      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS mobile VARCHAR(30);

      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS address TEXT;

      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS joining_date DATE;

      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS end_date DATE;

      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS permanent BOOLEAN
      DEFAULT TRUE;

      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS assigned_mentor VARCHAR(120);

      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS photo_url TEXT;

      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN
      DEFAULT FALSE;

      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS blocked BOOLEAN
      DEFAULT FALSE;

      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS employment_status VARCHAR(30)
      DEFAULT 'Active';

      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS email_status VARCHAR(30)
      DEFAULT 'Active';

      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS mailbox_retention_days INT;

      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS offboarding_started_at TIMESTAMP;

      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS offboarding_completed_at TIMESTAMP;

      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS salary_basic NUMERIC(12,2)
      DEFAULT 0;

      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS salary_hra NUMERIC(12,2)
      DEFAULT 0;

      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS salary_allowances NUMERIC(12,2)
      DEFAULT 0;

      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS salary_deductions NUMERIC(12,2)
      DEFAULT 0;

      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS overtime_rate NUMERIC(10,2)
      DEFAULT 0;
    `);

    /*
     * ============================================================
     * SALARY RECORD MIGRATION
     * ============================================================
     */

    await pool.query(`
      ALTER TABLE salary_records
      ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2)
      DEFAULT 0;

      ALTER TABLE salary_records
      ADD COLUMN IF NOT EXISTS basic_salary NUMERIC(12,2)
      DEFAULT 0;

      ALTER TABLE salary_records
      ADD COLUMN IF NOT EXISTS hra NUMERIC(12,2)
      DEFAULT 0;

      ALTER TABLE salary_records
      ADD COLUMN IF NOT EXISTS allowances NUMERIC(12,2)
      DEFAULT 0;

      ALTER TABLE salary_records
      ADD COLUMN IF NOT EXISTS overtime_pay NUMERIC(12,2)
      DEFAULT 0;

      ALTER TABLE salary_records
      ADD COLUMN IF NOT EXISTS gross_salary NUMERIC(12,2)
      DEFAULT 0;

      ALTER TABLE salary_records
      ADD COLUMN IF NOT EXISTS deductions NUMERIC(12,2)
      DEFAULT 0;

      ALTER TABLE salary_records
      ADD COLUMN IF NOT EXISTS net_salary NUMERIC(12,2)
      DEFAULT 0;

      ALTER TABLE salary_records
      ADD COLUMN IF NOT EXISTS status VARCHAR(30)
      DEFAULT 'Pending Review';

      ALTER TABLE salary_records
      ADD COLUMN IF NOT EXISTS reviewed_by INT
      REFERENCES users(id);

      ALTER TABLE salary_records
      ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;

      ALTER TABLE salary_records
      ADD COLUMN IF NOT EXISTS approved_by INT
      REFERENCES users(id);

      ALTER TABLE salary_records
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

      ALTER TABLE salary_records
      ADD COLUMN IF NOT EXISTS processed_by INT
      REFERENCES users(id);

      ALTER TABLE salary_records
      ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP;

      ALTER TABLE salary_records
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
      DEFAULT NOW();
    `);

    /*
     * ============================================================
     * BACKFILL OLD SALARY RECORDS
     * ============================================================
     */

    await pool.query(`
      UPDATE salary_records

      SET
        basic_salary =
          CASE
            WHEN COALESCE(basic_salary, 0) = 0
            THEN COALESCE(amount, 0)
            ELSE basic_salary
          END,

        gross_salary =
          CASE
            WHEN COALESCE(gross_salary, 0) = 0
            THEN COALESCE(amount, 0)
            ELSE gross_salary
          END,

        net_salary =
          CASE
            WHEN COALESCE(net_salary, 0) = 0
            THEN COALESCE(amount, 0)
            ELSE net_salary
          END

      WHERE COALESCE(amount, 0) > 0;
    `);

    /*
     * ============================================================
     * BACKFILL EMPLOYEE SALARY
     * ============================================================
     */

    await pool.query(`
      UPDATE users AS u

      SET salary_basic = latest.amount

      FROM (
        SELECT DISTINCT ON (sr.user_id)
          sr.user_id,
          sr.amount

        FROM salary_records AS sr

        WHERE COALESCE(sr.amount, 0) > 0

        ORDER BY
          sr.user_id,
          sr.id DESC
      ) AS latest

      WHERE latest.user_id = u.id

        AND UPPER(TRIM(u.role)) = 'EMPLOYEE'

        AND COALESCE(u.salary_basic, 0) = 0;
    `);

    /*
     * ============================================================
     * PROJECT MIGRATION
     * ============================================================
     */

    await pool.query(`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS created_by INT
      REFERENCES users(id);

      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS lead_id INT
      REFERENCES users(id);

      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS start_date DATE;

      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS priority VARCHAR(20)
      DEFAULT 'Medium';
    `);

    /*
     * ============================================================
     * TASK MIGRATION
     * ============================================================
     */

    await pool.query(`
      ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS assignee_id INT
      REFERENCES users(id);

      ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS created_by INT
      REFERENCES users(id);

      ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS start_date DATE;

      ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS priority VARCHAR(20)
      DEFAULT 'Medium';
    `);

    /*
     * ============================================================
     * ANNOUNCEMENT MIGRATION
     * ============================================================
     */

    await pool.query(`
      ALTER TABLE announcements
      ADD COLUMN IF NOT EXISTS content TEXT;
    `);

    /*
     * ============================================================
     * LEAVE MIGRATION
     * ============================================================
     */

    await pool.query(`
      ALTER TABLE leave_requests
      ADD COLUMN IF NOT EXISTS leave_type VARCHAR(50)
      DEFAULT 'Leave';

      ALTER TABLE leave_requests
      ADD COLUMN IF NOT EXISTS reviewed_by INT
      REFERENCES users(id);
    `);

    /*
     * ============================================================
     * LEGACY COLUMN MIGRATION
     * ============================================================
     */

    await pool.query(`
      DO $$
      BEGIN

        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'projects'
            AND column_name = 'owner_id'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'projects'
            AND column_name = 'created_by'
        )
        THEN

          ALTER TABLE projects
          RENAME COLUMN owner_id TO created_by;

        END IF;


        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'tasks'
            AND column_name = 'assigned_to'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'tasks'
            AND column_name = 'assignee_id'
        )
        THEN

          ALTER TABLE tasks
          RENAME COLUMN assigned_to TO assignee_id;

        END IF;


        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'announcements'
            AND column_name = 'body'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'announcements'
            AND column_name = 'content'
        )
        THEN

          ALTER TABLE announcements
          RENAME COLUMN body TO content;

        END IF;

      END $$;
    `);

    /*
     * ============================================================
     * PRESERVE DATA FROM OLD COLUMN NAMES
     * ============================================================
     */

    await pool.query(`
      DO $$
      BEGIN

        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'projects'
            AND column_name = 'owner_id'
        )
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'projects'
            AND column_name = 'created_by'
        )
        THEN

          UPDATE projects
          SET created_by = COALESCE(created_by, owner_id);

        END IF;


        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'tasks'
            AND column_name = 'assigned_to'
        )
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'tasks'
            AND column_name = 'assignee_id'
        )
        THEN

          UPDATE tasks
          SET assignee_id = COALESCE(assignee_id, assigned_to);

        END IF;


        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'announcements'
            AND column_name = 'body'
        )
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'announcements'
            AND column_name = 'content'
        )
        THEN

          UPDATE announcements
          SET content = COALESCE(content, body);

        END IF;

      END $$;
    `);

    /*
     * ============================================================
     * TASK ASSIGNMENT MIGRATION
     * ============================================================
     */

    await pool.query(`
      ALTER TABLE task_assignments
      ADD COLUMN IF NOT EXISTS status VARCHAR(30)
      DEFAULT 'Pending';

      ALTER TABLE task_assignments
      ADD COLUMN IF NOT EXISTS progress INT
      DEFAULT 0;

      ALTER TABLE task_assignments
      ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;

      ALTER TABLE task_assignments
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
    `);

    /*
     * ============================================================
     * TASK ASSIGNMENT PROGRESS CONSTRAINT
     * ============================================================
     */

    await pool.query(`
      ALTER TABLE task_assignments
      DROP CONSTRAINT IF EXISTS task_assignments_progress_check;

      ALTER TABLE task_assignments
      ADD CONSTRAINT task_assignments_progress_check

      CHECK (
        progress >= 0
        AND progress <= 100
      );
    `);


    /*
     * ============================================================
     * GRANULAR PERMISSIONS + EMPLOYEE HISTORY
     * ============================================================
     */

    await pool.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id SERIAL PRIMARY KEY,
        permission_key VARCHAR(120) UNIQUE NOT NULL,
        permission_name VARCHAR(160) NOT NULL,
        module VARCHAR(60) NOT NULL,
        description TEXT,
        is_sensitive BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS role_permissions (
        id SERIAL PRIMARY KEY,
        role VARCHAR(20) NOT NULL,
        permission_id INT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        access VARCHAR(10) NOT NULL CHECK (access IN ('ALLOW','DENY')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(role, permission_id)
      );

      CREATE TABLE IF NOT EXISTS user_permissions (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        permission_id INT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        access VARCHAR(10) NOT NULL CHECK (access IN ('ALLOW','DENY')),
        granted_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, permission_id)
      );

      CREATE TABLE IF NOT EXISTS permission_audit_log (
        id SERIAL PRIMARY KEY,
        target_user_id INT REFERENCES users(id) ON DELETE SET NULL,
        permission_id INT REFERENCES permissions(id) ON DELETE SET NULL,
        old_access VARCHAR(10),
        new_access VARCHAR(10),
        changed_by INT REFERENCES users(id) ON DELETE SET NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS role_change_log (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        old_role VARCHAR(20),
        new_role VARCHAR(20),
        old_level VARCHAR(30),
        new_level VARCHAR(30),
        changed_by INT REFERENCES users(id) ON DELETE SET NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS promotion_history (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        old_level VARCHAR(30),
        new_level VARCHAR(30),
        old_role VARCHAR(20),
        new_role VARCHAR(20),
        effective_date DATE,
        reason TEXT,
        promoted_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_user_permissions_user
        ON user_permissions(user_id);
      CREATE INDEX IF NOT EXISTS idx_role_permissions_role
        ON role_permissions(role);
      CREATE INDEX IF NOT EXISTS idx_permission_audit_target
        ON permission_audit_log(target_user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_role_change_user
        ON role_change_log(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_promotion_history_user
        ON promotion_history(user_id, created_at DESC);
    `);

    /*
     * LOGIN TIMESTAMP MIGRATION
     *
     * Older versions used TIMESTAMP without a timezone. The application
     * wrote those values in UTC, so convert the existing values explicitly
     * to TIMESTAMPTZ before storing all future login/logout timestamps as
     * absolute instants.
     */
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'login_logs'
            AND column_name = 'login_at'
            AND data_type = 'timestamp without time zone'
        ) THEN
          ALTER TABLE login_logs
            ALTER COLUMN login_at TYPE TIMESTAMPTZ
              USING login_at AT TIME ZONE 'UTC';

          ALTER TABLE login_logs
            ALTER COLUMN logout_at TYPE TIMESTAMPTZ
              USING CASE
                WHEN logout_at IS NULL THEN NULL
                ELSE logout_at AT TIME ZONE 'UTC'
              END;
        END IF;

        ALTER TABLE login_logs
          ALTER COLUMN login_at SET DEFAULT CURRENT_TIMESTAMP;
      END $$;
    `);

    // Repair duplicate open sessions created by older versions before adding
    // the one-open-session constraint. Keep only the newest open session per user.
    await pool.query(`
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_at DESC, id DESC) AS rn
        FROM login_logs
        WHERE logout_at IS NULL
      )
      UPDATE login_logs l
      SET logout_at = CURRENT_TIMESTAMP
      FROM ranked r
      WHERE l.id = r.id AND r.rn > 1;
    `);

    /*
     * ============================================================
     * INDEXES
     * ============================================================
     */

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_salary_user_month
      ON salary_records (user_id, month);

      CREATE INDEX IF NOT EXISTS idx_login_logs_user_open
      ON login_logs (user_id, login_at DESC)
      WHERE logout_at IS NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_login_logs_one_open_session
      ON login_logs (user_id)
      WHERE logout_at IS NULL;

      CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
      ON notifications (
        user_id,
        read,
        created_at DESC
      );

      CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status
      ON password_reset_requests (
        status,
        requested_at DESC
      );

      CREATE INDEX IF NOT EXISTS idx_password_reset_requests_user
      ON password_reset_requests (
        user_id,
        requested_at DESC
      );

      CREATE INDEX IF NOT EXISTS idx_offboarding_records_user
      ON offboarding_records (
        user_id,
        created_at DESC
      );

      CREATE INDEX IF NOT EXISTS idx_offboarding_records_status
      ON offboarding_records (
        status,
        created_at DESC
      );

      CREATE INDEX IF NOT EXISTS idx_offboarding_audit_user
      ON offboarding_audit_log (
        user_id,
        created_at DESC
      );
    `);

    await seedPermissionCatalog();

    console.log("");
    console.log("====================================");
    console.log("Database schema created successfully");
    console.log("====================================");
    console.log("");

  } catch (error) {
    console.error("DATABASE INIT ERROR:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();