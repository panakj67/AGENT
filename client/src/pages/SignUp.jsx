import React, { useContext, useState } from "react";
import bg from "../assets/authBg.png";
import { IoEye } from "react-icons/io5";
import { IoEyeOff } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { userDataContext } from "../context/UserContext";
import axios from "axios";
import toast from "react-hot-toast";
import Aura from '../assets/Aura.png'

function SignUp() {
  const [showPassword, setShowPassword] = useState(false);
  const { serverUrl, userData, setUserData } = useContext(userDataContext);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let { data } = await axios.post(
        `/api/auth/signup`,
        {
          name,
          email,
          password,
        },
        { withCredentials: true }
      );
      if (data.success) {
        toast.success(data.message);
        setUserData(data.user);
        navigate("/");
      } else toast.error(data.message);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setName("");
      setEmail("");
      setPassword("");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
       {/* Background gradients */}
  <div className="absolute top-0 left-1/2 -translate-x-1/2 h-40 w-80 bg-gradient-to-b from-purple-300/40 to-transparent blur-3xl rounded-full pointer-events-none" />
  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-40 w-80 bg-gradient-to-t from-blue-300/40 to-transparent blur-3xl rounded-full pointer-events-none" />

      <div className="w-full border-2 border-white bg-gradient-to-br from-blue-100/30 relative max-w-[400px] rounded-2xl bg-white py-4 px-6 shadow-md overflow-hidden">
        {/* Decorative circle */}
        <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-gradient-to-br from-purple-200 to-blue-200 opacity-50 pointer-events-none" />
        
        {/* Logo + Title */}
        <div className="text-center relative z-10">
          <div className="flex justify-center items-center  mb-2">
            {/* Placeholder logo */}
            <div className="h-10 w-10 rounded-full">
              <img className="h-full w-full object-cover"
             src={Aura} alt="" />
            </div>
            <p className="text-2xl font-[500]">Aura</p>
          </div>
          <h2 className="text-2xl font-bold">Let's Get Started</h2>
          <p className="text-gray-500 text-sm">
            Enter your details to create your new account
          </p>
        </div>

        {/* Social Buttons */}
        {/* <div className="mt-6 flex justify-center gap-4">
          <button className="flex items-center justify-center rounded-full border border-gray-300 p-3 hover:bg-gray-100">
            <FcGoogle size={20} />
          </button>
          <button className="flex items-center justify-center rounded-full border border-gray-300 p-3 hover:bg-gray-100">
            <FaApple size={20} />
          </button>
          <button className="flex items-center justify-center rounded-full border border-gray-300 p-3 hover:bg-gray-100">
            <FaXTwitter size={20} />
          </button>
        </div> */}

        {/* Divider */}
        <div className="my-6 flex items-center">
          <div className="h-px flex-1 bg-gray-200" />
          {/* <span className="px-3 text-sm text-gray-400">OR</span> */}
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        {/* Email + Password */}
        <form className="space-y-2" onSubmit={handleSignUp}>
                    <div>
            <label className="block text-sm text-gray-600">
              Your Name
            </label>
            <input
              name="name"
              type="text"
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-black focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600">
              Your Email Address
            </label>
            <input
              name="email"
              type="email"
              placeholder="Your Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-black focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600">Password</label>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="*********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-black focus:outline-none"
                required
              />
              <button
                type="button"
                className="absolute cursor-pointer right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
            <div className="flex justify-between text-sm mt-1">
              
              {/* <a href="#" className="text-gray-800 hover:underline">
                Forgot password?
              </a> */}
            </div>
          </div>

          {/* Sign In Button */}
          <button disabled={loading} className={`w-full mt-2 cursor-pointer rounded-lg bg-gradient-to-b from-gray-900 to-gray-700 py-2 text-white shadow
            ${loading ? 'from-gray-700 to-gray-500 cursor-not-allowed' : 'from-gray-900 to-gray-700 hover:opacity-90 cursor-pointer'}`}>
              { !loading ? "Sign in" : "Loading..."}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <button onClick={() => navigate('/signin')} className="font-semibold inline cursor-pointer text-black hover:underline">
            Sign In
          </button>
        </p>
      </div>
    </div>
  );
}

export default SignUp;
