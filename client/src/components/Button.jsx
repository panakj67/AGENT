import React from "react";

export function Button({ children, variant = "default", className = "", ...props }) {
  const base =
    "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

  const variants = {
    default: "bg-black text-white hover:bg-gray-800 focus:ring-black",
    outline:
      "border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 focus:ring-gray-200",
    ghost:
      "text-gray-600 hover:bg-gray-100 focus:ring-gray-200 dark:hover:bg-gray-800 dark:text-gray-300",
  };

  return (
    <button
      className={`${base} ${variants[variant]} px-4 py-2 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
