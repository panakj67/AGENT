import { useContext, useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { FaApple } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { userDataContext } from "../context/UserContext";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast"
import axios from "axios";
import Aura from '../assets/Aura.png'

export default function Signin() {
  const [showPassword, setShowPassword] = useState(false);
  const { serverUrl, setAllChats, userData, setUserData } = useContext(userDataContext)
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState("")


  const handleSignIn = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      let {data} = await axios.post(`/api/auth/signin`, {
        email, password
      }, { withCredentials: true })
      if(data.success) {
        setUserData(data.user);
        console.log(data.user);
        
        setAllChats(data.user.chats);
        toast.success(data.message)
        navigate("/");
      }else toast.error(data.message)
    } catch (error) {
      toast.error(error.message);
    }
    finally{
      setEmail("")
      setPassword("")
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
  {/* Background gradients */}
  <div className="absolute top-0 left-1/2 -translate-x-1/2 h-40 w-80 bg-gradient-to-b from-purple-300/40 to-transparent blur-3xl rounded-full pointer-events-none" />
  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-40 w-80 bg-gradient-to-t from-blue-300/40 to-transparent blur-3xl rounded-full pointer-events-none" />

  {/* Card */}
  <div className="w-full border-2 border-white bg-gradient-to-br from-blue-100/30 relative max-w-[400px] rounded-2xl bg-white py-4 px-6 shadow-md overflow-hidden">
    {/* Decorative Half Circle */}
    <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-gradient-to-br from-purple-200 to-blue-200 opacity-50 pointer-events-none" />

    {/* Logo + Title */}
    <div className="text-center relative z-10">
      <div className="flex justify-center items-center mb-2">
        <div className="h-10 w-10 rounded-full">
          <img
            className="h-full w-full object-cover"
            src={Aura}
            alt=""
          />
        </div>
        <p className="text-2xl font-[500]">Aura</p>
      </div>
      <h2 className="text-2xl font-bold">Welcome back</h2>
      <p className="text-gray-500 text-sm">
        Please enter your details to sign in
      </p>
    </div>

    {/* Divider */}
    <div className="my-6 flex items-center relative z-10">
      <div className="h-px flex-1 bg-gray-200" />
      <div className="h-px flex-1 bg-gray-200" />
    </div>

    {/* Email + Password */}
    <form className="space-y-2 relative z-10" onSubmit={handleSignIn}>
      <div>
        <label className="block text-sm text-gray-600">Your Email Address</label>
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
      </div>

      <button disabled={loading} className={`w-full mt-2 cursor-pointer rounded-lg bg-gradient-to-b from-gray-900 to-gray-700 py-2 text-white shadow
        ${loading ? 'from-gray-700 to-gray-500 cursor-not-allowed' : 'from-gray-900 to-gray-700 hover:opacity-90 cursor-pointer'}`}>
        { !loading ? "Sign in" : "Loading..."}
      </button>
    </form>

    {/* Footer */}
    <p className="mt-6 text-center text-sm text-gray-600 relative z-10">
      Don’t have an account?{" "}
      <button
        onClick={() => navigate("/signup")}
        className="font-semibold inline cursor-pointer text-black hover:underline"
      >
        Sign up
      </button>
    </p>
  </div>
</div>

  );
}
