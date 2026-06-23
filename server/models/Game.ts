import mongoose from "mongoose";

const gameSchema = new mongoose.Schema ({
    total_players: { type: Number, required: true },
    players: [{
        user_id: mongoose.Schema.Types.ObjectId,
        username: String,
        color: { type: String, enum: ['red', 'blue', 'green', 'yellow'] },
        rank: Number,
        coins_earned: Number,
        tokens: { type: [Number], default: [-1, -1, -1, -1] }, // -1 = at home, 0..51 main track, 52..57 home stretch/finish
    }],
    status: { type: String, enum: ['waiting', 'playing', 'finished'],
    default: 'waiting' },
    turnIndex: { type: Number, default: 0 },
    currentRoll: { type: Number, default: null },
    moves: [{
        by: String,
        tokenIndex: Number,
        value: Number,
        at: Date,
        capture: { type: Boolean, default: false }
    }],
    started_at: Date,
    finished_at: Date,
});

export const Game = mongoose.model("Game", gameSchema);