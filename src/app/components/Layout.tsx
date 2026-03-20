import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router";
import { Clock, Search, FileText, LogOut, User, Users } from "lucide-react";

interface EmployeeProfile {
  id: number;
  name: string;
  role: string;
  picture: string | null;
  status: string;
}

export function Layout() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const location = useLocation();
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadProfile = () => {
      const employeeId = localStorage.getItem("employeeId");
      const token = localStorage.getItem("authToken");
      if (!employeeId || !token) return;

      fetch("http://localhost:5000/api/employees", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((employees: EmployeeProfile[]) => {
          const found = employees.find(
            (employee) => employee.id.toString() === employeeId.toString()
          );
          if (found) setProfile(found);
        })
        .catch(() => {});
    };

    loadProfile();
    window.addEventListener("profile-updated", loadProfile);

    return () => {
      window.removeEventListener("profile-updated", loadProfile);
    };
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const navItems = [
    { path: "/", label: "Time In / Time Out", icon: Clock },
    { path: "/search", label: "Search Attendance", icon: Search },
    { path: "/reports", label: "Generate Reports", icon: FileText },
    { path: "/employees", label: "Employee List", icon: Users },
    { path: "/logout", label: "Manual Logout", icon: LogOut },
  ];

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <img src="/smartqlogo.png" alt="SmartQ Logo" className="w-10 h-10 object-contain" />
            <div>
              <h2 className="font-semibold text-gray-900">SmartQ Systems</h2>
              <p className="text-xs text-gray-500">Attendance</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? "text-white"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                    style={isActive ? { backgroundColor: "#32AD32" } : {}}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 text-center">
            © 2026 SmartQ Systems
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">SmartQ Systems</h1>
              <p className="text-sm text-gray-600 mt-1">{formatDate(currentTime)}</p>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-2xl font-semibold" style={{ color: "#32AD32" }}>
                  {formatTime(currentTime)}
                </div>
              </div>

              <div
                className="relative"
                onMouseEnter={() => setTooltipVisible(true)}
                onMouseLeave={() => setTooltipVisible(false)}
              >
                {profile?.picture ? (
                  <img
                    src={profile.picture}
                    alt={profile.name}
                    className="w-10 h-10 rounded-full object-cover border-2"
                    style={{ borderColor: "#32AD32" }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-200">
                    <User className="w-5 h-5 text-gray-600" />
                  </div>
                )}

                {tooltipVisible && profile && (
                  <div className="absolute right-0 top-12 z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                    <div className="font-semibold">{profile.name}</div>
                    <div className="text-gray-400">{profile.id}</div>
                    {/* Tooltip arrow */}
                    <div className="absolute -top-1.5 right-3 w-3 h-3 bg-gray-900 rotate-45" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
