import React from "react";

export function Card({ className = "", ...props }) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}
      {...props}
    />
  );
}

export function CardContent({ className = "", ...props }) {
  return <div className={`p-4 ${className}`} {...props} />;
}
