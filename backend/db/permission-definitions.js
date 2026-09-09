const PERMISSIONS = [
  ['dashboard.view','View Dashboard','DASHBOARD','View the dashboard',false],
  ['employees.view','View Employees','EMPLOYEES','View employee records',true],
  ['employees.create','Create Employees','EMPLOYEES','Create employee accounts',true],
  ['employees.edit','Edit Employees','EMPLOYEES','Edit employee details',true],
  ['employees.block','Block Employees','EMPLOYEES','Block or unblock accounts',true],
  ['employees.manage_roles','Manage Roles','EMPLOYEES','Change employee roles and levels',true],
  ['employees.manage_permissions','Manage Permissions','EMPLOYEES','Grant or revoke employee permissions',true],
  ['interns.view','View Interns','INTERNS','View intern records',false],
  ['interns.create','Create Interns','INTERNS','Create intern accounts',true],
  ['interns.edit','Edit Interns','INTERNS','Edit intern details',true],
  ['projects.view_assigned','View Assigned Projects','PROJECTS','View assigned projects',false],
  ['projects.view_all','View All Projects','PROJECTS','View all projects',false],
  ['projects.create','Create Projects','PROJECTS','Create projects',false],
  ['projects.edit','Edit Projects','PROJECTS','Edit projects',false],
  ['projects.delete','Delete Projects','PROJECTS','Delete projects',true],
  ['projects.manage_members','Manage Project Members','PROJECTS','Manage project membership',false],
  ['projects.change_phase','Change Project Phase','PROJECTS','Advance project phases',false],
  ['tasks.view_assigned','View Assigned Tasks','TASKS','View assigned tasks',false],
  ['tasks.view_all','View All Tasks','TASKS','View all tasks',false],
  ['tasks.create','Create Tasks','TASKS','Create tasks',false],
  ['tasks.edit','Edit Tasks','TASKS','Edit tasks',false],
  ['tasks.delete','Delete Tasks','TASKS','Delete tasks',true],
  ['tasks.assign','Assign Tasks','TASKS','Assign tasks to users',false],
  ['tasks.update_progress','Update Task Progress','TASKS','Update task progress',false],
  ['attendance.view_own','View Own Attendance','ATTENDANCE','View own attendance',false],
  ['attendance.view_all','View All Attendance','ATTENDANCE','View other attendance records',true],
  ['attendance.manage','Manage Attendance','ATTENDANCE','Manage attendance records',true],
  ['leave.view_own','View Own Leave','LEAVE','View own leave',false],
  ['leave.view_all','View All Leave','LEAVE','View other leave requests',true],
  ['leave.apply','Apply Leave','LEAVE','Submit leave requests',false],
  ['leave.edit_own','Edit Own Leave','LEAVE','Edit own leave requests',false],
  ['leave.approve','Approve Leave','LEAVE','Approve leave requests',true],
  ['leave.reject','Reject Leave','LEAVE','Reject leave requests',true],
  ['daily_work.view_own','View Own Daily Work','DAILY WORK','View own work logs',false],
  ['daily_work.view_all','View All Daily Work','DAILY WORK','View team work logs',false],
  ['daily_work.create','Create Daily Work','DAILY WORK','Create work logs',false],
  ['daily_work.manage','Manage Daily Work','DAILY WORK','Manage work logs',false],
  // [/* 'salary.view_own' */,'View Own Salary','SALARY','View own salary',true],
  // [/* 'salary.view_all' */,'View All Salary','SALARY','View employee salary',true],
  // [/* 'salary.create' */,'Create Salary Records','SALARY','Create salary records',true],
  // [/* 'salary.edit' */,'Edit Salary Records','SALARY','Edit salary records',true],
  // [/* 'salary.review' */,'Review Salary','SALARY','Review salary records',true],
  // [/* 'salary.approve' */,'Approve Salary','SALARY','Approve salary records',true],
  // [/* 'salary.process' */,'Process Salary','SALARY','Process payroll',true],
  // [/* 'overtime.view_own' */,'View Own Overtime','OVERTIME','View own overtime',false],
  // [/* 'overtime.view_all' */,'View All Overtime','OVERTIME','View team overtime',true],
  // [/* 'overtime.submit' */,'Submit Overtime','OVERTIME','Submit overtime',false],
  // [/* 'overtime.edit' */,'Edit Overtime','OVERTIME','Edit overtime',false],
  // [/* 'overtime.approve' */,'Approve Overtime','OVERTIME','Approve overtime',true],
  // [/* 'overtime.manage' */,'Manage Overtime','OVERTIME','Manage overtime',true],
  ['announcements.view','View Announcements','ANNOUNCEMENTS','View announcements',false],
  ['announcements.create','Create Announcements','ANNOUNCEMENTS','Create announcements',false],
  ['announcements.edit','Edit Announcements','ANNOUNCEMENTS','Edit announcements',false],
  ['announcements.delete','Delete Announcements','ANNOUNCEMENTS','Delete announcements',true],
  ['calendar.view','View Calendar','CALENDAR','View company calendar',false],
  ['calendar.create','Create Calendar Events','CALENDAR','Create events',false],
  ['calendar.edit','Edit Calendar Events','CALENDAR','Edit events',false],
  ['calendar.delete','Delete Calendar Events','CALENDAR','Delete events',true],
  ['organization.view','View Organization','ORGANIZATION','View organization information',false],
  ['organization.manage','Manage Organization','ORGANIZATION','Manage organization settings',true],
  ['chat.use','Use Chat','CHAT','Use company chat',false],
  ['chat.create_group','Create Chat Groups','CHAT','Create chat groups',false],
  ['chat.manage_group','Manage Chat Groups','CHAT','Manage chat groups',false],
  ['chat.delete_own','Delete Own Messages','CHAT','Delete own chat messages',false],
  ['message_monitoring.view','View Monitored Messages','MESSAGE MONITORING','View monitored messages',true],
  ['message_monitoring.view_deleted','View Deleted Messages','MESSAGE MONITORING','View deleted messages',true],
  ['message_monitoring.search','Search Monitored Messages','MESSAGE MONITORING','Search monitored messages',true],
  ['message_monitoring.export','Export Monitoring Data','MESSAGE MONITORING','Export monitoring information',true],
  ['code.view','View Repositories','CODE MANAGEMENT','View repositories',false],
  ['code.create_repository','Create Repository','CODE MANAGEMENT','Create repositories',true],
  ['code.edit_repository','Edit Repository','CODE MANAGEMENT','Edit repositories',false],
  ['code.manage_members','Manage Repository Members','CODE MANAGEMENT','Manage repository membership',true],
  ['code.upload','Upload Files','CODE MANAGEMENT','Upload repository files',false],
  ['code.download','Download Files','CODE MANAGEMENT','Download repository files',false],
  ['code.delete_files','Delete Files','CODE MANAGEMENT','Delete repository files',true],
  ['code.create_version','Create Version','CODE MANAGEMENT','Create repository versions',false],
  ['code.create_mr','Create Merge Request','CODE MANAGEMENT','Create merge requests',false],
  ['code.review_mr','Review Merge Request','CODE MANAGEMENT','Review merge requests',true],
  ['code.approve_mr','Approve Merge Request','CODE MANAGEMENT','Approve merge requests',true],
  ['code.merge','Merge Changes','CODE MANAGEMENT','Merge approved changes',true],
  ['code.delete_repository','Delete Repository','CODE MANAGEMENT','Delete repositories',true],
  ['offboarding.manage','Manage Offboarding','OFFBOARDING','Start/cancel/manage offboarding',true],
  ['account.view','View Account','ACCOUNT','View account settings',false],
  ['account.manage','Manage Account','ACCOUNT','Manage account settings',true]
];

function roleDefault(role, key) {
  const r = role.toUpperCase();
  if (r === 'CEO' || r === 'ADMIN') return 'ALLOW';
  if (r === 'HR') {
    if (['employees.view','employees.create','employees.edit','employees.manage_roles','interns.view','interns.create','interns.edit','projects.view_assigned','projects.view_all','projects.create','projects.edit','projects.change_phase','tasks.view_assigned','tasks.view_all','tasks.create','tasks.edit','tasks.delete','tasks.assign','tasks.update_progress','attendance.view_all','attendance.manage','leave.view_all','leave.approve','leave.reject','daily_work.view_all','daily_work.manage',/* 'salary.view_own' */,/* 'salary.view_all' */,/* 'salary.create' */,/* 'salary.edit' */,/* 'salary.review' */,/* 'overtime.view_all' */,/* 'overtime.approve' */,/* 'overtime.manage' */,'announcements.view','announcements.create','announcements.edit','announcements.delete','calendar.view','calendar.create','calendar.edit','calendar.delete','organization.view','organization.manage','chat.use','chat.create_group','chat.manage_group','chat.delete_own','message_monitoring.view','message_monitoring.view_deleted','message_monitoring.search','code.view'].includes(key)) return 'ALLOW';
    return 'DENY';
  }
  if (r === 'EMPLOYEE') {
    return ['dashboard.view','projects.view_assigned','tasks.view_assigned','tasks.update_progress','attendance.view_own','leave.view_own','leave.apply','leave.edit_own','daily_work.view_own','daily_work.create',/* 'salary.view_own' */,/* 'overtime.view_own' */,/* 'overtime.submit' */,/* 'overtime.edit' */,'announcements.view','calendar.view','organization.view','chat.use','chat.create_group','chat.delete_own','code.view','code.download','code.upload','code.create_version','code.create_mr','account.view','account.manage'].includes(key) ? 'ALLOW' : 'DENY';
  }
  if (r === 'INTERN') {
    return ['dashboard.view','projects.view_assigned','tasks.view_assigned','tasks.update_progress','attendance.view_own','leave.view_own','leave.apply','leave.edit_own','daily_work.view_own','daily_work.create',/* 'overtime.view_own' */,/* 'overtime.submit' */,'announcements.view','calendar.view','organization.view','chat.use','chat.delete_own','code.view','code.download','account.view','account.manage'].includes(key) ? 'ALLOW' : 'DENY';
  }
  return 'DENY';
}


module.exports = { PERMISSIONS, roleDefault };
