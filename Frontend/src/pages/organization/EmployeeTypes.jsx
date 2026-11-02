import { MasterList } from "./MasterList";

export function EmployeeTypes() {
  return (
    <MasterList
      title="Employee type"
      description="Permanent, contract, intern, and other staff types."
      endpoint="/admin/employee-types"
      placeholder="e.g. Permanent"
      permissionModule="EMPLOYEE_TYPES"
    />
  );
}
