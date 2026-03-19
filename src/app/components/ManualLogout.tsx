import { useState } from "react";
import { useNavigate } from "react-router";
import { LogOut, AlertTriangle, CheckCircle } from "lucide-react";

export function ManualLogout() {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [loggedOut, setLoggedOut] = useState(false);
  const navigate = useNavigate();

  const handleLogoutClick = () => {
    setShowConfirmation(true);
  };

  const handleConfirmLogout = () => {
    setIsLoggingOut(true);
    
    // Clear localStorage and logout
    setTimeout(() => {
      setIsLoggingOut(false);
      setLoggedOut(true);
      
      // Clear auth data
      localStorage.removeItem('authToken');
      localStorage.removeItem('employeeId');
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        setShowConfirmation(false);
        setLoggedOut(false);
        navigate('/login');
      }, 3000);
    }, 1500);
  };

  const handleCancelLogout = () => {
    setShowConfirmation(false);
    setLoggedOut(false);
  };

  return (
    <div className="p-8">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-8">Manual Logout</h2>

        {!showConfirmation && !loggedOut && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="w-24 h-24 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
              <LogOut className="w-12 h-12 text-red-500" />
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Admin Logout
            </h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              This will log you out of the attendance system. You'll need to log in again to access the system.
            </p>

            <button
              onClick={handleLogoutClick}
              className="px-8 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        )}

        {showConfirmation && !loggedOut && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {!isLoggingOut ? (
              <>
                <div className="p-8 text-center border-b border-gray-200">
                  <div className="w-20 h-20 rounded-full bg-yellow-50 flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="w-10 h-10 text-yellow-600" />
                  </div>
                  
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Are you sure you want to log out?
                  </h3>
                  <p className="text-gray-600">
                    You will be logged out of the SmartQ Systems Attendance application.
                  </p>
                </div>

                <div className="p-6 bg-gray-50 flex gap-3 justify-center">
                  <button
                    onClick={handleCancelLogout}
                    className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmLogout}
                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Yes, Logout
                  </button>
                </div>
              </>
            ) : (
              <div className="p-12 text-center">
                <div className="w-16 h-16 border-4 border-gray-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Logging out...</p>
              </div>
            )}
          </div>
        )}

        {loggedOut && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: "#E8F5E8" }}>
              <CheckCircle className="w-12 h-12" style={{ color: "#32AD32" }} />
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Successfully Logged Out
            </h3>
            <p className="text-gray-600 mb-4">
              You have been logged out of the system.
            </p>
            <p className="text-sm text-gray-500">
              Redirecting to main screen...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
