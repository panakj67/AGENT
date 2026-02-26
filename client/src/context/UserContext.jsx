import axios from 'axios'
import React, { createContext, useEffect, useState } from 'react'

export const userDataContext = createContext()


axios.defaults.baseURL = "http://localhost:3000";
axios.defaults.withCredentials = true;

function UserContext({ children }) {
  const serverUrl = "http://localhost:8000"
  const [userData, setUserData] = useState(null)
  const [allChats, setAllChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
      const saved = localStorage.getItem("darkMode");
      return saved === "true" ? true : false; // convert string to boolean
    });
  

  const handleCurrentUser = async () => {
    setLoading(true);
    try {
      const result = await axios.get(`/api/user/current`, { withCredentials: true })
      setUserData(result.data)
      setAllChats(result.data.chats || []);
      // console.log(result.data.chats)
    } catch (error) {
      console.log(error)
    }finally{
      setLoading(false)
    }
  }

  // console.log(userData);

  const getGeminiResponse = async (command) => {
    try {
      const result = await axios.post(`/api/user/asktoassistant`, { command, user : userData?.name }, { withCredentials: true })
      return result.data
    } catch (error) {
      console.error(error?.response?.data || error.message);
      // Return a fallback response to avoid breaking the app
      return { response: "Error from Gemini API.", type: null, userInput: null };
    }
  }

  useEffect(() => {
    handleCurrentUser()
  }, [])

  const value = {
    serverUrl, allChats, setAllChats, loading, setLoading, darkMode, setDarkMode,
     userData, setUserData, getGeminiResponse
  }

  return (
    <div>
      <userDataContext.Provider value={value}>
        {children}
      </userDataContext.Provider>
    </div>
  )
}

export default UserContext
