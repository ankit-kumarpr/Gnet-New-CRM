import { MasterList } from "./MasterList";

export function WorkModes() {
  return (
    <MasterList
      title="Work mode"
      description="Office, remote, hybrid, and other work modes."
      endpoint="/admin/work-modes"
      placeholder="e.g. Office"
      permissionModule="WORK_MODES"
    />
  );
}
