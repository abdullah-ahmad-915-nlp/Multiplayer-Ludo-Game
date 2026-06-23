import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Home from './pages/Home'
import Leaderboard from './pages/Leaderboard'
import History from './pages/History'
import UpdateProfile from './pages/UpdateProfile'
import Lobby from './pages/Lobby'
import Game from './pages/Game'
import { BrowserRouter, Routes, Route } from "react-router-dom";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/home" element={<Home />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/history" element={<History />} />
        <Route path="/update-profile" element={<UpdateProfile />} />
        <Route path="/newgame/lobby" element={<Lobby />} />
        <Route path="/newgame/:gameId" element={<Game />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App
