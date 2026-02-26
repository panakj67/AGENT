
import { useContext } from "react";
import { userDataContext } from "../context/UserContext";
import Signin from "../pages/SignIn";

const ProtectedRoute = ({ element }) => {
  
  const {loading, setLoading, userData, darkMode} = useContext(userDataContext) // We'll set this up in Step 3
  console.log(loading);
  if (loading) {
    return (
      <div
        className={`flex flex-col items-center text-blue-600 ${darkMode ? "bg-black" : "bg-gradient-to-tr from-white via-indigo-50 to-indigo-100"} 
 justify-center h-screen`}
      >
        <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin"></div>
        <p className="mt-6 text-xl font-semibold animate-pulse tracking-wide">
          Loading, please wait...
        </p>
      </div>
    );
  }
  return userData ? element : <Signin />;
};

export default ProtectedRoute;
