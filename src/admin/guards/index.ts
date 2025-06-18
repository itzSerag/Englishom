export * from './admin-roles.guard';
export * from './super-admin.guard';

// Export with new names for clarity
export { AdminRoleGuard } from './admin-roles.guard';
export { IsAdminGuard } from './super-admin.guard';
