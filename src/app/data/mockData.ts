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


