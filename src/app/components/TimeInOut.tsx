import { useState } from "react";
import { CheckCircle, UserCheck, Search } from "lucide-react";
import { employees } from "../data/mockData";

type SubmitStatus = "idle" | "loading" | "success" | "error";
type ActionType = "Time In" | "Time Out";

export function TimeInOut() {
  const [inputValue, setInputValue] = useState("");
  const [action, setAction] = useState<ActionType>("Time In");
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [foundEmployee, setFoundEmployee] = useState<typeof employees[0] | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    setSubmitStatus("loading");
    setErrorMessage("");

    // Search by ID or name (case-insensitive)
    const match = employees.find(
      (emp) =>
        emp.id.toLowerCase() === inputValue.trim().toLowerCase() ||
        emp.name.toLowerCase().includes(inputValue.trim().toLowerCase())
    );

    setTimeout(() => {
      if (match) {
        setFoundEmployee(match);
        setSubmitStatus("success");

        // Reset after 5 seconds
        setTimeout(() => {
          setSubmitStatus("idle");
          setFoundEmployee(null);
          setInputValue("");
        }, 5000);
      } else {
        setErrorMessage("Employee not found. Check the ID or name and try again.");
        setSubmitStatus("error");
      }
    }, 600);
  };

  const handleReset = () => {
    setSubmitStatus("idle");
    setFoundEmployee(null);
    setInputValue("");
    setErrorMessage("");
  };

  return (
    <div className="p-8">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-8">Time In / Time Out</h2>

        <div className="bg-white rounded-lg border border-gray-200 p-12">
          {(submitStatus === "idle" || submitStatus === "error") && (
            <div className="max-w-md mx-auto">
              <div className="flex items-center justify-center w-16 h-16 rounded-full mx-auto mb-6" style={{ backgroundColor: "#E8F5E8" }}>
                <UserCheck className="w-8 h-8" style={{ color: "#32AD32" }} />
              </div>

              <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">
                Mark Attendance
              </h3>
              <p className="text-gray-500 text-center mb-8">
                Enter the employee ID or name to record attendance
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Action toggle */}
                <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-6">
                  {(["Time In", "Time Out"] as ActionType[]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setAction(opt)}
                      className="flex-1 py-2.5 text-sm font-medium transition-colors"
                      style={
                        action === opt
                          ? { backgroundColor: "#32AD32", color: "#fff" }
                          : { backgroundColor: "#fff", color: "#374151" }
                      }
                    >
                      {opt}
                    </button>
                  ))}
                </div>

                {/* Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      if (submitStatus === "error") setSubmitStatus("idle");
                    }}
                    placeholder="Employee ID or Name (e.g. EMP001 or John)"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50"
                    style={{ '--tw-ring-color': '#32AD32' } as React.CSSProperties}
                    autoFocus
                  />
                </div>

                {/* Error */}
                {submitStatus === "error" && (
                  <p className="text-sm text-red-600">{errorMessage}</p>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={!inputValue.trim() || submitStatus === "loading"}
                  className="w-full py-3 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  style={{ backgroundColor: "#32AD32" }}
                >
                  {submitStatus === "loading" ? "Processing..." : `Record ${action}`}
                </button>
              </form>
            </div>
          )}

          {submitStatus === "success" && foundEmployee && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-48 h-48 rounded-lg mb-6" style={{ backgroundColor: "#E8F5E8" }}>
                <CheckCircle className="w-24 h-24" style={{ color: "#32AD32" }} />
              </div>

              <div className="mb-6 p-6 bg-green-50 rounded-lg inline-block">
                <div className="text-2xl font-semibold mb-2" style={{ color: "#32AD32" }}>
                  {action} Recorded Successfully!
                </div>
                <p className="text-gray-600">
                  {new Date().toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-md mx-auto">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Employee Information</h4>

                <div className="space-y-3 text-left">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Employee Name:</span>
                    <span className="font-semibold text-gray-900">{foundEmployee.name}</span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Employee ID:</span>
                    <span className="font-semibold text-gray-900">{foundEmployee.id}</span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Department:</span>
                    <span className="font-semibold text-gray-900">{foundEmployee.department}</span>
                  </div>

                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">Action:</span>
                    <span className="px-3 py-1 rounded-full text-sm text-white" style={{ backgroundColor: "#32AD32" }}>
                      {action}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleReset}
                className="mt-6 px-6 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors text-sm"
              >
                Record Another
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

