import { createBrowserRouter, Navigate } from "react-router";
import { Layout } from "./components/Layout";
import { TimeInOut } from "./components/TimeInOut";
import { SearchAttendance } from "./components/SearchAttendance";
import { GenerateReports } from "./components/GenerateReports";
import { ManualLogout } from "./components/ManualLogout";
import { EmployeeList } from "./components/EmployeeList";
import { MonthlyRecords } from "./components/MonthlyRecords";
import { AdminApproval } from "./components/AdminApproval";
import { HolidayManager } from "./components/HolidayManager";
import { LeaveManager } from "./components/LeaveManager";
import LoginPage from "./components/LoginPage";
import SignUpPage from "./components/SignUpPage";

// These must be defined OUTSIDE createBrowserRouter to avoid remount issues
function ProtectedLayout() {
  const token = localStorage.getItem('authToken');
  if (!token) return <Navigate to="/login" replace />;
  return <Layout />;
}

function NotFound() {
  const token = localStorage.getItem('authToken');
  return token ? <Navigate to="/" replace /> : <Navigate to="/login" replace />;
}

export const router = createBrowserRouter([
  { path: "/login", Component: LoginPage },
  { path: "/signup", Component: SignUpPage },
  {
    path: "/",
    Component: ProtectedLayout,
    children: [
      { index: true, Component: TimeInOut },
      { path: "search", Component: SearchAttendance },
      { path: "monthly", Component: MonthlyRecords },
      { path: "reports", Component: GenerateReports },
      { path: "employees", Component: EmployeeList },
      { path: "logout", Component: ManualLogout },
      { path: "admin-approval", Component: AdminApproval },
      { path: "holidays", Component: HolidayManager },
      { path: "leave-manager", Component: LeaveManager },
    ],
  },
  { path: "*", Component: NotFound },
]);
