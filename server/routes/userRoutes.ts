import express from "express";
import { getUserById, getHistoryForUser, getLeaderboard, updateUser } from "../controllers/userController.ts";

const router = express.Router();

router.get("/leaderboard", getLeaderboard);

router.get("/:id", getUserById);

router.get("/:id/history", getHistoryForUser);

router.put("/:id", updateUser);

export default router;
