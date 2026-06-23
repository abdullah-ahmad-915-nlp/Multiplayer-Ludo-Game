import type { Request, Response } from "express";
import { User } from "../models/User.ts";

export const login = async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: "Username and password are required" });
        }

        const user = await User.findOne({ username });
        if (!user || user.password !== password) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const token = `token_${user._id}`;

        res.status(200).json({
            message: "Login successful",
            token,
            userId: user._id,
            username: user.username,
        });
    }
    catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const signup = async (req: Request, res: Response) => {
    try {
        const { username , password, confirmPassword, dob } = req.body;

        if (!username || !password || !confirmPassword || !dob) {
            return res.status(400).json({ message: "All fields are required" });
        }

        if (password !== confirmPassword) {
            return res.status(401).json({ message: "Passwords do not match" });
        }

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(401).json({ message: "User already exists" });
        }

        const newUser = await User.create({
            username,
            password,
            dob
        });

        const token = `token_${newUser._id}`;

        res.status(200).json({
            message: "Signup successful",
            token,
            userId: newUser._id,
            username: newUser.username,
        });
        
    }
    catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({ message: "Server error" });
    }
};