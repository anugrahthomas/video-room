import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from "./routes/Home";
import Room from "./routes/Room";
import { Toaster } from "react-hot-toast";



const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:id" element={<Room />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}
export default App;