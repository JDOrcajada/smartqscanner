export interface Employee {
  id: string;
  name: string;
  department: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  timeIn: string;
  timeOut: string | null;
  status: "Present" | "Late" | "Absent";
}

export const employees: Employee[] = [
  { id: "EMP001", name: "John Smith", department: "Engineering" },
  { id: "EMP002", name: "Sarah Johnson", department: "Human Resources" },
  { id: "EMP003", name: "Michael Chen", department: "Sales" },
  { id: "EMP004", name: "Emily Williams", department: "Engineering" },
  { id: "EMP005", name: "David Brown", department: "Marketing" },
  { id: "EMP006", name: "Jessica Davis", department: "Finance" },
  { id: "EMP007", name: "Robert Wilson", department: "Operations" },
  { id: "EMP008", name: "Amanda Martinez", department: "Engineering" },
];

export const attendanceRecords: AttendanceRecord[] = [
  {
    id: "1",
    employeeId: "EMP001",
    employeeName: "John Smith",
    date: "2026-03-13",
    timeIn: "08:45 AM",
    timeOut: "05:30 PM",
    status: "Present",
  },
  {
    id: "2",
    employeeId: "EMP002",
    employeeName: "Sarah Johnson",
    date: "2026-03-13",
    timeIn: "09:15 AM",
    timeOut: "06:00 PM",
    status: "Late",
  },
  {
    id: "3",
    employeeId: "EMP003",
    employeeName: "Michael Chen",
    date: "2026-03-13",
    timeIn: "08:30 AM",
    timeOut: null,
    status: "Present",
  },
  {
    id: "4",
    employeeId: "EMP004",
    employeeName: "Emily Williams",
    date: "2026-03-13",
    timeIn: "08:50 AM",
    timeOut: "05:45 PM",
    status: "Present",
  },
  {
    id: "5",
    employeeId: "EMP001",
    employeeName: "John Smith",
    date: "2026-03-12",
    timeIn: "08:40 AM",
    timeOut: "05:20 PM",
    status: "Present",
  },
  {
    id: "6",
    employeeId: "EMP005",
    employeeName: "David Brown",
    date: "2026-03-12",
    timeIn: "08:55 AM",
    timeOut: "05:35 PM",
    status: "Present",
  },
  {
    id: "7",
    employeeId: "EMP006",
    employeeName: "Jessica Davis",
    date: "2026-03-13",
    timeIn: "08:35 AM",
    timeOut: "05:15 PM",
    status: "Present",
  },
  {
    id: "8",
    employeeId: "EMP007",
    employeeName: "Robert Wilson",
    date: "2026-03-13",
    timeIn: "09:30 AM",
    timeOut: null,
    status: "Late",
  },
];

export const departments = [
  "All Departments",
  "Engineering",
  "Human Resources",
  "Sales",
  "Marketing",
  "Finance",
  "Operations",
];
