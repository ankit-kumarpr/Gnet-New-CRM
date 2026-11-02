import { MasterList } from "./MasterList";

export function LeaveTypes() {
  return (
    <MasterList
      title="Leave type"
      description="Casual, sick, earned, and other leave names."
      endpoint="/admin/leave-types"
      placeholder="e.g. Casual leave"
      permissionModule="LEAVE_TYPES"
    />
  );
}
