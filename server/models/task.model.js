import mongoose from "mongoose"

const TaskSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true, 
    index: true 
  },
  userEmail: {
    type: String,
    required: true   // needed to send reminder email
  },
  title: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String,
    default: ""
  },
  dueAt: { 
    type: Date, 
    default: null    // null = no specific time
  },
  // For recurring tasks
  recurring: {
    type: String,
    enum: ["none", "daily", "weekly", "monthly"],
    default: "none"
  },
  recurringTime: {
    type: String,    // "08:00" for daily 8am
    default: null
  },
  // For condition based alerts e.g. Bitcoin below $60k
  condition: {
    type: String,
    default: null
  },
  completed: { 
    type: Boolean, 
    default: false 
  },
  notified: { 
    type: Boolean, 
    default: false 
  }
}, { timestamps: true })

export const Task = mongoose.model("Task", TaskSchema)