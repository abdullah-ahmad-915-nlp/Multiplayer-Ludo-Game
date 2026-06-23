import type { Request, Response } from "express";
import { User } from "../models/User.ts";
import { Game } from "../models/Game.ts";
import mongoose from "mongoose";

export const getUserById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid user id" });
        }

        const user = await User.findById(id).lean();
        if (!user) return res.status(404).json({ message: "User not found" });

        res.status(200).json({
            username: user.username,
            coins: user.coins ?? 0,
            total_played: user.total_played ?? 0,
            dob: user.dob,
            userId: user._id,
        });
    }
    catch (error) {
        console.error("getUserById error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const getHistoryForUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid user id" });
        }

        const games = await Game.find({ 'players.user_id': id, status: 'finished' }).sort({ finished_at: -1 }).lean();

        const history = games.map(g => {
            const player = (g.players || []).find((p: any) => String(p.user_id) === String(id));
            return {
                gameId: g._id,
                finishedAt: g.finished_at,
                totalPlayers: g.total_players,
                players: g.players?.map((p: any) => `${p.username} (${p.color})`) || [],
                rank: player?.rank ?? null,
                coinsEarned: player?.coins_earned ?? 0,
            };
        });

        res.status(200).json({ history });
    }
    catch (error) {
        console.error("getHistoryForUser error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const getLeaderboard = async (_req: Request, res: Response) => {
    try {
        const top = await User.find().sort({ coins: -1 }).limit(10).lean();
        const list = top.map(u => ({ username: u.username, coins: u.coins ?? 0, total_played: u.total_played ?? 0 }));
        res.status(200).json({ leaderboard: list });
    }
    catch (error) {
        console.error("getLeaderboard error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const updateUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid user id" });
        }

        const { dob, currentPassword, newPassword, confirmPassword } = req.body;

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: "User not found" });

        // If changing password, validate current and confirm
        if (newPassword || confirmPassword) {
            if (!currentPassword) {
                return res.status(400).json({ message: "Current password required to change password" });
            }
            if (user.password !== currentPassword) {
                return res.status(401).json({ message: "Current password is incorrect" });
            }
            if (newPassword !== confirmPassword) {
                return res.status(400).json({ message: "New passwords do not match" });
            }
            user.password = newPassword;
        }

        if (dob) {
            user.dob = new Date(dob);
        }

        await user.save();

        res.status(200).json({ message: "Profile updated", userId: user._id });
    }
    catch (error) {
        console.error("updateUser error:", error);
        res.status(500).json({ message: "Server error" });
    }
};