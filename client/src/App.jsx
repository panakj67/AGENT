import React, { lazy, useContext } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import SignUp from './pages/SignUp'
import SignIn from './pages/SignIn'

import { userDataContext } from './context/UserContext'

const Home = lazy(
  () => import('./pages/Home')
)

import axios from 'axios'
import { Toaster} from 'react-hot-toast'
import { useEffect } from 'react'
import ProtectedRoute from './components/ProtectedRoute'

//axios.defaults.baseURL = "https://ai-powered-kxo1.onrender.com";
axios.defaults.baseURL = "http://localhost:3000";
axios.defaults.withCredentials = true;

function App() {
  const { userData, setUserData } = useContext(userDataContext)

  return (
    <>
      <Toaster />
      <Routes>
        <Route path='/' element={<ProtectedRoute element={<Home />}/>} />
        <Route path='/signup' element={!userData ? <SignUp /> : <Navigate to={"/"} />} />
        <Route path='/signin' element={!userData ? <SignIn /> : <Navigate to={"/"} />} />
      </Routes>
    </>
  );
}

export default App
