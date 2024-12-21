export const USER_TYPE_OPTIONS = [
  { id: "Pharmacist", role: "Pharmacist", readOnly: false },
  { id: "Volunteer", role: "Volunteer", readOnly: false },
  { id: "StaffReadOnly", role: "Staff", readOnly: true },
  { id: "Staff", role: "Staff", readOnly: false },
  // { id: "NurseReadOnly", role: "Nurse", readOnly: true },
  { id: "Nurse", role: "Nurse", readOnly: false },
  { id: "Doctor", role: "Doctor", readOnly: false },
  { id: "WardAdmin", role: "Ward Admin", readOnly: false },
  { id: "LocalBodyAdmin", role: "Local Body Admin", readOnly: false },
  { id: "DistrictLabAdmin", role: "District Lab Admin", readOnly: false },
  { id: "DistrictReadOnlyAdmin", role: "District Admin", readOnly: true },
  { id: "DistrictAdmin", role: "District Admin", readOnly: false },
  { id: "StateLabAdmin", role: "State Lab Admin", readOnly: false },
  { id: "StateReadOnlyAdmin", role: "State Admin", readOnly: true },
  { id: "StateAdmin", role: "State Admin", readOnly: false },
] as const;

export const USER_LAST_ACTIVE_OPTIONS = [
  { id: 1, text: "24 hours" },
  { id: 7, text: "7 days" },
  { id: 30, text: "30 days" },
  { id: 90, text: "90 days" },
  { id: 365, text: "1 Year" },
  { id: "never", text: "Never" },
];
