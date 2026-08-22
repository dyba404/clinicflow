import type { StaffRole } from "./types.js";

export type Permission =
  | "agenda.view_all"
  | "agenda.view_own"
  | "appointments.create"
  | "appointments.edit"
  | "appointments.cancel_own"
  | "checkin.perform"
  | "patients.manage"
  | "records.view"
  | "records.edit"
  | "records.edit_partial"
  | "payments.register"
  | "reports.view_all"
  | "reports.view_daily"
  | "reminders.send"
  | "staff.manage"
  | "services.manage"
  | "receipts.issue"
  | "inventory.manage"
  | "quotes.manage"
  | "labs.manage"
  | "commissions.manage"
  | "insurers.manage"
  | "waitlist.manage"
  | "campaigns.manage"
  | "vat.manage"
  | "branches.manage"
  | "arco.manage"
  | "hospital.manage"
  | "surgery.manage"
  | "icu.manage"
  | "billing.manage";

const ALL: Record<StaffRole, ReadonlyArray<Permission>> = {
  owner: [
    "agenda.view_all",
    "agenda.view_own",
    "appointments.create",
    "appointments.edit",
    "appointments.cancel_own",
    "checkin.perform",
    "patients.manage",
    "records.view",
    "records.edit",
    "records.edit_partial",
    "payments.register",
    "reports.view_all",
    "reports.view_daily",
    "reminders.send",
    "staff.manage",
    "services.manage",
    "receipts.issue",
    "inventory.manage",
    "quotes.manage",
    "labs.manage",
    "commissions.manage",
    "insurers.manage",
    "waitlist.manage",
    "campaigns.manage",
    "vat.manage",
    "branches.manage",
    "arco.manage",
    "hospital.manage",
    "surgery.manage",
    "icu.manage",
    "billing.manage",
  ],
  receptionist: [
    "agenda.view_all",
    "appointments.create",
    "appointments.edit",
    "checkin.perform",
    "patients.manage",
    "records.view",
    "payments.register",
    "reports.view_daily",
    "reminders.send",
    "receipts.issue",
    "quotes.manage",
    "insurers.manage",
    "waitlist.manage",
    "campaigns.manage",
    "billing.manage",
  ],
  assistant: [
    "agenda.view_all",
    "checkin.perform",
    "patients.manage",
    "records.edit_partial",
    "inventory.manage",
    "labs.manage",
    "hospital.manage",
  ],
  doctor: [
    "agenda.view_own",
    "appointments.create",
    "appointments.cancel_own",
    "records.view",
    "records.edit",
    "patients.manage",
    "quotes.manage",
    "labs.manage",
    "hospital.manage",
    "surgery.manage",
    "icu.manage",
  ],
};

export function permissionsFor(role: StaffRole): ReadonlyArray<Permission> {
  return ALL[role];
}

export function hasPermission(role: StaffRole, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}

export interface AccessContext {
  tenantId: string;
  role: StaffRole;
  membershipId: string;
  insideShift: boolean;
}

export function canAccess(ctx: AccessContext, restrictionOut: boolean): boolean {
  if (!ctx.role) return false;
  if (restrictionOut && !ctx.insideShift) return false;
  return true;
}
