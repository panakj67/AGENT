import React from 'react'
import Aura from '../assets/Aura.png'

const FreshChat = () => {
  return (
    <div className="flex flex-col items-center justify-center transform h-full px-4 sm:px-6 md:px-8">
            <img className="h-40 sm:h-32 md:h-48 lg:h-56 xl:h-64" src={Aura} alt="Aura" />
            <h1 className="text-3xl sm:text-2xl md:text-4xl font-semibold text-center mt-4">What can I help with?</h1>
    </div>
  )
}

export default FreshChat