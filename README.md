# TrioByte Salary + Login Update

Updated files implement:
- Empty login email/password fields; no visible demo credentials.
- Automatic monthly salary generation on the 1st of each month, with a first-week catch-up if the backend was offline on the 1st.
- Salary records generated from employee salary configuration stored on users.
- Detailed salary breakdown.
- HR: Mark Reviewed.
- Admin: Approve & Process.
- CEO: Approve / Override.
- Employees: view their own salary records only.
- Salary processing persisted in PostgreSQL and notifies the employee.
- Database migration fields and unique `(user_id, month)` protection.

Important: `frontend/src/Triobyte.jpeg` is included as the exact logo asset currently used by the project.
