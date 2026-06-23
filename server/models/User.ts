import mongoose from "mongoose";

const userSchema = new mongoose.Schema ({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    dob: { type: Date, required: true },
    coins: { type: Number, default: 100 },
    total_played: { type: Number, default: 0 },
});

export const User = mongoose.model("User", userSchema);